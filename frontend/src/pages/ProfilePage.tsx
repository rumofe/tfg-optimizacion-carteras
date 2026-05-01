import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, UserProfile } from '../services/api';
import { CARD } from '../styles';

interface PerfilLabel {
  label: string;
  color: string;
  desc: string;
}

function inferPerfilLabel(vol: number | null): PerfilLabel {
  if (vol == null) return {
    label: 'Sin definir', color: 'var(--text-3)',
    desc: 'Visita el Planificador para configurar tu perfil de inversor.',
  };
  if (vol <= 17) return {
    label: 'Conservador', color: 'var(--green)',
    desc: 'Baja exposición al riesgo · ≤ 15 % vol.',
  };
  if (vol <= 30) return {
    label: 'Moderado', color: 'var(--accent)',
    desc: 'Equilibrio riesgo-rentabilidad · ≤ 25 % vol.',
  };
  return {
    label: 'Agresivo', color: 'var(--amber)',
    desc: 'Alta exposición a renta variable · ≤ 40 % vol.',
  };
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile()
      .then(({ data }) => setProfile(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ color: 'var(--text-2)', textAlign: 'center', marginTop: '80px', fontSize: '15px' }}>
        Cargando perfil…
      </div>
    );
  }

  const perfilLabel = inferPerfilLabel(profile?.tolerancia_riesgo ?? null);
  const capitalSet  = profile?.capital_base != null && profile.capital_base > 0;
  const perfilSet   = profile?.tolerancia_riesgo != null;

  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Header */}
      <h1 style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 700, margin: '0 0 6px' }}>
        Mi cuenta
      </h1>
      <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: '0 0 28px' }}>
        Resumen de tu cuenta y de tu perfil de inversor. Para cambiar capital, perfil de riesgo
        o tu situación financiera, ve al Planificador.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── Cuenta ── */}
        <div style={CARD}>
          <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>
            Cuenta
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              backgroundColor: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {profile?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div style={{ color: 'var(--text)', fontSize: '14px', fontWeight: 600 }}>{profile?.email}</div>
              <div style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: '2px' }}>Inversor registrado</div>
            </div>
          </div>
        </div>

        {/* ── Perfil de inversor (resumen) ── */}
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Perfil de inversor
            </div>
            <button
              onClick={() => navigate('/dashboard/planner')}
              style={{
                padding: '6px 14px', fontSize: '11px', fontWeight: 600,
                backgroundColor: 'transparent', color: 'var(--accent)',
                border: '1px solid rgba(79, 134, 247, 0.4)',
                borderRadius: '14px', cursor: 'pointer',
              }}
            >
              ✎ Editar en el Planificador
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* Capital de referencia */}
            <div style={{
              padding: '14px 16px', backgroundColor: 'var(--raised)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: `3px solid ${capitalSet ? 'var(--green)' : 'var(--border)'}`,
            }}>
              <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
                Capital de referencia
              </div>
              {capitalSet ? (
                <div style={{ color: 'var(--green)', fontSize: '22px', fontWeight: 700, lineHeight: 1 }}>
                  {profile!.capital_base!.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
                </div>
              ) : (
                <div style={{ color: 'var(--text-3)', fontSize: '13px', fontStyle: 'italic' }}>
                  No definido
                </div>
              )}
              <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '6px', lineHeight: 1.5 }}>
                Capital invertible recomendado por el Planificador.
              </div>
            </div>

            {/* Perfil de riesgo */}
            <div style={{
              padding: '14px 16px', backgroundColor: 'var(--raised)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: `3px solid ${perfilSet ? perfilLabel.color : 'var(--border)'}`,
            }}>
              <div style={{ color: 'var(--text-2)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
                Perfil de riesgo
              </div>
              <div style={{ color: perfilLabel.color, fontSize: '22px', fontWeight: 700, lineHeight: 1 }}>
                {perfilLabel.label}
              </div>
              {perfilSet && (
                <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '6px' }}>
                  Volatilidad máxima: {profile!.tolerancia_riesgo!.toFixed(0)} %
                </div>
              )}
              <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '4px', lineHeight: 1.5 }}>
                {perfilLabel.desc}
              </div>
            </div>
          </div>

          {(!capitalSet || !perfilSet) && (
            <div style={{
              marginTop: '14px', padding: '10px 12px',
              backgroundColor: 'rgba(232, 166, 64, 0.08)',
              border: '1px solid rgba(232, 166, 64, 0.3)',
              borderRadius: '6px', fontSize: '11px', color: 'var(--amber)',
              lineHeight: 1.5,
            }}>
              ⚠ Aún no has configurado tu perfil de inversor.
              {' '}
              <span
                onClick={() => navigate('/dashboard/planner')}
                style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Hazlo en el Planificador
              </span>
              {' '}para que el Optimizador y las plantillas se ajusten a tu situación.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
