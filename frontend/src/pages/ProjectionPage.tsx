import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine,
} from 'recharts';
import {
  getPortfolios, runMonteCarlo, getProfile, Portfolio, MonteCarloResult, MonteCarloMode,
} from '../services/api';
import { CARD, INPUT, LABEL } from '../styles';

function eur(n: number) { return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }); }
function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }

function FanTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{
      backgroundColor: 'var(--raised)', border: '1px solid var(--border)',
      borderRadius: '8px', padding: '10px 14px', fontSize: '12px',
    }}>
      <div style={{ color: 'var(--text-2)', marginBottom: '6px', fontWeight: 600 }}>
        Año {Number(label).toFixed(1)}
      </div>
      <div style={{ color: 'var(--green)' }}>Mejor 5 % &nbsp;<strong>{eur(d.p95)} €</strong></div>
      <div style={{ color: 'var(--accent)' }}>Mediana &nbsp;<strong>{eur(d.p50)} €</strong></div>
      <div style={{ color: 'var(--red)' }}>Peor 5 % &nbsp;<strong>{eur(d.p5)} €</strong></div>
      <div style={{ color: 'var(--text-3)', marginTop: '4px', fontSize: '11px' }}>
        Rango central (25–75 %): {eur(d.p25)} – {eur(d.p75)} €
      </div>
    </div>
  );
}

