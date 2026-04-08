import { useState, useEffect, useRef, useId } from 'react';

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  scale?: 'linear' | 'log';
  prefix?: string;
  suffix?: string;
  formatDisplay?: (v: number) => string;
  formatMin?: string;
  formatMax?: string;
}

const IMAX = 1000; // resolución interna del slider

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }
function snapTo(v: number, step: number)           { return Math.round(v / step) * step; }

/** Valor externo → posición interna 0..IMAX */
function toPos(v: number, min: number, max: number, scale: 'linear' | 'log'): number {
  const ratio = scale === 'log'
    ? (Math.log(clamp(v, min, max)) - Math.log(min)) / (Math.log(max) - Math.log(min))
    : (clamp(v, min, max) - min) / (max - min);
  return clamp(Math.round(ratio * IMAX), 0, IMAX);
}

/** Posición interna 0..IMAX → valor externo (sin snap, suave durante drag) */
function fromPos(p: number, min: number, max: number, scale: 'linear' | 'log'): number {
  const ratio = p / IMAX;
  return scale === 'log'
    ? Math.exp(Math.log(min) + ratio * (Math.log(max) - Math.log(min)))
    : min + ratio * (max - min);
}

export default function SliderInput({
  label, value, onChange, min, max, step,
  scale = 'linear',
  prefix = '', suffix = '',
  formatDisplay,
  formatMin, formatMax,
}: Props) {
  const id = useId();

  // Posición interna del slider: estado local para evitar el snap-back
  const [pos, setPos] = useState(() => toPos(value, min, max, scale));

  // Sincronizar pos cuando el valor cambia desde fuera (ej. carga de perfil)
  // Usamos ref para distinguir cambios externos de los que nosotros causamos
  const lastCommitted = useRef(value);
  useEffect(() => {
    if (value !== lastCommitted.current) {
      lastCommitted.current = value;
      setPos(toPos(value, min, max, scale));
    }
  }, [value, min, max, scale]);

  const [inputVal, setInputVal] = useState<string | null>(null);

  const fill    = `${(pos / IMAX) * 100}%`;
  const display = formatDisplay ? formatDisplay(value) : String(value);

  // ── Drag del slider: suave, sin snap ──────────────────────────────────────
  function handleSlider(rawPos: number) {
    setPos(rawPos);
    const ext = clamp(fromPos(rawPos, min, max, scale), min, max);
    lastCommitted.current = ext;
    onChange(ext);
  }

  // ── Flechas del teclado sobre el range: step real ─────────────────────────
  function handleRangeKey(e: React.KeyboardEvent) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const dir = (e.key === 'ArrowUp' || e.key === 'ArrowRight') ? 1 : -1;
    const next = snapTo(clamp(value + dir * step, min, max), step);
    lastCommitted.current = next;
    onChange(next);
    setPos(toPos(next, min, max, scale));
  }

  // ── Input de texto: snap al confirmar ─────────────────────────────────────
  function commitInput(raw: string) {
    const parsed = parseFloat(raw.replace(/[^\d.,-]/g, '').replace(',', '.'));
    if (!isNaN(parsed)) {
      const next = snapTo(clamp(parsed, min, max), step);
      lastCommitted.current = next;
      onChange(next);
      setPos(toPos(next, min, max, scale));
    }
    setInputVal(null);
  }

  return (
    <div>
      {/* Cabecera: etiqueta + valor editable */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', marginBottom: '12px',
      }}>
        <label htmlFor={id} style={{
          color: 'var(--text-2)', fontSize: '11px',
          fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase',
        }}>
          {label}
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {prefix && <span style={{ color: 'var(--text-3)', fontSize: '13px', fontWeight: 500 }}>{prefix}</span>}
          <input
            type="text"
            inputMode="decimal"
            value={inputVal ?? display}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={(e)  => commitInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter')     { commitInput((e.target as HTMLInputElement).value); }
              if (e.key === 'Escape')    { setInputVal(null); }
              if (e.key === 'ArrowUp')   { e.preventDefault(); const n = snapTo(clamp(value + step, min, max), step); lastCommitted.current = n; onChange(n); setPos(toPos(n, min, max, scale)); }
              if (e.key === 'ArrowDown') { e.preventDefault(); const n = snapTo(clamp(value - step, min, max), step); lastCommitted.current = n; onChange(n); setPos(toPos(n, min, max, scale)); }
            }}
            style={{
              width: `${Math.max(display.length, 4) + 1}ch`,
              background: 'none', border: 'none',
              borderBottom: '1px dashed var(--border)',
              color: 'var(--accent)', fontSize: '18px', fontWeight: 700,
              letterSpacing: '-0.3px', textAlign: 'right',
              outline: 'none', padding: '0 1px', cursor: 'text',
            }}
            onFocus={(e)       => { e.currentTarget.style.borderBottomColor = 'var(--accent)'; e.currentTarget.select(); }}
            onBlurCapture={(e) => { e.currentTarget.style.borderBottomColor = 'var(--border)'; }}
          />
          {suffix && <span style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: 600 }}>{suffix}</span>}
        </div>
      </div>

      {/* Slider */}
      <input
        id={id}
        type="range"
        min={0} max={IMAX} step={1}
        value={pos}
        onChange={(e) => handleSlider(Number(e.target.value))}
        onKeyDown={handleRangeKey}
        style={{ '--fill': fill } as React.CSSProperties}
      />

      {/* Etiquetas min / max */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
        <span style={{ color: 'var(--text-3)', fontSize: '10px' }}>{prefix}{formatMin ?? min}{suffix}</span>
        <span style={{ color: 'var(--text-3)', fontSize: '10px' }}>{prefix}{formatMax ?? max}{suffix}</span>
      </div>
    </div>
  );
}
