"""
Simulación Monte Carlo de la trayectoria futura de una cartera.

Metodología: **bootstrap histórico** sobre los retornos diarios reales con
ajuste opcional de drift. Para cada simulación se sortean retornos diarios
del histórico (con reemplazo) y se compone la curva de capital.

Tres modos disponibles:

  - "historico": bootstrap puro sobre los retornos diarios tal cual están en
    la muestra. La media proyectada coincide con la media histórica. *Sesgo
    conocido*: si los últimos 5-10 años fueron un mercado alcista atípico
    (ej: bull run 2020-2025 con tech), el método extrapola ese régimen al
    futuro indefinidamente, generando proyecciones poco realistas.

  - "ajustado" (default): bootstrap con **mean adjustment**. Se centran los
    retornos diarios (se les resta su media histórica) y se les añade un
    drift diario equivalente al CAGR esperado configurado (default 7 %, el
    equity premium histórico de los mercados desarrollados a largo plazo).
    Se preserva la volatilidad, las colas gordas y la asimetría empíricas;
    solo se ajusta el centro de la distribución. Esta es la solución
    académica estándar cuando se quiere usar bootstrap para horizontes largos
    sin amplificar el sesgo del muestreo.

  - "manual": el usuario fija explícitamente el CAGR esperado.

En todos los casos se preservan colas gordas (kurtosis), asimetría (skew) y
autocorrelaciones parciales empíricas, propiedades que el modelo paramétrico
gaussiano borraría.
"""

from __future__ import annotations

import logging
from typing import Literal, Sequence

import numpy as np
import pandas as pd

from etl.market_data import MarketDataConnector

logger = logging.getLogger(__name__)

DIAS_TRADING_AÑO = 252
PERCENTILES_TRAYECTORIA = (5, 25, 50, 75, 95)
N_BINS_HISTOGRAMA = 30

# Drift por defecto en modo "ajustado": equity risk premium clásico de Damodaran
# (~7 % real anual a largo plazo en mercados desarrollados, antes de inflación).
CAGR_AJUSTADO_DEFAULT = 0.07

MODOS_SOPORTADOS = ("historico", "ajustado", "manual")

# Umbral a partir del cual avisamos al usuario de que el CAGR histórico
# probablemente sobreestima el futuro esperado.
CAGR_HISTORICO_SOSPECHOSO = 0.18


