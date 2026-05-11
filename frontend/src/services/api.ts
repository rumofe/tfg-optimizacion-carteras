import axios from 'axios';

// Base URL configurable vía variable de entorno Vite (`VITE_API_URL`).
// Si no está definida, cae al backend local por defecto.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://127.0.0.1:8000';
const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Si el servidor devuelve 401 fuera de auth, el token expiró → volver al login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url ?? '';
    const isAuthEndpoint = url.includes('/auth/');
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  },
);

export function login(email: string, password: string) {
  const body = new URLSearchParams({ username: email, password });
  return api.post<{ access_token: string }>('/auth/login', body);
}

export function register(email: string, password: string) {
  return api.post<{ access_token: string }>('/auth/register', { email, password });
}

export type OptimizationMethod = 'markowitz' | 'min_variance' | 'risk_parity' | 'equal_weight' | 'min_cvar';

export function optimizePortfolio(
  tickers: string[],
  capital: number,
  maxVolatilidad: number,
  metodo: OptimizationMethod = 'markowitz',
) {
  return api.post<OptimizeResult>('/portfolio/optimize', {
    tickers,
    capital,
    max_volatilidad: maxVolatilidad,
    metodo,
  });
}

export function savePortfolio(
  nombre: string,
  tickers: string[],
  pesos: Record<string, number>,
  capital: number,
) {
  return api.post('/portfolio/', { nombre_estrategia: nombre, tickers, pesos, capital });
}

export function getPortfolios() {
  return api.get<Portfolio[]>('/portfolio/');
}

export function deletePortfolio(id: number) {
  return api.delete(`/portfolio/${id}`);
}

export interface PortfolioSnapshot {
  id: number;
  fecha: string;          // ISO datetime
  nombre_estrategia: string;
  pesos: Record<string, number>;
  motivo: 'edicion' | 'creacion' | 'manual';
}

export function getPortfolioSnapshots(id: number) {
  return api.get<PortfolioSnapshot[]>(`/portfolio/${id}/snapshots`);
}

export function updatePortfolio(id: number, nombre: string, pesos: Record<string, number>) {
  return api.put(`/portfolio/${id}`, { nombre_estrategia: nombre, pesos });
}

// ─── Monte Carlo ─────────────────────────────────────────────────────────────

