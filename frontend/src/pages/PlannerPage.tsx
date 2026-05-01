import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { getProfile, updateProfile } from '../services/api';
import {
  calcularPlan,
  HORIZONTES_OPCIONES,
  PlannerInputs,
  Horizonte,
  PerfilRiesgo,
  AssetAllocation,
} from '../services/planner';
import { CARD, INPUT, LABEL } from '../styles';

const PERFILES_OPCIONES: { id: PerfilRiesgo; label: string; descr: string }[] = [
  { id: 'conservador', label: 'Conservador', descr: 'Prefiero perder menos aunque gane menos' },
  { id: 'moderado',    label: 'Moderado',    descr: 'Equilibrio entre rentabilidad y riesgo' },
  { id: 'agresivo',    label: 'Agresivo',    descr: 'Acepto pérdidas grandes a cambio de más retorno' },
];

const ASIGNACION_COLORS = {
  cash:        '#22d3ee',
  bonds:       'var(--green)',
  equity:      'var(--accent)',
  realEstate:  'var(--purple)',
  commodities: 'var(--amber)',
} as const;

const ASIGNACION_LABELS = {
  cash:        'Cash (emergencia)',
  bonds:       'Renta fija',
  equity:      'Renta variable',
  realEstate:  'Inmobiliario',
  commodities: 'Materias primas',
} as const;

function eur(n: number) {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0 });
}

function inferPerfilFromVol(vol: number | null): PerfilRiesgo {
  if (vol == null) return 'moderado';
  if (vol <= 17) return 'conservador';
  if (vol <= 30) return 'moderado';
  return 'agresivo';
}

const PERFIL_TO_VOL: Record<PerfilRiesgo, number> = {
  conservador: 15,
  moderado:    25,
  agresivo:    40,
};

