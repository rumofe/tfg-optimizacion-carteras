import { useEffect, useRef, useState } from 'react';

interface Stage {
  /** Umbral de progreso (0-100) a partir del cual se muestra esta etiqueta. */
  at: number;
  label: string;
}

interface Props {
  /** Si está corriendo la operación. Al pasar a false, la barra completa al 100 %. */
  running: boolean;
  /** Duración estimada en segundos (controla la velocidad de avance). */
  estimatedSeconds?: number;
  /** Etiquetas por fase, ordenadas por umbral ascendente. */
  stages?: Stage[];
  /** Texto del título sobre la barra. */
  title?: string;
  /** Color del relleno (variable CSS o color). */
  color?: string;
}

const DEFAULT_STAGES: Stage[] = [
  { at: 0,  label: 'Descargando datos de mercado…' },
  { at: 28, label: 'Calculando matriz de covarianzas…' },
  { at: 52, label: 'Optimizando pesos (multi-start SLSQP)…' },
  { at: 80, label: 'Construyendo fronteras eficiente y de Pareto…' },
  { at: 97, label: 'Casi listo…' },
];

/**
 * Barra de progreso *estimada*. No refleja el progreso real del backend
 * (la operación es una única petición HTTP síncrona) sino una aproximación
 * asintótica: avanza rápido al principio y se ralentiza acercándose al 90 %,
 * de modo que si la operación tarda más de lo estimado la barra no se queda
 * "pegada" al 100 % dando sensación de cuelgue. Cuando llega la respuesta
 * (`running` pasa a false) salta al 100 % y se desvanece.
 */
export default function ProgressBar({
  running,
  estimatedSeconds = 3,
  stages = DEFAULT_STAGES,
  title = 'Procesando',
  color = 'var(--accent)',
}: Props) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (running) {
      setVisible(true);
      setProgress(0);
      setElapsed(0);
      startRef.current = performance.now();

      // Constante de tiempo: con ~estimatedSeconds llegamos cerca del 90 %.
      // progreso(t) = 90 * (1 - e^(-t/tau)), con tau = estimatedSeconds / 2.3
      // (2.3 ≈ ln(10), así a t=estimatedSeconds estamos al ~90 %).
      const tau = Math.max(estimatedSeconds, 0.5) / 2.3;

      const tick = () => {
        const t = (performance.now() - startRef.current) / 1000;
        setElapsed(t);
        const p = 90 * (1 - Math.exp(-t / tau));
        setProgress(p);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    } else {
      // Operación terminada: completar al 100 % y ocultar tras un instante.
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (visible) {
        setProgress(100);
        const id = setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 450);
        return () => clearTimeout(id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, estimatedSeconds]);

  if (!visible) return null;

  const stageLabel = [...stages].reverse().find((s) => progress >= s.at)?.label ?? stages[0]?.label ?? '';
  const restante = Math.max(0, estimatedSeconds - elapsed);

  return (
    <div style={{
      marginTop: '16px',
      padding: '16px 18px',
      backgroundColor: 'var(--raised)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
        <span style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600 }}>
          {title}
        </span>
        <span style={{ color: 'var(--text-3)', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
          {progress >= 100
            ? '¡Listo!'
            : restante > 0.4
              ? `~${restante.toFixed(0)} s restantes (estimado)`
              : 'finalizando…'}
        </span>
      </div>

      {/* Barra */}
      <div style={{
        height: '8px',
        backgroundColor: 'var(--bg)',
        borderRadius: '4px',
        overflow: 'hidden',
        border: '1px solid var(--border)',
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: '4px',
          transition: 'width 0.15s linear',
          // brillo sutil en movimiento
          backgroundImage: progress < 100
            ? 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)'
            : 'none',
          backgroundSize: '200% 100%',
          animation: progress < 100 ? 'progressShimmer 1.2s linear infinite' : 'none',
        }} />
      </div>

      {/* Fase + porcentaje */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
        <span style={{ color: 'var(--text-2)', fontSize: '11px' }}>{stageLabel}</span>
        <span style={{ color, fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(progress)}%
        </span>
      </div>

      {/* keyframes inline (una sola vez basta, pero es idempotente) */}
      <style>{`
        @keyframes progressShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
