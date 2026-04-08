import logging

import numpy as np
import pandas as pd
from scipy.optimize import minimize

from etl.market_data import MarketDataConnector

logger = logging.getLogger(__name__)

RISK_FREE_RATE = 0.02  # 2% anual, tasa libre de riesgo


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

    def calcular_frontera(self, n_puntos: int = 50) -> list[dict]:
        """
        Calcula la Frontera Eficiente de Markowitz: para cada nivel de retorno
        objetivo, minimiza la volatilidad del portfolio.
        Devuelve lista de {retorno, volatilidad, sharpe}.
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
                lambda w: float(np.sqrt(w @ cov_matrix @ w)),
                np.ones(n) / n,
                method="SLSQP",
                bounds=bounds,
                constraints=constraints,
                options={"ftol": 1e-9, "maxiter": 500},
            )
            if result.success:
                vol = float(np.sqrt(result.x @ cov_matrix @ result.x))
                sharpe = (target - RISK_FREE_RATE) / vol if vol > 1e-10 else 0.0
                frontier.append({
                    "retorno": round(target * 100, 3),
                    "volatilidad": round(vol * 100, 3),
                    "sharpe": round(sharpe, 4),
                })

        return frontier

    def optimizar(self, max_volatilidad: float, capital: float) -> dict:
        """
        Maximiza el Sharpe Ratio sujeto a:
          - suma de pesos = 1
          - todos los pesos en [0, 1]
          - volatilidad anualizada del portfolio <= max_volatilidad

        Devuelve dict con: pesos, retorno_esperado, volatilidad, sharpe_ratio, frontera.
        """
        n = len(self.tickers)
        cov_matrix = self.calcular_matriz_covarianza().values
        mean_returns = self.returns.mean().values * 252  # retornos anualizados

        def neg_sharpe(weights: np.ndarray) -> float:
            port_return = float(np.dot(weights, mean_returns))
            port_vol = float(np.sqrt(weights @ cov_matrix @ weights))
            if port_vol < 1e-10:
                return 0.0
            return -(port_return - RISK_FREE_RATE) / port_vol

        constraints = [
            {"type": "eq", "fun": lambda w: np.sum(w) - 1.0},
            {"type": "ineq", "fun": lambda w: max_volatilidad - np.sqrt(w @ cov_matrix @ w)},
        ]
        bounds = [(0.0, 1.0)] * n
        w0 = np.ones(n) / n  # pesos iniciales equiponderados

        result = minimize(
            neg_sharpe,
            w0,
            method="SLSQP",
            bounds=bounds,
            constraints=constraints,
            options={"ftol": 1e-9, "maxiter": 1000},
        )

        if not result.success:
            raise ValueError(f"La optimización no convergió: {result.message}")

        weights = result.x
        port_return = float(np.dot(weights, mean_returns))
        port_vol = float(np.sqrt(weights @ cov_matrix @ weights))
        sharpe = (port_return - RISK_FREE_RATE) / port_vol if port_vol > 1e-10 else 0.0

        # Calcular retornos anualizados individuales y volatilidades para el contexto
        activos_info = {
            t: {
                "retorno_anualizado": round(float(r) * 100, 3),
                "volatilidad_anualizada": round(float(np.sqrt(cov_matrix[i][i])) * 100, 3),
            }
            for i, (t, r) in enumerate(zip(self.tickers, mean_returns))
        }

        return {
            "pesos": {t: float(w) for t, w in zip(self.tickers, weights)},
            "retorno_esperado": port_return,
            "volatilidad": port_vol,
            "sharpe_ratio": float(sharpe),
            "activos_info": activos_info,
            "frontera": self.calcular_frontera(),
        }
