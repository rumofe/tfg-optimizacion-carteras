import { useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { getPortfolios, deletePortfolio, getTickerInfo, Portfolio, TickerInfo } from '../services/api';
import EditPortfolioModal from '../components/EditPortfolioModal';
import { COLORS, CARD } from '../styles';

interface SectorData { sector: string; peso: number; }
interface PaisData   { pais:   string; peso: number; }

// ─── Mapa geográfico ──────────────────────────────────────────────────────────
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

/** Mapea el nombre de país que devuelve yfinance al código ISO 3166-1 numérico
 *  usado por world-atlas/topojson. */
const PAIS_A_ISO: Record<string, string> = {
  'United States': '840', 'Germany': '276', 'France': '250',
  'United Kingdom': '826', 'Japan': '392', 'China': '156',
  'Switzerland': '756', 'Netherlands': '528', 'Sweden': '752',
  'Denmark': '208', 'Norway': '578', 'Finland': '246',
  'Ireland': '372', 'Italy': '380', 'Spain': '724',
  'Belgium': '56',  'Austria': '40',  'Canada': '124',
  'Australia': '36', 'South Korea': '410', 'Taiwan': '158',
  'India': '356', 'Brazil': '76',  'Mexico': '484',
  'Singapore': '702', 'Israel': '376', 'Luxembourg': '442',
  'Portugal': '620', 'Greece': '300', 'Poland': '616',
  'Czech Republic': '203', 'Hungary': '348', 'Russia': '643',
  'South Africa': '710', 'New Zealand': '554', 'Indonesia': '360',
  'Thailand': '764', 'Malaysia': '458', 'Philippines': '608',
  'Saudi Arabia': '682', 'United Arab Emirates': '784', 'Turkey': '792',
  'Argentina': '32', 'Chile': '152', 'Colombia': '170',
};

function mapColor(pct: number, maxPct: number): string {
  const t = Math.min(pct / maxPct, 1);
  const alpha = 0.2 + t * 0.75;
  return `rgba(79, 134, 247, ${alpha.toFixed(2)})`;
}

// ─── Style Box ────────────────────────────────────────────────────────────────
const CAPS_BOX    = ['Large Cap', 'Mid Cap', 'Small Cap'] as const;
const STYLES_BOX  = ['Value', 'Blend', 'Growth'] as const;
const CAP_LABELS: Record<string, string> = { 'Large Cap': 'LARGE', 'Mid Cap': 'MID', 'Small Cap': 'SMALL' };

const TIPO_CONFIG: Record<string, { color: string; label: string; sectoresLabel: string }> = {
  Cyclical:  { color: '#f97316', label: 'Cíclico',   sectoresLabel: 'Materials · Financials · Consumer Disc. · Real Estate' },
  Sensitive: { color: '#f59e0b', label: 'Sensible',  sectoresLabel: 'Industrials · Tech · Energy · Communications' },
  Defensive: { color: '#10b981', label: 'Defensivo', sectoresLabel: 'Healthcare · Utilities · Consumer Staples' },
};

function calcularStyleBox(activos: Portfolio['activos'], infos: Record<string, TickerInfo>): Record<string, Record<string, number>> {
  const box: Record<string, Record<string, number>> = {};
  for (const a of activos) {
    const mc  = infos[a.ticker]?.market_cap_categoria;
    const est = infos[a.ticker]?.estilo_inversion;
    if (!mc || mc === 'Desconocido' || !est || est === 'Desconocido') continue;
    if (!box[mc]) box[mc] = {};
    box[mc][est] = (box[mc][est] ?? 0) + a.peso_asignado * 100;
  }
  return box;
}

function calcularMarketCapDist(activos: Portfolio['activos'], infos: Record<string, TickerInfo>): Record<string, number> {
  const out: Record<string, number> = { 'Large Cap': 0, 'Mid Cap': 0, 'Small Cap': 0 };
  for (const a of activos) {
    const cat = infos[a.ticker]?.market_cap_categoria;
    if (cat && cat !== 'Desconocido') out[cat] = (out[cat] ?? 0) + a.peso_asignado * 100;
  }
  return out;
}

function calcularEstiloDist(activos: Portfolio['activos'], infos: Record<string, TickerInfo>): Record<string, number> {
  const out: Record<string, number> = { Value: 0, Blend: 0, Growth: 0 };
  for (const a of activos) {
    const est = infos[a.ticker]?.estilo_inversion;
    if (est && est !== 'Desconocido') out[est] = (out[est] ?? 0) + a.peso_asignado * 100;
  }
  return out;
}

interface DividendosCartera {
  yieldPonderado: number;            // % anual de la cartera completa
  topPagadores: { ticker: string; yield: number; peso: number; aporte: number }[];
  frecuencias: Record<string, number>;  // peso% en cada categoría
  pagadoresCount: number;            // cuántos activos pagan dividendo
  totalActivos: number;
}

function calcularDividendosCartera(
  activos: Portfolio['activos'],
  infos: Record<string, TickerInfo>,
): DividendosCartera {
  let yieldPond = 0;
  let pagadoresCount = 0;
  const frecuencias: Record<string, number> = {};
  const aportes: { ticker: string; yield: number; peso: number; aporte: number }[] = [];
  for (const a of activos) {
    const info = infos[a.ticker];
    const y = info?.dividend_yield ?? 0;
    if (y > 0) {
      pagadoresCount++;
      const aporte = y * a.peso_asignado;
      yieldPond += aporte;
      aportes.push({ ticker: a.ticker, yield: y, peso: a.peso_asignado * 100, aporte });
      const freq = info?.payout_frequency ?? 'Desconocido';
      if (freq !== 'Ninguno' && freq !== 'Desconocido') {
        frecuencias[freq] = (frecuencias[freq] ?? 0) + a.peso_asignado * 100;
      }
    }
  }
  const topPagadores = aportes.sort((a, b) => b.aporte - a.aporte).slice(0, 3);
  return {
    yieldPonderado: yieldPond,
    topPagadores,
    frecuencias,
    pagadoresCount,
    totalActivos: activos.length,
  };
}

function calcularTipoAccionDist(activos: Portfolio['activos'], infos: Record<string, TickerInfo>): Record<string, number> {
  const out: Record<string, number> = { Cyclical: 0, Sensitive: 0, Defensive: 0 };
  for (const a of activos) {
    const tipo = infos[a.ticker]?.tipo_accion;
    if (tipo && tipo !== 'Desconocido') out[tipo] = (out[tipo] ?? 0) + a.peso_asignado * 100;
  }
  return out;
}

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
  const [mapTooltip, setMapTooltip] = useState<{ name: string; pct: number; x: number; y: number } | null>(null);

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
      <h1 style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 700, margin: '0 0 6px' }}>
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

            const sectores       = calcularSectores(p.activos, tickerInfos);
            const paises         = calcularPaises(p.activos, tickerInfos);
            const isExpanded     = expandedId === p.id;
            const styleBox       = calcularStyleBox(p.activos, tickerInfos);
            const marketCapDist  = calcularMarketCapDist(p.activos, tickerInfos);
            const estiloDist     = calcularEstiloDist(p.activos, tickerInfos);
            const tipoAccionDist = calcularTipoAccionDist(p.activos, tickerInfos);
            const dividendos     = calcularDividendosCartera(p.activos, tickerInfos);
            const maxBoxValue    = Math.max(
              ...CAPS_BOX.flatMap(c => STYLES_BOX.map(s => styleBox[c]?.[s] ?? 0)), 0.01
            );

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
                        <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
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
                        <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
                          Exposición geográfica
                        </div>

                        {/* ── Mapa choropleth ── */}
                        {(() => {
                          const pesosPorIso: Record<string, number> = {};
                          paises.forEach(({ pais, peso }) => {
                            const iso = PAIS_A_ISO[pais];
                            if (iso) pesosPorIso[iso] = peso;
                          });
                          const maxPaisoPeso = Math.max(...paises.map(p2 => p2.peso), 0.01);
                          return (
                            <div style={{ position: 'relative', marginBottom: '20px', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg)' }}>
                              <ComposableMap
                                projection="geoNaturalEarth1"
                                projectionConfig={{ scale: 145, center: [10, 10] }}
                                width={800} height={360}
                                style={{ width: '100%', height: 'auto', display: 'block' }}
                              >
                                <Geographies geography={GEO_URL}>
                                  {({ geographies }) =>
                                    geographies.map(geo => {
                                      const iso = String(geo.id);
                                      const pct = pesosPorIso[iso] ?? 0;
                                      const hasData = pct > 0;
                                      return (
                                        <Geography
                                          key={geo.rsmKey}
                                          geography={geo}
                                          fill={hasData ? mapColor(pct, maxPaisoPeso) : 'var(--raised)'}
                                          stroke="var(--border)"
                                          strokeWidth={0.4}
                                          style={{
                                            default:  { outline: 'none' },
                                            hover:    { outline: 'none', fill: hasData ? mapColor(Math.min(pct * 1.3, maxPaisoPeso), maxPaisoPeso) : 'var(--border)', cursor: hasData ? 'pointer' : 'default' },
                                            pressed:  { outline: 'none' },
                                          }}
                                          onMouseMove={(e: React.MouseEvent) => {
                                            if (hasData) setMapTooltip({ name: geo.properties.name, pct, x: e.clientX + 12, y: e.clientY - 36 });
                                          }}
                                          onMouseLeave={() => setMapTooltip(null)}
                                        />
                                      );
                                    })
                                  }
                                </Geographies>
                              </ComposableMap>
                              {/* Leyenda de escala */}
                              <div style={{ position: 'absolute', bottom: '10px', right: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: 'var(--text-2)', fontSize: '9px' }}>0%</span>
                                <div style={{ width: '70px', height: '7px', borderRadius: '4px', background: 'linear-gradient(to right, rgba(79,134,247,0.2), rgba(79,134,247,0.95))' }} />
                                <span style={{ color: 'var(--text-2)', fontSize: '9px' }}>{maxPaisoPeso.toFixed(0)}%</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Barras + lista */}
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

                    {/* ── Style Box + Market Cap + Investment Style ── */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                      <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                        Style Box (capitalización × estilo)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', alignItems: 'start' }}>

                        {/* 3×3 grid */}
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: '46px 1fr 1fr 1fr', gap: '4px' }}>
                            <div />
                            {STYLES_BOX.map(s => (
                              <div key={`hdr-${s}`} style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', paddingBottom: '4px' }}>{s}</div>
                            ))}
                            {CAPS_BOX.flatMap(cap => [
                              <div key={`lbl-${cap}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px', color: 'var(--text-2)', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                {CAP_LABELS[cap]}
                              </div>,
                              ...STYLES_BOX.map(est => {
                                const w = styleBox[cap]?.[est] ?? 0;
                                const alpha = 0.08 + (w / maxBoxValue) * 0.82;
                                const isMax = w === maxBoxValue && w > 0.05;
                                return (
                                  <div key={`${cap}-${est}`} style={{
                                    borderRadius: '5px', padding: '10px 4px', textAlign: 'center',
                                    backgroundColor: `rgba(79, 134, 247, ${alpha})`,
                                    color: alpha > 0.45 ? '#fff' : 'var(--text)',
                                    fontSize: '12px', fontWeight: isMax ? 700 : 500,
                                    minHeight: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    outline: isMax ? '2px solid var(--accent)' : 'none', outlineOffset: '1px',
                                  }}>
                                    {w > 0.05 ? `${w.toFixed(1)}%` : '—'}
                                  </div>
                                );
                              }),
                            ])}
                          </div>
                          <div style={{ color: 'var(--text-2)', fontSize: '10px', marginTop: '8px', fontStyle: 'italic', textAlign: 'center' }}>
                            P/E {'<'} 15 → Value · P/E {'>'} 25 → Growth · Large {'>'} $10B, Mid $2B–$10B
                          </div>
                        </div>

                        {/* Barras Market Cap + Estilo */}
                        <div>
                          <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px' }}>Por capitalización</div>
                          {CAPS_BOX.map((cat, i) => {
                            const pct = marketCapDist[cat] ?? 0;
                            return (
                              <div key={cat} style={{ marginBottom: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                  <span style={{ color: 'var(--text)', fontSize: '12px' }}>{cat}</span>
                                  <span style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 600 }}>{pct.toFixed(1)}%</span>
                                </div>
                                <div style={{ height: '7px', backgroundColor: 'var(--raised)', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length], borderRadius: '4px' }} />
                                </div>
                              </div>
                            );
                          })}

                          <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '16px 0 10px' }}>Por estilo de inversión</div>
                          {STYLES_BOX.map((est, i) => {
                            const pct = estiloDist[est] ?? 0;
                            const estColors = ['#10b981', 'var(--accent)', 'var(--purple)'];
                            return (
                              <div key={est} style={{ marginBottom: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                  <span style={{ color: 'var(--text)', fontSize: '12px' }}>{est}</span>
                                  <span style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 600 }}>{pct.toFixed(1)}%</span>
                                </div>
                                <div style={{ height: '7px', backgroundColor: 'var(--raised)', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, backgroundColor: estColors[i], borderRadius: '4px' }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* ── Clasificación por tipo de activo ── */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                      <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                        Clasificación por tipo de activo
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        {(['Cyclical', 'Sensitive', 'Defensive'] as const).map((tipo) => {
                          const cfg = TIPO_CONFIG[tipo];
                          const pct = tipoAccionDist[tipo] ?? 0;
                          return (
                            <div key={tipo} style={{ ...CARD, padding: '18px 20px', borderTop: `3px solid ${cfg.color}` }}>
                              <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
                                {cfg.label}
                              </div>
                              <div style={{ color: cfg.color, fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
                                {pct.toFixed(1)}%
                              </div>
                              <div style={{ color: 'var(--text-2)', fontSize: '10px', lineHeight: 1.5 }}>
                                {cfg.sectoresLabel}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Análisis de dividendos ── */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                      <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                        Dividendos
                      </div>
                      {dividendos.pagadoresCount === 0 ? (
                        <div style={{ color: 'var(--text-3)', fontSize: '12px', fontStyle: 'italic', padding: '8px 0' }}>
                          Ninguno de los activos de esta cartera paga dividendos.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          {/* Card: Yield ponderado + ingresos estimados */}
                          <div style={{ ...CARD, padding: '18px 20px', borderLeft: '3px solid var(--green)' }}>
                            <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                              Yield ponderado de la cartera
                            </div>
                            <div style={{ color: 'var(--green)', fontSize: '32px', fontWeight: 700, lineHeight: 1, marginBottom: '10px' }}>
                              {dividendos.yieldPonderado.toFixed(2)}%
                              <span style={{ color: 'var(--text-3)', fontSize: '12px', fontWeight: 500, marginLeft: '6px' }}>anual</span>
                            </div>
                            <div style={{ color: 'var(--text-2)', fontSize: '12px', lineHeight: 1.5 }}>
                              ≈ <strong style={{ color: 'var(--text)' }}>{(dividendos.yieldPonderado * 100).toFixed(0)} €</strong> anuales
                              por cada <strong>10.000 €</strong> invertidos.
                            </div>
                            <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '8px' }}>
                              {dividendos.pagadoresCount} de {dividendos.totalActivos} activos pagan dividendo
                            </div>
                            {/* Frecuencias */}
                            {Object.keys(dividendos.frecuencias).length > 0 && (
                              <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
                                {Object.entries(dividendos.frecuencias)
                                  .sort(([, a], [, b]) => b - a)
                                  .map(([freq, pct]) => (
                                    <span key={freq} style={{
                                      padding: '2px 8px', fontSize: '10px',
                                      backgroundColor: 'var(--raised)', color: 'var(--text-2)',
                                      border: '1px solid var(--border)', borderRadius: '10px',
                                    }}>
                                      {freq} · {pct.toFixed(0)}%
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>
                          {/* Card: top pagadores */}
                          <div style={{ ...CARD, padding: '18px 20px' }}>
                            <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '12px' }}>
                              Mayores contribuyentes al dividendo
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {dividendos.topPagadores.map((tp, i) => (
                                <div key={tp.ticker} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{
                                    width: '22px', height: '22px', borderRadius: '50%',
                                    backgroundColor: 'var(--raised)', border: '1px solid var(--border)',
                                    color: 'var(--text-2)', fontSize: '10px', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>{i + 1}</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                                      <span style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>{tp.ticker}</span>
                                      <span style={{ color: 'var(--green)', fontSize: '12px', fontWeight: 700 }}>
                                        {tp.yield.toFixed(2)}%
                                      </span>
                                    </div>
                                    <div style={{ height: '4px', backgroundColor: 'var(--raised)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                                      <div style={{
                                        width: `${(tp.aporte / Math.max(dividendos.yieldPonderado, 0.01)) * 100}%`,
                                        height: '100%', backgroundColor: 'var(--green)',
                                      }} />
                                    </div>
                                    <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '3px' }}>
                                      Aporta {tp.aporte.toFixed(2)} pp · peso {tp.peso.toFixed(0)}%
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tooltip del mapa */}
      {mapTooltip && (
        <div style={{
          position: 'fixed',
          left: mapTooltip.x,
          top: mapTooltip.y,
          backgroundColor: 'var(--raised)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '7px 12px',
          fontSize: '12px',
          pointerEvents: 'none',
          zIndex: 9999,
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        }}>
          <div style={{ color: 'var(--text)', fontWeight: 600 }}>{mapTooltip.name}</div>
          <div style={{ color: 'var(--accent)', fontWeight: 700, marginTop: '2px' }}>{mapTooltip.pct.toFixed(1)}%</div>
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