export default function PlannerPage() {
  const navigate = useNavigate();
  const [loading, setLoading]         = useState(true);
  const [saved, setSaved]             = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  const [liquidez,    setLiquidez]    = useState<string>('20000');
  const [gastos,      setGastos]      = useState<string>('1500');
  const [meses,       setMeses]       = useState<3 | 6 | 12>(6);
  const [edad,        setEdad]        = useState<number>(30);
  const [horizonte,   setHorizonte]   = useState<Horizonte>('largo');
  const [perfil,      setPerfil]      = useState<PerfilRiesgo>('moderado');

  // Pre-rellenar desde el perfil del usuario
  useEffect(() => {
    getProfile()
      .then(({ data }) => {
        if (data.capital_base) setLiquidez(String(data.capital_base));
        setPerfil(inferPerfilFromVol(data.tolerancia_riesgo));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Cálculos en vivo
  const inputs: PlannerInputs = useMemo(() => ({
    liquidezDisponible: parseFloat(liquidez.replace(',', '.')) || 0,
    gastosMensuales:    parseFloat(gastos.replace(',', '.'))   || 0,
    mesesEmergencia:    meses,
    edad,
    horizonte,
    perfil,
  }), [liquidez, gastos, meses, edad, horizonte, perfil]);

  const plan = useMemo(() => calcularPlan(inputs), [inputs]);

  // Datos del donut: una entrada por clase con peso > 0
  type PieRow = { name: string; value: number; key: keyof AssetAllocation };
  const pieData = useMemo<PieRow[]>(() => {
    const fondo = plan.asignacionEur.cash;
    const inv = plan.capitalInvertible;
    const filas: PieRow[] = [];
    if (fondo > 0)                                          filas.push({ name: ASIGNACION_LABELS.cash,        value: fondo, key: 'cash' });
    const bondsEur       = Math.round(inv * plan.assetAllocation.bonds       / 100);
    const equityEur      = Math.round(inv * plan.assetAllocation.equity      / 100);
    const realEstateEur  = Math.round(inv * plan.assetAllocation.realEstate  / 100);
    const commoditiesEur = Math.round(inv * plan.assetAllocation.commodities / 100);
    if (bondsEur > 0)       filas.push({ name: ASIGNACION_LABELS.bonds,       value: bondsEur,       key: 'bonds' });
    if (equityEur > 0)      filas.push({ name: ASIGNACION_LABELS.equity,      value: equityEur,      key: 'equity' });
    if (realEstateEur > 0)  filas.push({ name: ASIGNACION_LABELS.realEstate,  value: realEstateEur,  key: 'realEstate' });
    if (commoditiesEur > 0) filas.push({ name: ASIGNACION_LABELS.commodities, value: commoditiesEur, key: 'commodities' });
    return filas;
  }, [plan]);

  async function guardarPerfilInversor() {
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      await updateProfile({
        capital_base:      plan.capitalInvertible,
        tolerancia_riesgo: PERFIL_TO_VOL[perfil],
      });
      setProfileMsg({ ok: true, text: 'Perfil guardado correctamente.' });
    } catch {
      setProfileMsg({ ok: false, text: 'No se pudo guardar el perfil.' });
    } finally {
      setSavingProfile(false);
      setTimeout(() => setProfileMsg(null), 3000);
    }
  }

  async function aplicarAlOptimizador() {
    // 1) Persistir capital + tolerancia en el perfil
    try {
      await updateProfile({
        capital_base:      plan.capitalInvertible,
        tolerancia_riesgo: PERFIL_TO_VOL[perfil],
      });
    } catch { /* sin bloquear */ }
    // 2) Pasar la recomendación de asset allocation a Optimizer vía localStorage
    localStorage.setItem('plannerRecommendation', JSON.stringify({
      capitalInvertible: plan.capitalInvertible,
      assetAllocation:   plan.assetAllocation,
      perfil,
      timestamp:         Date.now(),
    }));
    setSaved(true);
    setTimeout(() => navigate('/dashboard/optimizer'), 600);
  }

  if (loading) {
    return <div style={{ color: 'var(--text-2)', textAlign: 'center', marginTop: '80px', fontSize: '15px' }}>Cargando…</div>;
  }

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>
          Planificador financiero
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: 0 }}>
          Antes de invertir, define tu situación: liquidez, gastos, horizonte y perfil. La app calcula
          tu fondo de emergencia, cuánto puedes invertir y cómo distribuirlo entre clases de activo.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px', alignItems: 'start' }}>

        {/* ── Inputs ─────────────────────────────────────────────────────── */}
        <div style={CARD}>
          <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
            Tu situación
          </div>

          {/* Liquidez */}
          <div style={{ marginBottom: '16px' }}>
            <label style={LABEL}>Liquidez disponible (€)</label>
            <input
              type="number" min={0} step={500}
              value={liquidez}
              onChange={(e) => setLiquidez(e.target.value)}
              style={INPUT}
            />
            <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '4px' }}>
              Lo que tienes en cuentas + ahorros líquidos disponibles ya.
            </div>
          </div>

          {/* Gastos mensuales */}
          <div style={{ marginBottom: '16px' }}>
            <label style={LABEL}>Gastos mensuales (€)</label>
            <input
              type="number" min={0} step={50}
              value={gastos}
              onChange={(e) => setGastos(e.target.value)}
              style={INPUT}
            />
            <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '4px' }}>
              Vivienda, comida, transporte, ocio… media de los últimos meses.
            </div>
          </div>

          {/* Meses de emergencia */}
          <div style={{ marginBottom: '16px' }}>
            <label style={LABEL}>Fondo de emergencia</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {([3, 6, 12] as const).map((m) => (
                <button
                  key={m} type="button" onClick={() => setMeses(m)}
                  style={{
                    flex: 1, padding: '8px 10px',
                    backgroundColor: meses === m ? 'var(--accent)' : 'var(--raised)',
                    color: meses === m ? '#fff' : 'var(--text-2)',
                    border: `1px solid ${meses === m ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '6px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: meses === m ? 600 : 400,
                  }}
                >
                  {m} meses
                </button>
              ))}
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '4px' }}>
              Recomendado: 3 (con ingresos estables) · 6 (general) · 12 (autónomos / freelance).
            </div>
          </div>

          {/* Edad */}
          <div style={{ marginBottom: '16px' }}>
            <label style={LABEL}>Edad: <strong style={{ color: 'var(--text)' }}>{edad} años</strong></label>
            <input
              type="range" min={18} max={80} step={1}
              value={edad}
              onChange={(e) => setEdad(parseInt(e.target.value, 10))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Horizonte */}
          <div style={{ marginBottom: '16px' }}>
            <label style={LABEL}>Horizonte de inversión</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {HORIZONTES_OPCIONES.map((h) => (
                <button
                  key={h.id} type="button" onClick={() => setHorizonte(h.id)}
                  style={{
                    padding: '8px 10px',
                    backgroundColor: horizonte === h.id ? 'var(--accent)' : 'var(--raised)',
                    color: horizonte === h.id ? '#fff' : 'var(--text-2)',
                    border: `1px solid ${horizonte === h.id ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '6px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: horizonte === h.id ? 600 : 400,
                  }}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Perfil */}
          <div>
            <label style={LABEL}>Perfil de riesgo</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {PERFILES_OPCIONES.map((p) => {
                const active = perfil === p.id;
                return (
                  <button
                    key={p.id} type="button" onClick={() => setPerfil(p.id)}
                    style={{
                      padding: '10px 12px', textAlign: 'left',
                      backgroundColor: active ? 'var(--raised)' : 'transparent',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      borderLeft: `3px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    }}
                  >
                    <div style={{ color: active ? 'var(--accent)' : 'var(--text)', fontSize: '13px', fontWeight: 600 }}>{p.label}</div>
                    <div style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: '2px' }}>{p.descr}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Outputs ────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Resumen de capitales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{ ...CARD, padding: '14px 16px', borderLeft: '3px solid #22d3ee' }}>
              <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Fondo emergencia</div>
              <div style={{ color: '#22d3ee', fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>{eur(plan.fondoEmergencia)} €</div>
              <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '3px' }}>{meses} meses de gastos</div>
            </div>
            <div style={{ ...CARD, padding: '14px 16px', borderLeft: '3px solid var(--green)' }}>
              <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Capital invertible</div>
              <div style={{ color: 'var(--green)', fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>{eur(plan.capitalInvertible)} €</div>
              <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '3px' }}>{plan.pctInvertible.toFixed(0)} % de tu liquidez</div>
            </div>
            <div style={{ ...CARD, padding: '14px 16px', borderLeft: '3px solid var(--accent)' }}>
              <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>% Equity sugerido</div>
              <div style={{ color: 'var(--accent)', fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>{plan.assetAllocation.equity.toFixed(0)} %</div>
              <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '3px' }}>regla 110 + ajustes</div>
            </div>
          </div>

          {/* Donut + leyenda detallada */}
          <div style={CARD}>
            <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
              Tu reparto recomendado
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '24px', alignItems: 'center' }}>
              {/* Donut */}
              <div style={{ position: 'relative', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={62} outerRadius={92} dataKey="value" strokeWidth={0}>
                      {pieData.map((d, i) => (
                        <Cell key={i} fill={ASIGNACION_COLORS[d.key]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--raised)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: 'var(--text)' }}
                      formatter={(v: any) => [`${eur(v as number)} €`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <div style={{ color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</div>
                  <div style={{ color: 'var(--text)', fontSize: '18px', fontWeight: 700 }}>{eur(plan.fondoEmergencia + plan.capitalInvertible)} €</div>
                </div>
              </div>

              {/* Tabla */}
              <div>
                {pieData.length === 0 ? (
                  <div style={{ color: 'var(--text-3)', fontSize: '12px', fontStyle: 'italic' }}>
                    Introduce tu liquidez y gastos para ver el reparto.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {pieData.map((d) => (
                      <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: ASIGNACION_COLORS[d.key] }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600 }}>{d.name}</div>
                          <div style={{ color: 'var(--text-3)', fontSize: '11px' }}>
                            {d.key === 'cash' ? 'Cuenta corriente / cuenta remunerada' :
                             d.key === 'bonds' ? 'BND / AGG / TLT (bonos)' :
                             d.key === 'equity' ? 'SPY / VTI / VXUS (renta variable)' :
                             d.key === 'realEstate' ? 'VNQ / IYR (REITs)' :
                             'GLD / DBC (oro, materias primas)'}
                          </div>
                        </div>
                        <div style={{ color: 'var(--text)', fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' }}>
                          {eur(d.value)} €
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Notas */}
            {plan.notas.length > 0 && (
              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                {plan.notas.map((nota, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '8px', alignItems: 'flex-start',
                    fontSize: '11px', color: 'var(--text-2)', marginBottom: '6px', lineHeight: 1.5,
                  }}>
                    <span style={{ color: 'var(--amber)' }}>⚠</span>
                    <span>{nota}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mensaje de guardado */}
          {profileMsg && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px',
              backgroundColor: profileMsg.ok ? 'rgba(14,168,117,0.1)' : 'rgba(232,64,64,0.1)',
              border: `1px solid ${profileMsg.ok ? 'rgba(14,168,117,0.3)' : 'rgba(232,64,64,0.3)'}`,
              color: profileMsg.ok ? 'var(--green)' : 'var(--red)',
            }}>
              {profileMsg.ok ? '✓' : '⚠'} {profileMsg.text}
            </div>
          )}

          {/* CTAs */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={guardarPerfilInversor}
              disabled={plan.capitalInvertible <= 0 || savingProfile}
              style={{
                padding: '11px 20px',
                backgroundColor: 'transparent',
                color: plan.capitalInvertible <= 0 ? 'var(--text-3)' : 'var(--green)',
                border: `1px solid ${plan.capitalInvertible <= 0 ? 'var(--border)' : 'rgba(14,168,117,0.4)'}`,
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px', fontWeight: 600,
                cursor: plan.capitalInvertible <= 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {savingProfile ? 'Guardando…' : '💾 Guardar como mi perfil'}
            </button>
            <button
              onClick={aplicarAlOptimizador}
              disabled={plan.capitalInvertible <= 0 || saved}
              style={{
                padding: '11px 22px',
                backgroundColor: plan.capitalInvertible <= 0 ? 'var(--raised)' : 'var(--accent)',
                color: plan.capitalInvertible <= 0 ? 'var(--text-3)' : '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)',
                fontSize: '13px', fontWeight: 600,
                cursor: plan.capitalInvertible <= 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {saved ? '✓ Aplicado, abriendo Optimizador…' :
               plan.capitalInvertible <= 0 ? 'Tu liquidez no cubre la emergencia' :
               `→ Aplicar al Optimizador (${eur(plan.capitalInvertible)} €)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
