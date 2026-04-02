import logging

import numpy as np
import pandas as pd

from etl.market_data import MarketDataConnector

logger = logging.getLogger(__name__)

RISK_FREE_RATE = 0.02
CRISIS_PERIODS = {
    "covid": ("2020-02-19", "2020-03-23"),
    "lehman": ("2008-09-01", "2009-03-09"),
    "correccion_2022": ("2022-01-03", "2022-10-12"),
}


def _calcular_metricas(precio_serie: pd.Series) -> dict:
    """Calcula métricas estándar sobre una serie de precios indexada por fecha."""
    retornos = precio_serie.pct_change().dropna()
    rentabilidad_acumulada = float((precio_serie.iloc[-1] / precio_serie.iloc[0]) - 1)
    volatilidad = float(retornos.std() * np.sqrt(252))
    retorno_anualizado = float((1 + rentabilidad_acumulada) ** (252 / max(len(retornos), 1)) - 1)
    sharpe = (retorno_anualizado - RISK_FREE_RATE) / volatilidad if volatilidad > 1e-10 else 0.0

    # Max drawdown
    acumulado = (1 + retornos).cumprod()
    maximo_historico = acumulado.cummax()
    drawdown = (acumulado - maximo_historico) / maximo_historico
    max_drawdown = float(drawdown.min())

    return {
        "rentabilidad_acumulada": round(rentabilidad_acumulada * 100, 4),
        "volatilidad_anualizada": round(volatilidad * 100, 4),
        "sharpe_ratio": round(sharpe, 4),
        "max_drawdown": round(max_drawdown * 100, 4),
    }


class BacktestEngine:
    def __init__(self, tickers: list[str], pesos: dict[str, float], periodo: str = "5y"):
        connector = MarketDataConnector()

        precios: dict[str, pd.Series] = {}
        for ticker in tickers:
            df = connector.get_historical_prices(ticker, periodo)
            precios[ticker] = df.set_index("fecha")["valor_liquidativo"]

        df_spy = connector.get_historical_prices("SPY", periodo)
        precios["SPY"] = df_spy.set_index("fecha")["valor_liquidativo"]

        price_df = pd.DataFrame(precios).dropna()
        price_df.index = pd.to_datetime(price_df.index)
        price_df = price_df.sort_index()

        self.tickers = tickers
        self.pesos = pesos
        self.price_df = price_df

    def _cartera_precio_serie(self) -> pd.Series:
        """Construye la serie de precio de la cartera normalizando a base 100."""
        retornos = self.price_df[self.tickers].pct_change().dropna()
        retorno_cartera = sum(
            retornos[t] * self.pesos.get(t, 0.0) for t in self.tickers
        )
        precio_cartera = (1 + retorno_cartera).cumprod() * 100
        return precio_cartera

    def ejecutar(self) -> dict:
        precio_cartera = self._cartera_precio_serie()
        precio_spy = self.price_df["SPY"].loc[precio_cartera.index]
        precio_spy = precio_spy / precio_spy.iloc[0] * 100

        metricas = _calcular_metricas(precio_cartera)
        benchmark = _calcular_metricas(precio_spy)

        serie_temporal = [
            {
                "fecha": str(fecha.date()),
                "valor_cartera": round(float(vc), 4),
                "valor_benchmark": round(float(vb), 4),
            }
            for fecha, vc, vb in zip(
                precio_cartera.index, precio_cartera.values, precio_spy.values
            )
        ]

        return {
            "rentabilidad_acumulada": metricas["rentabilidad_acumulada"],
            "volatilidad_anualizada": metricas["volatilidad_anualizada"],
            "sharpe_ratio": metricas["sharpe_ratio"],
            "max_drawdown": metricas["max_drawdown"],
            "benchmark_rentabilidad": benchmark["rentabilidad_acumulada"],
            "serie_temporal": serie_temporal,
        }

    def analizar_crisis(self) -> dict:
        precio_cartera = self._cartera_precio_serie()
        precio_spy = self.price_df["SPY"].loc[precio_cartera.index]
        precio_spy = precio_spy / precio_spy.iloc[0] * 100

        resultado: dict[str, dict] = {}
        for nombre, (inicio, fin) in CRISIS_PERIODS.items():
            inicio_dt = pd.Timestamp(inicio)
            fin_dt = pd.Timestamp(fin)

            tramo_cartera = precio_cartera.loc[inicio_dt:fin_dt]
            tramo_spy = precio_spy.loc[inicio_dt:fin_dt]

            if tramo_cartera.empty:
                resultado[nombre] = {"disponible": False}
                continue

            metricas_cartera = _calcular_metricas(tramo_cartera)
            metricas_spy = _calcular_metricas(tramo_spy)

            resultado[nombre] = {
                "disponible": True,
                "periodo": {"inicio": inicio, "fin": fin},
                "cartera": metricas_cartera,
                "benchmark": metricas_spy,
            }

        return resultado
