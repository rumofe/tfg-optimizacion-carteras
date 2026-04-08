import { useState, CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../services/api';

type Tab = 'login' | 'register';

const INPUT: CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  backgroundColor: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const LABEL: CSSProperties = {
  display: 'block',
  color: 'var(--text-2)',
  fontSize: '12px',
  fontWeight: 500,
  letterSpacing: '0.3px',
  marginBottom: '7px',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      /* Glow radial muy sutil en el centro */
      background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(79,134,247,0.08) 0%, var(--bg) 70%)',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Cabecera: logo + título */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #4f86f7 0%, #9b6ef5 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', fontWeight: 800, color: '#fff',
            margin: '0 auto 18px', letterSpacing: '-0.5px',
            boxShadow: '0 8px 32px rgba(79,134,247,0.3)',
          }}>
            PL
          </div>
          <h1 style={{
            color: 'var(--text)', fontSize: '22px',
            fontWeight: 700, margin: '0 0 6px',
            letterSpacing: '-0.3px',
          }}>
            PortfolioLab
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: 0 }}>
            Optimización de carteras con Teoría de Markowitz
          </p>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px',
        }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg)',
            borderRadius: 'var(--radius-sm)',
            padding: '3px',
            marginBottom: '26px',
          }}>
            {(['login', 'register'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(''); }}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: tab === t ? 'var(--raised)' : 'transparent',
                  color: tab === t ? 'var(--text)' : 'var(--text-2)',
                  border: tab === t ? '1px solid var(--border)' : '1px solid transparent',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: tab === t ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {t === 'login' ? 'Iniciar sesión' : 'Registrarse'}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              color: 'var(--red)',
              fontSize: '13px',
              marginBottom: '20px',
              padding: '11px 14px',
              backgroundColor: 'rgba(232,64,64,0.07)',
              border: '1px solid rgba(232,64,64,0.25)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <span style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }}>⚠</span>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={LABEL}>CORREO ELECTRÓNICO</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@ejemplo.com"
                required
                style={INPUT}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={LABEL}>CONTRASEÑA</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                style={INPUT}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px',
                background: loading
                  ? 'var(--raised)'
                  : 'linear-gradient(135deg, #4f86f7 0%, #6d5ef5 100%)',
                color: loading ? 'var(--text-2)' : '#fff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s',
                letterSpacing: '0.1px',
              }}
            >
              {loading
                ? 'Cargando…'
                : tab === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
        </div>

        <p style={{
          textAlign: 'center',
          color: 'var(--text-3)',
          fontSize: '12px',
          marginTop: '20px',
        }}>
          E.T.S. Ingeniería Informática · Universidad de Málaga
        </p>
      </div>
    </div>
  );
}
