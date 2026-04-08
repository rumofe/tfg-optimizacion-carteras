import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { getPortfolios, deletePortfolio, getTickerInfo, Portfolio, TickerInfo } from '../services/api';
import EditPortfolioModal from '../components/EditPortfolioModal';

const COLORS = ['#4f86f7', '#0ea875', '#f0a020', '#9b6ef5', '#e84040', '#22d3ee', '#f472b6', '#a3e635'];

const CARD = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '24px',
};

interface SectorData { sector: string; peso: number; }
interface PaisData   { pais:   string; peso: number; }

function calcularSectores(activos: Portfolio['activos'], infos: Record<string, TickerInfo>): SectorData[] {
  const mapa: Record<string, number> = {};
  for (const a of activos) {
    const sector = infos[a.ticker]?.sector ?? 'Desconocido';
    mapa[sector] = (mapa[sector] ?? 0) + a.peso_asignado * 100;
  }
  return Object.entries(mapa)
    .map(([sector, peso]) => ({ sector, peso: parseFloat(peso.toFixed(2)) }))
    .sort((a, b) => b.peso - a.peso);
}

function calcularPaises(activos: Portfolio['activos'], infos: Record<string, TickerInfo>): PaisData[] {
  const mapa: Record<string, number> = {};
  for (const a of activos) {
    const pais = infos[a.ticker]?.pais ?? 'Desconocido';
    mapa[pais] = (mapa[pais] ?? 0) + a.peso_asignado * 100;
  }
  return Object.entries(mapa)
    .map(([pais, peso]) => ({ pais, peso: parseFloat(peso.toFixed(2)) }))
    .sort((a, b) => b.peso - a.peso);
}

