import logging
import urllib.request
from datetime import date, timedelta

import pandas as pd
import requests
import yfinance as yf

# Periodos que yfinance no reconoce nativamente → los convertimos a start date
_CUSTOM_PERIOD_YEARS: dict[str, int] = {
    "15y": 15,
    "20y": 20,
    "25y": 25,
}

from app.core.config import settings

logger = logging.getLogger(__name__)


class DataSourceError(Exception):
    """Se lanza cuando todas las fuentes de datos fallan."""


class MarketDataConnector:
    def get_historical_prices(
        self,
        ticker: str,
        period: str = "1y",
        start: str | None = None,
        end: str | None = None,
    ) -> pd.DataFrame:
        """
        Devuelve DataFrame con columnas [fecha, valor_liquidativo].
        Si se proporcionan start/end, tienen precedencia sobre period.
        Intenta yfinance primero; si falla, Alpha Vantage como fallback.
        """
        logger.info("Descargando precios para %s (periodo %s, start=%s, end=%s)...", ticker, period, start, end)
        try:
            return self._from_yfinance(ticker, period, start, end)
        except Exception as exc:
            logger.warning("yfinance falló para %s: %s. Probando Alpha Vantage...", ticker, exc)

        try:
            return self._from_alpha_vantage(ticker)
        except DataSourceError:
            raise
        except Exception as exc:
            logger.error("Alpha Vantage también falló para %s: %s", ticker, exc)

        raise DataSourceError(
            f"No se pudieron obtener datos para '{ticker}' desde ninguna fuente."
        )

    def _from_yfinance(self, ticker: str, period: str, start: str | None = None, end: str | None = None) -> pd.DataFrame:
        data = self._yf_history(ticker, period, start, end, auto_adjust=True)
        df = data[["Close"]].reset_index()
        df.columns = ["fecha", "valor_liquidativo"]
        df["fecha"] = pd.to_datetime(df["fecha"]).dt.date
        return df.dropna()

    def get_historical_full(
        self,
        ticker: str,
        period: str = "1y",
        start: str | None = None,
        end: str | None = None,
    ) -> pd.DataFrame:
        """
        Devuelve DataFrame con [fecha, precio, precio_total_return, dividendo].
        - precio: ajustado por splits, NO por dividendos (price return puro).
        - precio_total_return: ajustado por splits Y dividendos reinvertidos.
        - dividendo: dividendo en bruto pagado ese día (0 si no hay).

        Solo usa yfinance (Alpha Vantage no expone dividendos).
        """
        logger.info("Descargando precios+dividendos para %s (periodo %s, start=%s, end=%s)...", ticker, period, start, end)
        data = self._yf_history(ticker, period, start, end, auto_adjust=False)
        # Con auto_adjust=False: Close = split-adjusted, Adj Close = split+dividend adjusted
        cols = ["Close", "Adj Close"]
        if "Dividends" in data.columns:
            cols.append("Dividends")
        df = data[cols].reset_index()
        rename = {"Close": "precio", "Adj Close": "precio_total_return", "Dividends": "dividendo"}
        df = df.rename(columns=rename)
        df = df.rename(columns={df.columns[0]: "fecha"})
        df["fecha"] = pd.to_datetime(df["fecha"]).dt.date
        if "dividendo" not in df.columns:
            df["dividendo"] = 0.0
        df["dividendo"] = df["dividendo"].fillna(0.0)
        return df.dropna(subset=["precio", "precio_total_return"])

    def _yf_history(
        self,
        ticker: str,
        period: str,
        start: str | None,
        end: str | None,
        auto_adjust: bool,
    ) -> pd.DataFrame:
        """Wrapper común para yfinance.history() con headers + manejo de periodos custom."""
        yf.set_tz_cache_location("/tmp")
        opener = urllib.request.build_opener()
        opener.addheaders = [
            ("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        ]
        urllib.request.install_opener(opener)
        ticker_obj = yf.Ticker(ticker)
        if start:
            kwargs = {"start": start, "auto_adjust": auto_adjust}
            if end:
                kwargs["end"] = end
            data = ticker_obj.history(**kwargs)
        elif period in _CUSTOM_PERIOD_YEARS:
            computed_start = date.today() - timedelta(days=_CUSTOM_PERIOD_YEARS[period] * 365)
            data = ticker_obj.history(start=str(computed_start), auto_adjust=auto_adjust)
        else:
            data = ticker_obj.history(period=period, auto_adjust=auto_adjust)
        if data.empty:
            raise ValueError("yfinance devolvió datos vacíos")
        return data

    def _from_alpha_vantage(self, ticker: str) -> pd.DataFrame:
        if not settings.alpha_vantage_api_key:
            raise DataSourceError(
                f"No se pudieron obtener datos para '{ticker}': "
                "yfinance falló y ALPHA_VANTAGE_API_KEY no está configurada."
            )

        url = "https://www.alphavantage.co/query"
        params = {
            "function": "TIME_SERIES_DAILY",
            "symbol": ticker,
            "outputsize": "full",
            "apikey": settings.alpha_vantage_api_key,
        }
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        payload = resp.json()

        series = payload.get("Time Series (Daily)")
        if not series:
            raise ValueError(f"Respuesta inesperada de Alpha Vantage: {list(payload.keys())}")

        rows = [
            {"fecha": pd.to_datetime(date).date(), "valor_liquidativo": float(values["4. close"])}
            for date, values in series.items()
        ]
        return pd.DataFrame(rows).sort_values("fecha").reset_index(drop=True)
