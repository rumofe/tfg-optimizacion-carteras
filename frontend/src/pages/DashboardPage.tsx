import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { to: 'optimizer', label: 'Optimizador',  icon: '⬡', desc: 'Markowitz & Frontera Eficiente' },
  { to: 'xray',      label: 'X-Ray',        icon: '◎', desc: 'Análisis sectorial' },
  { to: 'backtest',  label: 'Backtesting',  icon: '↗', desc: 'Simulación histórica' },
];

export default function DashboardPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/', { replace: true });
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem('token');
    navigate('/', { replace: true });
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: 'var(--bg)',
      fontFamily: 'inherit',
    }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: '240px',
        flexShrink: 0,
        backgroundColor: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Logo */}
        <div style={{
          padding: '28px 20px 22px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Monograma */}
            <div style={{
              width: '36px', height: '36px', borderRadius: '9px',
              background: 'linear-gradient(135deg, #4f86f7 0%, #9b6ef5 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 800, color: '#fff',
              flexShrink: 0, letterSpacing: '-0.5px',
            }}>
              PL
            </div>
            <div>
              <div style={{
                color: 'var(--text)', fontWeight: 700,
                fontSize: '15px', letterSpacing: '-0.2px',
              }}>
                PortfolioLab
              </div>
              <div style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: '1px' }}>
                TFG · UMA 2026
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          <div style={{
            color: 'var(--text-3)', fontSize: '10px', fontWeight: 600,
            letterSpacing: '0.8px', padding: '4px 10px 10px',
            textTransform: 'uppercase',
          }}>
            Módulos
          </div>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '11px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                textDecoration: 'none',
                color: isActive ? 'var(--text)' : 'var(--text-2)',
                backgroundColor: isActive ? 'var(--raised)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                fontSize: '13.5px',
                fontWeight: isActive ? 600 : 400,
                marginBottom: '2px',
                transition: 'all 0.15s',
              })}
            >
              <span style={{ fontSize: '14px', opacity: 0.85, minWidth: '16px', textAlign: 'center' }}>
                {icon}
              </span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div style={{
          padding: '14px 10px 16px',
          borderTop: '1px solid var(--border)',
        }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '9px 12px',
              backgroundColor: 'transparent',
              color: 'var(--text-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
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
            <span style={{ fontSize: '13px' }}>⎋</span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '40px 44px',
        minWidth: 0,
      }}>
        <Outlet />
      </main>
    </div>
  );
}
