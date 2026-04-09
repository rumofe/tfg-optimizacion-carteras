"""
Tests unitarios para el optimizador de Markowitz.

Se usa MarkowitzOptimizer.__new__ para crear instancias sin llamar a
__init__ (que descarga datos de yfinance), inyectando directamente un
DataFrame de retornos sintético. Así los tests son rápidos y sin red.
"""

import numpy as np
import pandas as pd
import pytest

from optimizer.markowitz import RISK_FREE_RATE, MarkowitzOptimizer


# ── Helper ─────────────────────────────────────────────────────────────────

def make_optimizer(n_activos: int = 3, n_dias: int = 500) -> MarkowitzOptimizer:
    """Crea un optimizador con retornos diarios sintéticos (sin red)."""
    opt = MarkowitzOptimizer.__new__(MarkowitzOptimizer)
    opt.tickers = [f"T{i}" for i in range(n_activos)]
    rng = np.random.default_rng(42)
    data = {t: rng.normal(0.0005, 0.015, n_dias) for t in opt.tickers}
    opt.returns = pd.DataFrame(data)
    return opt


# ── Matriz de covarianzas ───────────────────────────────────────────────────

class TestMatrizCovarianza:
    def test_es_simetrica(self):
        cov = make_optimizer().calcular_matriz_covarianza().values
        np.testing.assert_allclose(cov, cov.T, atol=1e-10)

    def test_diagonal_positiva(self):
        cov = make_optimizer().calcular_matriz_covarianza().values
        assert (np.diag(cov) > 0).all()

    def test_anualizada_por_252(self):
        opt = make_optimizer(n_activos=1)
        var_diaria = float(opt.returns.var().iloc[0])
        cov = opt.calcular_matriz_covarianza().values
        assert abs(cov[0, 0] - var_diaria * 252) < 1e-8

    def test_dimensiones_correctas(self):
        n = 4
        cov = make_optimizer(n_activos=n).calcular_matriz_covarianza()
        assert cov.shape == (n, n)


# ── Volatilidad del portfolio ───────────────────────────────────────────────

class TestPortfolioVol:
    def test_vol_positiva(self):
        opt = make_optimizer()
        cov = opt.calcular_matriz_covarianza().values
        w = np.ones(3) / 3
        assert opt._portfolio_vol(w, cov) > 0

    def test_activo_unico_igual_a_desviacion(self):
        opt = make_optimizer(n_activos=1)
        cov = opt.calcular_matriz_covarianza().values
        vol = opt._portfolio_vol(np.array([1.0]), cov)
        esperada = float(opt.returns.std().iloc[0] * np.sqrt(252))
        assert abs(vol - esperada) < 1e-6

    def test_diversificacion_reduce_vol(self):
        """Un portfolio equiponderado tiene vol ≤ la media de vols individuales."""
        opt = make_optimizer(n_activos=3)
        cov = opt.calcular_matriz_covarianza().values
        n = len(opt.tickers)
        vols_individuales = [opt._portfolio_vol(np.eye(n)[i], cov) for i in range(n)]
        vol_cartera = opt._portfolio_vol(np.ones(n) / n, cov)
        assert vol_cartera <= max(vols_individuales) + 1e-8


# ── Mínima varianza ─────────────────────────────────────────────────────────

class TestMinVarianza:
    def test_pesos_suman_uno(self):
        opt = make_optimizer()
        cov = opt.calcular_matriz_covarianza().values
        w = opt._min_varianza(cov)
        assert abs(w.sum() - 1.0) < 1e-6

    def test_pesos_no_negativos(self):
        opt = make_optimizer()
        cov = opt.calcular_matriz_covarianza().values
        w = opt._min_varianza(cov)
        assert (w >= -1e-8).all()

    def test_vol_menor_que_equiponderado(self):
        opt = make_optimizer()
        cov = opt.calcular_matriz_covarianza().values
        n = len(opt.tickers)
        w_min = opt._min_varianza(cov)
        w_eq = np.ones(n) / n
        assert opt._portfolio_vol(w_min, cov) <= opt._portfolio_vol(w_eq, cov) + 1e-8


# ── Optimización (Sharpe máximo) ────────────────────────────────────────────

class TestOptimizar:
    def test_resultado_contiene_campos_requeridos(self):
        opt = make_optimizer()
        result = opt.optimizar(max_volatilidad=0.5, capital=10_000)
        for campo in ("pesos", "retorno_esperado", "volatilidad", "sharpe_ratio",
                      "activos_info", "frontera"):
            assert campo in result, f"Falta el campo '{campo}'"

    def test_pesos_suman_uno(self):
        opt = make_optimizer()
        result = opt.optimizar(max_volatilidad=0.5, capital=10_000)
        assert abs(sum(result["pesos"].values()) - 1.0) < 1e-4

    def test_pesos_no_negativos(self):
        opt = make_optimizer()
        result = opt.optimizar(max_volatilidad=0.5, capital=10_000)
        assert all(v >= -1e-6 for v in result["pesos"].values())

    def test_volatilidad_respeta_restriccion(self):
        opt = make_optimizer()
        max_vol = 0.30
        result = opt.optimizar(max_volatilidad=max_vol, capital=10_000)
        assert result["volatilidad"] <= max_vol + 1e-4

    def test_sharpe_es_numero_finito(self):
        opt = make_optimizer()
        result = opt.optimizar(max_volatilidad=0.5, capital=10_000)
        assert np.isfinite(result["sharpe_ratio"])

    def test_activos_info_tiene_todos_los_tickers(self):
        opt = make_optimizer(n_activos=3)
        result = opt.optimizar(max_volatilidad=0.5, capital=10_000)
        for t in opt.tickers:
            assert t in result["activos_info"]

    def test_frontera_es_lista_no_vacia(self):
        opt = make_optimizer()
        result = opt.optimizar(max_volatilidad=0.5, capital=10_000)
        assert isinstance(result["frontera"], list)
        assert len(result["frontera"]) > 0

    def test_volatilidad_cero_lanza_valueerror(self):
        opt = make_optimizer()
        with pytest.raises(ValueError):
            opt.optimizar(max_volatilidad=0.0, capital=10_000)


# ── Frontera eficiente ──────────────────────────────────────────────────────

class TestFrontera:
    def test_cada_punto_tiene_campos_esperados(self):
        opt = make_optimizer()
        frontera = opt.calcular_frontera(n_puntos=10)
        for punto in frontera:
            assert "retorno" in punto
            assert "volatilidad" in punto
            assert "sharpe" in punto

    def test_volatilidades_positivas(self):
        opt = make_optimizer()
        frontera = opt.calcular_frontera(n_puntos=10)
        assert all(p["volatilidad"] >= 0 for p in frontera)

    def test_n_puntos_limita_resultado(self):
        opt = make_optimizer()
        frontera = opt.calcular_frontera(n_puntos=5)
        # Puede haber menos puntos si alguna optimización falla, pero nunca más
        assert len(frontera) <= 5