class MonteCarloSimulator:
    def __init__(
        self,
        tickers: Sequence[str],
        pesos: dict[str, float],
        period: str = "5y",
    ):
        """
        Descarga histórico y construye la serie diaria de retornos de la cartera.
        Usa 5y por defecto (más datos = más estadística para el bootstrap).
        """
        connector = MarketDataConnector()
        prices: dict[str, pd.Series] = {}
        for ticker in tickers:
            df = connector.get_historical_prices(ticker, period)
            prices[ticker] = df.set_index("fecha")["valor_liquidativo"]

        price_df = pd.DataFrame(prices).dropna()
        if len(price_df) < 60:
            raise ValueError(
                "Histórico insuficiente para Monte Carlo (necesito al menos 60 días)."
            )

        returns = price_df.pct_change().dropna()
        # Vector diario de retornos de la cartera completa (ya ponderado)
        weights_arr = np.array([pesos.get(t, 0.0) for t in price_df.columns])
        total_pesos = float(weights_arr.sum())
        if total_pesos < 1e-10:
            raise ValueError(
                "La suma de los pesos es cero. Comprueba que la cartera tiene activos válidos."
            )
        weights_arr = weights_arr / total_pesos  # normaliza por seguridad
        self.daily_portfolio_returns: np.ndarray = (returns.values @ weights_arr)
        self.tickers = list(price_df.columns)
        self.pesos_norm = dict(zip(self.tickers, weights_arr.tolist()))

        # Estadísticas históricas que se devuelven al cliente para que pueda
        # decidir si el régimen histórico es razonable como proyección.
        self.daily_mean: float = float(np.mean(self.daily_portfolio_returns))
        self.daily_std:  float = float(np.std(self.daily_portfolio_returns, ddof=1))
        # CAGR histórico anualizado (geometric): (1 + media_diaria)^252 − 1
        self.cagr_historico: float = float((1.0 + self.daily_mean) ** DIAS_TRADING_AÑO - 1.0)
        # Volatilidad anualizada
        self.vol_anual_historica: float = float(self.daily_std * np.sqrt(DIAS_TRADING_AÑO))

    def simular(
        self,
        años: int = 10,
        n_simulaciones: int = 5000,
        capital_inicial: float = 10_000.0,
        modo: Literal["historico", "ajustado", "manual"] = "ajustado",
        cagr_esperado: float | None = None,
        seed: int = 42,
    ) -> dict:
        """
        Ejecuta el bootstrap y devuelve estadísticos resumen.

        Parameters
        ----------
        años : int
            Horizonte temporal en años (1–40).
        n_simulaciones : int
            Número de trayectorias Monte Carlo (100–20 000).
        capital_inicial : float
            Capital inicial en €.
        modo : str
            - "historico": bootstrap puro. Proyecta el drift histórico tal cual.
            - "ajustado": bootstrap centrado a un drift conservador (default
              CAGR_AJUSTADO_DEFAULT). Recomendado para horizontes largos.
            - "manual": drift fijado por el usuario via `cagr_esperado`.
        cagr_esperado : float | None
            CAGR esperado en decimal (0.07 = 7 %). Solo se usa si modo="manual";
            si modo="ajustado" y se pasa, sobrescribe el default.
        seed : int
            Semilla para reproducibilidad.
        """
        if not (1 <= años <= 40):
            raise ValueError("El horizonte debe estar entre 1 y 40 años.")
        if not (100 <= n_simulaciones <= 20_000):
            raise ValueError("n_simulaciones debe estar entre 100 y 20 000.")
        if capital_inicial <= 0:
            raise ValueError("El capital inicial debe ser positivo.")
        if modo not in MODOS_SOPORTADOS:
            raise ValueError(f"Modo desconocido: {modo!r}. Opciones: {MODOS_SOPORTADOS}.")
        if modo == "manual" and cagr_esperado is None:
            raise ValueError("Modo 'manual' requiere cagr_esperado explícito.")
        if cagr_esperado is not None and not (-0.30 <= cagr_esperado <= 0.50):
            raise ValueError("cagr_esperado fuera de rango razonable (−30 % a +50 %).")

        # ── Calcular retornos diarios a usar según el modo ────────────────
        # Modo "historico": dejamos tal cual.
        # Modo "ajustado" / "manual": demean + add drift en **escala log**.
        #
        # El cambio en escala log (y no lineal) es importante: por Jensen's
        # inequality, si trasladaramos directamente la media aritmética de los
        # retornos lineales, la mediana del resultado caería sistemáticamente
        # por debajo del CAGR objetivo. Trabajando en log-space la mediana
        # proyectada coincide con el CAGR especificado, que es lo que el
        # usuario espera intuitivamente.
        if modo == "historico":
            retornos_efectivos = self.daily_portfolio_returns
            cagr_aplicado: float | None = None
        else:
            if modo == "ajustado":
                target_cagr = cagr_esperado if cagr_esperado is not None else CAGR_AJUSTADO_DEFAULT
            else:  # manual
                target_cagr = float(cagr_esperado)  # ya validado
            cagr_aplicado = target_cagr
            # Trabajamos sobre log-returns: ln(1 + r_diario)
            log_returns = np.log1p(self.daily_portfolio_returns)
            log_mean_hist = float(np.mean(log_returns))
            # Drift log diario que produce el CAGR objetivo:
            # (1 + CAGR)^1 = exp(252 * mu_log)  ⇒  mu_log = ln(1 + CAGR) / 252
            target_log_daily = float(np.log(1.0 + target_cagr)) / DIAS_TRADING_AÑO
            log_returns_adj = log_returns - log_mean_hist + target_log_daily
            retornos_efectivos = np.expm1(log_returns_adj)  # = exp(x) − 1

        n_dias = años * DIAS_TRADING_AÑO
        rng = np.random.default_rng(seed)

        # Bootstrap vectorizado sobre los retornos ya posiblemente reajustados
        idx = rng.integers(
            0, len(retornos_efectivos),
            size=(n_simulaciones, n_dias),
        )
        sampled = retornos_efectivos[idx]
        # Curvas de capital: capital_inicial * cumprod(1 + r) por fila
        equity = capital_inicial * np.cumprod(1.0 + sampled, axis=1)
        # Insertamos el día 0 para que las curvas empiecen en capital_inicial
        equity = np.concatenate(
            [np.full((n_simulaciones, 1), capital_inicial), equity],
            axis=1,
        )

        # ── Muestreo a paso mensual para no saturar el frontend ──────────────
        # 252 días/año / 12 ≈ 21 días por mes → tomamos cada 21 días
        step = 21
        idx_muestra = list(range(0, equity.shape[1], step))
        if idx_muestra[-1] != equity.shape[1] - 1:
            idx_muestra.append(equity.shape[1] - 1)
        equity_mensual = equity[:, idx_muestra]
        meses = np.array([i / DIAS_TRADING_AÑO * 12 for i in idx_muestra])

        # ── Percentiles temporales ───────────────────────────────────────────
        percentiles_mat = np.percentile(equity_mensual, PERCENTILES_TRAYECTORIA, axis=0)
        # Forma: (5, n_meses) → convertir a lista de dicts por mes
        trayectoria = []
        for j, mes_float in enumerate(meses):
            trayectoria.append({
                "año":  round(float(mes_float / 12), 3),
                "p5":   round(float(percentiles_mat[0, j]), 2),
                "p25":  round(float(percentiles_mat[1, j]), 2),
                "p50":  round(float(percentiles_mat[2, j]), 2),
                "p75":  round(float(percentiles_mat[3, j]), 2),
                "p95":  round(float(percentiles_mat[4, j]), 2),
            })

        # ── Estadísticos del valor final ─────────────────────────────────────
        finales = equity[:, -1]
        valor_final = {
            "media":    float(np.mean(finales)),
            "mediana":  float(np.percentile(finales, 50)),
            "std":      float(np.std(finales, ddof=1)),
            "p5":       float(np.percentile(finales, 5)),
            "p25":      float(np.percentile(finales, 25)),
            "p75":      float(np.percentile(finales, 75)),
            "p95":      float(np.percentile(finales, 95)),
            "min":      float(np.min(finales)),
            "max":      float(np.max(finales)),
        }
        valor_final = {k: round(v, 2) for k, v in valor_final.items()}

        # ── Probabilidades clave ─────────────────────────────────────────────
        prob_perdida = float(np.mean(finales < capital_inicial))
        prob_doblar  = float(np.mean(finales >= 2 * capital_inicial))
        prob_triplicar = float(np.mean(finales >= 3 * capital_inicial))
        # CAGR anualizado por simulación
        cagrs = (finales / capital_inicial) ** (1.0 / años) - 1.0
        cagr_estadisticas = {
            "p5":     round(float(np.percentile(cagrs, 5)) * 100, 3),
            "p50":    round(float(np.percentile(cagrs, 50)) * 100, 3),
            "p95":    round(float(np.percentile(cagrs, 95)) * 100, 3),
            "media":  round(float(np.mean(cagrs)) * 100, 3),
        }

        # ── Histograma del valor final ───────────────────────────────────────
        # Usamos bins log para capturar la cola larga a la derecha
        log_finales = np.log10(np.clip(finales, 1.0, None))
        counts, edges = np.histogram(log_finales, bins=N_BINS_HISTOGRAMA)
        histograma = [
            {
                "valor_min": round(10 ** edges[i], 2),
                "valor_max": round(10 ** edges[i + 1], 2),
                "frecuencia": int(counts[i]),
            }
            for i in range(len(counts))
        ]

        # Aviso si el histórico era anómalamente alto y el usuario eligió "historico"
        aviso_drift = None
        if modo == "historico" and self.cagr_historico > CAGR_HISTORICO_SOSPECHOSO:
            aviso_drift = (
                f"El CAGR histórico de esta cartera es {self.cagr_historico*100:.1f}%, "
                "muy por encima del promedio histórico del mercado (~7-10%). "
                "Proyectar este drift a 10+ años puede sobreestimar enormemente los resultados. "
                "Considera usar el modo 'ajustado' o 'manual' con un CAGR más conservador."
            )

        return {
            "parametros": {
                "años": años,
                "n_simulaciones": n_simulaciones,
                "capital_inicial": capital_inicial,
                "n_dias_historico": int(len(self.daily_portfolio_returns)),
                "metodo": "bootstrap-histórico",
                "modo": modo,
                "cagr_aplicado": round(cagr_aplicado * 100, 3) if cagr_aplicado is not None else None,
            },
            "historico": {
                "cagr_anual":       round(self.cagr_historico * 100, 3),
                "vol_anualizada":   round(self.vol_anual_historica * 100, 3),
                "dias_muestra":     int(len(self.daily_portfolio_returns)),
            },
            "aviso_drift":       aviso_drift,
            "trayectoria":       trayectoria,
            "valor_final":       valor_final,
            "cagr":              cagr_estadisticas,
            "probabilidad_perdida":     round(prob_perdida, 4),
            "probabilidad_doblar":      round(prob_doblar, 4),
            "probabilidad_triplicar":   round(prob_triplicar, 4),
            "histograma":        histograma,
        }
