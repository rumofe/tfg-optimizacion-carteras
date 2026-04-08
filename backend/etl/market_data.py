import logging
import urllib.request

import pandas as pd
import requests
import yfinance as yf

from app.core.config import settings

logger = logging.getLogger(__name__)


class DataSourceError(Exception):
    """Se lanza cuando todas las fuentes de datos fallan."""


class MarketDataConnector:
    def get_historical_prices(self, ticker: str, period: str = "1y") -> pd.DataFrame:
        """
        Devuelve DataFrame con columnas [fecha, valor_liquidativo].
        Intenta yfinance primero; si falla, Alpha Vantage como fallback.
        """
        logger.info("Descargando precios para %s (periodo %s)...", ticker, period)
        try:
            return self._from_yfinance(ticker, period)
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

    def _from_yfinance(self, ticker: str, period: str) -> pd.DataFrame:
        yf.set_tz_cache_location("/tmp")
        opener = urllib.request.build_opener()
        opener.addheaders = [
            ("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        ]
        urllib.request.install_opener(opener)
        data = yf.Ticker(ticker).history(period=period, auto_adjust=True)
        if data.empty:
            raise ValueError("yfinance devolvió datos vacíos")
        df = data[["Close"]].reset_index()
        df.columns = ["fecha", "valor_liquidativo"]
        df["fecha"] = pd.to_datetime(df["fecha"]).dt.date
        return df.dropna()

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
