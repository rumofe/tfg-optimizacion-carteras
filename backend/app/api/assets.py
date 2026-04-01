from fastapi import APIRouter, HTTPException, Query, status

from etl.market_data import DataSourceError, MarketDataConnector

router = APIRouter(prefix="/assets", tags=["assets"])

_connector = MarketDataConnector()


@router.get("/{ticker}/prices")
def get_prices(
    ticker: str,
    period: str = Query(default="1y", description="Periodo: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max"),
):
    print(f"GET /assets/{ticker}/prices llamado")
    try:
        try:
            df = _connector.get_historical_prices(ticker.upper(), period)
        except DataSourceError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

        return {
            "ticker": ticker.upper(),
            "period": period,
            "prices": df.to_dict(orient="records"),
        }
    except Exception as e:
        print(f"Error inesperado: {e}")
        raise
