import logging

import requests
import yfinance as yf
from fastapi import APIRouter, HTTPException, Query, status

from etl.market_data import DataSourceError, MarketDataConnector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assets", tags=["assets"])

_connector = MarketDataConnector()

# ─── Clasificación Morningstar ────────────────────────────────────────────────
_SECTOR_TO_TYPE: dict[str, str] = {
    "Basic Materials":        "Cyclical",
    "Consumer Cyclical":      "Cyclical",
    "Financial Services":     "Cyclical",
    "Real Estate":            "Cyclical",
    "Communication Services": "Sensitive",
    "Energy":                 "Sensitive",
    "Industrials":            "Sensitive",
    "Technology":             "Sensitive",
    "Consumer Defensive":     "Defensive",
    "Healthcare":             "Defensive",
    "Utilities":              "Defensive",
}


def _market_cap_cat(mc: float | None) -> str:
    if not mc:
        return "Desconocido"
    if mc >= 10_000_000_000:
        return "Large Cap"
    if mc >= 2_000_000_000:
        return "Mid Cap"
    return "Small Cap"


def _detectar_frecuencia_dividendos(dividends: "pd.Series") -> str:
    """
    Detecta la frecuencia de pago de dividendos a partir del histórico:
    mensual / trimestral / semestral / anual / irregular / ninguno.
    """
    if dividends is None or len(dividends) < 2:
        return "Ninguno" if dividends is None or len(dividends) == 0 else "Irregular"
    # Tomar últimos 4 años para evitar ruido por cambios históricos
    import pandas as pd
    cutoff = dividends.index.max() - pd.Timedelta(days=1460)
    recientes = dividends[dividends.index >= cutoff]
    if len(recientes) < 2:
        return "Irregular"
    # Diferencia media en días entre pagos
    dias_entre_pagos = recientes.index.to_series().diff().dt.days.dropna().mean()
    if dias_entre_pagos < 45:
        return "Mensual"
    if dias_entre_pagos < 120:
        return "Trimestral"
    if dias_entre_pagos < 240:
        return "Semestral"
    if dias_entre_pagos < 450:
        return "Anual"
    return "Irregular"


def _estilo_inversion(pe: float | None, pb: float | None) -> str:
    """Value/Blend/Growth basado en ratios P/E y P/B (método simplificado Morningstar)."""
    if pe is None and pb is None:
        return "Desconocido"
    score = 0
    if pe and pe > 0:
        if pe < 15:
            score -= 1
        elif pe > 25:
            score += 1
    if pb and pb > 0:
        if pb < 2:
            score -= 1
        elif pb > 4:
            score += 1
    if score <= -1:
        return "Value"
    if score >= 1:
        return "Growth"
    return "Blend"


@router.get("/search")
def search_assets(q: str = Query(..., min_length=1, description="Texto a buscar: ticker o nombre de empresa")):
    """
    Busca tickers en Yahoo Finance por símbolo o nombre de empresa.
    Devuelve hasta 8 resultados con ticker, nombre, tipo y exchange.
    """
    logger.info("GET /assets/search?q=%s", q)
    url = "https://query2.finance.yahoo.com/v1/finance/search"
    params = {
        "q": q,
        "lang": "en-US",
        "region": "US",
        "quotesCount": 8,
        "newsCount": 0,
        "enableFuzzyQuery": False,
        "enableCb": False,
    }
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=8)
        resp.raise_for_status()
        quotes = resp.json().get("quotes", [])
    except Exception as exc:
        logger.error("Error buscando '%s' en Yahoo Finance: %s", q, exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    # Filtrar opciones y resultados sin símbolo; priorizar EQUITY y ETF
    TIPOS_VALIDOS = {"EQUITY", "ETF", "MUTUALFUND", "INDEX"}
    return [
        {
            "ticker": item["symbol"],
            "nombre": item.get("longname") or item.get("shortname") or item["symbol"],
            "tipo": item.get("quoteType", ""),
            "exchange": item.get("exchange", ""),
        }
        for item in quotes
        if item.get("symbol") and item.get("quoteType") in TIPOS_VALIDOS
    ]


@router.get("/{ticker}/prices")
def get_prices(
    ticker: str,
    period: str = Query(default="1y", description="Periodo: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max"),
):
    ticker_upper = ticker.upper()
    logger.info("GET /assets/%s/prices (periodo=%s)", ticker_upper, period)
    try:
        df = _connector.get_historical_prices(ticker_upper, period)
    except DataSourceError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    return {
        "ticker": ticker_upper,
        "period": period,
        "prices": df.to_dict(orient="records"),
    }


@router.get("/{ticker}/info")
def get_info(ticker: str):
    """
    Devuelve metadatos del activo: nombre, sector, industria y país (via yfinance).
    Útil para el X-Ray sectorial de la cartera.
    """
    ticker_upper = ticker.upper()
    logger.info("GET /assets/%s/info", ticker_upper)
    try:
        ticker_obj = yf.Ticker(ticker_upper)
        info = ticker_obj.info
    except Exception as exc:
        logger.error("Error obteniendo info para %s: %s", ticker_upper, exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    if not info or info.get("quoteType") is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró información para el ticker '{ticker_upper}'",
        )

    market_cap  = info.get("marketCap")
    sector_str  = info.get("sector") or ""

    # Dividend yield: yfinance lo expone en distintos campos según el activo.
    # `dividendYield` viene como decimal (0.025) para acciones,
    # `yield` para ETFs/fondos. Normalizamos a porcentaje.
    raw_yield = (
        info.get("dividendYield")
        or info.get("trailingAnnualDividendYield")
        or info.get("yield")
    )
    if raw_yield is not None:
        # yfinance a veces devuelve ya en %, a veces como decimal. Heurística:
        dividend_yield = float(raw_yield) if raw_yield > 1 else float(raw_yield) * 100
        dividend_yield = round(dividend_yield, 4)
    else:
        dividend_yield = None

    # Frecuencia de pago: detectada del histórico de dividendos (más fiable que info)
    try:
        dividends = ticker_obj.dividends
        payout_frequency = _detectar_frecuencia_dividendos(dividends)
    except Exception:
        payout_frequency = "Desconocido"

    return {
        "ticker":              ticker_upper,
        "nombre":              info.get("longName") or info.get("shortName") or ticker_upper,
        "sector":              sector_str or info.get("fundFamily") or "Desconocido",
        "industria":           info.get("industry") or info.get("category") or "Desconocido",
        "pais":                info.get("country") or "Desconocido",
        "tipo":                info.get("quoteType", "Desconocido"),
        "moneda":              info.get("currency", "USD"),
        "market_cap":          market_cap,
        "market_cap_categoria": _market_cap_cat(market_cap),
        "estilo_inversion":    _estilo_inversion(info.get("trailingPE"), info.get("priceToBook")),
        "tipo_accion":         _SECTOR_TO_TYPE.get(sector_str, "Desconocido"),
        "dividend_yield":      dividend_yield,
        "payout_frequency":    payout_frequency,
    }
