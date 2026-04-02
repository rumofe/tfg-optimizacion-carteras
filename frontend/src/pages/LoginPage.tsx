import { useState, CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../services/api';

type Tab = 'login' | 'register';

const INPUT: CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  backgroundColor: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: '6px',
  color: '#e6edf3',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const LABEL: CSSProperties = {
  display: 'block',
  color: '#8b949e',
  fontSize: '12px',
  marginBottom: '6px',
  fontWeight: 500,
  letterSpacing: '0.5px',
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
      backgroundColor: '#0d1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '12px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>📊</div>
          <h1 style={{ color: '#e6edf3', fontSize: '20px', fontWeight: 700, margin: '0 0 6px' }}>
            Optimización de Carteras
          </h1>
          <p style={{ color: '#8b949e', fontSize: '13px', margin: 0 }}>
            Gestión inteligente de inversiones
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          backgroundColor: '#0d1117',
          borderRadius: '8px',
          padding: '4px',
          marginBottom: '24px',
        }}>
          {(['login', 'register'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: tab === t ? '#21262d' : 'transparent',
                color: tab === t ? '#e6edf3' : '#8b949e',
                border: 'none',
                borderRadius: '6px',
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

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              color: '#f85149',
              fontSize: '13px',
              marginBottom: '16px',
              padding: '10px 12px',
              backgroundColor: 'rgba(248, 81, 73, 0.08)',
              border: '1px solid rgba(248, 81, 73, 0.3)',
              borderRadius: '6px',
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label style={LABEL}>EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              style={INPUT}
            />
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label style={LABEL}>CONTRASEÑA</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              style={INPUT}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px',
              backgroundColor: loading ? '#21262d' : '#1f6feb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            {loading ? 'Cargando...' : tab === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}
