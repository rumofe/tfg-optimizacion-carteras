"""
Análisis del impacto fiscal sobre las inversiones según la legislación
española vigente (IRPF, base imponible del ahorro).

Aviso académico: este módulo es una **simplificación didáctica**. No tiene
en cuenta compensación de pérdidas, regla de los 2 meses para recompras,
tratamiento transfronterizo, ni casos especiales (CFDs, derivados,
fiscalidad foral). No constituye asesoramiento fiscal.

Modelo simplificado:

  - **ETF distributivo** (típico US, p. ej. SPY, BND): los dividendos se
    cobran cada año con retención del 19 % a cuenta del IRPF (luego se
    regulariza en la declaración). El capital reinvertido es menor → el
    interés compuesto trabaja sobre menos capital. Al final se tributan
    plusvalías sobre la diferencia (valor final − capital inicial − fee
    fiscal ya incluido en el camino).

  - **Fondo de Inversión / ETF acumulativo (UCITS)**: los dividendos se
    reinvierten dentro del producto sin pasar por el inversor. Solo se
    tributa al rescatar. Esto es el famoso "diferimiento fiscal" español.

Tramos IRPF aplicables a la base del ahorro (Ley 35/2006 con reformas):
  0 – 6 000 €    →  19 %
  6 000 – 50 000  →  21 %
  50 000 – 200 000 →  23 %
  200 000 – 300 000 →  27 %    (desde 2023)
  > 300 000      →  28 %       (desde 2025)
"""

from __future__ import annotations

from typing import Iterable

# Tramos: lista de (límite_superior_acumulado, tipo). El último tiene None como límite.
TRAMOS_IRPF_AHORRO: list[tuple[float | None, float]] = [
    (    6_000.0, 0.19),
    (   50_000.0, 0.21),
    (  200_000.0, 0.23),
    (  300_000.0, 0.27),
    (        None, 0.28),
]

RETENCION_DIVIDENDOS = 0.19  # retención a cuenta del IRPF cuando el ETF distribuye


def calcular_irpf_ahorro(base: float) -> dict:
    """
    Calcula el IRPF sobre la base imponible del ahorro aplicando los tramos.
    Devuelve total a pagar + desglose por tramo.
    """
    if base <= 0:
        return {"total": 0.0, "tipo_efectivo": 0.0, "desglose": []}

    desglose = []
    pagado = 0.0
    inicio = 0.0
    for limite, tipo in TRAMOS_IRPF_AHORRO:
        if limite is None:
            tramo_base = base - inicio
        else:
            tramo_base = min(base, limite) - inicio
        if tramo_base <= 0:
            break
        importe = tramo_base * tipo
        pagado += importe
        desglose.append({
            "desde":  round(inicio, 2),
            "hasta":  round(min(base, limite) if limite is not None else base, 2),
            "tipo":   tipo,
            "base":   round(tramo_base, 2),
            "cuota":  round(importe, 2),
        })
        if limite is None or base <= limite:
            break
        inicio = limite

    tipo_efectivo = pagado / base if base > 0 else 0.0
    return {
        "total":         round(pagado, 2),
        "tipo_efectivo": round(tipo_efectivo, 4),
        "desglose":      desglose,
    }


def _crecimiento_anual_compuesto(retorno_total_pct: float, años: int) -> float:
    """Convierte rentabilidad acumulada (%) en CAGR (decimal anual)."""
    return (1.0 + retorno_total_pct / 100.0) ** (1.0 / max(años, 1)) - 1.0