export default function ProjectionPage() {
  // ── Inputs del usuario ──────────────────────────────────────────────────
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [años, setAños] = useState(10);
  const [capital, setCapital] = useState(10000);
  const [nSims, setNSims] = useState(5000);
  const [modo, setModo] = useState<MonteCarloMode>('ajustado');
  const [cagrManualStr, setCagrManualStr] = useState<string>('7');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<MonteCarloResult | null>(null);

  useEffect(() => {
    Promise.all([getPortfolios(), getProfile().catch(() => null)])
      .then(([p, prof]) => {
        setPortfolios(p.data);
        if (prof?.data?.capital_base) setCapital(prof.data.capital_base);
      })
      .catch(() => { /* ignorar */ });
  }, []);

  const selected = portfolios.find((p) => p.id === selectedId) ?? null;

  async function handleSimulate() {
    if (!selected) { setError('Selecciona una cartera guardada para proyectar.'); return; }
    setError(''); setResult(null); setLoading(true);
    try {
      const tickers = selected.activos.map((a) => a.ticker);
      const pesos: Record<string, number> = Object.fromEntries(
        selected.activos.map((a) => [a.ticker, a.peso_asignado]),
      );
      const cagrManual = modo === 'manual'
        ? (parseFloat(cagrManualStr.replace(',', '.')) || 0) / 100
        : null;
      const { data } = await runMonteCarlo(tickers, pesos, años, nSims, capital, modo, cagrManual);
      setResult(data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Error al ejecutar la simulación.');
    } finally {
      setLoading(false);
    }
  }

  // Datos para histograma (frecuencia → barras)
  const histData = useMemo(() => {
    if (!result) return [];
    return result.histograma.map((h) => ({
      valor: (h.valor_min + h.valor_max) / 2,
      label: eur(h.valor_min) + '€',
      frecuencia: h.frecuencia,
      // Para colorear: rojo si valor < capital_inicial (pérdida), verde si no
      perdida: h.valor_max < (result.parametros.capital_inicial),
    }));
  }, [result]);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>
          Proyección Monte Carlo
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: 0 }}>
          Simula miles de trayectorias futuras de tu cartera usando bootstrap sobre retornos históricos.
          Te muestra el rango de resultados posibles a varios años.
        </p>
      </div>

      {/* Configuración */}
      <div style={{ ...CARD, marginBottom: '24px' }}>
        {portfolios.length === 0 ? (
          <div style={{ color: 'var(--text-2)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
            No tienes carteras guardadas. Crea alguna desde el Optimizador.
          </div>
        ) : (
          <>
            {/* Selector de cartera */}
            <label style={LABEL}>Cartera a proyectar</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px', marginBottom: '20px' }}>
              {portfolios.map((p) => {
                const active = selectedId === p.id;
                return (
                  <button
                    key={p.id} type="button" onClick={() => setSelectedId(p.id)}
                    style={{
                      padding: '10px 12px', textAlign: 'left',
                      backgroundColor: active ? 'var(--raised)' : 'transparent',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      borderLeft: `3px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    }}
                  >
                    <div style={{ color: active ? 'var(--accent)' : 'var(--text)', fontSize: '13px', fontWeight: 600 }}>
                      {p.nombre_estrategia}
                    </div>
                    <div style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: '2px' }}>
                      {p.activos.length} activos · {p.fecha_creacion}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Parámetros */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
              <div>
                <label style={LABEL}>Capital inicial (€)</label>
                <input
                  type="number" min={100} step={500}
                  value={capital}
                  onChange={(e) => setCapital(parseFloat(e.target.value) || 0)}
                  style={INPUT}
                />
              </div>
              <div>
                <label style={LABEL}>Horizonte: <strong style={{ color: 'var(--text)' }}>{años} años</strong></label>
                <input
                  type="range" min={1} max={30} step={1}
                  value={años}
                  onChange={(e) => setAños(parseInt(e.target.value, 10))}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-3)' }}>
                  <span>1</span><span>30</span>
                </div>
              </div>
              <div>
                <label style={LABEL}>Simulaciones</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1000, 5000, 10000].map((n) => (
                    <button key={n} type="button" onClick={() => setNSims(n)}
                      style={{
                        flex: 1, padding: '8px 10px',
                        backgroundColor: nSims === n ? 'var(--accent)' : 'var(--raised)',
                        color: nSims === n ? '#fff' : 'var(--text-2)',
                        border: `1px solid ${nSims === n ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: '6px', cursor: 'pointer',
                        fontSize: '12px', fontWeight: nSims === n ? 600 : 400,
                      }}
                    >
                      {n.toLocaleString('es-ES')}
                    </button>
                  ))}
                </div>
                <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '4px' }}>
                  Más simulaciones = colas más estables
                </div>
              </div>
            </div>

            {/* Selector de modo de proyección */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--border)' }}>
              <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                Modelo de proyección
              </div>
              <div style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '12px' }}>
                El bootstrap puede preservar el drift histórico o ajustarlo a una expectativa más realista.
                A largo plazo (10+ años) recomendamos ajustar el drift: proyectar un mercado alcista atípico
                indefinidamente sobreestima los resultados.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {([
                  { id: 'ajustado',  label: 'Drift ajustado', descr: 'Bootstrap con CAGR esperado conservador (default 7 %). Recomendado.', color: 'var(--accent)' },
                  { id: 'manual',    label: 'Drift manual',    descr: 'Tú fijas el CAGR esperado. Útil si tienes una hipótesis propia.', color: 'var(--purple)' },
                  { id: 'historico', label: 'Histórico crudo', descr: 'Proyecta el drift histórico tal cual. Cuidado a largo plazo.',     color: 'var(--amber)' },
                ] as const).map(({ id, label, descr, color }) => {
                  const active = modo === id;
                  return (
                    <button
                      key={id} type="button" onClick={() => setModo(id)}
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
              {/* Input de CAGR manual */}
              {modo === 'manual' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                  <label style={{ color: 'var(--text-2)', fontSize: '12px' }}>CAGR esperado (%):</label>
                  <input
                    type="number" min={-30} max={50} step={0.5}
                    value={cagrManualStr}
                    onChange={(e) => setCagrManualStr(e.target.value)}
                    style={{ ...INPUT, maxWidth: '120px' }}
                  />
                  <span style={{ color: 'var(--text-3)', fontSize: '10px' }}>
                    S&P 500 histórico ≈ 10 % · Bonos ≈ 3-5 % · Cash ≈ 2 %
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div style={{
                color: 'var(--red)', fontSize: '13px', marginBottom: '12px',
                padding: '9px 12px', backgroundColor: 'rgba(232,64,64,0.08)',
                border: '1px solid rgba(232,64,64,0.3)', borderRadius: '6px',
              }}>{error}</div>
            )}

            <button
              type="button"
              onClick={handleSimulate}
              disabled={loading || !selected}
              style={{
                padding: '10px 24px',
                backgroundColor: loading || !selected ? 'var(--raised)' : 'var(--accent)',
                color: loading || !selected ? 'var(--text-3)' : '#fff',
                border: 'none', borderRadius: '6px',
                fontSize: '14px', fontWeight: 600,
                cursor: loading || !selected ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Simulando…' : `→ Ejecutar ${nSims.toLocaleString('es-ES')} simulaciones`}
            </button>
          </>
        )}
      </div>

      {/* Resultados */}
      {result && (
        <>
          {/* Info del modo aplicado + histórico de la cartera */}
          <div style={{
            ...CARD,
            marginBottom: '14px',
            padding: '14px 18px',
            display: 'flex', flexWrap: 'wrap', gap: '20px',
            alignItems: 'center',
            backgroundColor: 'var(--raised)',
          }}>
            <div>
              <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Modo</div>
              <div style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600 }}>
                {result.parametros.modo === 'historico'  ? 'Histórico crudo'  :
                 result.parametros.modo === 'ajustado'    ? 'Drift ajustado'   :
                 'Drift manual'}
              </div>
            </div>
            {result.parametros.cagr_aplicado != null && (
              <div>
                <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>CAGR objetivo</div>
                <div style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 600 }}>
                  {result.parametros.cagr_aplicado.toFixed(1)}% anual
                </div>
              </div>
            )}
            <div>
              <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>CAGR histórico cartera</div>
              <div style={{
                color: result.historico.cagr_anual > 18 ? 'var(--amber)' : 'var(--text)',
                fontSize: '13px', fontWeight: 600,
              }}>
                {result.historico.cagr_anual.toFixed(1)}% anual
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Vol histórica</div>
              <div style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600 }}>
                {result.historico.vol_anualizada.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Aviso si el histórico era anómalamente alto y se proyectó tal cual */}
          {result.aviso_drift && (
            <div style={{
              marginBottom: '14px',
              padding: '12px 16px',
              backgroundColor: 'rgba(232, 166, 64, 0.10)',
              border: '1px solid rgba(232, 166, 64, 0.4)',
              borderLeft: '3px solid var(--amber)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-2)',
              fontSize: '12px',
              lineHeight: 1.55,
            }}>
              <strong style={{ color: 'var(--amber)' }}>⚠ Aviso de proyección:</strong> {result.aviso_drift}
            </div>
          )}

          {/* Tarjetas resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <div style={{ ...CARD, padding: '14px 16px', borderLeft: '3px solid var(--accent)' }}>
              <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Valor mediano (p50)</div>
              <div style={{ color: 'var(--accent)', fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>{eur(result.valor_final.mediana)} €</div>
              <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '3px' }}>desde {eur(result.parametros.capital_inicial)} €</div>
            </div>
            <div style={{ ...CARD, padding: '14px 16px', borderLeft: '3px solid var(--green)' }}>
              <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Escenario optimista (p95)</div>
              <div style={{ color: 'var(--green)', fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>{eur(result.valor_final.p95)} €</div>
              <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '3px' }}>solo 5 % de los casos arriba</div>
            </div>
            <div style={{ ...CARD, padding: '14px 16px', borderLeft: '3px solid var(--red)' }}>
              <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Escenario pesimista (p5)</div>
              <div style={{ color: 'var(--red)', fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>{eur(result.valor_final.p5)} €</div>
              <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '3px' }}>5 % de los casos abajo</div>
            </div>
            <div style={{ ...CARD, padding: '14px 16px', borderLeft: '3px solid var(--purple)' }}>
              <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>CAGR mediano</div>
              <div style={{ color: 'var(--purple)', fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>{result.cagr.p50.toFixed(2)}%</div>
              <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '3px' }}>p5 {result.cagr.p5.toFixed(1)} % · p95 {result.cagr.p95.toFixed(1)} %</div>
            </div>
          </div>

          {/* Probabilidades clave */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Probabilidad de pérdida',  value: result.probabilidad_perdida,  color: 'var(--red)',    descr: 'Acabar con menos de lo invertido' },
              { label: 'Probabilidad de doblar',   value: result.probabilidad_doblar,   color: 'var(--green)',  descr: '×2 sobre el capital inicial' },
              { label: 'Probabilidad de triplicar', value: result.probabilidad_triplicar, color: 'var(--accent)', descr: '×3 sobre el capital inicial' },
            ].map(({ label, value, color, descr }) => (
              <div key={label} style={{ ...CARD, padding: '14px 16px' }}>
                <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                  <div style={{ color, fontSize: '24px', fontWeight: 700 }}>{pct(value)}</div>
                </div>
                <div style={{ height: '6px', backgroundColor: 'var(--raised)', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                  <div style={{ width: `${value * 100}%`, height: '100%', backgroundColor: color }} />
                </div>
                <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '6px' }}>{descr}</div>
              </div>
            ))}
          </div>

          {/* Fan chart de la trayectoria */}
          <div style={{ ...CARD, marginBottom: '20px' }}>
            <h3 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Trayectoria proyectada · banda de incertidumbre
            </h3>
            <p style={{ color: 'var(--text-2)', fontSize: '12px', margin: '0 0 16px' }}>
              La banda gris clara cubre el 90 % central de los escenarios (p5-p95).
              La gris oscura el 50 % central (p25-p75). La línea sólida es la mediana.
            </p>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={result.trayectoria} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="año" type="number"
                  stroke="var(--border)" tick={{ fill: 'var(--text-2)', fontSize: 11 }}
                  label={{ value: 'Años', position: 'insideBottom', offset: -2, fill: 'var(--text-2)', fontSize: 11 }}
                  domain={['dataMin', 'dataMax']}
                />
                <YAxis
                  stroke="var(--border)" tick={{ fill: 'var(--text-2)', fontSize: 11 }} width={70}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)} K€` : `${v.toFixed(0)}€`}
                />
                <Tooltip content={<FanTooltip />} />
                {/* Banda 5-95 (área amplia) */}
                <Area type="monotone" dataKey="p95" stroke="none" fill="var(--accent)" fillOpacity={0.10} stackId="1a" />
                <Area type="monotone" dataKey="p5"  stroke="none" fill="var(--bg)"     fillOpacity={1}    stackId="1a" />
                {/* Banda 25-75 (área central, más opaca) */}
                <Area type="monotone" dataKey="p75" stroke="none" fill="var(--accent)" fillOpacity={0.22} stackId="1b" />
                <Area type="monotone" dataKey="p25" stroke="none" fill="var(--bg)"     fillOpacity={1}    stackId="1b" />
                {/* Mediana */}
                <Line type="monotone" dataKey="p50" stroke="var(--accent)" dot={false} strokeWidth={2.5} />
                {/* Línea de referencia: capital inicial */}
                <ReferenceLine y={result.parametros.capital_inicial} stroke="var(--text-3)" strokeDasharray="4 4"
                  label={{ value: 'Capital inicial', position: 'right', fill: 'var(--text-3)', fontSize: 10 }} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '20px', marginTop: '8px', fontSize: '11px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--accent)' }}>● Mediana (p50)</span>
              <span style={{ color: 'var(--text-2)' }}>▮ Banda 25-75 % (50 % central)</span>
              <span style={{ color: 'var(--text-3)' }}>▮ Banda 5-95 % (90 % central)</span>
              <span style={{ color: 'var(--text-3)' }}>--- Capital inicial</span>
            </div>
          </div>

          {/* Histograma de valores finales */}
          <div style={{ ...CARD, marginBottom: '20px' }}>
            <h3 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Distribución del valor final · año {result.parametros.años}
            </h3>
            <p style={{ color: 'var(--text-2)', fontSize: '12px', margin: '0 0 16px' }}>
              Cuántas de las {result.parametros.n_simulaciones.toLocaleString('es-ES')} simulaciones acabaron en cada rango (escala log).
              Las barras rojas son escenarios con pérdida.
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={histData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="valor" type="number" scale="log" domain={['dataMin', 'dataMax']}
                  stroke="var(--border)" tick={{ fill: 'var(--text-2)', fontSize: 10 }}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)} K` : v.toFixed(0)}
                />
                <YAxis stroke="var(--border)" tick={{ fill: 'var(--text-2)', fontSize: 10 }} width={48} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--raised)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v: any) => [`${v} simulaciones`, '']}
                  labelFormatter={(v: any) => `Valor final ≈ ${eur(v)} €`}
                />
                <Bar dataKey="frecuencia">
                  {histData.map((entry, i) => (
                    <Cell key={i} fill={entry.perdida ? 'var(--red)' : 'var(--green)'} fillOpacity={0.75} />
                  ))}
                </Bar>
                <ReferenceLine x={result.parametros.capital_inicial} stroke="var(--text-2)" strokeDasharray="3 3"
                  label={{ value: 'Inicial', position: 'top', fill: 'var(--text-2)', fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Disclaimer */}
          <div style={{
            ...CARD, padding: '14px 18px',
            backgroundColor: 'rgba(232, 166, 64, 0.06)',
            border: '1px solid rgba(232, 166, 64, 0.25)',
            fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--amber)' }}>Cómo leer esto:</strong>{' '}
            usamos <strong>bootstrap histórico</strong> sobre {result.parametros.n_dias_historico} días de retornos diarios reales:
            cada simulación construye una trayectoria sorteando esos retornos con reemplazo.
            Esto preserva las colas gordas y la asimetría que la distribución normal borraría.
            La principal limitación es que no genera escenarios fuera de la muestra histórica
            (un cisne negro peor que cualquier día observado no aparecerá).
            Los rendimientos pasados <strong>no garantizan los futuros</strong>: úsalo para
            entender órdenes de magnitud y rangos de incertidumbre, no como predicción.
          </div>
        </>
      )}
    </div>
  );
}
