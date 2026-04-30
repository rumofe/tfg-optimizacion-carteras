import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  getPortfolios, runBacktest, Portfolio, BacktestResult,
} from '../services/api';
import { CARD, LABEL } from '../styles';

// Paleta diferenciada para hasta 4 carteras + benchmark
const SERIES_COLORS = [
  'var(--accent)',   // azul
  'var(--purple)',   // morado
  'var(--amber)',    // ámbar
  'var(--green)',    // verde
];
const BENCHMARK_COLOR = 'var(--text-3)';

const PERIODS = ['ytd', '1y', '3y', '5y', '10y', '20y', 'max'];
const PERIOD_LABELS: Record<string, string> = { ytd: 'YTD' };

interface CarteraResultado {
  portfolio: Portfolio;
  loading: boolean;
  error: string | null;
  result: BacktestResult | null;
}

function pct(v: number) { return `${v.toFixed(2)}%`; }
function fmt(v: number) { return v.toFixed(3); }
function carteraToPesos(p: Portfolio): Record<string, number> {
  return Object.fromEntries(p.activos.map((a) => [a.ticker, a.peso_asignado]));
}

/**
 * Down-sample una serie para que el gráfico no se sature.
 * Mantiene primer y último punto.
 */
function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const step = arr.length / maxPoints;
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(arr[Math.floor(i * step)]);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
  return out;
}