export default function XRayPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tickerInfos, setTickerInfos] = useState<Record<string, TickerInfo>>({});
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null);

  async function cargarCarteras() {
    setLoading(true);
    setError('');
    try {
      const { data } = await getPortfolios();
      setPortfolios(data);

      // Cargar info de sectores para todos los tickers únicos
      const tickers = [...new Set(data.flatMap((p) => p.activos.map((a) => a.ticker)))];
      const infosEntradas = await Promise.allSettled(
        tickers.map((t) => getTickerInfo(t).then((r) => [t, r.data] as [string, TickerInfo]))
      );
      const infos: Record<string, TickerInfo> = {};
      for (const res of infosEntradas) {
        if (res.status === 'fulfilled') {
          infos[res.value[0]] = res.value[1];
        }
      }
      setTickerInfos(infos);
    } catch {
      setError('No se pudieron cargar las carteras. Comprueba que el servidor está activo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargarCarteras(); }, []);

  async function handleDelete(id: number, nombre: string) {
    if (!window.confirm(`¿Eliminar la cartera "${nombre}"?`)) return;
    setDeletingId(id);
    try {
      await deletePortfolio(id);
      setPortfolios((prev) => prev.filter((p) => p.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch {
      alert('Error al eliminar la cartera. Inténtalo de nuevo.');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div style={{ color: 'var(--text-2)', textAlign: 'center', marginTop: '80px', fontSize: '15px' }}>
        Cargando carteras…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        color: 'var(--red)', textAlign: 'center', marginTop: '80px',
        fontSize: '14px', padding: '16px', backgroundColor: 'rgba(232,64,64,0.08)',
        border: '1px solid rgba(232,64,64,0.3)', borderRadius: '8px', maxWidth: '480px', margin: '80px auto 0',
      }}>
        {error}
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
        X-Ray de Carteras
      </h1>
      <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: '0 0 28px' }}>
        Composición y exposición sectorial de tus carteras ({portfolios.length} cartera{portfolios.length !== 1 ? 's' : ''})
      </p>

      {portfolios.length === 0 ? (
        <div style={{
          ...CARD,
          padding: '60px 40px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
          <div style={{ color: 'var(--text)', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
            Sin carteras guardadas
          </div>
          <div style={{ color: 'var(--text-2)', fontSize: '13px' }}>
            Ve al Optimizador, genera una cartera y guárdala para verla aquí
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {portfolios.map((p) => {
            const pieData = p.activos.map((a) => ({
              name: a.ticker,
              value: parseFloat((a.peso_asignado * 100).toFixed(2)),
            }));

            const sectores = calcularSectores(p.activos, tickerInfos);
            const paises   = calcularPaises(p.activos, tickerInfos);
            const isExpanded = expandedId === p.id;

            return (
              <div key={p.id} style={CARD}>
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ color: 'var(--text)', fontSize: '16px', fontWeight: 600, margin: '0 0 4px' }}>
                      {p.nombre_estrategia}
                    </h2>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{
                        color: 'var(--text-2)', fontSize: '11px',
                        backgroundColor: 'var(--raised)',
                        padding: '2px 8px', borderRadius: '12px',
                      }}>
                        {p.fecha_creacion}
                      </span>
                      <span style={{ color: 'var(--text-2)', fontSize: '12px' }}>
                        {p.activos.length} activo{p.activos.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: 'transparent',
                        color: 'var(--accent)',
                        border: '1px solid rgba(79, 134, 247, 0.4)',
                        borderRadius: '6px',
                        fontSize: '12px', fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      {isExpanded ? 'Ocultar X-Ray' : 'Ver X-Ray'}
                    </button>
                    <button
                      onClick={() => setEditingPortfolio(p)}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: 'transparent',
                        color: 'var(--amber)',
                        border: '1px solid rgba(240, 160, 32, 0.4)',
                        borderRadius: '6px',
                        fontSize: '12px', fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.nombre_estrategia)}
                      disabled={deletingId === p.id}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: 'transparent',
                        color: 'var(--red)',
                        border: '1px solid rgba(232, 64, 64, 0.4)',
                        borderRadius: '6px',
                        fontSize: '12px', fontWeight: 500,
                        cursor: deletingId === p.id ? 'not-allowed' : 'pointer',
                        opacity: deletingId === p.id ? 0.5 : 1,
                      }}
                    >
                      {deletingId === p.id ? 'Eliminando…' : 'Eliminar'}
                    </button>
                  </div>
                </div>

                {/* Composición + pesos */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {/* PieChart */}
                  <div>
                    <div style={{ color: 'var(--text-2)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                      DISTRIBUCIÓN DE ACTIVOS
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%" cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: 'var(--raised)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                          itemStyle={{ color: 'var(--text)' }}
                          formatter={(v: any) => [`${(v as number).toFixed(2)}%`, '']}
                        />
                        <Legend
                          formatter={(value) => (
                            <span style={{ color: 'var(--text)', fontSize: '12px' }}>{value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Weight List */}
                  <div>
                    <div style={{ color: 'var(--text-2)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                      PESOS ASIGNADOS
                    </div>
                    <div style={{ borderTop: '1px solid var(--raised)', paddingTop: '12px' }}>
                      {p.activos
                        .slice()
                        .sort((a, b) => b.peso_asignado - a.peso_asignado)
                        .map((a, i) => {
                          const info = tickerInfos[a.ticker];
                          return (
                            <div key={a.ticker} style={{ marginBottom: '10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                <span style={{ color: COLORS[i % COLORS.length], fontSize: '13px', fontWeight: 700 }}>
                                  {a.ticker}
                                </span>
                                <span style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600 }}>
                                  {(a.peso_asignado * 100).toFixed(2)}%
                                </span>
                              </div>
                              {info && (
                                <div style={{ color: 'var(--text-2)', fontSize: '11px' }}>
                                  {info.sector} · {info.pais}
                                </div>
                              )}
                              {/* Barra de progreso */}
                              <div style={{ height: '3px', backgroundColor: 'var(--raised)', borderRadius: '2px', marginTop: '4px' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${a.peso_asignado * 100}%`,
                                  backgroundColor: COLORS[i % COLORS.length],
                                  borderRadius: '2px',
                                }} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>

                {/* X-Ray expandido: sectorial + geográfico */}
                {isExpanded && (
                  <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

                    {/* ── Sectorial ── */}
                    {sectores.length > 0 && (
                      <div>
                        <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
                          Exposición sectorial
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
                          <ResponsiveContainer width="100%" height={Math.max(160, sectores.length * 34)}>
                            <BarChart data={sectores} layout="vertical" margin={{ left: 10, right: 20, top: 4, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                              <XAxis type="number" unit="%" tick={{ fill: 'var(--text-2)', fontSize: 11 }} stroke="var(--border)" />
                              <YAxis type="category" dataKey="sector" tick={{ fill: 'var(--text)', fontSize: 11 }} stroke="var(--border)" width={115} />
                              <Tooltip
                                contentStyle={{ backgroundColor: 'var(--raised)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                                formatter={(v: any) => [`${v}%`, 'Exposición']}
                              />
                              <Bar dataKey="peso" radius={[0, 4, 4, 0]}>
                                {sectores.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                          <div style={{ paddingTop: '4px' }}>
                            {sectores.map((s, i) => (
                              <div key={s.sector} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[i % COLORS.length], flexShrink: 0 }} />
                                  <span style={{ color: 'var(--text)', fontSize: '13px' }}>{s.sector}</span>
                                </div>
                                <span style={{ color: 'var(--text-2)', fontSize: '13px', fontWeight: 600 }}>{s.peso}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Geográfico ── */}
                    {paises.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                        <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
                          Exposición geográfica
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
                          <ResponsiveContainer width="100%" height={Math.max(160, paises.length * 34)}>
                            <BarChart data={paises} layout="vertical" margin={{ left: 10, right: 20, top: 4, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                              <XAxis type="number" unit="%" tick={{ fill: 'var(--text-2)', fontSize: 11 }} stroke="var(--border)" />
                              <YAxis type="category" dataKey="pais" tick={{ fill: 'var(--text)', fontSize: 11 }} stroke="var(--border)" width={115} />
                              <Tooltip
                                contentStyle={{ backgroundColor: 'var(--raised)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                                formatter={(v: any) => [`${v}%`, 'Exposición']}
                              />
                              <Bar dataKey="peso" radius={[0, 4, 4, 0]}>
                                {paises.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                          <div style={{ paddingTop: '4px' }}>
                            {paises.map((p2, i) => (
                              <div key={p2.pais} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[(i + 3) % COLORS.length], flexShrink: 0 }} />
                                  <span style={{ color: 'var(--text)', fontSize: '13px' }}>{p2.pais}</span>
                                </div>
                                <span style={{ color: 'var(--text-2)', fontSize: '13px', fontWeight: 600 }}>{p2.peso}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de edición */}
      {editingPortfolio && (
        <EditPortfolioModal
          portfolio={editingPortfolio}
          onClose={() => setEditingPortfolio(null)}
          onSaved={(updated) => {
            setPortfolios((prev) => prev.map((p) => p.id === updated.id ? updated : p));
            setEditingPortfolio(null);
          }}
        />
      )}
    </div>
  );
}
