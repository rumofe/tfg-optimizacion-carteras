import { useEffect, useState, useMemo } from 'react';
import {
  getPortfolioSnapshots, PortfolioSnapshot, Portfolio,
} from '../services/api';
import { CARD, COLORS } from '../styles';

interface Props {
  portfolio: Portfolio;
  onClose: () => void;
}

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function diff(antes: Record<string, number>, despues: Record<string, number>): {
  añadidos:    string[];
  eliminados:  string[];
  modificados: { ticker: string; antes: number; despues: number }[];
} {
  const tickersAntes   = new Set(Object.keys(antes));
  const tickersDespues = new Set(Object.keys(despues));
  const añadidos      = [...tickersDespues].filter((t) => !tickersAntes.has(t));
  const eliminados    = [...tickersAntes].filter((t) => !tickersDespues.has(t));
  const modificados: { ticker: string; antes: number; despues: number }[] = [];
  for (const t of tickersAntes) {
    if (tickersDespues.has(t) && Math.abs(antes[t] - despues[t]) > 1e-4) {
      modificados.push({ ticker: t, antes: antes[t], despues: despues[t] });
    }
  }
  return { añadidos, eliminados, modificados };
}

export default function PortfolioHistoryModal({ portfolio, onClose }: Props) {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    getPortfolioSnapshots(portfolio.id)
      .then(({ data }) => setSnapshots(data))
      .catch(() => setError('No se pudo cargar el historial.'))
      .finally(() => setLoading(false));
  }, [portfolio.id]);

  // Estado actual de la cartera como referencia para diffs
  const pesosActuales = useMemo(
    () => Object.fromEntries(portfolio.activos.map((a) => [a.ticker, a.peso_asignado])),
    [portfolio],
  );

  // Construimos la lista: estado actual + snapshots ordenados por fecha desc.
  // Para cada snapshot calculamos su diff respecto a la versión "siguiente" en el tiempo.
  const timeline = useMemo(() => {
    // versiones en orden DESC (más reciente arriba): [actual, snap0, snap1, ...]
    const versiones: { etiqueta: string; fecha: string | null; pesos: Record<string, number>; motivo: string | null }[] = [
      {
        etiqueta: 'Versión actual',
        fecha: null,
        pesos: pesosActuales,
        motivo: 'actual',
      },
      ...snapshots.map((s) => ({
        etiqueta: s.nombre_estrategia,
        fecha: s.fecha,
        pesos: s.pesos,
        motivo: s.motivo,
      })),
    ];
    // Para cada versión, comparar con la SIGUIENTE en el array (más antigua)
    return versiones.map((v, i) => {
      const previa = versiones[i + 1];
      const cambios = previa ? diff(previa.pesos, v.pesos) : null;
      return { ...v, cambios };
    });
  }, [pesosActuales, snapshots]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...CARD,
          width: '100%', maxWidth: '780px',
          maxHeight: '85vh', overflowY: 'auto',
          backgroundColor: 'var(--surface)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div>
            <h2 style={{ color: 'var(--text)', fontSize: '17px', fontWeight: 700, margin: '0 0 4px' }}>
              Historial de "{portfolio.nombre_estrategia}"
            </h2>
            <div style={{ color: 'var(--text-3)', fontSize: '12px' }}>
              {snapshots.length === 0 ? 'Sin ediciones todavía' : `${snapshots.length} versiones anteriores guardadas`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-2)',
              cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '4px 8px',
            }}
            title="Cerrar"
          >×</button>
        </div>

        {/* Body */}
        {loading ? (
          <div style={{ color: 'var(--text-2)', fontSize: '13px', padding: '24px 0', textAlign: 'center' }}>Cargando…</div>
        ) : error ? (
          <div style={{ color: 'var(--red)', fontSize: '13px', padding: '12px 0' }}>{error}</div>
        ) : (
          <div style={{ marginTop: '20px', position: 'relative' }}>
            {/* Timeline vertical */}
            <div style={{
              position: 'absolute', left: '11px', top: '8px', bottom: '8px',
              width: '2px', backgroundColor: 'var(--border)',
            }} />
            {timeline.map((v, i) => {
              const esActual = i === 0;
              const sortedPesos = Object.entries(v.pesos).sort(([, a], [, b]) => b - a);
              return (
                <div key={i} style={{ display: 'flex', gap: '14px', marginBottom: '20px' }}>
                  {/* Punto */}
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    backgroundColor: esActual ? 'var(--accent)' : 'var(--raised)',
                    border: `2px solid ${esActual ? 'var(--accent)' : 'var(--border)'}`,
                    flexShrink: 0, marginTop: '4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '10px', fontWeight: 700,
                    zIndex: 1, position: 'relative',
                  }}>
                    {esActual ? '★' : ''}
                  </div>
                  {/* Card */}
                  <div style={{
                    flex: 1,
                    padding: '14px 16px',
                    backgroundColor: esActual ? 'rgba(79,134,247,0.06)' : 'var(--raised)',
                    border: `1px solid ${esActual ? 'rgba(79,134,247,0.3)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    {/* Cabecera */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ color: esActual ? 'var(--accent)' : 'var(--text)', fontSize: '13px', fontWeight: 700 }}>
                          {v.etiqueta}
                        </span>
                        {!esActual && (
                          <span style={{ color: 'var(--text-3)', fontSize: '10px', marginLeft: '8px',
                            padding: '1px 6px', backgroundColor: 'var(--surface)',
                            border: '1px solid var(--border)', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '0.4px',
                          }}>
                            {v.motivo}
                          </span>
                        )}
                      </div>
                      {v.fecha && (
                        <span style={{ color: 'var(--text-3)', fontSize: '11px', fontFamily: 'monospace' }}>
                          {fmtFecha(v.fecha)}
                        </span>
                      )}
                      {esActual && (
                        <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 600 }}>en vigor</span>
                      )}
                    </div>

                    {/* Cambios respecto a la versión anterior */}
                    {v.cambios && (v.cambios.añadidos.length + v.cambios.eliminados.length + v.cambios.modificados.length > 0) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '10px', fontSize: '11px' }}>
                        {v.cambios.añadidos.map((t) => (
                          <div key={`a-${t}`} style={{ color: 'var(--green)' }}>
                            <strong>+ {t}</strong> · añadido
                          </div>
                        ))}
                        {v.cambios.eliminados.map((t) => (
                          <div key={`e-${t}`} style={{ color: 'var(--red)' }}>
                            <strong>− {t}</strong> · eliminado
                          </div>
                        ))}
                        {v.cambios.modificados.map((m) => {
                          const delta = (m.despues - m.antes) * 100;
                          const arriba = delta > 0;
                          return (
                            <div key={`m-${m.ticker}`} style={{ color: 'var(--text-2)' }}>
                              <strong>{m.ticker}</strong>: {(m.antes * 100).toFixed(1)}% →{' '}
                              <span style={{ color: arriba ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                                {(m.despues * 100).toFixed(1)}% ({arriba ? '+' : ''}{delta.toFixed(1)} pp)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Mini barras con todos los pesos */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {sortedPesos.map(([t, w], idx) => (
                        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                          <span style={{ color: COLORS[idx % COLORS.length], fontWeight: 600, fontFamily: 'monospace', width: '54px' }}>{t}</span>
                          <div style={{ flex: 1, height: '5px', backgroundColor: 'var(--surface)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${w * 100}%`, height: '100%', backgroundColor: COLORS[idx % COLORS.length] }} />
                          </div>
                          <span style={{ color: 'var(--text-2)', fontFamily: 'monospace', width: '46px', textAlign: 'right' }}>
                            {(w * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
