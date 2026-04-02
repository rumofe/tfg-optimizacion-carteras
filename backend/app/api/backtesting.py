from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator

from backtesting.engine import BacktestEngine
from etl.market_data import DataSourceError

router = APIRouter(prefix="/backtesting", tags=["backtesting"])


class BacktestRequest(BaseModel):
    tickers: list[str]
    pesos: dict[str, float]
    periodo: str = "5y"

    @field_validator("pesos")
    @classmethod
    def pesos_suman_uno(cls, v: dict[str, float]) -> dict[str, float]:
        total = sum(v.values())
        if abs(total - 1.0) > 1e-4:
            raise ValueError(f"Los pesos deben sumar 1.0, suman {total:.4f}")
        return v

    @field_validator("tickers")
    @classmethod
    def al_menos_un_ticker(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("Se necesita al menos un ticker")
        return [t.upper() for t in v]


@router.post("/run")
def run_backtest(payload: BacktestRequest):
    """
    Ejecuta el backtest con pesos fijos para los tickers dados y devuelve
    métricas globales + análisis por periodos de crisis.
    """
    try:
        engine = BacktestEngine(
            tickers=payload.tickers,
            pesos=payload.pesos,
            periodo=payload.periodo,
        )
        resultado = engine.ejecutar()
        crisis = engine.analizar_crisis()
    except DataSourceError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return {**resultado, "crisis": crisis}
