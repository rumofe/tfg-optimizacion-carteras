import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import ThemeSelector from '../components/ThemeSelector';
import { getProfile } from '../services/api';

const NAV_ITEMS = [
  { to: 'planner',   label: 'Planificador', icon: '▦' },
  { to: 'optimizer', label: 'Optimizador',  icon: '◎' },
  { to: 'xray',      label: 'X-Ray',        icon: '◈' },
  { to: 'backtest',  label: 'Backtesting',  icon: '◉' },
  { to: 'compare',   label: 'Comparador',   icon: '▣' },
];

// ── Logo SVG ──────────────────────────────────────────────────────────────────
function ASLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
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

export default function DashboardPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) { navigate('/', { replace: true }); return; }
    getProfile().then(({ data }) => setEmail(data.email)).catch(() => {});
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem('token');
    navigate('/', { replace: true });
  }

  const initial = email ? email[0].toUpperCase() : '?';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg)' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: '240px', flexShrink: 0,
        backgroundColor: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <ASLogo />
            <div>
              <div style={{
                color: 'var(--text)', fontWeight: 700, fontSize: '15px',
                letterSpacing: '-0.2px',
              }}>
                AlphaScope
              </div>
              <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '1px', letterSpacing: '0.3px' }}>
                TFG · UMA 2026
              </div>
            </div>
          </div>
        </div>

        {/* Nav módulos */}
        <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{
            color: 'var(--text-3)', fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.8px', padding: '4px 10px 10px', textTransform: 'uppercase',
          }}>
            Módulos
          </div>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to} to={to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                textDecoration: 'none',
                color: isActive ? 'var(--text)' : 'var(--text-2)',
                backgroundColor: isActive ? 'var(--raised)' : 'transparent',
                borderLeft: `3px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                fontSize: '13.5px', fontWeight: isActive ? 600 : 400,
                transition: 'color 0.15s, background-color 0.15s',
              })}
            >
              <span style={{ fontSize: '14px', opacity: 0.7 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div style={{ borderTop: '1px solid var(--border)' }}>

          {/* Avatar → perfil */}
          <NavLink
            to="profile"
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '14px 16px', textDecoration: 'none',
              backgroundColor: isActive ? 'var(--raised)' : 'transparent',
              borderLeft: `3px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
              transition: 'background 0.15s',
              cursor: 'pointer',
            })}
          >
            <div style={{
              width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
              backgroundColor: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700, color: '#fff',
            }}>
              {initial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                color: 'var(--text)', fontSize: '12px', fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {email || 'Mi perfil'}
              </div>
              <div style={{ color: 'var(--text-3)', fontSize: '10px' }}>Ver perfil</div>
            </div>
          </NavLink>

          <ThemeSelector current={theme} onChange={setTheme} />

          <div style={{ padding: '0 10px 14px' }}>
            <button
              onClick={handleLogout}
              style={{
                width: '100%', padding: '9px 12px',
                backgroundColor: 'transparent', color: 'var(--text-2)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--red)';
                e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)';
                e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-2)';
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span style={{ opacity: 0.6 }}>→</span> Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '40px 44px', minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
