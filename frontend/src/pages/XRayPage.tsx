import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { getPortfolios, deletePortfolio, getTickerInfo, Portfolio, TickerInfo } from '../services/api';

const COLORS = ['#58a6ff', '#3fb950', '#d29922', '#bc8cff', '#f85149', '#79c0ff', '#fb8500', '#ff6b9d'];

const CARD = {
  backgroundColor: '#161b22',
  border: '1px solid #30363d',
  borderRadius: '10px',
  padding: '24px',
};

interface SectorData {
  sector: string;
  peso: number;
}

function calcularSectores(activos: Portfolio['activos'], infos: Record<string, TickerInfo>): SectorData[] {
  const mapa: Record<string, number> = {};
  for (const a of activos) {
    const info = infos[a.ticker];
    const sector = info?.sector ?? 'Desconocido';
    mapa[sector] = (mapa[sector] ?? 0) + a.peso_asignado * 100;
  }
  return Object.entries(mapa)
    .map(([sector, peso]) => ({ sector, peso: parseFloat(peso.toFixed(2)) }))
    .sort((a, b) => b.peso - a.peso);
}

export default function XRayPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tickerInfos, setTickerInfos] = useState<Record<string, TickerInfo>>({});
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
      <div style={{ color: '#8b949e', textAlign: 'center', marginTop: '80px', fontSize: '15px' }}>
        Cargando carteras…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        color: '#f85149', textAlign: 'center', marginTop: '80px',
        fontSize: '14px', padding: '16px', backgroundColor: 'rgba(248,81,73,0.08)',
        border: '1px solid rgba(248,81,73,0.3)', borderRadius: '8px', maxWidth: '480px', margin: '80px auto 0',
      }}>
        {error}
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ color: '#e6edf3', fontSize: '22px', fontWeight: 700, margin: '0 0 6px' }}>
        X-Ray de Carteras
      </h1>
      <p style={{ color: '#8b949e', fontSize: '13px', margin: '0 0 28px' }}>
        Composición y exposición sectorial de tus carteras ({portfolios.length} cartera{portfolios.length !== 1 ? 's' : ''})
      </p>

      {portfolios.length === 0 ? (
        <div style={{
          ...CARD,
          padding: '60px 40px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
          <div style={{ color: '#e6edf3', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
            Sin carteras guardadas
          </div>
          <div style={{ color: '#8b949e', fontSize: '13px' }}>
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
            const isExpanded = expandedId === p.id;

            return (
              <div key={p.id} style={CARD}>
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ color: '#e6edf3', fontSize: '16px', fontWeight: 600, margin: '0 0 4px' }}>
                      {p.nombre_estrategia}
                    </h2>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{
                        color: '#8b949e', fontSize: '11px',
                        backgroundColor: '#21262d',
                        padding: '2px 8px', borderRadius: '12px',
                      }}>
                        {p.fecha_creacion}
                      </span>
                      <span style={{ color: '#8b949e', fontSize: '12px' }}>
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
                        color: '#58a6ff',
                        border: '1px solid rgba(88, 166, 255, 0.4)',
                        borderRadius: '6px',
                        fontSize: '12px', fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      {isExpanded ? 'Ocultar detalle' : 'Ver X-Ray sectorial'}
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.nombre_estrategia)}
                      disabled={deletingId === p.id}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: 'transparent',
                        color: '#f85149',
                        border: '1px solid rgba(248, 81, 73, 0.4)',
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
                    <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 500, letterSpacing: '0.4px', marginBottom: '12px' }}>
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
                          contentStyle={{ backgroundColor: '#21262d', border: '1px solid #30363d', borderRadius: '8px', fontSize: '12px' }}
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

                  {/* Weight List */}
                  <div>
                    <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 500, letterSpacing: '0.4px', marginBottom: '12px' }}>
                      PESOS ASIGNADOS
                    </div>
                    <div style={{ borderTop: '1px solid #21262d', paddingTop: '12px' }}>
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
                                <span style={{ color: '#e6edf3', fontSize: '13px', fontWeight: 600 }}>
                                  {(a.peso_asignado * 100).toFixed(2)}%
                                </span>
                              </div>
                              {info && (
                                <div style={{ color: '#8b949e', fontSize: '11px' }}>
                                  {info.sector} · {info.pais}
                                </div>
                              )}
                              {/* Barra de progreso */}
                              <div style={{ height: '3px', backgroundColor: '#21262d', borderRadius: '2px', marginTop: '4px' }}>
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

                {/* X-Ray sectorial expandido */}
                {isExpanded && sectores.length > 0 && (
                  <div style={{ marginTop: '24px', borderTop: '1px solid #30363d', paddingTop: '20px' }}>
                    <div style={{ color: '#8b949e', fontSize: '11px', fontWeight: 500, letterSpacing: '0.4px', marginBottom: '16px' }}>
                      EXPOSICIÓN SECTORIAL (X-RAY)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={sectores} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
                          <XAxis
                            type="number"
                            unit="%"
                            tick={{ fill: '#8b949e', fontSize: 11 }}
                            stroke="#21262d"
                          />
                          <YAxis
                            type="category"
                            dataKey="sector"
                            tick={{ fill: '#e6edf3', fontSize: 11 }}
                            stroke="#21262d"
                            width={110}
                          />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#21262d', border: '1px solid #30363d', borderRadius: '8px', fontSize: '12px' }}
                            formatter={(v: any) => [`${v}%`, 'Exposición']}
                          />
                          <Bar dataKey="peso" fill="#58a6ff" radius={[0, 4, 4, 0]}>
                            {sectores.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div>
                        {sectores.map((s, i) => (
                          <div key={s.sector} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS[i % COLORS.length], flexShrink: 0 }} />
                              <span style={{ color: '#e6edf3', fontSize: '13px' }}>{s.sector}</span>
                            </div>
                            <span style={{ color: '#8b949e', fontSize: '13px', fontWeight: 600 }}>{s.peso}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
