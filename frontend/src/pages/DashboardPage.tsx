import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import ThemeSelector from '../components/ThemeSelector';
import { getProfile } from '../services/api';

const NAV_ITEMS = [
  { to: 'optimizer', label: 'Optimizador' },
  { to: 'xray',      label: 'X-Ray'       },
  { to: 'backtest',  label: 'Backtesting' },
];

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
        <div style={{ padding: '28px 20px 22px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '9px',
              backgroundColor: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 800, color: '#fff', flexShrink: 0,
            }}>PL</div>
            <div>
              <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '15px' }}>
                PortfolioLab
              </div>
              <div style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: '1px' }}>TFG · UMA 2026</div>
            </div>
          </div>
        </div>

        {/* Nav módulos */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          <div style={{
            color: 'var(--text-3)', fontSize: '10px', fontWeight: 600,
            letterSpacing: '0.5px', padding: '4px 10px 10px', textTransform: 'uppercase',
          }}>
            Módulos
          </div>
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to} to={to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center',
                padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                textDecoration: 'none',
                color: isActive ? 'var(--text)' : 'var(--text-2)',
                backgroundColor: isActive ? 'var(--raised)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                fontSize: '13.5px', fontWeight: isActive ? 600 : 400,
                marginBottom: '2px', transition: 'color 0.15s, background-color 0.15s',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div style={{ borderTop: '1px solid var(--border)' }}>

          {/* Avatar-card → perfil */}
          <NavLink
            to="profile"
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 14px', textDecoration: 'none',
              backgroundColor: isActive ? 'var(--raised)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'background 0.15s',
              cursor: 'pointer',
            })}
          >
            {/* Avatar */}
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
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--red)';
                e.currentTarget.style.borderColor = 'rgba(232,64,64,0.35)';
                e.currentTarget.style.backgroundColor = 'rgba(232,64,64,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-2)';
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
                Cerrar sesión
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
