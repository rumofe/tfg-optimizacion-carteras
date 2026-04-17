import axios from 'axios';

const api = axios.create({ baseURL: 'http://127.0.0.1:8000' });

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

export function optimizePortfolio(tickers: string[], capital: number, maxVolatilidad: number) {
  return api.post<OptimizeResult>('/portfolio/optimize', {
    tickers,
    capital,
    max_volatilidad: maxVolatilidad,
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

export function updatePortfolio(id: number, nombre: string, pesos: Record<string, number>) {
  return api.put(`/portfolio/${id}`, { nombre_estrategia: nombre, pesos });
}

export function runBacktest(
  tickers: string[],
  pesos: Record<string, number>,
  periodo: string,
  fecha_inicio?: string,
  fecha_fin?: string,
) {
  return api.post<BacktestResult>('/backtesting/run', {
    tickers,
    pesos,
    periodo,
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
  pesos: Record<string, number>;
  retorno_esperado: number;
  volatilidad: number;
  sharpe_ratio: number;
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
}

export default api;
