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


def _calcular_metricas(precio_serie: pd.Series, benchmark_serie: pd.Series | None = None) -> dict:
    """
    Calcula métricas estándar sobre una serie de precios indexada por fecha.
    Si se proporciona benchmark_serie, calcula también Beta respecto a él.
    """
    retornos = precio_serie.pct_change().dropna()
    rentabilidad_acumulada = float((precio_serie.iloc[-1] / precio_serie.iloc[0]) - 1)
    n_dias = max(len(retornos), 1)
    volatilidad = float(retornos.std() * np.sqrt(252))
    retorno_anualizado = float((1 + rentabilidad_acumulada) ** (252 / n_dias) - 1)
    sharpe = (retorno_anualizado - RISK_FREE_RATE) / volatilidad if volatilidad > 1e-10 else 0.0

    # Max drawdown
    acumulado = (1 + retornos).cumprod()
    maximo_historico = acumulado.cummax()
    drawdown = (acumulado - maximo_historico) / maximo_historico
    max_drawdown = float(drawdown.min())

    # Sortino ratio: sólo penaliza la volatilidad bajista
    retornos_negativos = retornos[retornos < 0]
    downside_vol = float(retornos_negativos.std() * np.sqrt(252)) if len(retornos_negativos) > 1 else 1e-10
    sortino = (retorno_anualizado - RISK_FREE_RATE) / downside_vol if downside_vol > 1e-10 else 0.0

    # Calmar ratio: retorno anualizado / |max drawdown|
    calmar = retorno_anualizado / abs(max_drawdown) if abs(max_drawdown) > 1e-10 else 0.0

    resultado: dict = {
        "rentabilidad_acumulada": round(rentabilidad_acumulada * 100, 4),
        "retorno_anualizado": round(retorno_anualizado * 100, 4),
        "volatilidad_anualizada": round(volatilidad * 100, 4),
        "sharpe_ratio": round(sharpe, 4),
        "sortino_ratio": round(sortino, 4),
        "calmar_ratio": round(calmar, 4),
        "max_drawdown": round(max_drawdown * 100, 4),
    }

    # Beta respecto al benchmark
    if benchmark_serie is not None:
        ret_bench = benchmark_serie.pct_change().dropna()
        ret_common = retornos.align(ret_bench, join="inner")[0]
        bench_common = ret_bench.align(retornos, join="inner")[0]
        if len(ret_common) > 2:
            cov = float(np.cov(ret_common.values, bench_common.values)[0][1])
            var_bench = float(np.var(bench_common.values, ddof=1))
            resultado["beta"] = round(cov / var_bench, 4) if var_bench > 1e-10 else 0.0
        else:
            resultado["beta"] = 0.0
    else:
        resultado["beta"] = None

    return resultado


class BacktestEngine:
    def __init__(
        self,
        tickers: list[str],
        pesos: dict[str, float],
        periodo: str = "5y",
        fecha_inicio: str | None = None,
        fecha_fin: str | None = None,
    ):
        connector = MarketDataConnector()

        precios: dict[str, pd.Series] = {}
        for ticker in tickers:
            df = connector.get_historical_prices(ticker, periodo, fecha_inicio, fecha_fin)
            precios[ticker] = df.set_index("fecha")["valor_liquidativo"]

        df_spy = connector.get_historical_prices("SPY", periodo, fecha_inicio, fecha_fin)
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
        precio_spy_norm = precio_spy / precio_spy.iloc[0] * 100

        metricas = _calcular_metricas(precio_cartera, benchmark_serie=precio_spy_norm)
        benchmark = _calcular_metricas(precio_spy_norm)

        serie_temporal = [
            {
                "fecha": str(fecha.date()),
                "valor_cartera": round(float(vc), 4),
                "valor_benchmark": round(float(vb), 4),
            }
            for fecha, vc, vb in zip(
                precio_cartera.index, precio_cartera.values, precio_spy_norm.values
            )
        ]

        return {
            "rentabilidad_acumulada": metricas["rentabilidad_acumulada"],
            "retorno_anualizado": metricas["retorno_anualizado"],
            "volatilidad_anualizada": metricas["volatilidad_anualizada"],
            "sharpe_ratio": metricas["sharpe_ratio"],
            "sortino_ratio": metricas["sortino_ratio"],
            "calmar_ratio": metricas["calmar_ratio"],
            "max_drawdown": metricas["max_drawdown"],
            "beta": metricas["beta"],
            "benchmark_rentabilidad": benchmark["rentabilidad_acumulada"],
            "benchmark_retorno_anualizado": benchmark["retorno_anualizado"],
            "serie_temporal": serie_temporal,
        }

    def analizar_crisis(self) -> dict:
        precio_cartera = self._cartera_precio_serie()
        precio_spy = self.price_df["SPY"].loc[precio_cartera.index]
        precio_spy_norm = precio_spy / precio_spy.iloc[0] * 100

        resultado: dict[str, dict] = {}
        for nombre, (inicio, fin) in CRISIS_PERIODS.items():
            inicio_dt = pd.Timestamp(inicio)
            fin_dt = pd.Timestamp(fin)

            tramo_cartera = precio_cartera.loc[inicio_dt:fin_dt]
            tramo_spy = precio_spy_norm.loc[inicio_dt:fin_dt]

            if tramo_cartera.empty or len(tramo_cartera) < 2:
                resultado[nombre] = {"disponible": False}
                continue

            metricas_cartera = _calcular_metricas(tramo_cartera, benchmark_serie=tramo_spy)
            metricas_spy = _calcular_metricas(tramo_spy)

            resultado[nombre] = {
                "disponible": True,
                "periodo": {"inicio": inicio, "fin": fin},
                "cartera": metricas_cartera,
                "benchmark": metricas_spy,
            }

        return resultado
