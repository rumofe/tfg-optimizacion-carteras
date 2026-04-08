import { useState, useId } from 'react';

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;   // e.g. "€"
  suffix?: string;   // e.g. "%"
  formatDisplay?: (v: number) => string;
  formatMin?: string;
  formatMax?: string;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function snap(v: number, step: number) {
  return Math.round(v / step) * step;
}

export default function SliderInput({
  label, value, onChange, min, max, step,
  prefix = '', suffix = '',
  formatDisplay,
  formatMin, formatMax,
}: Props) {
  const id = useId();
  const [inputVal, setInputVal] = useState<string | null>(null); // null = use controlled value

  const fill = `${((value - min) / (max - min)) * 100}%`;
  const display = formatDisplay ? formatDisplay(value) : value.toString();

  function commitInput(raw: string) {
    const parsed = parseFloat(raw.replace(/[^\d.-]/g, ''));
    if (!isNaN(parsed)) onChange(snap(clamp(parsed, min, max), step));
    setInputVal(null);
  }

  return (
    <div>
      {/* Header: label + value input */}
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

        {/* Inline editable value */}
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
              if (e.key === 'Enter')  commitInput((e.target as HTMLInputElement).value);
              if (e.key === 'Escape') setInputVal(null);
              if (e.key === 'ArrowUp')   { e.preventDefault(); onChange(snap(clamp(value + step, min, max), step)); }
              if (e.key === 'ArrowDown') { e.preventDefault(); onChange(snap(clamp(value - step, min, max), step)); }
            }}
            style={{
              width: `${Math.max(display.length, 4) + 1}ch`,
              background: 'none', border: 'none',
              borderBottom: '1px dashed var(--border)',
              color: 'var(--accent)', fontSize: '18px', fontWeight: 700,
              letterSpacing: '-0.3px', textAlign: 'right',
              outline: 'none', padding: '0 1px',
              cursor: 'text',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderBottomColor = 'var(--accent)';
              e.currentTarget.select();
            }}
            onBlurCapture={(e) => { e.currentTarget.style.borderBottomColor = 'var(--border)'; }}
          />
          {suffix && (
            <span style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: 600 }}>{suffix}</span>
          )}
        </div>
      </div>

      {/* Slider */}
      <input
        id={id}
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--fill': fill } as React.CSSProperties}
      />

      {/* Min / max hints */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: '6px',
      }}>
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
