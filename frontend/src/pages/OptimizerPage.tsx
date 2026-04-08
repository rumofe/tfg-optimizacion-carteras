import { useState, CSSProperties } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ZAxis, ReferenceDot,
} from 'recharts';
import { optimizePortfolio, savePortfolio, OptimizeResult } from '../services/api';
import TickerSearch from '../components/TickerSearch';

const COLORS = ['#58a6ff', '#3fb950', '#d29922', '#bc8cff', '#f85149', '#79c0ff', '#fb8500', '#ff6b9d'];

function pct(n: number) { return `${(n * 100).toFixed(2)}%`; }

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

// Tooltip personalizado para el gráfico de frontera eficiente
function FronteraTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{
      backgroundColor: '#21262d', border: '1px solid #30363d',
      borderRadius: '8px', padding: '10px 14px', fontSize: '12px',
    }}>
      <div style={{ color: '#8b949e', marginBottom: '4px' }}>Frontera Eficiente</div>
      <div style={{ color: '#58a6ff' }}>Volatilidad: <strong>{d.volatilidad?.toFixed(2)}%</strong></div>
      <div style={{ color: '#3fb950' }}>Retorno: <strong>{d.retorno?.toFixed(2)}%</strong></div>
      <div style={{ color: '#d29922' }}>Sharpe: <strong>{d.sharpe?.toFixed(4)}</strong></div>
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

    if (tickers.length < 2) {
      setError('Añade al menos 2 activos para optimizar la cartera.');
      return;
    }

    setError('');
    setResult(null);
    setShowSaveForm(false);
    setSaveMsg(null);
    setLoading(true);

    try {
      const { data } = await optimizePortfolio(tickers, capital, maxVol / 100);
      setResult(data);
      setSubmittedTickers(tickers);
      setSubmittedCapital(capital);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Error al optimizar. Comprueba que los tickers son válidos.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!result || !saveName.trim()) return;
    setSaveLoading(true);
    setSaveMsg(null);
    try {
      await savePortfolio(saveName, submittedTickers, result.pesos, submittedCapital);
      setSaveMsg({ ok: true, text: `Cartera "${saveName}" guardada correctamente` });
      setShowSaveForm(false);
      setSaveName('');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setSaveMsg({ ok: false, text: typeof detail === 'string' ? detail : 'Error al guardar la cartera' });
    } finally {
      setSaveLoading(false);
    }
  }

  const pieData = result
    ? Object.entries(result.pesos)
        .filter(([, v]) => v > 0.001)
        .map(([name, value]) => ({ name, value: parseFloat((value * 100).toFixed(2)) }))
    : [];

  const sortedPesos = result
    ? Object.entries(result.pesos).sort(([, a], [, b]) => b - a)
    : [];

  // Datos para la frontera eficiente
  const fronteraData = result?.frontera ?? [];
  const optimalPoint = result
    ? { volatilidad: result.volatilidad * 100, retorno: result.retorno_esperado * 100, sharpe: result.sharpe_ratio }
    : null;

  // Activos individuales para el scatter
  const activosScatter = result
    ? Object.entries(result.activos_info).map(([ticker, info]) => ({
        ticker,
        volatilidad: info.volatilidad_anualizada,
        retorno: info.retorno_anualizado,
      }))
    : [];

  return (
    <div>
      <h1 style={{ color: '#e6edf3', fontSize: '22px', fontWeight: 700, margin: '0 0 6px' }}>
        Optimizador de Carteras
      </h1>
      <p style={{ color: '#8b949e', fontSize: '13px', margin: '0 0 28px' }}>
        Maximiza el ratio Sharpe bajo tu restricción de volatilidad — incluye Frontera Eficiente de Markowitz
      </p>

      {/* Form */}
      <form onSubmit={handleOptimize} style={{ ...CARD, marginBottom: '28px' }}>
        {/* Buscador de activos */}
        <div style={{ marginBottom: '16px' }}>
          <label style={LABEL}>ACTIVOS DE LA CARTERA</label>
          <TickerSearch selected={tickers} onChange={setTickers} maxItems={10} />
          {tickers.length > 0 && tickers.length < 2 && (
            <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '6px' }}>
              Añade al menos un activo más para poder optimizar
            </div>
          )}
        </div>

        {/* Capital y volatilidad */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: error ? '12px' : '16px' }}>
          <div>
            <label style={LABEL}>CAPITAL (€)</label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              min={100}
              required
              style={INPUT}
            />
          </div>
          <div>
            <label style={LABEL}>VOLATILIDAD MÁXIMA (%)</label>
            <input
              type="number"
              value={maxVol}
              onChange={(e) => setMaxVol(Number(e.target.value))}
              min={1}
              max={100}
              step={0.5}
              required
              style={INPUT}
            />
          </div>
        </div>

        {error && (
          <div style={{
            color: '#f85149', fontSize: '13px', marginBottom: '14px',
            padding: '9px 12px', backgroundColor: 'rgba(248, 81, 73, 0.08)',
            border: '1px solid rgba(248, 81, 73, 0.3)', borderRadius: '6px',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || tickers.length < 2}
          style={{
            padding: '10px 24px',
            backgroundColor: (loading || tickers.length < 2) ? '#21262d' : '#1f6feb',
            color: (loading || tickers.length < 2) ? '#8b949e' : '#fff',
            border: 'none', borderRadius: '6px',
            fontSize: '14px', fontWeight: 600,
            cursor: (loading || tickers.length < 2) ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Optimizando…' : 'Optimizar cartera'}
        </button>
      </form>

      {/* Results */}
      {result && (
        <>
          {/* Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'Retorno Esperado', value: pct(result.retorno_esperado), color: '#3fb950' },
              { label: 'Volatilidad',       value: pct(result.volatilidad),      color: '#d29922' },
              { label: 'Sharpe Ratio',      value: result.sharpe_ratio.toFixed(4), color: '#58a6ff' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ ...CARD, textAlign: 'center' }}>
                <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 500, letterSpacing: '0.4px', marginBottom: '8px' }}>
                  {label.toUpperCase()}
                </div>
                <div style={{ color, fontSize: '30px', fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Pie + Table */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            {/* PieChart */}
            <div style={CARD}>
              <h3 style={{ color: '#e6edf3', fontSize: '14px', fontWeight: 600, margin: '0 0 20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Distribución de pesos
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" strokeWidth={0}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#21262d', border: '1px solid #30363d', borderRadius: '8px', fontSize: '13px' }}
                    itemStyle={{ color: '#e6edf3' }}
                    formatter={(v: any) => [`${(v as number).toFixed(2)}%`, '']}
                  />
                  <Legend
                    formatter={(value) => (
                      <span style={{ color: '#e6edf3', fontSize: '12px' }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Weights Table */}
            <div style={CARD}>
              <h3 style={{ color: '#e6edf3', fontSize: '14px', fontWeight: 600, margin: '0 0 20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Asignación de activos
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Ticker', 'Peso', 'Capital (€)'].map((h) => (
                      <th key={h} style={{
                        color: '#8b949e', fontSize: '11px', fontWeight: 500,
                        textAlign: 'left', padding: '0 0 10px',
                        borderBottom: '1px solid #30363d',
                        letterSpacing: '0.4px',
                      }}>
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPesos.map(([ticker, peso], i) => (
                    <tr key={ticker}>
                      <td style={{ padding: '10px 0', borderBottom: '1px solid #21262d', fontSize: '14px' }}>
                        <span style={{ color: COLORS[i % COLORS.length], fontWeight: 700 }}>{ticker}</span>
                      </td>
                      <td style={{ color: '#e6edf3', padding: '10px 0', borderBottom: '1px solid #21262d', fontSize: '14px' }}>
                        {pct(peso)}
                      </td>
                      <td style={{ color: '#3fb950', padding: '10px 0', borderBottom: '1px solid #21262d', fontSize: '14px', fontWeight: 600 }}>
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
              <h3 style={{ color: '#e6edf3', fontSize: '14px', fontWeight: 600, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Frontera Eficiente de Markowitz
              </h3>
              <p style={{ color: '#8b949e', fontSize: '12px', margin: '0 0 20px' }}>
                Cada punto es un portfolio óptimo para un nivel de retorno. La estrella marca el portfolio de máximo Sharpe seleccionado.
              </p>
              <ResponsiveContainer width="100%" height={340}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis
                    dataKey="volatilidad"
                    type="number"
                    name="Volatilidad"
                    unit="%"
                    stroke="#21262d"
                    tick={{ fill: '#8b949e', fontSize: 11 }}
                    label={{ value: 'Volatilidad (%)', position: 'insideBottom', offset: -10, fill: '#8b949e', fontSize: 11 }}
                    domain={['auto', 'auto']}
                  />
                  <YAxis
                    dataKey="retorno"
                    type="number"
                    name="Retorno"
                    unit="%"
                    stroke="#21262d"
                    tick={{ fill: '#8b949e', fontSize: 11 }}
                    label={{ value: 'Retorno (%)', angle: -90, position: 'insideLeft', fill: '#8b949e', fontSize: 11 }}
                    domain={['auto', 'auto']}
                    width={60}
                  />
                  <ZAxis range={[30, 30]} />
                  <Tooltip content={<FronteraTooltip />} />

                  {/* Frontera eficiente */}
                  <Scatter
                    name="Frontera Eficiente"
                    data={fronteraData}
                    fill="#58a6ff"
                    opacity={0.7}
                    line={{ stroke: '#58a6ff', strokeWidth: 2 }}
                    lineType="joint"
                  />

                  {/* Activos individuales */}
                  <Scatter
                    name="Activos individuales"
                    data={activosScatter}
                    fill="#d29922"
                    opacity={0.9}
                  />

                  {/* Portfolio óptimo */}
                  {optimalPoint && (
                    <ReferenceDot
                      x={optimalPoint.volatilidad}
                      y={optimalPoint.retorno}
                      r={10}
                      fill="#f85149"
                      stroke="#fff"
                      strokeWidth={2}
                      label={{ value: '★ Óptimo', fill: '#f85149', fontSize: 11, dy: -16 }}
                    />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '20px', marginTop: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: '#58a6ff' }}>● Frontera Eficiente</span>
                <span style={{ fontSize: '12px', color: '#d29922' }}>● Activos individuales</span>
                <span style={{ fontSize: '12px', color: '#f85149' }}>★ Portfolio óptimo (max Sharpe)</span>
              </div>
            </div>
          )}

          {/* Save Portfolio */}
          {saveMsg && (
            <div style={{
              fontSize: '13px', marginBottom: '14px', padding: '10px 14px',
              borderRadius: '8px',
              color: saveMsg.ok ? '#3fb950' : '#f85149',
              backgroundColor: saveMsg.ok ? 'rgba(63, 185, 80, 0.08)' : 'rgba(248, 81, 73, 0.08)',
              border: `1px solid ${saveMsg.ok ? 'rgba(63, 185, 80, 0.3)' : 'rgba(248, 81, 73, 0.3)'}`,
            }}>
              {saveMsg.ok ? '✓ ' : '✗ '}{saveMsg.text}
            </div>
          )}

          {!showSaveForm ? (
            <button
              onClick={() => { setShowSaveForm(true); setSaveMsg(null); }}
              style={{
                padding: '10px 24px',
                backgroundColor: 'transparent',
                color: '#3fb950',
                border: '1px solid rgba(63, 185, 80, 0.5)',
                borderRadius: '6px',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              + Guardar cartera
            </button>
          ) : (
            <form onSubmit={handleSave} style={{
              ...CARD,
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}>
              <div style={{ flex: '1 1 260px' }}>
                <label style={LABEL}>NOMBRE DE LA CARTERA</label>
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Mi cartera tecnológica"
                  required
                  style={INPUT}
                />
              </div>
              <button
                type="submit"
                disabled={saveLoading}
                style={{
                  padding: '10px 20px', backgroundColor: '#1f6feb', color: '#fff',
                  border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600,
                  cursor: saveLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {saveLoading ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => setShowSaveForm(false)}
                style={{
                  padding: '10px 20px', backgroundColor: 'transparent', color: '#8b949e',
                  border: '1px solid #30363d', borderRadius: '6px', fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
