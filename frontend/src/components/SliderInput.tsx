import { useState, useId } from 'react';

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  scale?: 'linear' | 'log';  // log = control uniforme en órdenes de magnitud
  prefix?: string;
  suffix?: string;
  formatDisplay?: (v: number) => string;
  formatMin?: string;
  formatMax?: string;
}

// El slider interno siempre va de 0 a IMAX para tener resolución suficiente
const IMAX = 1000;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
function snap(v: number, step: number) {
  return Math.round(v / step) * step;
}

/** Valor externo → posición interna del slider (0..IMAX) */
function toInternal(v: number, min: number, max: number, scale: 'linear' | 'log'): number {
  if (scale === 'log') {
    return Math.round(
      ((Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min))) * IMAX
    );
  }
  return Math.round(((v - min) / (max - min)) * IMAX);
}

/** Posición interna → valor externo, ajustado al step */
function toExternal(s: number, min: number, max: number, step: number, scale: 'linear' | 'log'): number {
  const ratio = s / IMAX;
  const raw =
    scale === 'log'
      ? Math.exp(Math.log(min) + ratio * (Math.log(max) - Math.log(min)))
      : min + ratio * (max - min);
  return snap(clamp(raw, min, max), step);
}

export default function SliderInput({
  label, value, onChange, min, max, step,
  scale = 'linear',
  prefix = '', suffix = '',
  formatDisplay,
  formatMin, formatMax,
}: Props) {
  const id = useId();
  const [inputVal, setInputVal] = useState<string | null>(null);

  const internal = toInternal(value, min, max, scale);
  const fill      = `${(internal / IMAX) * 100}%`;
  const display   = formatDisplay ? formatDisplay(value) : String(value);

  function commitInput(raw: string) {
    const parsed = parseFloat(raw.replace(/[^\d.-]/g, ''));
    if (!isNaN(parsed)) onChange(snap(clamp(parsed, min, max), step));
    setInputVal(null);
  }

  return (
    <div>
      {/* Cabecera: etiqueta + valor editable */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', marginBottom: '12px',
      }}>
        <label
          htmlFor={id}
          style={{
            color: 'var(--text-2)', fontSize: '11px',
            fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase',
          }}
        >
          {label}
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {prefix && (
            <span style={{ color: 'var(--text-3)', fontSize: '13px', fontWeight: 500 }}>{prefix}</span>
          )}
          <input
            type="text"
            inputMode="decimal"
            value={inputVal ?? display}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={(e) => commitInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  { commitInput((e.target as HTMLInputElement).value); }
              if (e.key === 'Escape') { setInputVal(null); }
              if (e.key === 'ArrowUp')   { e.preventDefault(); onChange(snap(clamp(value + step, min, max), step)); }
              if (e.key === 'ArrowDown') { e.preventDefault(); onChange(snap(clamp(value - step, min, max), step)); }
            }}
            style={{
              width: `${Math.max(display.length, 4) + 1}ch`,
              background: 'none', border: 'none',
              borderBottom: '1px dashed var(--border)',
              color: 'var(--accent)', fontSize: '18px', fontWeight: 700,
              letterSpacing: '-0.3px', textAlign: 'right',
              outline: 'none', padding: '0 1px', cursor: 'text',
            }}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'var(--accent)'; e.currentTarget.select(); }}
            onBlurCapture={(e) => { e.currentTarget.style.borderBottomColor = 'var(--border)'; }}
          />
          {suffix && (
            <span style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: 600 }}>{suffix}</span>
          )}
        </div>
      </div>

      {/* Slider interno 0..IMAX */}
      <input
        id={id}
        type="range"
        min={0} max={IMAX} step={1}
        value={internal}
        onChange={(e) => onChange(toExternal(Number(e.target.value), min, max, step, scale))}
        style={{ '--fill': fill } as React.CSSProperties}
      />

      {/* Etiquetas min / max */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
        <span style={{ color: 'var(--text-3)', fontSize: '10px' }}>
          {prefix}{formatMin ?? min}{suffix}
        </span>
        <span style={{ color: 'var(--text-3)', fontSize: '10px' }}>
          {prefix}{formatMax ?? max}{suffix}
        </span>
      </div>
    </div>
  );
}
