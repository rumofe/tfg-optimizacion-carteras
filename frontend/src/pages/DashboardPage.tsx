import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { to: 'optimizer', label: 'Optimizador',  icon: '◈' },
  { to: 'xray',      label: 'X-Ray',        icon: '◉' },
  { to: 'backtest',  label: 'Backtesting',  icon: '▲' },
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
      backgroundColor: '#0d1117',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Sidebar */}
      <aside style={{
        width: '220px',
        flexShrink: 0,
        backgroundColor: '#161b22',
        borderRight: '1px solid #30363d',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #30363d' }}>
          <div style={{ color: '#58a6ff', fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
            PortfolioLab
          </div>
          <div style={{ color: '#8b949e', fontSize: '12px' }}>
            Optimización Markowitz · UMA
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                textDecoration: 'none',
                color: isActive ? '#e6edf3' : '#8b949e',
                backgroundColor: isActive ? '#21262d' : 'transparent',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 400,
                marginBottom: '2px',
                transition: 'all 0.15s',
              })}
            >
              <span style={{ fontSize: '15px', opacity: 0.9 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid #30363d' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '9px',
              backgroundColor: 'transparent',
              color: '#f85149',
              border: '1px solid rgba(248, 81, 73, 0.4)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '36px 40px' }}>
        <Outlet />
      </main>
    </div>
  );
}
