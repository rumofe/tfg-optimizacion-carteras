/**
 * Plantillas de cartera preconfiguradas por perfil de riesgo.
 *
 * Cada plantilla propone una combinación de tickers realista para un determinado
 * perfil de inversor (conservador, moderado, agresivo). El usuario puede usarla
 * tal cual o tomarla como punto de partida para personalizar.
 *
 * Criterios de selección:
 *  - Solo tickers líquidos soportados por yfinance (mercado US).
 *  - Mezcla coherente con el nivel de riesgo declarado.
 *  - Máximo 8 activos por plantilla (el TickerSearch permite 10).
 */

export type PerfilTemplate = 'conservador' | 'moderado' | 'agresivo';

export interface PortfolioTemplate {
  id: string;
  nombre: string;
  descripcion: string;
  perfil: PerfilTemplate;
  tickers: string[];
  volatilidadSugerida: number;
}

export const TEMPLATES: PortfolioTemplate[] = [
  // ─── Conservador (≤ 15 % vol) ──────────────────────────────────────────────
  {
    id: 'defensiva-dividendos',
    nombre: 'Defensiva con Dividendos',
    descripcion: 'Consumer staples y healthcare con dividendos históricamente estables.',
    perfil: 'conservador',
    tickers: ['JNJ', 'PG', 'KO', 'PEP', 'WMT', 'MCD'],
    volatilidadSugerida: 15,
  },
  {
    id: '60-40-global',
    nombre: 'Clásica 60/40 Global',
    descripcion: 'Mix tradicional equity + renta fija + oro: la cartera de libro de texto.',
    perfil: 'conservador',
    tickers: ['VTI', 'VXUS', 'BND', 'TLT', 'GLD'],
    volatilidadSugerida: 13,
  },
  {
    id: 'income-utilities',
    nombre: 'Ingresos & Utilities',
    descripcion: 'Utilities y REITs: flujos predecibles y sensibilidad a tipos de interés.',
    perfil: 'conservador',
    tickers: ['NEE', 'SO', 'DUK', 'O', 'VNQ'],
    volatilidadSugerida: 14,
  },
  {
    id: 'bond-ladder',
    nombre: 'Bond Ladder · solo renta fija',
    descripcion: 'Escalera de bonos del Tesoro USA por duraciones (corto, medio y largo plazo) + agregado + protección inflación.',
    perfil: 'conservador',
    tickers: ['SHY', 'IEF', 'TLT', 'AGG', 'TIP'],
    volatilidadSugerida: 10,
  },
  {
    id: 'permanent-portfolio',
    nombre: 'Permanent Portfolio (Browne)',
    descripcion: '25/25/25/25: equity + bonos LP + bonos CP + oro. Diseñada para resistir cualquier régimen económico.',
    perfil: 'conservador',
    tickers: ['VTI', 'TLT', 'SHY', 'GLD'],
    volatilidadSugerida: 12,
  },

  // ─── Moderado (≤ 25 % vol) ─────────────────────────────────────────────────
  {
    id: 'core-sp500-intl',
    nombre: 'Core S&P 500 + Internacional',
    descripcion: 'Exposición global amplia vía ETFs: lo más parecido a un mercado eficiente.',
    perfil: 'moderado',
    tickers: ['SPY', 'VTI', 'VXUS', 'VWO'],
    volatilidadSugerida: 20,
  },
  {
    id: 'sectores-balanceados',
    nombre: 'Sectores Balanceados',
    descripcion: 'Líderes sectoriales diversificados: defensivos + tech + financieros + energía.',
    perfil: 'moderado',
    tickers: ['MSFT', 'JNJ', 'V', 'UNH', 'WMT', 'XOM', 'JPM'],
    volatilidadSugerida: 23,
  },
  {
    id: 'blue-chips-us',
    nombre: 'Blue Chips US',
    descripcion: 'Grandes capitalizaciones establecidas con historia de crecimiento sostenido.',
    perfil: 'moderado',
    tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'BRK-B', 'JNJ', 'V', 'JPM'],
    volatilidadSugerida: 25,
  },
  {
    id: 'all-weather-dalio',
    nombre: 'All Weather (Ray Dalio)',
    descripcion: '30 % equity + 55 % bonos LP/MP + 15 % commodities/oro. La cartera "para todo clima" de Bridgewater.',
    perfil: 'moderado',
    tickers: ['VTI', 'TLT', 'IEF', 'GLD', 'DBC'],
    volatilidadSugerida: 18,
  },
  {
    id: 'income-bonos-dividendos',
    nombre: 'Income · bonos + dividendos',
    descripcion: 'Combina ETFs de bonos high-yield e investment grade con dividend stocks. Pensada para generar rentas.',
    perfil: 'moderado',
    tickers: ['LQD', 'HYG', 'TLT', 'JNJ', 'KO', 'PG', 'O', 'VNQ'],
    volatilidadSugerida: 16,
  },

  // ─── Agresivo (≤ 40 % vol) ─────────────────────────────────────────────────
  {
    id: 'tech-mega-cap',
    nombre: 'Mega-cap Tech',
    descripcion: 'Las siete magníficas: concentración en tech líder, alto crecimiento esperado.',
    perfil: 'agresivo',
    tickers: ['NVDA', 'MSFT', 'GOOGL', 'META', 'AMZN', 'AAPL', 'TSLA'],
    volatilidadSugerida: 32,
  },
  {
    id: 'disrupcion-innovacion',
    nombre: 'Disrupción e Innovación',
    descripcion: 'Tech + ETFs de innovación: apuesta por empresas transformadoras, alta volatilidad.',
    perfil: 'agresivo',
    tickers: ['QQQ', 'ARKK', 'TSLA', 'NVDA', 'AMD', 'PLTR'],
    volatilidadSugerida: 40,
  },
  {
    id: 'semis-emergentes',
    nombre: 'Semiconductores + Emergentes',
    descripcion: 'Apuesta concentrada en la cadena de valor de semis global más mercados emergentes.',
    perfil: 'agresivo',
    tickers: ['TSM', 'NVDA', 'AVGO', 'ASML', 'VWO'],
    volatilidadSugerida: 38,
  },
];

export const PERFIL_META: Record<PerfilTemplate, { color: string; label: string; umbral: number }> = {
  conservador: { color: 'var(--green)',  label: 'Conservador', umbral: 15 },
  moderado:    { color: 'var(--accent)', label: 'Moderado',    umbral: 25 },
  agresivo:    { color: 'var(--amber)',  label: 'Agresivo',    umbral: 40 },
};

/** Detecta el perfil del usuario a partir de su tolerancia al riesgo configurada. */
export function detectarPerfil(tolerancia: number | null | undefined): PerfilTemplate | null {
  if (tolerancia == null) return null;
  if (tolerancia <= 17) return 'conservador';
  if (tolerancia <= 30) return 'moderado';
  return 'agresivo';
}
