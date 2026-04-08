import { useState, useEffect, useRef } from 'react';
import { searchAssets, SearchResult } from '../services/api';

const LOGO_BASE = 'https://assets.parqet.com/logos/symbol/';
const COLORS = ['#4f86f7', '#0ea875', '#f0a020', '#9b6ef5', '#e84040', '#22d3ee', '#f472b6', '#a3e635'];

const TIPO_BADGE: Record<string, string> = {
  EQUITY:     'Acción',
  ETF:        'ETF',
  MUTUALFUND: 'Fondo',
  INDEX:      'Índice',
};

function TickerLogo({ ticker, size = 32 }: { ticker: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const color = COLORS[ticker.charCodeAt(0) % COLORS.length];

  if (failed) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        backgroundColor: 'var(--bg)',
        border: `1px solid var(--border)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 700, color, flexShrink: 0,
      }}>
        {ticker.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={`${LOGO_BASE}${ticker}?format=jpg`}
      alt={ticker}
      width={size}
      height={size}
      style={{
        borderRadius: '50%', objectFit: 'contain',
        backgroundColor: '#fff', flexShrink: 0,
        border: '1px solid var(--border)',
      }}
      onError={() => setFailed(true)}
    />
  );
}

interface Props {
  selected: string[];
  onChange: (tickers: string[]) => void;
  maxItems?: number;
}

export default function TickerSearch({ selected, onChange, maxItems = 10 }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const { data } = await searchAssets(query.trim());
        setResults(data.filter((r) => !selected.includes(r.ticker)));
        setOpen(true);
        setHighlightIdx(-1);
      } catch {
        setResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 280);
  }, [query, selected]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  function addTicker(ticker: string) {
    if (!selected.includes(ticker) && selected.length < maxItems) {
      onChange([...selected, ticker]);
    }
    setQuery('');
    setOpen(false);
    setResults([]);
    inputRef.current?.focus();
  }

  function removeTicker(ticker: string) {
    onChange(selected.filter((t) => t !== ticker));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && results[highlightIdx]) {
        addTicker(results[highlightIdx].ticker);
      } else if (results[0]) {
        addTicker(results[0].ticker);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const canAdd = selected.length < maxItems;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Chips de tickers seleccionados */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
          {selected.map((ticker, i) => (
            <div
              key={ticker}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                backgroundColor: 'var(--raised)',
                border: `1px solid ${COLORS[i % COLORS.length]}40`,
                borderRadius: '20px',
                padding: '4px 8px 4px 5px',
              }}
            >
              <TickerLogo ticker={ticker} size={22} />
              <span style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 700 }}>
                {ticker}
              </span>
              <button
                type="button"
                onClick={() => removeTicker(ticker)}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--text-2)', cursor: 'pointer',
                  padding: '0 0 0 2px', fontSize: '15px',
                  lineHeight: 1, display: 'flex', alignItems: 'center',
                }}
                aria-label={`Eliminar ${ticker}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input de búsqueda */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={
            !canAdd
              ? `Máximo ${maxItems} activos`
              : selected.length === 0
              ? 'Buscar ticker o empresa (ej: Apple, AAPL, MSFT…)'
              : 'Añadir otro activo…'
          }
          disabled={!canAdd}
          style={{
            width: '100%',
            padding: '10px 36px 10px 14px',
            backgroundColor: canAdd ? 'var(--bg)' : 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text)',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
            cursor: canAdd ? 'text' : 'not-allowed',
            opacity: canAdd ? 1 : 0.5,
          }}
        />
        {/* Icono de búsqueda / spinner */}
        <div style={{
          position: 'absolute', right: '12px', top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-2)', fontSize: '14px', pointerEvents: 'none',
        }}>
          {loadingSearch ? '⟳' : '⌕'}
        </div>
      </div>

      {/* Dropdown de resultados */}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          zIndex: 200,
          backgroundColor: 'var(--raised)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {results.map((r, i) => (
            <div
              key={r.ticker}
              onMouseDown={() => addTicker(r.ticker)}
              onMouseEnter={() => setHighlightIdx(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 14px',
                cursor: 'pointer',
                backgroundColor: i === highlightIdx ? 'var(--border)' : 'transparent',
                borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background-color 0.1s',
              }}
            >
              <TickerLogo ticker={r.ticker} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '14px' }}>
                  {r.ticker}
                </span>
                <span style={{
                  color: 'var(--text-2)', fontSize: '12px',
                  marginLeft: '8px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {r.nombre}
                </span>
              </div>
              {r.tipo && (
                <span style={{
                  color: 'var(--text-2)', fontSize: '10px', fontWeight: 500,
                  backgroundColor: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px', padding: '2px 6px',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {TIPO_BADGE[r.tipo] ?? r.tipo}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Estado vacío en búsqueda */}
      {open && query.trim().length > 0 && !loadingSearch && results.length === 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          zIndex: 200, backgroundColor: 'var(--raised)',
          border: '1px solid var(--border)', borderRadius: '8px',
          padding: '14px 16px',
          color: 'var(--text-2)', fontSize: '13px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          Sin resultados para "{query}"
        </div>
      )}
    </div>
  );
}
