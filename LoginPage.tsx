import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../services/api';
import { INPUT } from '../styles';

type Tab = 'login' | 'register';

// ── Logo SVG inline ───────────────────────────────────────────────────────────
function ASLogo({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="10" fill="var(--accent)" />
      <polyline
        points="6,30 12,21 18,25 26,13 34,9"
        stroke="rgba(255,255,255,0.3)" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      <polyline
        points="6,30 12,21 18,25 26,13 34,9"
        stroke="white" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      <circle cx="34" cy="9" r="2.5" fill="white" />
    </svg>
  );
}

// Sparkline datos decorativos
const SPARK = [42, 58, 51, 67, 63, 78, 72, 85, 80, 94, 88, 100, 96, 110];

export default function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab]         = useState<Tab>('login');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [focusEmail, setFocusEmail]   = useState(false);
  const [focusPass,  setFocusPass]    = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fn = tab === 'login' ? login : register;
      const { data } = await fn(email, password);
      localStorage.setItem('token', data.access_token);
      navigate('/dashboard');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }

  // Sparkline path
  const max = Math.max(...SPARK), min = Math.min(...SPARK);
  const sparkXs = SPARK.map((_, i) => (i / (SPARK.length - 1)) * 300);
  const sparkYs = SPARK.map(v => 75 - ((v - min) / (max - min)) * 65);
  const sparkD  = sparkXs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${sparkYs[i]}`).join(' ');
  const sparkArea = `${sparkD} L 300 80 L 0 80 Z`;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      backgroundColor: 'var(--bg)',
    }}>
      {/* ── Panel izquierdo: branding ── */}
      <div style={{
        flex: '0 0 50%', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 64px',
        background: 'linear-gradient(145deg, var(--bg) 0%, var(--surface) 100%)',
        borderRight: '1px solid var(--border)',
      }}>
        {/* Grid decorativo */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none' }}>
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="var(--accent)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Glow radial */}
        <div style={{
          position: 'absolute', top: '-15%', left: '-10%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, var(--accent-dim) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Sparkline decorativa en el fondo */}
        <div style={{ position: 'absolute', bottom: '56px', left: '60px', right: '60px', opacity: 0.12, pointerEvents: 'none' }}>
          <svg width="100%" height="80" viewBox="0 0 300 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.6" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={sparkArea} fill="url(#spark-fill)" />
            <path d={sparkD}    fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Contenido */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '48px' }}>
            <ASLogo size={48} />
            <div>
              <div style={{ color: 'var(--text)', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.4px' }}>AlphaScope</div>
              <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '0.3px' }}>TFG · UMA 2026</div>
            </div>
          </div>

          <h2 style={{
            color: 'var(--text)', fontSize: '34px', fontWeight: 700,
            margin: '0 0 14px', lineHeight: 1.2, letterSpacing: '-0.6px',
          }}>
            Optimización de<br />
            <span style={{ color: 'var(--accent)' }}>carteras</span> inteligente
          </h2>
          <p style={{ color: 'var(--text-2)', fontSize: '14px', margin: '0 0 36px', lineHeight: 1.7, maxWidth: '340px' }}>
            Maximiza el ratio Sharpe de tu cartera con la Teoría Moderna de Markowitz,
            análisis X-Ray y backtesting histórico.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Frontera Eficiente de Markowitz' },
              { label: 'X-Ray · Análisis sectorial y geográfico' },
              { label: 'Backtesting con crisis reales' },
            ].map(({ label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-2)', fontSize: '13px' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: '22px', left: '64px', color: 'var(--text-3)', fontSize: '11px' }}>
          E.T.S. Ingeniería Informática · Universidad de Málaga
        </div>
      </div>

      {/* ── Panel derecho: formulario ── */}
      <div style={{
        flex: '0 0 50%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '40px',
        backgroundColor: 'var(--bg)',
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>

          {/* Tabs */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '4px', marginBottom: '28px',
          }}>
            {(['login', 'register'] as Tab[]).map((t) => (
              <button
                key={t} type="button"
                onClick={() => { setTab(t); setError(''); }}
                style={{
                  flex: 1, padding: '9px',
                  backgroundColor: tab === t ? 'var(--raised)' : 'transparent',
                  color: tab === t ? 'var(--text)' : 'var(--text-2)',
                  border: tab === t ? '1px solid var(--border)' : '1px solid transparent',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', fontSize: '13px',
                  fontWeight: tab === t ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {t === 'login' ? 'Iniciar sesión' : 'Registrarse'}
              </button>
            ))}
          </div>

          <h3 style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.3px' }}>
            {tab === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
          </h3>
          <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: '0 0 24px' }}>
            {tab === 'login' ? 'Accede a tu panel de carteras' : 'Empieza a optimizar tu portfolio'}
          </p>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', gap: '10px', alignItems: 'flex-start',
              padding: '12px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '18px',
              backgroundColor: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.25)',
              color: 'var(--red)', fontSize: '13px',
            }}>
              <span style={{ flexShrink: 0 }}>⚠</span>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '12px', fontWeight: 600, marginBottom: '7px' }}>
                Correo electrónico
              </label>
              <input
                type="email" value={email} required
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@ejemplo.com"
                onFocus={() => setFocusEmail(true)}
                onBlur={() => setFocusEmail(false)}
                style={{
                  ...INPUT,
                  borderColor: focusEmail ? 'var(--accent)' : 'var(--border)',
                  boxShadow: focusEmail ? '0 0 0 3px var(--accent-dim)' : 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '12px', fontWeight: 600, marginBottom: '7px' }}>
                Contraseña
              </label>
              <input
                type="password" value={password} required minLength={6}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                onFocus={() => setFocusPass(true)}
                onBlur={() => setFocusPass(false)}
                style={{
                  ...INPUT,
                  borderColor: focusPass ? 'var(--accent)' : 'var(--border)',
                  boxShadow: focusPass ? '0 0 0 3px var(--accent-dim)' : 'none',
                }}
              />
            </div>

            <button
              type="submit" disabled={loading}
              style={{
                marginTop: '8px', padding: '13px',
                backgroundColor: loading ? 'var(--raised)' : 'var(--accent)',
                color: loading ? 'var(--text-2)' : '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)',
                fontSize: '14px', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                boxShadow: loading ? 'none' : '0 4px 20px var(--accent-dim)',
              }}
            >
              {loading ? 'Cargando…' : tab === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
