import logging

import yfinance as yf
from fastapi import APIRouter, HTTPException, Query, status

from etl.market_data import DataSourceError, MarketDataConnector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assets", tags=["assets"])

_connector = MarketDataConnector()


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
        info = yf.Ticker(ticker_upper).info
    except Exception as exc:
        logger.error("Error obteniendo info para %s: %s", ticker_upper, exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    if not info or info.get("quoteType") is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró información para el ticker '{ticker_upper}'",
        )

    return {
        "ticker": ticker_upper,
        "nombre": info.get("longName") or info.get("shortName") or ticker_upper,
        "sector": info.get("sector") or info.get("fundFamily") or "Desconocido",
        "industria": info.get("industry") or info.get("category") or "Desconocido",
        "pais": info.get("country") or "Desconocido",
        "tipo": info.get("quoteType", "Desconocido"),
        "moneda": info.get("currency", "USD"),
    }
