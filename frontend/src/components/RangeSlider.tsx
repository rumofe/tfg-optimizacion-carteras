import { useRef } from 'react';

interface Props {
  min?: number;
  max?: number;
  step?: number;
  valueMin: number;
  valueMax: number;
  onChange: (lo: number, hi: number) => void;
  suffix?: string;
  color?: string;
}

const TRACK_H = 5;   // alto de la pista (px)
const THUMB = 18;    // diámetro del thumb (px)
const ROW_H = 24;    // alto de la fila interactiva (px)

/**
 * Slider de rango con dos manijas, implementado ÍNTEGRAMENTE con <div> y
 * eventos de puntero (sin <input type="range">). De este modo no existe
 * ninguna pista ni "thumb" nativo del navegador que pueda renderizarse por
 * duplicado (problema típico de los range nativos en Chrome/Opera GX/Firefox).
 */
export default function RangeSlider({
  min = 0, max = 100, step = 1,
  valueMin, valueMax, onChange,
  suffix = '%', color = 'var(--accent)',
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  /** Convierte la posición X del puntero en un valor dentro de [min, max]. */
  function valueFromX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return min;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + ratio * (max - min);
    const snapped = Math.round(raw / step) * step;
    return Math.max(min, Math.min(max, snapped));
  }

  /** Crea los handlers de arrastre para una de las manijas. */
  function dragHandlers(which: 'lo' | 'hi') {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      },
      onPointerMove: (e: React.PointerEvent) => {
        // Solo arrastramos si el puntero está capturado (botón pulsado).
        if (!(e.buttons & 1)) return;
        const v = valueFromX(e.clientX);
        if (which === 'lo') onChange(Math.min(v, valueMax), valueMax);
        else                onChange(valueMin, Math.max(v, valueMin));
      },
    };
  }

  /** Click en la pista: mueve la manija más cercana. */
  function onTrackPointerDown(e: React.PointerEvent) {
    const v = valueFromX(e.clientX);
    const distLo = Math.abs(v - valueMin);
    const distHi = Math.abs(v - valueMax);
    if (distLo <= distHi) onChange(Math.min(v, valueMax), valueMax);
    else                  onChange(valueMin, Math.max(v, valueMin));
  }

  const thumbStyle = (leftPct: number): React.CSSProperties => ({
    position: 'absolute',
    top: '50%',
    left: `${leftPct}%`,
    width: `${THUMB}px`,
    height: `${THUMB}px`,
    transform: 'translate(-50%, -50%)',
    borderRadius: '50%',
    background: color,
    border: '2px solid var(--surface)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
    cursor: 'grab',
    touchAction: 'none',
    zIndex: 2,
  });

  return (
    <div>
      {/* Etiquetas de valores */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ color: 'var(--text-2)', fontSize: '12px' }}>
          Mín <strong style={{ color }}>{valueMin}{suffix}</strong>
        </span>
        <span style={{ color: 'var(--text-2)', fontSize: '12px' }}>
          Máx <strong style={{ color }}>{valueMax}{suffix}</strong>
        </span>
      </div>

      {/* Fila interactiva */}
      <div style={{ position: 'relative', height: `${ROW_H}px` }}>
        {/* Pista de fondo (clicable) */}
        <div
          ref={trackRef}
          onPointerDown={onTrackPointerDown}
          style={{
            position: 'absolute', top: '50%', left: 0, right: 0,
            height: `${TRACK_H}px`, transform: 'translateY(-50%)',
            background: 'var(--raised)', borderRadius: `${TRACK_H / 2}px`,
            cursor: 'pointer',
          }}
        />
        {/* Segmento seleccionado */}
        <div style={{
          position: 'absolute', top: '50%',
          height: `${TRACK_H}px`, transform: 'translateY(-50%)',
          background: color, borderRadius: `${TRACK_H / 2}px`,
          left: `${pct(valueMin)}%`, right: `${100 - pct(valueMax)}%`,
          pointerEvents: 'none',
        }} />
        {/* Manija mínima */}
        <div {...dragHandlers('lo')} style={thumbStyle(pct(valueMin))} aria-label="Peso mínimo" />
        {/* Manija máxima */}
        <div {...dragHandlers('hi')} style={thumbStyle(pct(valueMax))} aria-label="Peso máximo" />
      </div>

      {/* Marcas de extremos */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ color: 'var(--text-3)', fontSize: '10px' }}>{min}{suffix}</span>
        <span style={{ color: 'var(--text-3)', fontSize: '10px' }}>{max}{suffix}</span>
      </div>
    </div>
  );
}
