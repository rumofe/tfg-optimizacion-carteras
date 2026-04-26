import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { runBacktest, getPortfolios, BacktestResult, Portfolio } from '../services/api';
import TickerSearch from '../components/TickerSearch';
import { CARD, COLORS, INPUT, LABEL } from '../styles';

const PERIODS = ['ytd', '1y', '3y', '5y', '10y', '20y', 'max'];
const PERIOD_LABELS: Record<string, string> = { ytd: 'YTD' };

function todayStr() { return new Date().toISOString().slice(0, 10); }
function yearStartStr() { return `${new Date().getFullYear()}-01-01`; }

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

type Modo = 'guardada' | 'manual';

export default function BacktestPage() {
  const [modo, setModo] = useState<Modo>('guardada');

  // Carteras guardadas
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedId, setSelectedId] = useState<number | ''>('');

  // Entradas manuales
  const [manualTickers, setManualTickers] = useState<string[]>([]);
  const [manualWeights, setManualWeights] = useState<Record<string, string>>({});

  const [period, setPeriod] = useState('5y');
  const [tipoPeriodo, setTipoPeriodo] = useState<'predefinido' | 'personalizado'>('predefinido');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin]       = useState('');
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
    setManualTickers(sorted.map((a) => a.ticker));
    setManualWeights(Object.fromEntries(
      sorted.map((a) => [a.ticker, (a.peso_asignado * 100).toFixed(2)])
    ));
  }

  function handleManualTickersChange(tickers: string[]) {
    setManualTickers(tickers);
    setManualWeights((prev) => {
      const next: Record<string, string> = {};
      tickers.forEach((t) => { next[t] = prev[t] ?? ''; });
      return next;
    });
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
      if (manualTickers.length === 0) { setError('Añade al menos un ticker.'); return; }
      tickers = manualTickers;
      rawWeights = manualTickers.map((t) => parseFloat(manualWeights[t] ?? '0') || 0);
    }

    const total = rawWeights.reduce((a, b) => a + b, 0);
    if (total <= 0) { setError('Los pesos deben ser positivos.'); return; }

    const pesos: Record<string, number> = {};
    tickers.forEach((t, i) => { pesos[t] = rawWeights[i] / total; });

    if (tipoPeriodo === 'personalizado' && !fechaInicio) {
      setError('Indica al menos la fecha de inicio.'); return;
    }

    setError('');
    setResult(null);
    setLoading(true);

    try {
      const { data } = tipoPeriodo === 'personalizado'
        ? await runBacktest(tickers, pesos, '5y', fechaInicio, fechaFin || undefined)
        : await runBacktest(tickers, pesos, period);
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
      <h1 style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 700, margin: '0 0 6px' }}>
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
          <div style={{ marginBottom: '16px' }}>
            <label style={LABEL}>Activos</label>
            <TickerSearch selected={manualTickers} onChange={handleManualTickersChange} maxItems={10} />

            {manualTickers.length > 0 && (
              <div style={{ marginTop: '14px' }}>
                <label style={LABEL}>Pesos (se normalizan automáticamente)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {manualTickers.map((ticker, i) => (
                    <div key={ticker} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 10px',
                      backgroundColor: 'var(--raised)',
                      borderRadius: 'var(--radius-sm)',
                    }}>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                        backgroundColor: COLORS[i % COLORS.length],
                      }} />
                      <span style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, minWidth: '64px' }}>
                        {ticker}
                      </span>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          type="number" min={0} max={100} step={1}
                          placeholder="0"
                          value={manualWeights[ticker] ?? ''}
                          onChange={(e) => setManualWeights((prev) => ({ ...prev, [ticker]: e.target.value }))}
                          style={{ ...INPUT, paddingRight: '28px', textAlign: 'right' }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                          onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--border)')}
                        />
                        <span style={{
                          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                          color: 'var(--text-2)', fontSize: '12px', pointerEvents: 'none',
                        }}>%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Periodo — siempre visible */}
        <div style={{ marginBottom: error ? '12px' : '16px' }}>
          <label style={LABEL}>PERIODO</label>

          {/* Sub-toggle predefinido / personalizado */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg)',
            borderRadius: '6px',
            padding: '3px',
            marginBottom: '10px',
            width: 'fit-content',
          }}>
            {(['predefinido', 'personalizado'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTipoPeriodo(t); setError(''); }}
                style={{
                  padding: '5px 14px',
                  backgroundColor: tipoPeriodo === t ? 'var(--raised)' : 'transparent',
                  color: tipoPeriodo === t ? 'var(--text)' : 'var(--text-2)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: tipoPeriodo === t ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {t === 'predefinido' ? 'Predefinido' : 'Rango de fechas'}
              </button>
            ))}
          </div>

          {tipoPeriodo === 'predefinido' && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                  {PERIOD_LABELS[p] ?? p}
                </button>
              ))}
            </div>
          )}

          {tipoPeriodo === 'personalizado' && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 500 }}>DESDE</span>
                <input
                  type="date"
                  value={fechaInicio}
                  max={fechaFin || todayStr()}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  style={{ ...INPUT, width: '150px' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 500 }}>HASTA</span>
                <input
                  type="date"
                  value={fechaFin}
                  min={fechaInicio || undefined}
                  max={todayStr()}
                  onChange={(e) => setFechaFin(e.target.value)}
                  style={{ ...INPUT, width: '150px' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
              </div>
              <button
                type="button"
                onClick={() => { setFechaInicio(yearStartStr()); setFechaFin(todayStr()); }}
                style={{
                  alignSelf: 'flex-end',
                  padding: '7px 14px',
                  backgroundColor: 'var(--raised)',
                  color: 'var(--text-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                YTD
              </button>
            </div>
          )}
        </div>

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

          {/* Descomposición precio vs dividendos */}
          {result.descomposicion && result.dividendos && (() => {
            const d = result.descomposicion!;
            const div = result.dividendos!;
            const total = Math.max(Math.abs(d.rentabilidad_total), 0.01);
            const pctPrecio = (Math.abs(d.rentabilidad_precio) / total) * 100;
            const pctDiv    = (Math.abs(d.rentabilidad_dividendos) / total) * 100;
            const maxIngreso = Math.max(...div.ingresos_anuales.map((x) => x.importe_por_100), 0.01);
            return (
              <div style={{ ...CARD, marginBottom: '20px' }}>
                <h3 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Descomposición del retorno · Precio vs Dividendos
                </h3>
                <p style={{ color: 'var(--text-2)', fontSize: '12px', margin: '0 0 20px' }}>
                  Tu retorno total se descompone en revalorización del precio + reinversión de dividendos.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
                  {/* Barra apilada */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Retorno total acumulado
                      </span>
                      <span style={{ color: d.rentabilidad_total >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '24px', fontWeight: 700 }}>
                        {d.rentabilidad_total >= 0 ? '+' : ''}{d.rentabilidad_total.toFixed(2)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', height: '36px', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'var(--raised)', marginBottom: '12px' }}>
                      <div style={{
                        width: `${pctPrecio}%`,
                        backgroundColor: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '12px', fontWeight: 600,
                      }}>
                        {pctPrecio > 12 ? `${d.rentabilidad_precio.toFixed(1)}%` : ''}
                      </div>
                      <div style={{
                        width: `${pctDiv}%`,
                        backgroundColor: 'var(--green)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '12px', fontWeight: 600,
                      }}>
                        {pctDiv > 12 ? `${d.rentabilidad_dividendos.toFixed(1)}%` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '11px' }}>
                      <span style={{ color: 'var(--accent)' }}>
                        ● Precio: <strong>{d.rentabilidad_precio.toFixed(2)}%</strong>
                        <span style={{ color: 'var(--text-3)', marginLeft: '4px' }}>({pctPrecio.toFixed(0)}%)</span>
                      </span>
                      <span style={{ color: 'var(--green)' }}>
                        ● Dividendos: <strong>{d.rentabilidad_dividendos.toFixed(2)}%</strong>
                        <span style={{ color: 'var(--text-3)', marginLeft: '4px' }}>({pctDiv.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div style={{ marginTop: '14px', padding: '10px 12px', backgroundColor: 'var(--raised)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.5 }}>
                      Por cada <strong style={{ color: 'var(--text)' }}>10.000 €</strong> invertidos al inicio,
                      la cartera generó aproximadamente <strong style={{ color: 'var(--green)' }}>{(div.ingresos_totales * 100).toFixed(0)} €</strong> en dividendos
                      durante todo el periodo (yield medio anual <strong style={{ color: 'var(--green)' }}>{div.yield_promedio_anual.toFixed(2)}%</strong>).
                    </div>
                  </div>
                  {/* Mini chart ingresos por año */}
                  <div>
                    <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px' }}>
                      Ingresos por dividendos · €/año (sobre 10 000 €)
                    </div>
                    {div.ingresos_anuales.length === 0 ? (
                      <div style={{ color: 'var(--text-3)', fontSize: '12px', fontStyle: 'italic' }}>
                        Sin dividendos en el periodo.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {div.ingresos_anuales.map((y) => {
                          const eur = y.importe_por_100 * 100;
                          const w = (y.importe_por_100 / maxIngreso) * 100;
                          return (
                            <div key={y.año} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: 'var(--text-2)', fontSize: '11px', width: '36px', fontFamily: 'monospace' }}>{y.año}</span>
                              <div style={{ flex: 1, height: '14px', backgroundColor: 'var(--raised)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${w}%`, height: '100%', backgroundColor: 'var(--green)' }} />
                              </div>
                              <span style={{ color: 'var(--green)', fontSize: '11px', fontWeight: 600, width: '52px', textAlign: 'right' }}>
                                {eur.toFixed(0)} €
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

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
