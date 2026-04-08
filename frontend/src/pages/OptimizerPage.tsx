import { useState, CSSProperties } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ZAxis, ReferenceDot,
} from 'recharts';
import { optimizePortfolio, savePortfolio, OptimizeResult } from '../services/api';
import TickerSearch from '../components/TickerSearch';

const COLORS = ['#4f86f7', '#0ea875', '#f0a020', '#9b6ef5', '#e84040', '#22d3ee', '#f472b6', '#a3e635'];

function pct(n: number) { return `${(n * 100).toFixed(2)}%`; }

const INPUT: CSSProperties = {
  width: '100%', padding: '10px 14px',
  backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text)',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box',
};

const LABEL: CSSProperties = {
  display: 'block', color: 'var(--text-2)', fontSize: '11px',
  marginBottom: '6px', fontWeight: 600, letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

const CARD: CSSProperties = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '24px',
};

function FronteraTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{
      backgroundColor: 'var(--raised)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '12px',
    }}>
      <div style={{ color: 'var(--text-2)', marginBottom: '6px', fontWeight: 600 }}>Frontera Eficiente</div>
      <div style={{ color: 'var(--accent)' }}>Volatilidad: <strong>{d.volatilidad?.toFixed(2)}%</strong></div>
      <div style={{ color: 'var(--green)' }}>Retorno: <strong>{d.retorno?.toFixed(2)}%</strong></div>
      <div style={{ color: 'var(--amber)' }}>Sharpe: <strong>{d.sharpe?.toFixed(4)}</strong></div>
    </div>
  );
}

