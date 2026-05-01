import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ZAxis, ReferenceDot,
} from 'recharts';
import { optimizePortfolio, savePortfolio, getProfile, OptimizeResult, ParetoPoint, OptimizationMethod } from '../services/api';
import TickerSearch from '../components/TickerSearch';
import SliderInput from '../components/SliderInput';
import { COLORS, CARD, INPUT, LABEL } from '../styles';
import { TEMPLATES, PERFIL_META, detectarPerfil, PortfolioTemplate, PerfilTemplate } from '../portfolioTemplates';

function pct(n: number) { return `${(n * 100).toFixed(2)}%`; }

// ── Pareto helpers ────────────────────────────────────────────────────────────
function paretoColor(theta: number): string {
  // Degradado continuo: morado (#7c3aed) → azul accent (#4f86f7)
  const r = Math.round(124 - 45 * theta);
  const g = Math.round(58  + 76 * theta);
  const b = Math.round(237 + 10 * theta);
  return `rgb(${r},${g},${b})`;
}

function PuntoParetoShape(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={5} fill={paretoColor(payload?.theta ?? 0.5)} opacity={0.88} />;
}

function ParetoTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: ParetoPoint = payload[0]?.payload;
  if (!d) return null;
  const tipo = d.theta > 0.65 ? 'Orientado a Sharpe' : d.theta < 0.35 ? 'Orientado a Sortino' : 'Equilibrado';
  return (
    <div style={{ backgroundColor: 'var(--raised)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
      <div style={{ color: paretoColor(d.theta), fontWeight: 700, marginBottom: '6px' }}>{tipo} (θ={d.theta.toFixed(2)})</div>
      <div style={{ color: 'var(--text-2)' }}>Sharpe   <strong style={{ color: 'var(--accent)' }}>{d.sharpe.toFixed(3)}</strong></div>
      <div style={{ color: 'var(--text-2)' }}>Sortino  <strong style={{ color: 'var(--purple)' }}>{d.sortino.toFixed(3)}</strong></div>
      <div style={{ color: 'var(--text-2)' }}>Volatilidad <strong style={{ color: 'var(--amber)' }}>{d.volatilidad.toFixed(1)}%</strong></div>
      <div style={{ color: 'var(--text-2)' }}>Retorno  <strong style={{ color: 'var(--green)' }}>{d.retorno.toFixed(1)}%</strong></div>
    </div>
  );
}

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
  const [maxVol, setMaxVol] = useState(25);
  const [userProfile, setUserProfile] = useState<PerfilTemplate | null>(null);
  const [mostrarTodasPlantillas, setMostrarTodasPlantillas] = useState(false);
  const [plantillaActiva, setPlantillaActiva] = useState<string | null>(null);
  const [plannerHint, setPlannerHint] = useState<{ capital: number; equity: number; bonds: number } | null>(null);

  // Pre-rellenar capital y volatilidad máxima desde el perfil del inversor
  useEffect(() => {
    getProfile().then(({ data }) => {
      if (data.capital_base)      setCapital(data.capital_base);
      if (data.tolerancia_riesgo) setMaxVol(data.tolerancia_riesgo);
      setUserProfile(detectarPerfil(data.tolerancia_riesgo));
    }).catch(() => { /* perfil no disponible, usar defaults */ });

    // Si el usuario viene del Planner, pre-rellenar capital + mostrar hint de allocation
    const recRaw = localStorage.getItem('plannerRecommendation');
    if (recRaw) {
      try {
        const rec = JSON.parse(recRaw);
        // Solo válido si llegó hace menos de 10 minutos
        if (Date.now() - rec.timestamp < 10 * 60 * 1000) {
          if (rec.capitalInvertible > 0) setCapital(rec.capitalInvertible);
          setPlannerHint({
            capital: rec.capitalInvertible,
            equity:  rec.assetAllocation.equity,
            bonds:   rec.assetAllocation.bonds + rec.assetAllocation.realEstate + rec.assetAllocation.commodities,
          });
        }
        localStorage.removeItem('plannerRecommendation');
      } catch { /* JSON inválido */ }
    }
  }, []);

  function aplicarPlantilla(t: PortfolioTemplate) {
    setTickers(t.tickers);
    setMaxVol(t.volatilidadSugerida);
    setPlantillaActiva(t.id);
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [metodo, setMetodo] = useState<OptimizationMethod>('markowitz');
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
      const { data } = await optimizePortfolio(tickers, capital, maxVol / 100, metodo);
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
        <h1 style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>
          Optimizador de Carteras
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: 0 }}>
          Maximización del ratio Sharpe · Frontera Eficiente de Markowitz
        </p>
      </div>

      {/* Banner del Planner (si llega recomendación) */}
      {plannerHint && (
        <div style={{
          ...CARD,
          marginBottom: '20px',
          backgroundColor: 'rgba(79, 134, 247, 0.08)',
          border: '1px solid rgba(79, 134, 247, 0.35)',
          borderLeft: '3px solid var(--accent)',
          display: 'flex', alignItems: 'flex-start', gap: '14px',
        }}>
          <div style={{ fontSize: '20px', lineHeight: 1, paddingTop: '2px' }}>📋</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              Recomendación del Planificador aplicada
            </div>
            <div style={{ color: 'var(--text)', fontSize: '13px', lineHeight: 1.6 }}>
              Capital invertible: <strong>{plannerHint.capital.toLocaleString('es-ES')} €</strong>.
              Asset allocation sugerida: <strong>{plannerHint.equity.toFixed(0)} %</strong> renta variable +
              <strong> {plannerHint.bonds.toFixed(0)} %</strong> renta fija/alternativos.
            </div>
            <div style={{ color: 'var(--text-2)', fontSize: '11px', marginTop: '4px' }}>
              Para respetar la asignación, elige plantillas con BND/AGG/TLT (renta fija) o un mix con ETFs como SPY+BND.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPlannerHint(null)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-3)',
              cursor: 'pointer', fontSize: '16px', padding: '0 4px',
            }}
            title="Ocultar"
          >×</button>
        </div>
      )}

      {/* Plantillas según perfil */}
      {(() => {
        const plantillasVisibles = mostrarTodasPlantillas || !userProfile
          ? TEMPLATES
          : TEMPLATES.filter((t) => t.perfil === userProfile);
        const perfilLabel = userProfile ? PERFIL_META[userProfile].label.toLowerCase() : null;
        return (
          <div style={{ ...CARD, marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Plantillas {userProfile && !mostrarTodasPlantillas ? <>· perfil <span style={{ color: PERFIL_META[userProfile].color }}>{perfilLabel}</span></> : 'de cartera'}
                </div>
                <div style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: '3px' }}>
                  Un click → autorrellena tickers y volatilidad. Solo falta pulsar "Optimizar".
                </div>
              </div>
              {userProfile && (
                <button
                  type="button"
                  onClick={() => setMostrarTodasPlantillas((v) => !v)}
                  style={{
                    padding: '5px 12px', fontSize: '11px',
                    backgroundColor: 'transparent', color: 'var(--text-2)',
                    border: '1px solid var(--border)', borderRadius: '14px',
                    cursor: 'pointer',
                  }}
                >
                  {mostrarTodasPlantillas ? `Solo mi perfil (${perfilLabel})` : 'Ver todas'}
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {plantillasVisibles.map((t) => {
                const meta = PERFIL_META[t.perfil];
                const active = plantillaActiva === t.id;
                const visibleTickers = t.tickers.slice(0, 6);
                const restantes = t.tickers.length - visibleTickers.length;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => aplicarPlantilla(t)}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: active ? 'var(--raised)' : 'transparent',
                      border: `1px solid ${active ? meta.color : 'var(--border)'}`,
                      borderLeft: `3px solid ${meta.color}`,
                      borderRadius: 'var(--radius-sm)',
                      textAlign: 'left', cursor: 'pointer',
                      transition: 'all 0.15s',
                      display: 'flex', flexDirection: 'column', gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 600 }}>{t.nombre}</span>
                      <span style={{ color: meta.color, fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap' }}>≤ {t.volatilidadSugerida}%</span>
                    </div>
                    <div style={{ color: 'var(--text-3)', fontSize: '10px', lineHeight: 1.4 }}>
                      {t.descripcion}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '2px' }}>
                      {visibleTickers.map((tk) => (
                        <span key={tk} style={{
                          padding: '1px 6px', fontSize: '10px',
                          backgroundColor: 'var(--raised)', color: 'var(--text-2)',
                          border: '1px solid var(--border)', borderRadius: '8px',
                          fontFamily: 'monospace',
                        }}>{tk}</span>
                      ))}
                      {restantes > 0 && (
                        <span style={{ padding: '1px 6px', fontSize: '10px', color: 'var(--text-3)' }}>+{restantes}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Form */}
      <form onSubmit={handleOptimize} style={{ ...CARD, marginBottom: '28px' }}>

        {/* Selector de método de optimización */}
        <div style={{ marginBottom: '18px' }}>
          <label style={LABEL}>Método de optimización</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {([
              { id: 'markowitz',    label: 'Sharpe (Markowitz)', descr: 'Maximiza retorno/riesgo ajustado',    color: 'var(--accent)' },
              { id: 'min_variance', label: 'Mínima varianza',    descr: 'La cartera con menos volatilidad',     color: 'var(--green)'  },
              { id: 'risk_parity',  label: 'Risk Parity',         descr: 'Cada activo aporta igual riesgo',     color: 'var(--purple)' },
              { id: 'equal_weight', label: 'Equal Weight (1/N)',  descr: 'Pesos iguales, sin optimización',     color: 'var(--amber)'  },
            ] as const).map(({ id, label, descr, color }) => {
              const active = metodo === id;
              return (
                <button
                  key={id} type="button" onClick={() => setMetodo(id)}
                  style={{
                    padding: '10px 12px', textAlign: 'left',
                    backgroundColor: active ? 'var(--raised)' : 'transparent',
                    border: `1px solid ${active ? color : 'var(--border)'}`,
                    borderLeft: `3px solid ${active ? color : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ color: active ? color : 'var(--text)', fontSize: '12px', fontWeight: 600, marginBottom: '3px' }}>{label}</div>
                  <div style={{ color: 'var(--text-3)', fontSize: '10px', lineHeight: 1.4 }}>{descr}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={LABEL}>Activos de la cartera</label>
          <TickerSearch selected={tickers} onChange={setTickers} maxItems={10} />
          {tickers.length === 1 && (
            <p style={{ color: 'var(--text-3)', fontSize: '11px', margin: '6px 0 0' }}>
              Añade al menos un activo más para optimizar
            </p>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', marginBottom: '24px' }}>
          <SliderInput
            label="Capital inicial"
            value={capital}
            onChange={setCapital}
            min={500} max={500000} step={50}
            scale="log"
            prefix="€"
            formatDisplay={(v) => v.toLocaleString('es-ES')}
            formatMin="€ 500"
            formatMax="€ 500 K"
          />
          <div>
            {metodo === 'markowitz' ? (
              <>
                <SliderInput
                  label="Volatilidad máxima"
                  value={maxVol}
                  onChange={setMaxVol}
                  min={10} max={60} step={1}
                  suffix="%"
                  formatDisplay={(v) => v.toFixed(0)}
                  formatMin="10%"
                  formatMax="60%"
                />
                {/* Presets */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Conservador', vol: 15, color: 'var(--green)'  },
                    { label: 'Moderado',    vol: 25, color: 'var(--accent)' },
                    { label: 'Agresivo',    vol: 40, color: 'var(--amber)'  },
                    { label: 'Sin límite',  vol: 55, color: 'var(--red)'    },
                  ].map(({ label, vol, color }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setMaxVol(vol)}
                      style={{
                        padding: '3px 10px',
                        backgroundColor: maxVol === vol ? color : 'var(--raised)',
                        color: maxVol === vol ? '#fff' : 'var(--text-2)',
                        border: `1px solid ${maxVol === vol ? color : 'var(--border)'}`,
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: maxVol === vol ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {label} {vol}%
                    </button>
                  ))}
                </div>
                <p style={{ color: 'var(--text-2)', fontSize: '10px', margin: '6px 0 0' }}>
                  Referencia: S&P 500 ≈ 15–18 % anual · acciones individuales 25–40 %
                </p>
              </>
            ) : (
              <div style={{
                padding: '14px 16px',
                backgroundColor: 'var(--raised)',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border)',
                fontSize: '11px',
                color: 'var(--text-2)',
                lineHeight: 1.5,
              }}>
                <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Sin restricción de volatilidad
                </div>
                {metodo === 'min_variance' && '"Mínima varianza" busca la cartera con menor volatilidad posible — no necesita un límite, lo minimiza directamente.'}
                {metodo === 'risk_parity' && '"Risk Parity" reparte el riesgo equitativamente entre activos. La volatilidad resultante depende de la cartera, no se restringe.'}
                {metodo === 'equal_weight' && '"Equal Weight" asigna 1/N a cada activo. Sin optimización, sin restricciones — baseline ingenuo.'}
              </div>
            )}
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
          backgroundColor: canSubmit ? 'var(--accent)' : 'var(--raised)',
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
          {/* Badge del método usado */}
          {result.metodo && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 14px', backgroundColor: 'var(--raised)',
              border: '1px solid var(--border)', borderRadius: '20px',
              fontSize: '11px', color: 'var(--text-2)',
              marginBottom: '14px', fontWeight: 600,
            }}>
              <span style={{ color: 'var(--text-3)' }}>Método</span>
              <span style={{ color: 'var(--text)' }}>
                {result.metodo === 'markowitz'    ? 'Sharpe (Markowitz)'    :
                 result.metodo === 'min_variance' ? 'Mínima varianza'         :
                 result.metodo === 'risk_parity'  ? 'Risk Parity'             :
                 'Equal Weight (1/N)'}
              </span>
            </div>
          )}

          {/* Métricas principales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
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
                <div style={{ color, fontSize: '28px', fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Métricas de calidad de la cartera (concentración / diversificación) */}
          {result.diversification_ratio != null && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
              <div style={{ ...CARD, padding: '14px 18px', borderLeft: '3px solid var(--purple)' }}>
                <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Diversification ratio</div>
                <div style={{ color: 'var(--purple)', fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>{result.diversification_ratio!.toFixed(2)}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '3px', lineHeight: 1.4 }}>
                  Choueifaty: ratio entre vol media ponderada y vol cartera. {'>'} 1 indica diversificación efectiva.
                </div>
              </div>
              <div style={{ ...CARD, padding: '14px 18px', borderLeft: '3px solid #22d3ee' }}>
                <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Concentración (HHI)</div>
                <div style={{ color: '#22d3ee', fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>{result.concentracion_hhi!.toFixed(3)}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '3px', lineHeight: 1.4 }}>
                  Herfindahl-Hirschman: {'<'} 0.15 → diversificada · {'>'} 0.25 → concentrada.
                </div>
              </div>
              <div style={{ ...CARD, padding: '14px 18px', borderLeft: '3px solid var(--amber)' }}>
                <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Activos efectivos</div>
                <div style={{ color: 'var(--amber)', fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>{result.activos_efectivos!.toFixed(1)}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '3px', lineHeight: 1.4 }}>
                  Nº equivalente de activos con peso uniforme. Alto = diversificado, bajo = concentrado.
                </div>
              </div>
            </div>
          )}

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

          {/* Frontera de Pareto */}
          {result.pareto && result.pareto.length > 0 && (() => {
            const maxSharpePoint = result.pareto.reduce((a, b) => a.sharpe > b.sharpe ? a : b);
            return (
              <div style={{ ...CARD, marginBottom: '24px' }}>
                <h3 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Frontera de Pareto — Sharpe vs. Sortino
                </h3>
                <p style={{ color: 'var(--text-2)', fontSize: '12px', margin: '0 0 20px' }}>
                  Cada punto es un portfolio óptimo para una combinación distinta de objetivos. Ningún punto puede mejorar Sharpe y Sortino simultáneamente — eso es la frontera de Pareto. La estrella marca el portfolio seleccionado (máximo Sharpe).
                </p>
                <ResponsiveContainer width="100%" height={320}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 28, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="sharpe" type="number" name="Sharpe"
                      stroke="var(--border)" tick={{ fill: 'var(--text-2)', fontSize: 11 }}
                      label={{ value: 'Sharpe Ratio', position: 'insideBottom', offset: -16, fill: 'var(--text-2)', fontSize: 11 }}
                      domain={['auto', 'auto']}
                    />
                    <YAxis
                      dataKey="sortino" type="number" name="Sortino"
                      stroke="var(--border)" tick={{ fill: 'var(--text-2)', fontSize: 11 }}
                      label={{ value: 'Sortino Ratio', angle: -90, position: 'insideLeft', fill: 'var(--text-2)', fontSize: 11 }}
                      domain={['auto', 'auto']} width={60}
                    />
                    <ZAxis range={[44, 44]} />
                    <Tooltip content={<ParetoTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter
                      name="Frontera de Pareto"
                      data={result.pareto}
                      shape={<PuntoParetoShape />}
                      line={{ stroke: 'rgba(150,150,200,0.25)', strokeWidth: 1 }}
                      lineType="joint"
                    />
                    <ReferenceDot
                      x={maxSharpePoint.sharpe} y={maxSharpePoint.sortino}
                      r={9} fill="var(--red)" stroke="#fff" strokeWidth={2}
                      label={{ value: '★ Óptimo', fill: 'var(--red)', fontSize: 11, dy: -15 }}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
                {/* Leyenda del gradiente */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>Foco del portfolio:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '80px', height: '6px', borderRadius: '3px', background: `linear-gradient(to right, ${paretoColor(0)}, ${paretoColor(1)})` }} />
                  </div>
                  <span style={{ fontSize: '11px', color: paretoColor(0) }}>← Sortino puro</span>
                  <span style={{ fontSize: '11px', color: paretoColor(1) }}>Sharpe puro →</span>
                  <span style={{ fontSize: '11px', color: 'var(--red)', marginLeft: '12px' }}>★ Portfolio seleccionado</span>
                </div>
              </div>
            );
          })()}

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