export default function ComparePage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [period, setPeriod] = useState<string>('5y');
  const [resultados, setResultados] = useState<Record<number, CarteraResultado>>({});
  const [globalError, setGlobalError] = useState<string>('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    getPortfolios()
      .then(({ data }) => setPortfolios(data))
      .catch(() => setGlobalError('No se pudieron cargar las carteras guardadas.'));
  }, []);

  function toggleId(id: number) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev; // máximo 4
      return [...prev, id];
    });
  }

  async function ejecutarComparacion() {
    if (selectedIds.length < 2) {
      setGlobalError('Selecciona al menos 2 carteras para comparar.');
      return;
    }
    setGlobalError('');
    setRunning(true);

    const seleccionadas = portfolios.filter((p) => selectedIds.includes(p.id));
    const initial: Record<number, CarteraResultado> = {};
    seleccionadas.forEach((p) => {
      initial[p.id] = { portfolio: p, loading: true, error: null, result: null };
    });
    setResultados(initial);

    // Lanzamos en paralelo
    await Promise.all(
      seleccionadas.map(async (p) => {
        try {
          const tickers = p.activos.map((a) => a.ticker);
          const pesos   = carteraToPesos(p);
          const { data } = await runBacktest(tickers, pesos, period);
          setResultados((prev) => ({
            ...prev,
            [p.id]: { portfolio: p, loading: false, error: null, result: data },
          }));
        } catch (err: any) {
          const detail = err?.response?.data?.detail;
          setResultados((prev) => ({
            ...prev,
            [p.id]: {
              portfolio: p, loading: false, result: null,
              error: typeof detail === 'string' ? detail : 'Error al ejecutar el backtest',
            },
          }));
        }
      }),
    );
    setRunning(false);
  }

  // ── Datos derivados para el gráfico ───────────────────────────────────────
  const chartData = useMemo(() => {
    const carteras = Object.values(resultados).filter((r) => r.result);
    if (carteras.length === 0) return [];

    // Usar la cartera con menos puntos como referencia (intersección de fechas)
    const fechasComunes = carteras.reduce<string[]>((acc, c) => {
      const fechas = c.result!.serie_temporal.map((s) => s.fecha);
      return acc.length === 0 ? fechas : acc.filter((f) => fechas.includes(f));
    }, []);

    const fechasDS = downsample(fechasComunes, 220);
    const fechasSet = new Set(fechasDS);

    return fechasDS.map((fecha) => {
      const row: any = { fecha };
      carteras.forEach((c) => {
        const punto = c.result!.serie_temporal.find((s) => s.fecha === fecha);
        if (punto) row[`p_${c.portfolio.id}`] = punto.valor_cartera;
      });
      // Benchmark: usamos el de la primera cartera (todas tienen el mismo SPY)
      const primera = carteras[0].result!.serie_temporal.find((s) => s.fecha === fecha);
      if (primera) row['benchmark'] = primera.valor_benchmark;
      return row;
    }).filter((row) => fechasSet.has(row.fecha));
  }, [resultados]);

  const carterasConResultado = Object.values(resultados).filter((r) => r.result);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>
          Comparador de Carteras
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: 0 }}>
          Compara hasta 4 carteras guardadas en el mismo periodo · curvas de equity superpuestas, métricas lado a lado.
        </p>
      </div>

      {/* Selector + periodo */}
      <div style={{ ...CARD, marginBottom: '24px' }}>
        {portfolios.length === 0 ? (
          <div style={{ color: 'var(--text-2)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
            No tienes carteras guardadas todavía. Crea alguna desde el Optimizador.
          </div>
        ) : (
          <>
            <label style={LABEL}>Carteras a comparar (máx. 4)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px', marginBottom: '20px' }}>
              {portfolios.map((p) => {
                const idx = selectedIds.indexOf(p.id);
                const active = idx >= 0;
                const color = active ? SERIES_COLORS[idx] : 'var(--border)';
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleId(p.id)}
                    disabled={!active && selectedIds.length >= 4}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: active ? 'var(--raised)' : 'transparent',
                      border: `1px solid ${color}`,
                      borderLeft: `3px solid ${color}`,
                      borderRadius: 'var(--radius-sm)',
                      textAlign: 'left',
                      cursor: !active && selectedIds.length >= 4 ? 'not-allowed' : 'pointer',
                      opacity: !active && selectedIds.length >= 4 ? 0.4 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ color: active ? 'var(--text)' : 'var(--text-2)', fontSize: '13px', fontWeight: 600 }}>
                        {p.nombre_estrategia}
                      </span>
                      {active && (
                        <span style={{ color, fontSize: '10px', fontWeight: 700 }}>#{idx + 1}</span>
                      )}
                    </div>
                    <div style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: '3px' }}>
                      {p.activos.length} activos · {p.fecha_creacion}
                    </div>
                  </button>
                );
              })}
            </div>

            <label style={LABEL}>Periodo</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
              {PERIODS.map((p) => (
                <button
                  key={p} type="button" onClick={() => setPeriod(p)}
                  style={{
                    padding: '6px 14px', fontSize: '12px',
                    backgroundColor: period === p ? 'var(--accent)' : 'var(--raised)',
                    color: period === p ? '#fff' : 'var(--text-2)',
                    border: `1px solid ${period === p ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '6px', cursor: 'pointer',
                    fontWeight: period === p ? 600 : 400,
                  }}
                >
                  {PERIOD_LABELS[p] ?? p.toUpperCase()}
                </button>
              ))}
            </div>

            {globalError && (
              <div style={{
                color: 'var(--red)', fontSize: '13px', marginBottom: '12px',
                padding: '9px 12px', backgroundColor: 'rgba(232,64,64,0.08)',
                border: '1px solid rgba(232,64,64,0.3)', borderRadius: '6px',
              }}>
                {globalError}
              </div>
            )}

            <button
              type="button"
              onClick={ejecutarComparacion}
              disabled={running || selectedIds.length < 2}
              style={{
                padding: '10px 24px',
                backgroundColor: running || selectedIds.length < 2 ? 'var(--raised)' : 'var(--accent)',
                color: running || selectedIds.length < 2 ? 'var(--text-3)' : '#fff',
                border: 'none', borderRadius: '6px',
                fontSize: '14px', fontWeight: 600,
                cursor: running || selectedIds.length < 2 ? 'not-allowed' : 'pointer',
              }}
            >
              {running ? 'Ejecutando…' : `Comparar ${selectedIds.length || ''} carteras`}
            </button>
          </>
        )}
      </div>

      {/* Resultados */}
      {carterasConResultado.length > 0 && (
        <>
          {/* Equity curves superpuestas */}
          <div style={{ ...CARD, marginBottom: '20px' }}>
            <h3 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Evolución comparada · base 100
            </h3>
            <p style={{ color: 'var(--text-2)', fontSize: '12px', margin: '0 0 16px' }}>
              Cada cartera parte de 100 € en la misma fecha. Línea punteada = SPY (benchmark).
            </p>
            <ResponsiveContainer width="100%" height={400}>
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
                  itemStyle={{ color: 'var(--text)' }}
                />
                <Legend formatter={(value) => <span style={{ color: 'var(--text)', fontSize: '12px' }}>{value}</span>} />
                {carterasConResultado.map((c, i) => (
                  <Line
                    key={c.portfolio.id}
                    type="monotone"
                    dataKey={`p_${c.portfolio.id}`}
                    name={c.portfolio.nombre_estrategia}
                    stroke={SERIES_COLORS[i]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  name="SPY"
                  stroke={BENCHMARK_COLOR}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla de métricas comparada */}
          <div style={{ ...CARD, marginBottom: '20px', overflowX: 'auto' }}>
            <h3 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Métricas comparadas
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '720px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 8px', textAlign: 'left', color: 'var(--text-2)', borderBottom: '1px solid var(--border)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Cartera</th>
                  {[
                    'Rent. Acumulada', 'Ret. Anual.', 'Volatilidad', 'Sharpe', 'Sortino', 'Calmar', 'Max DD', 'Beta',
                  ].map((h) => (
                    <th key={h} style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-2)', borderBottom: '1px solid var(--border)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {carterasConResultado.map((c, i) => {
                  const r = c.result!;
                  return (
                    <tr key={c.portfolio.id}>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: SERIES_COLORS[i] }} />
                          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{c.portfolio.nombre_estrategia}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: r.rentabilidad_acumulada >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{pct(r.rentabilidad_acumulada)}</td>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--text)' }}>{pct(r.retorno_anualizado)}</td>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--amber)' }}>{pct(r.volatilidad_anualizada)}</td>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{fmt(r.sharpe_ratio)}</td>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--purple)' }}>{fmt(r.sortino_ratio)}</td>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: '#22d3ee' }}>{fmt(r.calmar_ratio)}</td>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--red)' }}>{pct(r.max_drawdown)}</td>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--text-2)' }}>{r.beta !== null ? fmt(r.beta) : '—'}</td>
                    </tr>
                  );
                })}
                {/* Benchmark */}
                {carterasConResultado.length > 0 && (
                  <tr>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: BENCHMARK_COLOR }} />
                        <span style={{ color: 'var(--text-2)', fontStyle: 'italic' }}>SPY (benchmark)</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--text-2)' }}>{pct(carterasConResultado[0].result!.benchmark_rentabilidad)}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--text-2)' }}>{pct(carterasConResultado[0].result!.benchmark_retorno_anualizado)}</td>
                    <td colSpan={6}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Composición lado a lado */}
          <div style={{ ...CARD }}>
            <h3 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Composición de cada cartera
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${carterasConResultado.length}, 1fr)`, gap: '14px' }}>
              {carterasConResultado.map((c, i) => {
                const sorted = [...c.portfolio.activos].sort((a, b) => b.peso_asignado - a.peso_asignado);
                return (
                  <div key={c.portfolio.id} style={{ borderTop: `3px solid ${SERIES_COLORS[i]}`, paddingTop: '12px' }}>
                    <div style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>
                      {c.portfolio.nombre_estrategia}
                    </div>
                    {sorted.map((a) => (
                      <div key={a.ticker} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text)', fontSize: '12px', fontFamily: 'monospace', width: '60px' }}>{a.ticker}</span>
                        <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--raised)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${a.peso_asignado * 100}%`, height: '100%', backgroundColor: SERIES_COLORS[i] }} />
                        </div>
                        <span style={{ color: 'var(--text-2)', fontSize: '11px', width: '46px', textAlign: 'right' }}>
                          {(a.peso_asignado * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Mostrar errores individuales */}
      {Object.values(resultados).filter((r) => r.error).map((r) => (
        <div key={r.portfolio.id} style={{
          color: 'var(--red)', fontSize: '13px', marginTop: '12px',
          padding: '9px 12px', backgroundColor: 'rgba(232,64,64,0.08)',
          border: '1px solid rgba(232,64,64,0.3)', borderRadius: '6px',
        }}>
          ⚠ {r.portfolio.nombre_estrategia}: {r.error}
        </div>
      ))}
    </div>
  );
}
