import axios from 'axios';

const api = axios.create({ baseURL: 'http://127.0.0.1:8000' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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

export function runBacktest(tickers: string[], pesos: Record<string, number>, periodo: string) {
  return api.post<BacktestResult>('/backtesting/run', { tickers, pesos, periodo });
}

// --- Types ---

export interface OptimizeResult {
  pesos: Record<string, number>;
  retorno_esperado: number;
  volatilidad: number;
  sharpe_ratio: number;
}

export interface Portfolio {
  id: number;
  nombre_estrategia: string;
  fecha_creacion: string;
  activos: { ticker: string; peso_asignado: number }[];
}

export interface MetricasItem {
  rentabilidad_acumulada: number;
  volatilidad_anualizada: number;
  sharpe_ratio: number;
  max_drawdown: number;
}

export interface CrisisItem {
  disponible: boolean;
  periodo?: { inicio: string; fin: string };
  cartera?: MetricasItem;
  benchmark?: MetricasItem;
}

export interface BacktestResult {
  rentabilidad_acumulada: number;
  volatilidad_anualizada: number;
  sharpe_ratio: number;
  max_drawdown: number;
  benchmark_rentabilidad: number;
  serie_temporal: { fecha: string; valor_cartera: number; valor_benchmark: number }[];
  crisis: Record<string, CrisisItem>;
}

export default api;
