import { useState, CSSProperties } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { runBacktest, BacktestResult } from '../services/api';

const PERIODS = ['1y', '2y', '3y', '5y', '10y'];

const CRISIS_LABELS: Record<string, string> = {
  covid:           'COVID-19 (Feb–Mar 2020)',
  lehman:          'Crisis Lehman (Sep 2008 – Mar 2009)',
  correccion_2022: 'Corrección 2022 (Ene–Oct 2022)',
};

function pct(n: number) { return `${n.toFixed(2)}%`; }

/** Reduce el array a un máximo de maxLen puntos para no sobrecargar el gráfico */
function downsample<T>(arr: T[], maxLen: number): T[] {
  if (arr.length <= maxLen) return arr;
  const step = Math.ceil(arr.length / maxLen);
  return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
}

const INPUT: CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  backgroundColor: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: '6px',
  color: '#e6edf3',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const LABEL: CSSProperties = {
  display: 'block',
  color: '#8b949e',
  fontSize: '12px',
  marginBottom: '6px',
  fontWeight: 500,
  letterSpacing: '0.4px',
};

const CARD: CSSProperties = {
  backgroundColor: '#161b22',
  border: '1px solid #30363d',
  borderRadius: '10px',
  padding: '24px',
};

export default function BacktestPage() {
  const [tickersInput, setTickersInput] = useState('');
  const [weightsInput, setWeightsInput] = useState('');
  const [period, setPeriod] = useState('5y');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BacktestResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const tickers = tickersInput
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    const rawWeights = weightsInput
      .split(',')
      .map((w) => parseFloat(w.trim()))
      .filter((n) => !isNaN(n));

    if (tickers.length === 0) {
      setError('Introduce al menos un ticker.');
      return;
    }
    if (rawWeights.length !== tickers.length) {
      setError(
        `El número de pesos (${rawWeights.length}) no coincide con el número de tickers (${tickers.length}).`,
      );
      return;
    }
    const total = rawWeights.reduce((a, b) => a + b, 0);
    if (total <= 0) {
      setError('Los pesos deben ser positivos.');
      return;
    }

    // Normalizar a suma = 1
    const pesos: Record<string, number> = {};
    tickers.forEach((t, i) => { pesos[t] = rawWeights[i] / total; });

    setError('');
    setResult(null);
    setLoading(true);

    try {
      const { data } = await runBacktest(tickers, pesos, period);
      setResult(data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Error al ejecutar el backtest.');
    } finally {
      setLoading(false);
    }
  }

  const chartData = result ? downsample(result.serie_temporal, 300) : [];

  return (
    <div>
      <h1 style={{ color: '#e6edf3', fontSize: '22px', fontWeight: 700, margin: '0 0 6px' }}>
        Backtesting
      </h1>
      <p style={{ color: '#8b949e', fontSize: '13px', margin: '0 0 28px' }}>
        Evalúa el rendimiento histórico de tu cartera vs. el índice SPY
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ ...CARD, marginBottom: '28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '16px', marginBottom: '6px' }}>
          <div>
            <label style={LABEL}>TICKERS</label>
            <input
              value={tickersInput}
              onChange={(e) => setTickersInput(e.target.value)}
              placeholder="AAPL, MSFT, GOOG"
              required
              style={INPUT}
            />
          </div>
          <div>
            <label style={LABEL}>PESOS (mismo orden — se normalizan automáticamente)</label>
            <input
              value={weightsInput}
              onChange={(e) => setWeightsInput(e.target.value)}
              placeholder="40, 35, 25"
              required
              style={INPUT}
            />
          </div>
          <div>
            <label style={LABEL}>PERIODO</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{ ...INPUT, cursor: 'pointer' }}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
        <p style={{ color: '#8b949e', fontSize: '11px', margin: '0 0 14px' }}>
          Ejemplo: tickers "AAPL, MSFT, GOOG" con pesos "40, 35, 25" → 40 %, 35 %, 25 %
        </p>

        {error && (
          <div style={{
            color: '#f85149', fontSize: '13px', marginBottom: '12px',
            padding: '9px 12px', backgroundColor: 'rgba(248, 81, 73, 0.08)',
            border: '1px solid rgba(248, 81, 73, 0.3)', borderRadius: '6px',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 24px',
            backgroundColor: loading ? '#21262d' : '#1f6feb',
            color: '#fff', border: 'none', borderRadius: '6px',
            fontSize: '14px', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Ejecutando backtest…' : 'Ejecutar backtest'}
        </button>
      </form>

      {/* Results */}
      {result && (
        <>
          {/* LineChart */}
          <div style={{ ...CARD, marginBottom: '20px' }}>
            <h3 style={{ color: '#e6edf3', fontSize: '14px', fontWeight: 600, margin: '0 0 20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Evolución del valor (base 100)
            </h3>
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis
                  dataKey="fecha"
                  stroke="#21262d"
                  tick={{ fill: '#8b949e', fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(0, 7)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#21262d"
                  tick={{ fill: '#8b949e', fontSize: 11 }}
                  width={50}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#21262d', border: '1px solid #30363d', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#8b949e', marginBottom: '4px' }}
                  itemStyle={{ color: '#e6edf3' }}
                />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: '#e6edf3', fontSize: '13px' }}>{value}</span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="valor_cartera"
                  stroke="#58a6ff"
                  dot={false}
                  name="Cartera"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="valor_benchmark"
                  stroke="#3fb950"
                  dot={false}
                  name="SPY (Benchmark)"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Global Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              {
                label: 'Rent. Acumulada',
                value: pct(result.rentabilidad_acumulada),
                color: result.rentabilidad_acumulada >= 0 ? '#3fb950' : '#f85149',
              },
              { label: 'Volatilidad Anual.', value: pct(result.volatilidad_anualizada),   color: '#d29922' },
              { label: 'Sharpe Ratio',       value: result.sharpe_ratio.toFixed(4),       color: '#58a6ff' },
              { label: 'Max Drawdown',        value: pct(result.max_drawdown),             color: '#f85149' },
              {
                label: 'Benchmark (SPY)',
                value: pct(result.benchmark_rentabilidad),
                color: result.benchmark_rentabilidad >= 0 ? '#8b949e' : '#f85149',
              },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ ...CARD, textAlign: 'center', padding: '16px' }}>
                <div style={{ color: '#8b949e', fontSize: '10px', fontWeight: 500, letterSpacing: '0.4px', marginBottom: '6px' }}>
                  {label.toUpperCase()}
                </div>
                <div style={{ color, fontSize: '20px', fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Crisis Analysis */}
          <div style={CARD}>
            <h3 style={{ color: '#e6edf3', fontSize: '14px', fontWeight: 600, margin: '0 0 20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Análisis de periodos de crisis
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                <thead>
                  <tr>
                    {['Periodo', 'Intervalo', 'Rent. Cartera', 'Rent. Benchmark', 'Sharpe Cart.', 'MaxDD Cart.', 'Vol. Cart.'].map((h) => (
                      <th key={h} style={{
                        color: '#8b949e', fontSize: '11px', fontWeight: 500,
                        textAlign: 'left', padding: '0 12px 10px 0',
                        borderBottom: '1px solid #30363d',
                        letterSpacing: '0.4px',
                        whiteSpace: 'nowrap',
                      }}>
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.crisis).map(([name, data]) => (
                    <tr key={name}>
                      <td style={{ color: '#e6edf3', padding: '13px 12px 13px 0', borderBottom: '1px solid #21262d', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {CRISIS_LABELS[name] ?? name}
                      </td>
                      {data.disponible ? (
                        <>
                          <td style={{ color: '#8b949e', padding: '13px 12px 13px 0', borderBottom: '1px solid #21262d', fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {data.periodo?.inicio} / {data.periodo?.fin}
                          </td>
                          <td style={{
                            padding: '13px 12px 13px 0', borderBottom: '1px solid #21262d', fontSize: '13px', fontWeight: 700,
                            color: (data.cartera?.rentabilidad_acumulada ?? 0) >= 0 ? '#3fb950' : '#f85149',
                          }}>
                            {pct(data.cartera?.rentabilidad_acumulada ?? 0)}
                          </td>
                          <td style={{
                            padding: '13px 12px 13px 0', borderBottom: '1px solid #21262d', fontSize: '13px', fontWeight: 700,
                            color: (data.benchmark?.rentabilidad_acumulada ?? 0) >= 0 ? '#3fb950' : '#f85149',
                          }}>
                            {pct(data.benchmark?.rentabilidad_acumulada ?? 0)}
                          </td>
                          <td style={{ color: '#58a6ff', padding: '13px 12px 13px 0', borderBottom: '1px solid #21262d', fontSize: '13px' }}>
                            {(data.cartera?.sharpe_ratio ?? 0).toFixed(4)}
                          </td>
                          <td style={{ color: '#f85149', padding: '13px 12px 13px 0', borderBottom: '1px solid #21262d', fontSize: '13px' }}>
                            {pct(data.cartera?.max_drawdown ?? 0)}
                          </td>
                          <td style={{ color: '#d29922', padding: '13px 0 13px 0', borderBottom: '1px solid #21262d', fontSize: '13px' }}>
                            {pct(data.cartera?.volatilidad_anualizada ?? 0)}
                          </td>
                        </>
                      ) : (
                        <td colSpan={6} style={{
                          color: '#8b949e', padding: '13px 0', borderBottom: '1px solid #21262d',
                          fontSize: '12px', fontStyle: 'italic',
                        }}>
                          Datos no disponibles para este periodo en el rango seleccionado
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