export default function OptimizerPage() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [capital, setCapital] = useState(10000);
  const [maxVol, setMaxVol] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [submittedCapital, setSubmittedCapital] = useState(0);
  const [submittedTickers, setSubmittedTickers] = useState<string[]>([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleOptimize(e: React.FormEvent) {
    e.preventDefault();
    if (tickers.length < 2) { setError('Añade al menos 2 activos para optimizar la cartera.'); return; }
    setError(''); setResult(null); setShowSaveForm(false); setSaveMsg(null); setLoading(true);
    try {
      const { data } = await optimizePortfolio(tickers, capital, maxVol / 100);
      setResult(data); setSubmittedTickers(tickers); setSubmittedCapital(capital);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Error al optimizar. Comprueba que los tickers son válidos.');
    } finally { setLoading(false); }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!result || !saveName.trim()) return;
    setSaveLoading(true); setSaveMsg(null);
    try {
      await savePortfolio(saveName, submittedTickers, result.pesos, submittedCapital);
      setSaveMsg({ ok: true, text: `Cartera "${saveName}" guardada` });
      setShowSaveForm(false); setSaveName('');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setSaveMsg({ ok: false, text: typeof detail === 'string' ? detail : 'Error al guardar la cartera' });
    } finally { setSaveLoading(false); }
  }

  const pieData = result
    ? Object.entries(result.pesos).filter(([, v]) => v > 0.001)
        .map(([name, value]) => ({ name, value: parseFloat((value * 100).toFixed(2)) }))
    : [];
  const sortedPesos = result ? Object.entries(result.pesos).sort(([, a], [, b]) => b - a) : [];
  const fronteraData = result?.frontera ?? [];
  const optimalPoint = result
    ? { volatilidad: result.volatilidad * 100, retorno: result.retorno_esperado * 100 }
    : null;
  const activosScatter = result
    ? Object.entries(result.activos_info).map(([ticker, info]) => ({
        ticker, volatilidad: info.volatilidad_anualizada, retorno: info.retorno_anualizado,
      }))
    : [];

  const canSubmit = !loading && tickers.length >= 2;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.3px' }}>
          Optimizador de Carteras
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: 0 }}>
          Maximización del ratio Sharpe · Frontera Eficiente de Markowitz
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleOptimize} style={{ ...CARD, marginBottom: '28px' }}>
        <div style={{ marginBottom: '18px' }}>
          <label style={LABEL}>Activos de la cartera</label>
          <TickerSearch selected={tickers} onChange={setTickers} maxItems={10} />
          {tickers.length === 1 && (
            <p style={{ color: 'var(--text-3)', fontSize: '11px', margin: '6px 0 0' }}>
              Añade al menos un activo más para optimizar
            </p>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={LABEL}>Capital (€)</label>
            <input type="number" value={capital} min={100} required style={INPUT}
              onChange={(e) => setCapital(Number(e.target.value))} />
          </div>
          <div>
            <label style={LABEL}>Volatilidad máxima (%)</label>
            <input type="number" value={maxVol} min={1} max={100} step={0.5} required style={INPUT}
              onChange={(e) => setMaxVol(Number(e.target.value))} />
          </div>
        </div>

        {error && (
          <div style={{
            color: 'var(--red)', fontSize: '13px', marginBottom: '16px',
            padding: '10px 14px', backgroundColor: 'rgba(232,64,64,0.07)',
            border: '1px solid rgba(232,64,64,0.2)', borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span>⚠</span> {error}
          </div>
        )}

        <button type="submit" disabled={!canSubmit} style={{
          padding: '10px 28px',
          background: canSubmit ? 'linear-gradient(135deg, #4f86f7 0%, #6d5ef5 100%)' : 'var(--raised)',
          color: canSubmit ? '#fff' : 'var(--text-3)',
          border: 'none', borderRadius: 'var(--radius-sm)',
          fontSize: '14px', fontWeight: 600,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          transition: 'opacity 0.15s',
        }}>
          {loading ? 'Optimizando…' : 'Optimizar cartera'}
        </button>
      </form>

      {result && (
        <>
          {/* Métricas principales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
            {[
              { label: 'Retorno Esperado', value: pct(result.retorno_esperado), color: 'var(--green)',  border: 'var(--green)' },
              { label: 'Volatilidad',       value: pct(result.volatilidad),      color: 'var(--amber)',  border: 'var(--amber)' },
              { label: 'Sharpe Ratio',      value: result.sharpe_ratio.toFixed(4), color: 'var(--accent)', border: 'var(--accent)' },
            ].map(({ label, value, color, border }) => (
              <div key={label} style={{
                ...CARD, padding: '20px 24px',
                borderLeft: `3px solid ${border}`,
              }}>
                <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>
                  {label}
                </div>
                <div style={{ color, fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Pie + tabla */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div style={CARD}>
              <h3 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, margin: '0 0 20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Distribución de pesos
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={95} innerRadius={40} dataKey="value" strokeWidth={0}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--raised)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: 'var(--text)' }}
                    formatter={(v: any) => [`${(v as number).toFixed(2)}%`, '']}
                  />
                  <Legend formatter={(value) => <span style={{ color: 'var(--text-2)', fontSize: '12px' }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={CARD}>
              <h3 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, margin: '0 0 20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Asignación de activos
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Ticker', 'Peso', 'Capital (€)'].map((h) => (
                      <th key={h} style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textAlign: 'left', padding: '0 0 10px', borderBottom: '1px solid var(--border)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPesos.map(([ticker, peso], i) => (
                    <tr key={ticker}>
                      <td style={{ padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: COLORS[i % COLORS.length], fontWeight: 700, fontSize: '14px' }}>{ticker}</span>
                      </td>
                      <td style={{ color: 'var(--text)', padding: '11px 0', borderBottom: '1px solid var(--border)', fontSize: '14px' }}>
                        {pct(peso)}
                      </td>
                      <td style={{ color: 'var(--green)', padding: '11px 0', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 600 }}>
                        €{(peso * submittedCapital).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Frontera Eficiente */}
          {fronteraData.length > 0 && (
            <div style={{ ...CARD, marginBottom: '24px' }}>
              <h3 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Frontera Eficiente de Markowitz
              </h3>
              <p style={{ color: 'var(--text-2)', fontSize: '12px', margin: '0 0 20px' }}>
                Cada punto representa un portfolio óptimo (mínima volatilidad para cada retorno objetivo).
                La estrella marca el portfolio seleccionado con máximo Sharpe.
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 24, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="volatilidad" type="number" name="Volatilidad" unit="%"
                    stroke="var(--border)" tick={{ fill: 'var(--text-2)', fontSize: 11 }}
                    label={{ value: 'Volatilidad (%)', position: 'insideBottom', offset: -14, fill: 'var(--text-2)', fontSize: 11 }}
                    domain={['auto', 'auto']} />
                  <YAxis dataKey="retorno" type="number" name="Retorno" unit="%"
                    stroke="var(--border)" tick={{ fill: 'var(--text-2)', fontSize: 11 }}
                    label={{ value: 'Retorno (%)', angle: -90, position: 'insideLeft', fill: 'var(--text-2)', fontSize: 11 }}
                    domain={['auto', 'auto']} width={60} />
                  <ZAxis range={[28, 28]} />
                  <Tooltip content={<FronteraTooltip />} />
                  <Scatter name="Frontera Eficiente" data={fronteraData} fill="var(--accent)" opacity={0.7}
                    line={{ stroke: 'var(--accent)', strokeWidth: 2 }} lineType="joint" />
                  <Scatter name="Activos individuales" data={activosScatter} fill="var(--amber)" opacity={0.9} />
                  {optimalPoint && (
                    <ReferenceDot x={optimalPoint.volatilidad} y={optimalPoint.retorno}
                      r={9} fill="var(--red)" stroke="#fff" strokeWidth={2}
                      label={{ value: '★ Óptimo', fill: 'var(--red)', fontSize: 11, dy: -15 }} />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--accent)' }}>● Frontera Eficiente</span>
                <span style={{ fontSize: '12px', color: 'var(--amber)' }}>● Activos individuales</span>
                <span style={{ fontSize: '12px', color: 'var(--red)' }}>★ Portfolio óptimo (max Sharpe)</span>
              </div>
            </div>
          )}

          {/* Guardar */}
          {saveMsg && (
            <div style={{
              fontSize: '13px', marginBottom: '14px', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              color: saveMsg.ok ? 'var(--green)' : 'var(--red)',
              backgroundColor: saveMsg.ok ? 'rgba(14,168,117,0.08)' : 'rgba(232,64,64,0.08)',
              border: `1px solid ${saveMsg.ok ? 'rgba(14,168,117,0.25)' : 'rgba(232,64,64,0.25)'}`,
            }}>
              {saveMsg.ok ? '✓ ' : '⚠ '}{saveMsg.text}
            </div>
          )}

          {!showSaveForm ? (
            <button onClick={() => { setShowSaveForm(true); setSaveMsg(null); }} style={{
              padding: '9px 22px', backgroundColor: 'transparent',
              color: 'var(--green)', border: '1px solid rgba(14,168,117,0.4)',
              borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}>
              + Guardar cartera
            </button>
          ) : (
            <form onSubmit={handleSave} style={{ ...CARD, display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 260px' }}>
                <label style={LABEL}>Nombre de la cartera</label>
                <input value={saveName} onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Mi cartera tecnológica" required style={INPUT} />
              </div>
              <button type="submit" disabled={saveLoading} style={{
                padding: '10px 20px', backgroundColor: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 600,
                cursor: saveLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
              }}>
                {saveLoading ? 'Guardando…' : 'Guardar'}
              </button>
              <button type="button" onClick={() => setShowSaveForm(false)} style={{
                padding: '10px 20px', backgroundColor: 'transparent', color: 'var(--text-2)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '13px', cursor: 'pointer',
              }}>
                Cancelar
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
