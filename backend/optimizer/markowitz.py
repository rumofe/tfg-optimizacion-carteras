import logging

import numpy as np
import pandas as pd
from scipy.optimize import minimize

from etl.market_data import MarketDataConnector

logger = logging.getLogger(__name__)

RISK_FREE_RATE = 0.02  # 2% anual, tasa libre de riesgo
N_STARTS = 20          # puntos de inicio aleatorios para el multi-start

# Métodos de optimización soportados.
# - markowitz   : Mean-Variance clásico, max Sharpe con restricción de volatilidad
# - min_variance: Cartera de mínima varianza global (sin restricción de retorno)
# - risk_parity : Equal Risk Contribution (Maillard-Roncalli 2010)
# - equal_weight: Asignación 1/N (baseline ingenuo, paper Bessler-Wolff 2017)
METODOS_SOPORTADOS = ("markowitz", "min_variance", "risk_parity", "equal_weight")


class MarkowitzOptimizer:
    def __init__(self, tickers: list[str], period: str = "2y"):
        """
        Descarga precios históricos para todos los tickers y construye
        el DataFrame de retornos diarios.
        """
        connector = MarketDataConnector()
        prices: dict[str, pd.Series] = {}
        for ticker in tickers:
            df = connector.get_historical_prices(ticker, period)
            prices[ticker] = df.set_index("fecha")["valor_liquidativo"]

        price_df = pd.DataFrame(prices).dropna()
        self.tickers = list(price_df.columns)
        self.returns: pd.DataFrame = price_df.pct_change().dropna()

    def calcular_matriz_covarianza(self) -> pd.DataFrame:
        """Devuelve la matriz de covarianzas anualizada (× 252 días de trading)."""
        return self.returns.cov() * 252

    def _portfolio_vol(self, weights: np.ndarray, cov_matrix: np.ndarray) -> float:
        return float(np.sqrt(weights @ cov_matrix @ weights))

    def _min_varianza(self, cov_matrix: np.ndarray) -> np.ndarray:
        """Calcula los pesos del portfolio de mínima varianza global."""
        n = len(self.tickers)
        result = minimize(
            lambda w: self._portfolio_vol(w, cov_matrix),
            np.ones(n) / n,
            method="SLSQP",
            bounds=[(0.0, 1.0)] * n,
            constraints=[{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}],
            options={"ftol": 1e-12, "maxiter": 2000},
        )
        if result.success:
            return result.x
        # Fallback analítico si falla: equiponderado
        return np.ones(n) / n

    def _equal_weight(self) -> np.ndarray:
        """1/N portfolio (DeMiguel et al. 2009): baseline naive sin optimización."""
        n = len(self.tickers)
        return np.ones(n) / n

    def _risk_parity(self, cov_matrix: np.ndarray) -> np.ndarray:
        """
        Equal Risk Contribution (Maillard, Roncalli & Teïletche 2010).

        Cada activo aporta la misma contribución al riesgo total:
            RC_i = w_i · (Σw)_i / σ_p   ∀ i

        En vez de la formulación con división (numéricamente delicada),
        minimizamos la suma de cuadrados de diferencias entre las
        contribuciones marginales no normalizadas (w_i · (Σw)_i):

            f(w) = Σ_{i<j} ( w_i (Σw)_i − w_j (Σw)_j )²

        Solver: SLSQP con multi-start (equiponderado + 5 puntos dirichlet).
        Esta formulación equivale al método iterativo del paper original
        pero converge mejor con scipy.optimize.
        """
        n = len(self.tickers)

        def f(w: np.ndarray) -> float:
            sigma_w = cov_matrix @ w
            rc = w * sigma_w  # contribuciones marginales (sin normalizar)
            mean = rc.mean()
            return float(np.sum((rc - mean) ** 2))

        bounds = [(1e-6, 1.0)] * n  # evitamos w=0 que rompería derivabilidad
        constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]
        rng = np.random.default_rng(42)
        starts = [np.ones(n) / n] + [rng.dirichlet(np.ones(n)) for _ in range(5)]

        best = None
        for w0 in starts:
            res = minimize(
                f, w0, method="SLSQP",
                bounds=bounds, constraints=constraints,
                options={"ftol": 1e-12, "maxiter": 2000},
            )
            if res.success and (best is None or res.fun < best.fun):
                best = res
        if best is None:
            logger.warning("Risk parity: ningún start convergió, usando equiponderado.")
            return self._equal_weight()
        return best.x

    def _portfolio_sortino(self, weights: np.ndarray, mean_returns: np.ndarray) -> float:
        """
        Ratio de Sortino: penaliza solo la volatilidad bajista (retornos < 0).
        A diferencia del Sharpe, no penaliza las subidas.
        """
        port_ret_daily = self.returns.values @ weights
        ann_return = float(np.dot(weights, mean_returns))
        negatives = port_ret_daily[port_ret_daily < 0]
        if len(negatives) < 2:
            return 0.0
        downside_vol = float(np.std(negatives, ddof=1) * np.sqrt(252))
        if downside_vol < 1e-10:
            return 0.0
        return (ann_return - RISK_FREE_RATE) / downside_vol

    def frontera_pareto(self, n_puntos: int = 20) -> list[dict]:
        """
        Aproxima la frontera de Pareto en el espacio (Sharpe, Sortino).

        Idea: para θ ∈ [0,1] se maximiza la función escalarizada
            θ · Sharpe(w) + (1-θ) · Sortino(w)

        θ=1 → prioriza únicamente Sharpe (igual que el optimizador clásico).
        θ=0 → prioriza únicamente Sortino (solo castiga el riesgo bajista).
        θ intermedio → solución de compromiso en el frente de Pareto.

        Tras obtener los candidatos se filtran los dominados para devolver
        solo los portfolios que son inalcanzables en ambas métricas a la vez.
        """
        n = len(self.tickers)
        cov_matrix = self.calcular_matriz_covarianza().values
        mean_returns = self.returns.mean().values * 252
        bounds = [(0.0, 1.0)] * n
        constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]
        rng = np.random.default_rng(42)

        candidatos: list[dict] = []
        for theta in np.linspace(0.0, 1.0, n_puntos):
            def objetivo(w: np.ndarray, t: float = float(theta)) -> float:
                vol = self._portfolio_vol(w, cov_matrix)
                ann_ret = float(np.dot(w, mean_returns))
                sharpe  = (ann_ret - RISK_FREE_RATE) / vol if vol > 1e-10 else 0.0
                sortino = self._portfolio_sortino(w, mean_returns)
                return -(t * sharpe + (1.0 - t) * sortino)

            starts = [np.ones(n) / n] + [rng.dirichlet(np.ones(n)) for _ in range(5)]
            best = None
            for w0 in starts:
                try:
                    res = minimize(
                        objetivo, w0, method="SLSQP",
                        bounds=bounds, constraints=constraints,
                        options={"ftol": 1e-9, "maxiter": 500},
                    )
                    if res.success and (best is None or res.fun < best.fun):
                        best = res
                except Exception:
                    continue

            if best is not None:
                w = best.x
                vol     = self._portfolio_vol(w, cov_matrix)
                ann_ret = float(np.dot(w, mean_returns))
                sharpe  = (ann_ret - RISK_FREE_RATE) / vol if vol > 1e-10 else 0.0
                sortino = self._portfolio_sortino(w, mean_returns)
                candidatos.append({
                    "theta":       round(float(theta), 3),
                    "sharpe":      round(float(sharpe), 4),
                    "sortino":     round(float(sortino), 4),
                    "volatilidad": round(float(vol * 100), 3),
                    "retorno":     round(float(ann_ret * 100), 3),
                })

        # Filtrar dominados: un punto P es dominado si existe Q con
        # Q.sharpe >= P.sharpe AND Q.sortino >= P.sortino (al menos uno estricto)
        def dominado(p: dict, todos: list[dict]) -> bool:
            return any(
                q["sharpe"] >= p["sharpe"] and q["sortino"] >= p["sortino"]
                and (q["sharpe"] > p["sharpe"] or q["sortino"] > p["sortino"])
                for q in todos if q is not p
            )

        pareto = [p for p in candidatos if not dominado(p, candidatos)]
        return sorted(pareto, key=lambda x: x["sharpe"])

    def calcular_frontera(self, n_puntos: int = 50) -> list[dict]:
        """
        Calcula la Frontera Eficiente de Markowitz: para cada nivel de retorno
        objetivo, minimiza la volatilidad del portfolio.
        """
        n = len(self.tickers)
        cov_matrix = self.calcular_matriz_covarianza().values
        mean_returns = self.returns.mean().values * 252

        ret_min = float(np.min(mean_returns))
        ret_max = float(np.max(mean_returns))

        frontier = []
        for target in np.linspace(ret_min, ret_max, n_puntos):
            constraints = [
                {"type": "eq", "fun": lambda w: float(np.sum(w)) - 1.0},
                {"type": "eq", "fun": lambda w, t=target: float(np.dot(w, mean_returns)) - t},
            ]
            bounds = [(0.0, 1.0)] * n
            result = minimize(
                lambda w: self._portfolio_vol(w, cov_matrix),
                np.ones(n) / n,
                method="SLSQP",
                bounds=bounds,
                constraints=constraints,
                options={"ftol": 1e-9, "maxiter": 500},
            )
            if result.success:
                vol = self._portfolio_vol(result.x, cov_matrix)
                sharpe = (target - RISK_FREE_RATE) / vol if vol > 1e-10 else 0.0
                frontier.append({
                    "retorno": round(target * 100, 3),
                    "volatilidad": round(vol * 100, 3),
                    "sharpe": round(sharpe, 4),
                })

        return frontier

    def _max_sharpe(self, cov_matrix: np.ndarray, mean_returns: np.ndarray, max_volatilidad: float) -> np.ndarray:
        """
        Markowitz clásico: maximiza Sharpe Ratio con restricción de volatilidad.
        Multi-start SLSQP. Devuelve los pesos óptimos.
        """
        n = len(self.tickers)

        def neg_sharpe(weights: np.ndarray) -> float:
            port_return = float(np.dot(weights, mean_returns))
            port_vol = self._portfolio_vol(weights, cov_matrix)
            if port_vol < 1e-10:
                return 0.0
            return -(port_return - RISK_FREE_RATE) / port_vol

        constraints = [
            {"type": "eq",   "fun": lambda w: np.sum(w) - 1.0},
            {"type": "ineq", "fun": lambda w: max_volatilidad - self._portfolio_vol(w, cov_matrix)},
        ]
        bounds = [(0.0, 1.0)] * n

        rng = np.random.default_rng(42)
        starting_points = [np.ones(n) / n] + [
            rng.dirichlet(np.ones(n)) for _ in range(N_STARTS)
        ]

        best_result = None
        best_neg_sharpe = np.inf
        for w0 in starting_points:
            res = minimize(
                neg_sharpe, w0, method="SLSQP",
                bounds=bounds, constraints=constraints,
                options={"ftol": 1e-9, "maxiter": 1000},
            )
            if res.success and res.fun < best_neg_sharpe:
                best_neg_sharpe = res.fun
                best_result = res

        # Fallback: mínima varianza si no converge ningún start
        if best_result is None:
            logger.warning(
                "Multi-start falló para %s con max_vol=%.2f. Intentando mínima varianza.",
                self.tickers, max_volatilidad,
            )
            w_minvar = self._min_varianza(cov_matrix)
            min_vol = self._portfolio_vol(w_minvar, cov_matrix)
            if min_vol > max_volatilidad:
                raise ValueError(
                    f"La volatilidad mínima alcanzable con estos activos es "
                    f"{min_vol * 100:.1f}%, superior a tu restricción de "
                    f"{max_volatilidad * 100:.1f}%. Aumenta la volatilidad máxima "
                    f"o elige activos menos volátiles."
                )
            return w_minvar
        return best_result.x

    def optimizar(
        self,
        max_volatilidad: float,
        capital: float,
        metodo: str = "markowitz",
    ) -> dict:
        """
        Despacha el cálculo según el método de optimización elegido.

        Métodos:
          - 'markowitz':    max Sharpe con restricción de volatilidad (clásico)
          - 'min_variance': mínima varianza global (sin restricción de retorno)
          - 'risk_parity':  Equal Risk Contribution — cada activo aporta el mismo riesgo
          - 'equal_weight': 1/N — baseline naive sin optimización

        Devuelve siempre los mismos campos: pesos, retorno, volatilidad, sharpe,
        frontera eficiente y frontera de Pareto (estas últimas son del marco
        Markowitz, se incluyen como referencia).
        """
        if metodo not in METODOS_SOPORTADOS:
            raise ValueError(
                f"Método desconocido: '{metodo}'. Opciones: {METODOS_SOPORTADOS}"
            )

        cov_matrix = self.calcular_matriz_covarianza().values
        mean_returns = self.returns.mean().values * 252

        if metodo == "markowitz":
            weights = self._max_sharpe(cov_matrix, mean_returns, max_volatilidad)
        elif metodo == "min_variance":
            weights = self._min_varianza(cov_matrix)
        elif metodo == "risk_parity":
            weights = self._risk_parity(cov_matrix)
        elif metodo == "equal_weight":
            weights = self._equal_weight()
        else:  # pragma: no cover (controlado arriba)
            raise ValueError(metodo)

        port_return = float(np.dot(weights, mean_returns))
        port_vol = self._portfolio_vol(weights, cov_matrix)
        sharpe = (port_return - RISK_FREE_RATE) / port_vol if port_vol > 1e-10 else 0.0

        # Métricas adicionales útiles para comparar métodos
        # - Diversificación (Choueifaty): ratio entre vol ponderada y vol cartera
        individual_vols = np.sqrt(np.diag(cov_matrix))
        weighted_avg_vol = float(np.dot(weights, individual_vols))
        diversification_ratio = weighted_avg_vol / port_vol if port_vol > 1e-10 else 1.0
        # - Concentración (Herfindahl-Hirschman): 1/N ≤ HHI ≤ 1
        hhi = float(np.sum(weights ** 2))
        n_efectivos = 1.0 / hhi if hhi > 1e-10 else float(len(self.tickers))

        activos_info = {
            t: {
                "retorno_anualizado": round(float(r) * 100, 3),
                "volatilidad_anualizada": round(float(np.sqrt(cov_matrix[i][i])) * 100, 3),
            }
            for i, (t, r) in enumerate(zip(self.tickers, mean_returns))
        }

        return {
            "metodo": metodo,
            "pesos": {t: float(w) for t, w in zip(self.tickers, weights)},
            "retorno_esperado": port_return,
            "volatilidad": port_vol,
            "sharpe_ratio": float(sharpe),
            "diversification_ratio": round(float(diversification_ratio), 4),
            "concentracion_hhi": round(hhi, 4),
            "activos_efectivos": round(n_efectivos, 2),
            "activos_info": activos_info,
            "frontera": self.calcular_frontera(),
            "pareto": self.frontera_pareto(),
        }
