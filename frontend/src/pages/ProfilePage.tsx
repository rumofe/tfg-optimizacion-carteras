import { useState, useEffect, CSSProperties } from 'react';
import { getProfile, updateProfile, UserProfile } from '../services/api';

const CARD: CSSProperties = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '24px',
};

const LABEL: CSSProperties = {
  display: 'block', color: 'var(--text-2)', fontSize: '11px',
  marginBottom: '6px', fontWeight: 600, letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

const INPUT: CSSProperties = {
  width: '100%', padding: '10px 14px',
  backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text)',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box',
};

const PERFILES = [
  { id: 'conservador',   label: 'Conservador',   vol: 8,    desc: 'Preservación de capital · ≤ 8 % vol.' },
  { id: 'moderado',      label: 'Moderado',       vol: 15,   desc: 'Equilibrio riesgo-rentabilidad · ≤ 15 % vol.' },
  { id: 'agresivo',      label: 'Agresivo',       vol: 25,   desc: 'Máxima rentabilidad · ≤ 25 % vol.' },
  { id: 'personalizado', label: 'Personalizado',  vol: null, desc: 'Define tu propio límite de volatilidad' },
] as const;

type PerfilId = (typeof PERFILES)[number]['id'];

function inferPerfil(vol: number | null): PerfilId {
  if (vol === 8)  return 'conservador';
  if (vol === 15) return 'moderado';
  if (vol === 25) return 'agresivo';
  return 'personalizado';
}

export default function ProfilePage() {
  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [capital, setCapital]           = useState<string>('');
  const [perfilId, setPerfilId]         = useState<PerfilId>('moderado');
  const [volPersonal, setVolPersonal]   = useState<string>('15');
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [msg, setMsg]                   = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    getProfile()
      .then(({ data }) => {
        setProfile(data);
        setCapital(data.capital_base != null ? String(data.capital_base) : '');
        const pid = inferPerfil(data.tolerancia_riesgo);
        setPerfilId(pid);
        if (pid === 'personalizado' && data.tolerancia_riesgo != null) {
          setVolPersonal(String(data.tolerancia_riesgo));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const preset = PERFILES.find((p) => p.id === perfilId);
      const tol = preset?.vol != null ? preset.vol : parseFloat(volPersonal) || null;
      const cap = capital !== '' ? parseFloat(capital) : null;
      const { data } = await updateProfile({ capital_base: cap, tolerancia_riesgo: tol });
      setProfile(data);
      setMsg({ type: 'ok', text: 'Perfil guardado correctamente.' });
    } catch {
      setMsg({ type: 'err', text: 'Error al guardar el perfil. Inténtalo de nuevo.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ color: 'var(--text-2)', textAlign: 'center', marginTop: '80px', fontSize: '15px' }}>
        Cargando perfil…
      </div>
    );
  }

  const ACCENT_COLORS: Record<PerfilId, string> = {
    conservador:   'var(--green)',
    moderado:      'var(--accent)',
    agresivo:      'var(--red)',
    personalizado: 'var(--purple)',
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Header */}
      <h1 style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
        Perfil de Inversor
      </h1>
      <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: '0 0 28px' }}>
        Configura tu capital de referencia y tu tolerancia al riesgo. Estos valores
        se usarán como punto de partida en el Optimizador.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Cuenta */}
        <div style={CARD}>
          <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '10px' }}>
            Cuenta
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {profile?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div style={{ color: 'var(--text)', fontSize: '14px', fontWeight: 600 }}>{profile?.email}</div>
              <div style={{ color: 'var(--text-3)', fontSize: '11px' }}>Inversor registrado</div>
            </div>
          </div>
        </div>

        {/* Capital */}
        <div style={CARD}>
          <label style={LABEL}>Capital de referencia (€)</label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-2)', fontSize: '14px', pointerEvents: 'none',
            }}>€</span>
            <input
              type="number" min={0} step={100}
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              placeholder="10000"
              style={{ ...INPUT, paddingLeft: '28px' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: '6px' }}>
            Valor orientativo que se pre-rellena en el Optimizador.
          </div>
        </div>

        {/* Perfil de riesgo */}
        <div style={CARD}>
          <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '14px' }}>
            Perfil de riesgo
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {PERFILES.map((p) => {
              const active = perfilId === p.id;
              const color  = ACCENT_COLORS[p.id];
              return (
                <button
                  key={p.id}
                  onClick={() => setPerfilId(p.id)}
                  style={{
                    padding: '14px 16px',
                    backgroundColor: active ? 'var(--raised)' : 'transparent',
                    border: `1px solid ${active ? color : 'var(--border)'}`,
                    borderLeft: `3px solid ${active ? color : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ color: active ? color : 'var(--text)', fontSize: '13px', fontWeight: 600, marginBottom: '3px' }}>
                    {p.label}
                  </div>
                  <div style={{ color: 'var(--text-3)', fontSize: '11px', lineHeight: 1.4 }}>
                    {p.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Input manual si Personalizado */}
          {perfilId === 'personalizado' && (
            <div style={{ marginTop: '14px' }}>
              <label style={LABEL}>Volatilidad máxima (%)</label>
              <input
                type="number" min={1} max={100} step={1}
                value={volPersonal}
                onChange={(e) => setVolPersonal(e.target.value)}
                style={INPUT}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--purple)')}
                onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>
          )}
        </div>

        {/* Guardar */}
        {msg && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px',
            backgroundColor: msg.type === 'ok' ? 'rgba(14,168,117,0.1)' : 'rgba(232,64,64,0.1)',
            border: `1px solid ${msg.type === 'ok' ? 'rgba(14,168,117,0.3)' : 'rgba(232,64,64,0.3)'}`,
            color: msg.type === 'ok' ? 'var(--green)' : 'var(--red)',
          }}>
            {msg.type === 'ok' ? '✓' : '⚠'} {msg.text}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '11px 24px',
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)',
            border: 'none', borderRadius: 'var(--radius-sm)',
            color: '#fff', fontSize: '14px', fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            transition: 'opacity 0.15s',
            alignSelf: 'flex-start',
          }}
        >
          {saving ? 'Guardando…' : 'Guardar perfil'}
        </button>

      </div>
    </div>
  );
}