def simular_etf_distributivo(
    capital: float,
    años: int,
    cagr_total: float,
    yield_anual: float,
) -> dict:
    """
    Simula año a año un ETF que distribuye dividendos:
      1) Capital crece al CAGR de precio (cagr_total − yield).
      2) Cada año recibe dividendos = valor × yield. Se aplica retención 19 %.
         Lo que queda neto se reinvierte (asumimos que el inversor lo reinvierte).
      3) Al final, plusvalía = valor_final − capital_inicial. Tributa por tramos.
    """
    # CAGR de precio puro (sin dividendos)
    cagr_precio = max(cagr_total - yield_anual, -0.99)
    valor = capital
    retenciones_anuales = []
    dividendos_brutos_anuales = []

    for año in range(1, años + 1):
        # 1) Apreciación de precio
        valor *= (1.0 + cagr_precio)
        # 2) Dividendos sobre el valor antes de cobrarlos
        dividendo_bruto = valor * yield_anual
        retencion = dividendo_bruto * RETENCION_DIVIDENDOS
        # Asumimos: el inversor reinvierte el neto (broker low-cost, sin comisión)
        valor += dividendo_bruto - retencion
        # Pero el bruto ya entra en la base del año (la retención es a cuenta;
        # podría haber que pagar más si supera tramos, pero como simplificación
        # tratamos cada año independiente: 19 % es prácticamente final si la
        # base anual no supera 6 000 €).
        retenciones_anuales.append(retencion)
        dividendos_brutos_anuales.append(dividendo_bruto)

    total_dividendos_brutos = sum(dividendos_brutos_anuales)
    total_retenciones = sum(retenciones_anuales)
    total_netos_reinvertidos = total_dividendos_brutos - total_retenciones

    # 3) Plusvalía al rescatar.
    # El coste fiscal de adquisición incluye el capital inicial + los netos
    # reinvertidos (cada reinversión amplía la base de coste). Si no se ajusta,
    # se tributarían dos veces los dividendos: una en la retención anual y otra
    # como plusvalía al rescatar.
    coste_adquisicion = capital + total_netos_reinvertidos
    plusvalia = max(valor - coste_adquisicion, 0.0)
    irpf_plusvalia = calcular_irpf_ahorro(plusvalia)
    valor_final_neto = valor - irpf_plusvalia["total"]

    return {
        "vehiculo":              "etf_distributivo",
        "valor_final_bruto":     round(valor, 2),
        "valor_final_neto":      round(valor_final_neto, 2),
        "plusvalia":             round(plusvalia, 2),
        "irpf_plusvalia":        irpf_plusvalia,
        "dividendos_brutos":     round(total_dividendos_brutos, 2),
        "retenciones_anuales":   round(total_retenciones, 2),
        "irpf_total":            round(irpf_plusvalia["total"] + total_retenciones, 2),
    }


def simular_fondo_acumulativo(
    capital: float,
    años: int,
    cagr_total: float,
) -> dict:
    """
    Fondo de inversión o ETF UCITS acumulativo: todo se reinvierte dentro
    del producto, no hay flujos al inversor durante el horizonte.
    Tributa solo al rescatar sobre la plusvalía total.
    """
    valor = capital * (1.0 + cagr_total) ** años
    plusvalia = max(valor - capital, 0.0)
    irpf = calcular_irpf_ahorro(plusvalia)
    valor_final_neto = valor - irpf["total"]

    return {
        "vehiculo":          "fondo_acumulativo",
        "valor_final_bruto": round(valor, 2),
        "valor_final_neto":  round(valor_final_neto, 2),
        "plusvalia":         round(plusvalia, 2),
        "irpf_plusvalia":    irpf,
        "irpf_total":        irpf["total"],
    }


def comparar(
    capital: float,
    años: int,
    retorno_anualizado: float,
    yield_anual: float = 0.0,
) -> dict:
    """
    Compara ambos vehículos con los mismos parámetros de cartera.

    Parameters
    ----------
    capital : capital invertido inicialmente (€)
    años    : horizonte
    retorno_anualizado : CAGR total (incluyendo dividendos reinvertidos), decimal
    yield_anual        : porcentaje del retorno que viene en forma de dividendos
                         distribuidos en el ETF (decimal, p. ej. 0.025 para 2.5 %)
    """
    if capital <= 0:
        raise ValueError("El capital debe ser positivo.")
    if not (1 <= años <= 40):
        raise ValueError("El horizonte debe estar entre 1 y 40 años.")
    if retorno_anualizado < -0.99:
        raise ValueError("Retorno anualizado inválido.")
    if not (0 <= yield_anual <= 0.20):
        raise ValueError("El yield anual debe estar entre 0 % y 20 %.")

    etf  = simular_etf_distributivo(capital, años, retorno_anualizado, yield_anual)
    fondo = simular_fondo_acumulativo(capital, años, retorno_anualizado)

    diff_neto = fondo["valor_final_neto"] - etf["valor_final_neto"]
    pct_ahorro = (diff_neto / etf["valor_final_neto"] * 100) if etf["valor_final_neto"] > 0 else 0.0

    # Escenario teórico sin fiscalidad (referencia)
    bruto_teorico = capital * (1.0 + retorno_anualizado) ** años

    return {
        "parametros": {
            "capital":             round(capital, 2),
            "años":                años,
            "retorno_anualizado":  round(retorno_anualizado * 100, 4),
            "yield_anual":         round(yield_anual * 100, 4),
        },
        "bruto_teorico":   round(bruto_teorico, 2),
        "etf_distrib":     etf,
        "fondo_acum":      fondo,
        "diferimiento": {
            "ahorro_eur":      round(diff_neto, 2),
            "ahorro_pct":      round(pct_ahorro, 2),
            "irpf_etf":        etf["irpf_total"],
            "irpf_fondo":      fondo["irpf_total"],
        },
    }
