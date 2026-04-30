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

# Frecuencias de rebalanceo soportadas: clave → freq de pandas para resample
_REBALANCING_FREQ: dict[str, str] = {
    "ninguno":    "",
    "anual":      "YE",
    "semestral":  "2QE",
    "trimestral": "QE",
    "mensual":    "ME",
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
        rebalanceo: str = "ninguno",
        comision_pct: float = 0.0,
    ):
        if rebalanceo not in _REBALANCING_FREQ:
            raise ValueError(
                f"Frecuencia de rebalanceo inválida: '{rebalanceo}'. "
                f"Opciones: {list(_REBALANCING_FREQ)}"
            )
        if comision_pct < 0 or comision_pct > 5:
            raise ValueError("La comisión debe estar entre 0 y 5 %.")

        self.rebalanceo = rebalanceo
        self.comision = comision_pct / 100.0
        connector = MarketDataConnector()

        precios_total: dict[str, pd.Series] = {}
        precios_solo: dict[str, pd.Series] = {}
        dividendos: dict[str, pd.Series] = {}
        for ticker in tickers:
            df_full = connector.get_historical_full(ticker, periodo, fecha_inicio, fecha_fin)
            df_full = df_full.set_index("fecha")
            precios_total[ticker] = df_full["precio_total_return"]
            precios_solo[ticker]  = df_full["precio"]
            dividendos[ticker]    = df_full["dividendo"]

        df_spy = connector.get_historical_prices("SPY", periodo, fecha_inicio, fecha_fin)
        precios_total["SPY"] = df_spy.set_index("fecha")["valor_liquidativo"]

        price_df = pd.DataFrame(precios_total).dropna()
        price_df.index = pd.to_datetime(price_df.index)
        price_df = price_df.sort_index()

        price_only_df = pd.DataFrame(precios_solo).dropna()
        price_only_df.index = pd.to_datetime(price_only_df.index)
        price_only_df = price_only_df.sort_index()

        div_df = pd.DataFrame(dividendos).fillna(0.0)
        div_df.index = pd.to_datetime(div_df.index)
        div_df = div_df.sort_index()

        self.tickers = tickers
        self.pesos = pesos
        self.price_df = price_df             # total return (incluye dividendos reinvertidos)
        self.price_only_df = price_only_df   # solo precio (sin dividendos)
        self.div_df = div_df                 # dividendos brutos pagados por acción

    def _serie_cartera_simple(self, df: pd.DataFrame) -> pd.Series:
        """Buy & hold: pondera retornos diarios sin rebalancear."""
        retornos = df[self.tickers].pct_change().dropna()
        retorno_cartera = sum(
            retornos[t] * self.pesos.get(t, 0.0) for t in self.tickers
        )
        return (1 + retorno_cartera).cumprod() * 100

    def _serie_cartera_rebalanceada(self, df: pd.DataFrame) -> tuple[pd.Series, list[dict]]:
        """
        Simula la cartera con rebalanceo periódico al peso objetivo y comisiones
        proporcionales al volumen rebalanceado.

        Modelo: en cada fecha de rebalanceo, los pesos efectivos vuelven al
        objetivo. La comisión se aplica como un haircut sobre el valor de la
        cartera proporcional al "turnover" (fracción de la cartera que cambia
        de manos).

        Returns
        -------
        (precio_cartera, eventos_rebalanceo)
            precio_cartera: pd.Series base 100
            eventos_rebalanceo: lista de {fecha, turnover, coste_pct}
        """
        precios = df[self.tickers].dropna()
        retornos = precios.pct_change().fillna(0.0)

        target = pd.Series(self.pesos, index=self.tickers)
        target = target / target.sum()

        # Días de rebalanceo según frecuencia. Resample devuelve etiqueta al final
        # del periodo; usamos esas fechas como "rebalanceo se hace el siguiente
        # día disponible".
        freq = _REBALANCING_FREQ[self.rebalanceo]
        if freq:
            marcadores = precios.resample(freq).last().index
            # Mapear cada marcador al primer día de cotización siguiente o igual
            indice = precios.index
            fechas_rebal = set()
            for m in marcadores:
                pos = indice.searchsorted(m)
                if pos < len(indice):
                    fechas_rebal.add(indice[pos])
            # No rebalancear el primer día (ya partimos en target)
            fechas_rebal.discard(indice[0])
        else:
            fechas_rebal = set()

        # Simulación día a día
        pesos = target.copy()
        valor = 100.0
        valores: list[float] = []
        eventos: list[dict] = []

        for fecha in precios.index:
            # 1) Aplicar retorno diario a cada ticker → pesos efectivos derivan
            r = retornos.loc[fecha]
            crecimiento = (pesos * (1 + r)).sum()
            valor *= float(crecimiento)
            pesos = (pesos * (1 + r)) / crecimiento

            # 2) Rebalanceo (al cierre de ese día)
            if fecha in fechas_rebal:
                turnover = float((pesos - target).abs().sum() / 2.0)
                coste = turnover * 2 * self.comision  # se vende y se compra
                valor *= (1 - coste)
                pesos = target.copy()
                if turnover > 1e-6:
                    eventos.append({
                        "fecha": str(fecha.date()) if hasattr(fecha, "date") else str(fecha),
                        "turnover": round(turnover, 4),
                        "coste_pct": round(coste * 100, 4),
                    })

            valores.append(valor)

        serie = pd.Series(valores, index=precios.index)
        return serie, eventos

    def _cartera_precio_serie(self) -> pd.Series:
        """Serie de la cartera en total return (con dividendos reinvertidos)."""
        if self.rebalanceo == "ninguno" and self.comision == 0:
            return self._serie_cartera_simple(self.price_df)
        serie, eventos = self._serie_cartera_rebalanceada(self.price_df)
        self._eventos_rebalanceo = eventos
        return serie

    def _cartera_precio_solo_serie(self) -> pd.Series:
        """Serie de la cartera solo precio (sin dividendos)."""
        if self.rebalanceo == "ninguno" and self.comision == 0:
            return self._serie_cartera_simple(self.price_only_df)
        serie, _ = self._serie_cartera_rebalanceada(self.price_only_df)
        return serie

    def _calcular_dividendos(self) -> dict:
        """
        Calcula la contribución de los dividendos a la rentabilidad de la cartera
        e ingresos anuales aproximados (€ por cada 100€ invertidos en t=0).
        """
        # Para cada ticker, dividendos relativos al precio inicial de su período
        if self.price_only_df.empty:
            return {
                "ingresos_anuales": [],
                "yield_promedio_anual": 0.0,
                "ingresos_totales": 0.0,
            }

        precio_inicial = self.price_only_df.iloc[0]
        # dividendos por euro invertido en t=0, por ticker
        div_por_euro = self.div_df.divide(precio_inicial, axis=1).fillna(0.0)

        # Suma ponderada por pesos → dividendos por euro invertido en cartera (en %)
        peso_serie = pd.Series(self.pesos)
        div_cartera = div_por_euro[self.tickers].multiply(peso_serie, axis=1).sum(axis=1)
        # Convertir a € por cada 100€ invertidos
        div_cartera_por_100 = div_cartera * 100

        # Agrupar por año
        div_anuales = div_cartera_por_100.groupby(div_cartera_por_100.index.year).sum()
        ingresos_anuales = [
            {"año": int(año), "importe_por_100": round(float(imp), 4)}
            for año, imp in div_anuales.items()
            if imp > 0
        ]

        ingresos_totales = float(div_cartera_por_100.sum())
        # Yield promedio anual = ingresos totales / nº años
        n_dias = len(self.price_only_df)
        n_años = max(n_dias / 252.0, 1.0)
        yield_promedio = ingresos_totales / n_años  # ya en € por 100€ ⇒ es %

        return {
            "ingresos_anuales": ingresos_anuales,
            "yield_promedio_anual": round(yield_promedio, 4),
            "ingresos_totales": round(ingresos_totales, 4),
        }

    def ejecutar(self) -> dict:
        self._eventos_rebalanceo: list[dict] = []
        precio_cartera = self._cartera_precio_serie()
        precio_cartera_solo = self._cartera_precio_solo_serie()
        precio_spy = self.price_df["SPY"].loc[precio_cartera.index]
        precio_spy_norm = precio_spy / precio_spy.iloc[0] * 100

        metricas = _calcular_metricas(precio_cartera, benchmark_serie=precio_spy_norm)
        benchmark = _calcular_metricas(precio_spy_norm)

        # Descomposición precio vs dividendos
        rent_total  = metricas["rentabilidad_acumulada"]  # ya en %
        rent_precio_acum = float((precio_cartera_solo.iloc[-1] / precio_cartera_solo.iloc[0]) - 1) * 100
        rent_dividendos  = round(rent_total - rent_precio_acum, 4)

        info_dividendos = self._calcular_dividendos()

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

        eventos = getattr(self, "_eventos_rebalanceo", [])
        coste_total_pct = round(sum(e["coste_pct"] for e in eventos), 4)
        rebalanceo_info = {
            "frecuencia": self.rebalanceo,
            "comision_pct": round(self.comision * 100, 4),
            "n_rebalanceos": len(eventos),
            "coste_total_pct": coste_total_pct,
            "eventos": eventos[-12:],  # últimos 12 para no saturar payload
        }

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
            "descomposicion": {
                "rentabilidad_precio": round(rent_precio_acum, 4),
                "rentabilidad_dividendos": rent_dividendos,
                "rentabilidad_total": rent_total,
            },
            "dividendos": info_dividendos,
            "rebalanceo": rebalanceo_info,
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
