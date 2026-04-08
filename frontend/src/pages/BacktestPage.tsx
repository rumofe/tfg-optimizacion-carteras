import { useState, useEffect, CSSProperties } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { runBacktest, getPortfolios, BacktestResult, Portfolio } from '../services/api';

const PERIODS = ['1y', '2y', '3y', '5y', '10y'];

const CRISIS_LABELS: Record<string, string> = {
  covid:           'COVID-19 (Feb–Mar 2020)',
  lehman:          'Crisis Lehman (Sep 2008 – Mar 2009)',
  correccion_2022: 'Corrección 2022 (Ene–Oct 2022)',
};

function pct(n: number) { return `${n.toFixed(2)}%`; }
function fmt(n: number, d = 4) { return n.toFixed(d); }

function downsample<T>(arr: T[], maxLen: number): T[] {
  if (arr.length <= maxLen) return arr;
  const step = Math.ceil(arr.length / maxLen);
  return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
}

const INPUT: CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  backgroundColor: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const LABEL: CSSProperties = {
  display: 'block',
  color: 'var(--text-2)',
  fontSize: '11px',
  marginBottom: '6px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

const CARD: CSSProperties = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '24px',
};

type Modo = 'guardada' | 'manual';

export default function BacktestPage() {
  const [modo, setModo] = useState<Modo>('guardada');

  // Carteras guardadas
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedId, setSelectedId] = useState<number | ''>('');

  // Entradas manuales
  const [tickersInput, setTickersInput] = useState('');
  const [weightsInput, setWeightsInput] = useState('');

  const [period, setPeriod] = useState('5y');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BacktestResult | null>(null);

  // Cargar carteras guardadas al montar
  useEffect(() => {
    getPortfolios()
      .then(({ data }) => setPortfolios(data))
      .catch(() => { /* silencioso: puede que no esté logado */ });
  }, []);

  // Cartera seleccionada del dropdown
  const selectedPortfolio = portfolios.find((p) => p.id === selectedId) ?? null;

  function cargarCarteraEnForm(p: Portfolio) {
    const sorted = [...p.activos].sort((a, b) => b.peso_asignado - a.peso_asignado);
    setTickersInput(sorted.map((a) => a.ticker).join(', '));
    // Mostrar pesos como porcentaje redondeado (se normalizan al enviar)
    setWeightsInput(sorted.map((a) => (a.peso_asignado * 100).toFixed(2)).join(', '));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let tickers: string[];
    let rawWeights: number[];

    if (modo === 'guardada') {
      if (!selectedPortfolio) {
        setError('Selecciona una cartera guardada.');
        return;
      }
      const sorted = [...selectedPortfolio.activos].sort((a, b) => b.peso_asignado - a.peso_asignado);
      tickers = sorted.map((a) => a.ticker);
      rawWeights = sorted.map((a) => a.peso_asignado);
    } else {
      tickers = tickersInput
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);
      rawWeights = weightsInput
        .split(',')
        .map((w) => parseFloat(w.trim()))
        .filter((n) => !isNaN(n));

      if (tickers.length === 0) { setError('Introduce al menos un ticker.'); return; }
      if (rawWeights.length !== tickers.length) {
        setError(`El número de pesos (${rawWeights.length}) no coincide con el de tickers (${tickers.length}).`);
        return;
      }
    }

    const total = rawWeights.reduce((a, b) => a + b, 0);
    if (total <= 0) { setError('Los pesos deben ser positivos.'); return; }

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
      <h1 style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
        Backtesting
      </h1>
      <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: '0 0 28px' }}>
        Evalúa el rendimiento histórico de tu cartera vs. SPY — con análisis de periodos de crisis
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ ...CARD, marginBottom: '28px' }}>

        {/* Toggle de modo */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg)',
          borderRadius: '8px',
          padding: '4px',
          marginBottom: '20px',
          width: 'fit-content',
        }}>
          {(['guardada', 'manual'] as Modo[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setModo(m); setError(''); setResult(null); }}
              style={{
                padding: '7px 18px',
                backgroundColor: modo === m ? 'var(--raised)' : 'transparent',
                color: modo === m ? 'var(--text)' : 'var(--text-2)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: modo === m ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {m === 'guardada' ? 'Cartera guardada' : 'Entrada manual'}
            </button>
          ))}
        </div>

        {/* Modo: cartera guardada */}
        {modo === 'guardada' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={LABEL}>SELECCIONA UNA CARTERA</label>
            {portfolios.length === 0 ? (
              <div style={{
                padding: '14px 16px',
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-2)',
                fontSize: '13px',
              }}>
                No tienes carteras guardadas. Ve al Optimizador y guarda una primero.
              </div>
            ) : (
              <>
                <select
                  value={selectedId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedId(id || '');
                    const p = portfolios.find((p) => p.id === id);
                    if (p) cargarCarteraEnForm(p);
                    setResult(null);
                    setError('');
                  }}
                  style={{ ...INPUT, cursor: 'pointer' }}
                >
                  <option value="">— Elige una cartera —</option>
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre_estrategia}  ({p.activos.length} activos · {p.fecha_creacion})
                    </option>
                  ))}
                </select>

                {/* Preview de la cartera seleccionada */}
                {selectedPortfolio && (
                  <div style={{
                    marginTop: '10px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}>
                    {[...selectedPortfolio.activos]
                      .sort((a, b) => b.peso_asignado - a.peso_asignado)
                      .map((a) => (
                        <div key={a.ticker} style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          backgroundColor: 'var(--raised)',
                          border: '1px solid var(--border)',
                          borderRadius: '20px',
                          padding: '3px 10px',
                          fontSize: '12px',
                        }}>
                          <span style={{ color: 'var(--text)', fontWeight: 700 }}>{a.ticker}</span>
                          <span style={{ color: 'var(--text-2)' }}>{(a.peso_asignado * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Modo: manual */}
        {modo === 'manual' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr', gap: '16px', marginBottom: '16px' }}>
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
          </div>
        )}

        {/* Periodo — siempre visible */}
        <div style={{ marginBottom: error ? '12px' : '16px' }}>
          <label style={LABEL}>PERIODO</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                style={{
                  padding: '7px 14px',
                  backgroundColor: period === p ? 'var(--accent)' : 'var(--raised)',
                  color: period === p ? '#fff' : 'var(--text-2)',
                  border: `1px solid ${period === p ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: period === p ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {modo === 'manual' && (
          <p style={{ color: 'var(--text-2)', fontSize: '11px', margin: '0 0 14px' }}>
            Ejemplo: tickers "AAPL, MSFT, GOOG" con pesos "40, 35, 25" → 40 %, 35 %, 25 %
          </p>
        )}

        {error && (
          <div style={{
            color: 'var(--red)', fontSize: '13px', marginBottom: '12px',
            padding: '9px 12px', backgroundColor: 'rgba(232, 64, 64, 0.08)',
            border: '1px solid rgba(232, 64, 64, 0.3)', borderRadius: '6px',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 24px',
            backgroundColor: loading ? 'var(--raised)' : 'var(--accent)',
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
            <h3 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, margin: '0 0 20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Evolución del valor (base 100)
            </h3>
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="fecha"
                  stroke="var(--border)"
                  tick={{ fill: 'var(--text-2)', fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(0, 7)}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="var(--border)" tick={{ fill: 'var(--text-2)', fontSize: 11 }} width={50} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--raised)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: 'var(--text-2)', marginBottom: '4px' }}
                  itemStyle={{ color: 'var(--text)' }}
                />
                <Legend formatter={(value) => <span style={{ color: 'var(--text)', fontSize: '13px' }}>{value}</span>} />
                <Line type="monotone" dataKey="valor_cartera" stroke="var(--accent)" dot={false} name="Cartera" strokeWidth={2} />
                <Line type="monotone" dataKey="valor_benchmark" stroke="var(--green)" dot={false} name="SPY (Benchmark)" strokeWidth={2} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Métricas fila 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
            {[
              { label: 'Rent. Acumulada',    value: pct(result.rentabilidad_acumulada),  borderColor: result.rentabilidad_acumulada >= 0 ? 'var(--green)' : 'var(--red)',  textColor: result.rentabilidad_acumulada >= 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Ret. Anualizado',    value: pct(result.retorno_anualizado),       borderColor: result.retorno_anualizado >= 0 ? 'var(--green)' : 'var(--red)',      textColor: result.retorno_anualizado >= 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Volatilidad Anual.', value: pct(result.volatilidad_anualizada),  borderColor: 'var(--amber)',   textColor: 'var(--amber)' },
              { label: 'Max Drawdown',       value: pct(result.max_drawdown),            borderColor: 'var(--red)',     textColor: 'var(--red)' },
            ].map(({ label, value, borderColor, textColor }) => (
              <div key={label} style={{ ...CARD, padding: '16px 20px', borderLeft: `3px solid ${borderColor}` }}>
                <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
                <div style={{ color: textColor, fontSize: '22px', fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Métricas fila 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Sharpe Ratio',  value: fmt(result.sharpe_ratio),                                          borderColor: 'var(--accent)',  textColor: 'var(--accent)' },
              { label: 'Sortino Ratio', value: fmt(result.sortino_ratio),                                         borderColor: 'var(--purple)',  textColor: 'var(--purple)' },
              { label: 'Calmar Ratio',  value: fmt(result.calmar_ratio),                                          borderColor: '#22d3ee',        textColor: '#22d3ee' },
              { label: 'Beta (vs SPY)', value: result.beta !== null ? fmt(result.beta) : '—',                     borderColor: 'var(--amber)',   textColor: 'var(--amber)' },
            ].map(({ label, value, borderColor, textColor }) => (
              <div key={label} style={{ ...CARD, padding: '16px 20px', borderLeft: `3px solid ${borderColor}` }}>
                <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
                <div style={{ color: textColor, fontSize: '22px', fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Benchmark comparison */}
          <div style={{ ...CARD, marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <div style={{ color: 'var(--text-2)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>TU CARTERA</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: result.rentabilidad_acumulada >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {pct(result.rentabilidad_acumulada)}
              </div>
              <div style={{ color: 'var(--text-2)', fontSize: '12px', marginTop: '4px' }}>
                {pct(result.retorno_anualizado)} anualizado · Sharpe {fmt(result.sharpe_ratio)}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-2)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>BENCHMARK (SPY)</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: result.benchmark_rentabilidad >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {pct(result.benchmark_rentabilidad)}
              </div>
              <div style={{ color: 'var(--text-2)', fontSize: '12px', marginTop: '4px' }}>
                {pct(result.benchmark_retorno_anualizado)} anualizado
              </div>
            </div>
          </div>

          {/* Crisis Analysis */}
          <div style={CARD}>
            <h3 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, margin: '0 0 20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Análisis de periodos de crisis
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr>
                    {['Periodo', 'Intervalo', 'Rent. Cartera', 'Rent. Benchmark', 'Sharpe', 'Sortino', 'MaxDD Cart.', 'Beta'].map((h) => (
                      <th key={h} style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 500, textAlign: 'left', padding: '0 12px 10px 0', borderBottom: '1px solid var(--border)', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.crisis).map(([name, data]) => (
                    <tr key={name}>
                      <td style={{ color: 'var(--text)', padding: '13px 12px 13px 0', borderBottom: '1px solid var(--raised)', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {CRISIS_LABELS[name] ?? name}
                      </td>
                      {data.disponible ? (
                        <>
                          <td style={{ color: 'var(--text-2)', padding: '13px 12px 13px 0', borderBottom: '1px solid var(--raised)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {data.periodo?.inicio} / {data.periodo?.fin}
                          </td>
                          <td style={{ padding: '13px 12px 13px 0', borderBottom: '1px solid var(--raised)', fontSize: '13px', fontWeight: 700, color: (data.cartera?.rentabilidad_acumulada ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {pct(data.cartera?.rentabilidad_acumulada ?? 0)}
                          </td>
                          <td style={{ padding: '13px 12px 13px 0', borderBottom: '1px solid var(--raised)', fontSize: '13px', fontWeight: 700, color: (data.benchmark?.rentabilidad_acumulada ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {pct(data.benchmark?.rentabilidad_acumulada ?? 0)}
                          </td>
                          <td style={{ color: 'var(--accent)', padding: '13px 12px 13px 0', borderBottom: '1px solid var(--raised)', fontSize: '13px' }}>
                            {fmt(data.cartera?.sharpe_ratio ?? 0)}
                          </td>
                          <td style={{ color: 'var(--purple)', padding: '13px 12px 13px 0', borderBottom: '1px solid var(--raised)', fontSize: '13px' }}>
                            {fmt(data.cartera?.sortino_ratio ?? 0)}
                          </td>
                          <td style={{ color: 'var(--red)', padding: '13px 12px 13px 0', borderBottom: '1px solid var(--raised)', fontSize: '13px' }}>
                            {pct(data.cartera?.max_drawdown ?? 0)}
                          </td>
                          <td style={{ color: 'var(--amber)', padding: '13px 0 13px 0', borderBottom: '1px solid var(--raised)', fontSize: '13px' }}>
                            {data.cartera?.beta !== null && data.cartera?.beta !== undefined ? fmt(data.cartera.beta) : '—'}
                          </td>
                        </>
                      ) : (
                        <td colSpan={7} style={{ color: 'var(--text-2)', padding: '13px 0', borderBottom: '1px solid var(--raised)', fontSize: '12px', fontStyle: 'italic' }}>
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