export interface MonteCarloPoint {
  año: number;
  p5:  number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export type MonteCarloMode = 'historico' | 'ajustado' | 'manual';

export interface MonteCarloResult {
  parametros: {
    años: number;
    n_simulaciones: number;
    capital_inicial: number;
    n_dias_historico: number;
    metodo: string;
    modo: MonteCarloMode;
    cagr_aplicado: number | null;   // % anual aplicado, null si modo=historico
  };
  historico: {
    cagr_anual: number;       // % CAGR de la muestra histórica
    vol_anualizada: number;
    dias_muestra: number;
  };
  aviso_drift: string | null;
  trayectoria: MonteCarloPoint[];
  valor_final: {
    media: number; mediana: number; std: number;
    p5: number; p25: number; p75: number; p95: number;
    min: number; max: number;
  };
  cagr: { p5: number; p50: number; p95: number; media: number };
  probabilidad_perdida: number;
  probabilidad_doblar: number;
  probabilidad_triplicar: number;
  histograma: { valor_min: number; valor_max: number; frecuencia: number }[];
}

// ─── Fiscalidad española ─────────────────────────────────────────────────────

export interface IRPFTramo {
  desde: number;
  hasta: number;
  tipo: number;     // p. ej. 0.19
  base: number;
  cuota: number;
}

export interface IRPFCalculo {
  total: number;
  tipo_efectivo: number;
  desglose: IRPFTramo[];
}

export interface VehiculoFiscalResult {
  vehiculo: 'etf_distributivo' | 'fondo_acumulativo';
  valor_final_bruto: number;
  valor_final_neto: number;
  plusvalia: number;
  irpf_plusvalia: IRPFCalculo;
  irpf_total: number;
  dividendos_brutos?: number;
  retenciones_anuales?: number;
}

export interface FiscalidadResult {
  parametros: {
    capital: number;
    años: number;
    retorno_anualizado: number;   // %
    yield_anual: number;          // %
  };
  bruto_teorico: number;
  etf_distrib: VehiculoFiscalResult;
  fondo_acum:  VehiculoFiscalResult;
  diferimiento: {
    ahorro_eur: number;
    ahorro_pct: number;
    irpf_etf:   number;
    irpf_fondo: number;
  };
}

export function runFiscalidad(
  capital: number,
  años: number,
  retornoAnualizado: number,   // decimal
  yieldAnual: number = 0,      // decimal
) {
  return api.post<FiscalidadResult>('/portfolio/fiscalidad', {
    capital,
    años,
    retorno_anualizado: retornoAnualizado,
    yield_anual: yieldAnual,
  });
}

export function runMonteCarlo(
  tickers: string[],
  pesos: Record<string, number>,
  años: number,
  nSimulaciones: number,
  capitalInicial: number,
  modo: MonteCarloMode = 'ajustado',
  cagrEsperado: number | null = null,
) {
  return api.post<MonteCarloResult>('/portfolio/monte-carlo', {
    tickers, pesos, años,
    n_simulaciones: nSimulaciones,
    capital_inicial: capitalInicial,
    modo,
    cagr_esperado: cagrEsperado,
  });
}

export function runBacktest(
  tickers: string[],
  pesos: Record<string, number>,
  periodo: string,
  fecha_inicio?: string,
  fecha_fin?: string,
  rebalanceo: string = 'ninguno',
  comision_pct: number = 0,
) {
  return api.post<BacktestResult>('/backtesting/run', {
    tickers,
    pesos,
    periodo,
    rebalanceo,
    comision_pct,
    ...(fecha_inicio ? { fecha_inicio } : {}),
    ...(fecha_fin   ? { fecha_fin }   : {}),
  });
}

export function getTickerInfo(ticker: string) {
  return api.get<TickerInfo>(`/assets/${ticker}/info`);
}

export function searchAssets(q: string) {
  return api.get<SearchResult[]>('/assets/search', { params: { q } });
}

export function getProfile() {
  return api.get<UserProfile>('/auth/profile');
}

export function updateProfile(data: { capital_base?: number | null; tolerancia_riesgo?: number | null }) {
  return api.put<UserProfile>('/auth/profile', data);
}

// --- Types ---

export interface FronteraPunto {
  retorno: number;
  volatilidad: number;
  sharpe: number;
}

export interface ParetoPoint {
  theta:       number;   // 0 = puro Sortino, 1 = puro Sharpe
  sharpe:      number;
  sortino:     number;
  volatilidad: number;
  retorno:     number;
}

export interface ActivoInfo {
  retorno_anualizado: number;
  volatilidad_anualizada: number;
}

export interface OptimizeResult {
  metodo?: OptimizationMethod;
  pesos: Record<string, number>;
  retorno_esperado: number;
  volatilidad: number;
  sharpe_ratio: number;
  diversification_ratio?: number;
  concentracion_hhi?: number;
  activos_efectivos?: number;
  cvar_95_diario?: number;
  cvar_95_anual?: number;
  activos_info: Record<string, ActivoInfo>;
  frontera: FronteraPunto[];
  pareto: ParetoPoint[];
}

export interface Portfolio {
  id: number;
  nombre_estrategia: string;
  fecha_creacion: string;
  activos: { ticker: string; peso_asignado: number }[];
}

export interface MetricasItem {
  rentabilidad_acumulada: number;
  retorno_anualizado: number;
  volatilidad_anualizada: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  max_drawdown: number;
  beta: number | null;
}

export interface CrisisItem {
  disponible: boolean;
  periodo?: { inicio: string; fin: string };
  cartera?: MetricasItem;
  benchmark?: MetricasItem;
}

export interface DescomposicionRetorno {
  rentabilidad_precio: number;
  rentabilidad_dividendos: number;
  rentabilidad_total: number;
}

export interface DividendosInfo {
  ingresos_anuales: { año: number; importe_por_100: number }[];
  yield_promedio_anual: number;   // %
  ingresos_totales: number;       // € por cada 100€ invertidos
}

export interface RebalanceoInfo {
  frecuencia: 'ninguno' | 'mensual' | 'trimestral' | 'semestral' | 'anual';
  comision_pct: number;
  n_rebalanceos: number;
  coste_total_pct: number;
  eventos: { fecha: string; turnover: number; coste_pct: number }[];
}

export interface BacktestResult {
  rentabilidad_acumulada: number;
  retorno_anualizado: number;
  volatilidad_anualizada: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  max_drawdown: number;
  beta: number | null;
  benchmark_rentabilidad: number;
  benchmark_retorno_anualizado: number;
  serie_temporal: { fecha: string; valor_cartera: number; valor_benchmark: number }[];
  crisis: Record<string, CrisisItem>;
  descomposicion?: DescomposicionRetorno;
  dividendos?: DividendosInfo;
  rebalanceo?: RebalanceoInfo;
}

export interface SearchResult {
  ticker: string;
  nombre: string;
  tipo: string;
  exchange: string;
}

export interface UserProfile {
  email: string;
  capital_base: number | null;
  tolerancia_riesgo: number | null;
}

export interface TickerInfo {
  ticker: string;
  nombre: string;
  sector: string;
  industria: string;
  pais: string;
  tipo: string;
  moneda: string;
  market_cap: number | null;
  market_cap_categoria: 'Large Cap' | 'Mid Cap' | 'Small Cap' | 'Desconocido';
  estilo_inversion: 'Value' | 'Blend' | 'Growth' | 'Desconocido';
  tipo_accion: 'Cyclical' | 'Sensitive' | 'Defensive' | 'Desconocido';
  asset_class: 'Equity' | 'Bonds' | 'Real Estate' | 'Commodities' | 'Cash' | 'Alternatives' | 'Mixed';
  dividend_yield: number | null;   // % anual
  payout_frequency: 'Mensual' | 'Trimestral' | 'Semestral' | 'Anual' | 'Irregular' | 'Ninguno' | 'Desconocido';
}

export default api;
