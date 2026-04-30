/**
 * Planificador financiero personal.
 *
 * Lógica pura (sin React) que dado el contexto financiero del inversor
 * calcula:
 *   - Fondo de emergencia recomendado.
 *   - Capital líquido invertible.
 *   - Asset allocation por clase (Cash / Bonds / Equity / Alternativos).
 *
 * Sirve de base teórica al "modo robo-advisor" del TFG. La construcción
 * combina tres heurísticas estándar de la literatura financiera:
 *
 *  1. Regla de Bogle/Vanguard del 110: %equity ≈ 110 − edad.
 *  2. Ajuste por perfil de riesgo (conservador/moderado/agresivo).
 *  3. Restricciones por horizonte temporal (corto/medio/largo plazo).
 */

export type Horizonte = 'corto' | 'medio' | 'largo' | 'muyLargo';
export type PerfilRiesgo = 'conservador' | 'moderado' | 'agresivo';

export interface PlannerInputs {
  liquidezDisponible: number;     // €  total que el inversor tiene en cuenta
  gastosMensuales:    number;     // €  gasto medio mensual
  mesesEmergencia:    number;     // típicamente 3, 6 o 12
  edad:               number;
  horizonte:          Horizonte;
  perfil:             PerfilRiesgo;
}

export interface AssetAllocation {
  cash:       number;  // %
  bonds:      number;
  equity:     number;
  realEstate: number;
  commodities: number;
}

export interface PlannerOutputs {
  fondoEmergencia:     number;     // € recomendado
  capitalInvertible:   number;     // € disponibles para invertir
  pctInvertible:       number;     // % sobre liquidez
  assetAllocation:     AssetAllocation;
  // Reparto en €:
  asignacionEur:       AssetAllocation;
  // Mensajes/avisos contextuales
  notas:               string[];
}

const HORIZONTE_CAP_EQUITY: Record<Horizonte, number> = {
  corto:    30,   // <2 años
  medio:    60,   // 2-5 años
  largo:    100,  // 5-10 años
  muyLargo: 100,  // +10 años (sin cap)
};

const HORIZONTE_BONUS_EQUITY: Record<Horizonte, number> = {
  corto:    -10,
  medio:    0,
  largo:    0,
  muyLargo: 5,
};

const PERFIL_AJUSTE_EQUITY: Record<PerfilRiesgo, number> = {
  conservador: -10,
  moderado:    0,
  agresivo:    10,
};

const HORIZONTE_LABEL: Record<Horizonte, string> = {
  corto:    '< 2 años',
  medio:    '2 – 5 años',
  largo:    '5 – 10 años',
  muyLargo: '+ 10 años',
};

/**
 * Calcula el % de equity aplicando regla del 110 + ajustes por perfil y horizonte.
 * Acotado entre 0 y el cap de horizonte.
 */
export function calcularPctEquity(
  edad: number,
  perfil: PerfilRiesgo,
  horizonte: Horizonte,
): number {
  const base       = Math.max(0, Math.min(100, 110 - edad));
  const conPerfil  = base + PERFIL_AJUSTE_EQUITY[perfil];
  const conHoriz   = conPerfil + HORIZONTE_BONUS_EQUITY[horizonte];
  const cap        = HORIZONTE_CAP_EQUITY[horizonte];
  return Math.max(0, Math.min(cap, conHoriz));
}

/**
 * Construye una asset allocation completa a partir del % de equity
 * y del perfil. La diferencia se reparte entre bonds, real estate y
 * commodities (pequeñas posiciones diversificadoras).
 */
export function construirAssetAllocation(
  pctEquity: number,
  perfil: PerfilRiesgo,
): AssetAllocation {
  const restoMacro = 100 - pctEquity;
  // Real estate y commodities son pequeñas posiciones diversificadoras.
  // El conservador prefiere todo bonds; el agresivo añade más alternativos.
  const pctRealEstate = perfil === 'agresivo' ? 5 : (perfil === 'moderado' ? 4 : 2);
  const pctCommodities = perfil === 'agresivo' ? 5 : (perfil === 'moderado' ? 3 : 2);
  // Si el resto es pequeño, comprimir alternativos
  const altsTotal = pctRealEstate + pctCommodities;
  const altsAjust = Math.min(altsTotal, restoMacro * 0.25);
  const pctRE_real = pctRealEstate * (altsAjust / Math.max(altsTotal, 0.01));
  const pctC_real  = pctCommodities * (altsAjust / Math.max(altsTotal, 0.01));
  const pctBonds   = restoMacro - pctRE_real - pctC_real;
  return {
    cash:        0,
    bonds:       round(pctBonds),
    equity:      round(pctEquity),
    realEstate:  round(pctRE_real),
    commodities: round(pctC_real),
  };
}

/** Calcula todo el plan financiero a partir de los inputs. */
export function calcularPlan(inputs: PlannerInputs): PlannerOutputs {
  const fondoEmergencia = Math.max(0, inputs.gastosMensuales * inputs.mesesEmergencia);
  const capitalInvertible = Math.max(0, inputs.liquidezDisponible - fondoEmergencia);
  const pctInvertible = inputs.liquidezDisponible > 0
    ? (capitalInvertible / inputs.liquidezDisponible) * 100
    : 0;

  const pctEquity = calcularPctEquity(inputs.edad, inputs.perfil, inputs.horizonte);
  const aa = construirAssetAllocation(pctEquity, inputs.perfil);

  // Asignación en € (sólo sobre el capital invertible; el efectivo de emergencia
  // queda fuera, en cuenta corriente o cuenta remunerada).
  const asignacionEur: AssetAllocation = {
    cash:        Math.round(fondoEmergencia),
    bonds:       Math.round(capitalInvertible * aa.bonds       / 100),
    equity:      Math.round(capitalInvertible * aa.equity      / 100),
    realEstate:  Math.round(capitalInvertible * aa.realEstate  / 100),
    commodities: Math.round(capitalInvertible * aa.commodities / 100),
  };

  // Avisos contextuales
  const notas: string[] = [];
  if (capitalInvertible <= 0) {
    notas.push('Tu liquidez actual no cubre el fondo de emergencia. Prioriza ahorrar antes de invertir.');
  }
  if (pctInvertible < 30 && capitalInvertible > 0) {
    notas.push('Más del 70 % de tu liquidez se queda como emergencia: es normal si tienes pocos meses ahorrados.');
  }
  if (inputs.horizonte === 'corto' && aa.equity > 30) {
    notas.push('Horizonte corto y mucho equity: vigila la volatilidad, podrías necesitar el dinero antes de un ciclo bajista.');
  }
  if (inputs.edad >= 60 && aa.equity > 60) {
    notas.push('A partir de los 60 conviene reducir progresivamente equity; revisa la regla del 110.');
  }
  if (inputs.perfil === 'conservador' && aa.equity > 40) {
    notas.push('Perfil conservador con equity elevado: ajusta la asignación o cambia tu tolerancia.');
  }

  return {
    fondoEmergencia: Math.round(fondoEmergencia),
    capitalInvertible: Math.round(capitalInvertible),
    pctInvertible:   round(pctInvertible),
    assetAllocation: aa,
    asignacionEur,
    notas,
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export const HORIZONTES_OPCIONES: { id: Horizonte; label: string }[] = [
  { id: 'corto',    label: HORIZONTE_LABEL.corto },
  { id: 'medio',    label: HORIZONTE_LABEL.medio },
  { id: 'largo',    label: HORIZONTE_LABEL.largo },
  { id: 'muyLargo', label: HORIZONTE_LABEL.muyLargo },
];
