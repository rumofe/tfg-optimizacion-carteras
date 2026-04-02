import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { getPortfolios, Portfolio } from '../services/api';

const COLORS = ['#58a6ff', '#3fb950', '#d29922', '#bc8cff', '#f85149', '#79c0ff', '#fb8500', '#ff6b9d'];

export default function XRayPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getPortfolios()
      .then(({ data }) => setPortfolios(data))
      .catch(() => setError('No se pudieron cargar las carteras. Comprueba que el servidor está activo.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ color: '#8b949e', textAlign: 'center', marginTop: '80px', fontSize: '15px' }}>
        Cargando carteras…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        color: '#f85149', textAlign: 'center', marginTop: '80px',
        fontSize: '14px', padding: '16px', backgroundColor: 'rgba(248,81,73,0.08)',
        border: '1px solid rgba(248,81,73,0.3)', borderRadius: '8px', maxWidth: '480px', margin: '80px auto 0',
      }}>
        {error}
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ color: '#e6edf3', fontSize: '22px', fontWeight: 700, margin: '0 0 6px' }}>
        X-Ray de Carteras
      </h1>
      <p style={{ color: '#8b949e', fontSize: '13px', margin: '0 0 28px' }}>
        Composición de tus carteras guardadas ({portfolios.length} cartera{portfolios.length !== 1 ? 's' : ''})
      </p>

      {portfolios.length === 0 ? (
        <div style={{
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '10px',
          padding: '60px 40px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
          <div style={{ color: '#e6edf3', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
            Sin carteras guardadas
          </div>
          <div style={{ color: '#8b949e', fontSize: '13px' }}>
            Ve al Optimizador, genera una cartera y guárdala para verla aquí
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '20px',
        }}>
          {portfolios.map((p) => {
            const pieData = p.activos.map((a) => ({
              name: a.ticker,
              value: parseFloat((a.peso_asignado * 100).toFixed(2)),
            }));

            return (
              <div key={p.id} style={{
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '10px',
                padding: '24px',
              }}>
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <h2 style={{ color: '#e6edf3', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                    {p.nombre_estrategia}
                  </h2>
                  <span style={{
                    color: '#8b949e', fontSize: '11px',
                    backgroundColor: '#21262d',
                    padding: '2px 8px', borderRadius: '12px',
                  }}>
                    {p.fecha_creacion}
                  </span>
                </div>
                <p style={{ color: '#8b949e', fontSize: '12px', margin: '0 0 16px' }}>
                  {p.activos.length} activo{p.activos.length !== 1 ? 's' : ''}
                </p>

                {/* PieChart */}
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#21262d', border: '1px solid #30363d', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#e6edf3' }}
                      formatter={(v: any) => [`${(v as number).toFixed(2)}%`, '']}
                    />
                    <Legend
                      formatter={(value) => (
                        <span style={{ color: '#e6edf3', fontSize: '12px' }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Weight List */}
                <div style={{ marginTop: '12px', borderTop: '1px solid #21262d', paddingTop: '12px' }}>
                  {p.activos
                    .slice()
                    .sort((a, b) => b.peso_asignado - a.peso_asignado)
                    .map((a, i) => (
                      <div key={a.ticker} style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: '4px',
                      }}>
                        <span style={{ color: COLORS[i % COLORS.length], fontSize: '13px', fontWeight: 600 }}>
                          {a.ticker}
                        </span>
                        <span style={{ color: '#8b949e', fontSize: '12px' }}>
                          {(a.peso_asignado * 100).toFixed(2)}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
