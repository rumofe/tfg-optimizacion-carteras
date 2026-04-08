import { useState, useEffect } from 'react';
import { updatePortfolio, Portfolio } from '../services/api';
import TickerSearch from './TickerSearch';

interface Props {
  portfolio: Portfolio;
  onClose: () => void;
  onSaved: (updated: Portfolio) => void;
}

const COLORS = ['#4f86f7', '#0ea875', '#f0a020', '#9b6ef5', '#e84040', '#22d3ee', '#f472b6', '#a3e635'];

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text)',
  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
};

type Row = { ticker: string; pct: string };

function toRows(activos: Portfolio['activos']): Row[] {
  return activos
    .slice()
    .sort((a, b) => b.peso_asignado - a.peso_asignado)
    .map((a) => ({ ticker: a.ticker, pct: (a.peso_asignado * 100).toFixed(2) }));
}

export default function EditPortfolioModal({ portfolio, onClose, onSaved }: Props) {
  const [nombre, setNombre]   = useState(portfolio.nombre_estrategia);
  const [rows, setRows]       = useState<Row[]>(() => toRows(portfolio.activos));
  const [addTickers, setAddTickers] = useState<string[]>([]);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const total = rows.reduce((s, r) => s + (parseFloat(r.pct) || 0), 0);
  const totalOk = Math.abs(total - 100) < 0.1;

  function updatePct(ticker: string, val: string) {
    setRows((prev) => prev.map((r) => r.ticker === ticker ? { ...r, pct: val } : r));
  }

  function removeRow(ticker: string) {
    setRows((prev) => prev.filter((r) => r.ticker !== ticker));
  }

  function normalize() {
    if (total === 0) return;
    setRows((prev) => prev.map((r) => ({
      ...r,
      pct: ((parseFloat(r.pct) || 0) / total * 100).toFixed(2),
    })));
  }

  function addSelected() {
    const existing = new Set(rows.map((r) => r.ticker));
    const news = addTickers.filter((t) => !existing.has(t));
    if (news.length === 0) { setAddTickers([]); return; }
    // Distribuir el peso que sobra
    const remaining = Math.max(0, 100 - total);
    const share = news.length > 0 ? (remaining / news.length).toFixed(2) : '0';
    setRows((prev) => [...prev, ...news.map((t) => ({ ticker: t, pct: share }))]);
    setAddTickers([]);
  }

  async function handleSave() {
    if (rows.length < 1) { setError('La cartera debe tener al menos 1 activo.'); return; }
    if (!totalOk) { setError('Los pesos deben sumar 100 %. Usa "Normalizar" para ajustarlos.'); return; }
    if (!nombre.trim()) { setError('El nombre no puede estar vacío.'); return; }
    setSaving(true); setError('');
    try {
      const pesos: Record<string, number> = {};
      rows.forEach((r) => { pesos[r.ticker] = (parseFloat(r.pct) || 0) / 100; });
      await updatePortfolio(portfolio.id, nombre.trim(), pesos);
      const updated: Portfolio = {
        ...portfolio,
        nombre_estrategia: nombre.trim(),
        activos: rows.map((r) => ({ ticker: r.ticker, peso_asignado: (parseFloat(r.pct) || 0) / 100 })),
      };
      onSaved(updated);
    } catch {
      setError('Error al guardar. Comprueba que el servidor está activo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    /* Overlay */
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Modal */}
      <div style={{
        width: '100%', maxWidth: '520px',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '90vh',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ color: 'var(--text)', fontSize: '15px', fontWeight: 700 }}>Editar cartera</div>
            <div style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: '2px' }}>{portfolio.nombre_estrategia}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-2)',
            fontSize: '18px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px',
            lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Nombre */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block', color: 'var(--text-2)', fontSize: '10px',
              fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '6px',
            }}>
              Nombre de la estrategia
            </label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              style={INPUT_STYLE}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Activos */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px',
            }}>
              <label style={{
                color: 'var(--text-2)', fontSize: '10px',
                fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase',
              }}>
                Activos y pesos
              </label>
              {/* Indicador de suma */}
              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                borderRadius: '20px',
                backgroundColor: totalOk ? 'rgba(14,168,117,0.12)' : 'rgba(240,160,32,0.12)',
                color: totalOk ? 'var(--green)' : 'var(--amber)',
              }}>
                Σ {total.toFixed(2)} %
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {rows.map((r, i) => (
                <div key={r.ticker} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px',
                  backgroundColor: 'var(--raised)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: COLORS[i % COLORS.length],
                  }} />
                  <span style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, minWidth: '60px' }}>
                    {r.ticker}
                  </span>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="number" min={0} max={100} step={0.01}
                      value={r.pct}
                      onChange={(e) => updatePct(r.ticker, e.target.value)}
                      style={{ ...INPUT_STYLE, paddingRight: '28px', textAlign: 'right' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                      onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--border)')}
                    />
                    <span style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text-2)', fontSize: '12px', pointerEvents: 'none',
                    }}>%</span>
                  </div>
                  <button
                    onClick={() => removeRow(r.ticker)}
                    title="Quitar activo"
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-3)',
                      fontSize: '14px', cursor: 'pointer', padding: '2px 4px',
                      borderRadius: '4px', flexShrink: 0, lineHeight: 1,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--red)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-3)')}
                  >✕</button>
                </div>
              ))}
            </div>

            {/* Normalizar */}
            {!totalOk && rows.length > 0 && (
              <button
                onClick={normalize}
                style={{
                  marginTop: '8px', padding: '5px 12px',
                  backgroundColor: 'var(--accent-dim)',
                  color: 'var(--accent)', border: '1px solid rgba(79,134,247,0.3)',
                  borderRadius: 'var(--radius-sm)', fontSize: '12px',
                  fontWeight: 500, cursor: 'pointer',
                }}
              >
                Normalizar a 100 %
              </button>
            )}
          </div>

          {/* Añadir tickers */}
          <div>
            <label style={{
              display: 'block', color: 'var(--text-2)', fontSize: '10px',
              fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '6px',
            }}>
              Añadir activos
            </label>
            <TickerSearch
              selected={addTickers}
              onChange={setAddTickers}
            />
            {addTickers.length > 0 && (
              <button
                onClick={addSelected}
                style={{
                  marginTop: '8px', padding: '6px 14px',
                  backgroundColor: 'var(--accent-dim)',
                  color: 'var(--accent)', border: '1px solid rgba(79,134,247,0.3)',
                  borderRadius: 'var(--radius-sm)', fontSize: '12px',
                  fontWeight: 500, cursor: 'pointer',
                }}
              >
                + Añadir {addTickers.length} activo{addTickers.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px',
              backgroundColor: 'rgba(232,64,64,0.1)',
              border: '1px solid rgba(232,64,64,0.3)',
              color: 'var(--red)',
            }}>
              ⚠ {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 20px',
                backgroundColor: 'transparent', color: 'var(--text-2)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '9px 20px',
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)',
                border: 'none', borderRadius: 'var(--radius-sm)',
                color: '#fff', fontSize: '13px', fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
