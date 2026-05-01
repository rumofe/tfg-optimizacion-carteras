import { CSSProperties } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  AlphaScope — styles.ts
//  Drop-in replacement for frontend/src/styles.ts
//  Todos los componentes existentes siguen funcionando sin cambios.
// ─────────────────────────────────────────────────────────────────────────────

/** Paleta de gráficos — misma longitud que antes, colores actualizados */
export const COLORS = [
  '#4f8ef7', // accent blue
  '#34d399', // green
  '#fbbf24', // amber
  '#a78bfa', // purple
  '#f87171', // red
  '#22d3ee', // cyan
  '#fb923c', // orange
  '#a3e635', // lime
];

/** Card estándar */
export const CARD: CSSProperties = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',   // 12px en el nuevo tema
  padding: '24px',
};

/** Input estándar — compatible con todos los usos existentes */
export const INPUT: CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  backgroundColor: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',  // 8px en el nuevo tema
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

/** Label de campo — igual API, tipografía más limpia */
export const LABEL: CSSProperties = {
  display: 'block',
  color: 'var(--text-2)',
  fontSize: '12px',
  marginBottom: '7px',
  fontWeight: 600,
  letterSpacing: '0.3px',
  // Quitamos textTransform uppercase para look más moderno;
  // si prefieres mantenerlo, añade: textTransform: 'uppercase'
};

// ── Tokens extra (nuevos, opcionales) ────────────────────────────────────────

/** Section label — cabecera de sección en caps pequeñas */
export const SECTION_LABEL: CSSProperties = {
  color: 'var(--text-3)',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.8px',
  textTransform: 'uppercase',
  marginBottom: '8px',
};

/** Número destacado con fuente monoespaciada */
export const MONO: CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontWeight: 600,
};

/** Botón primario */
export const BTN_PRIMARY: CSSProperties = {
  padding: '10px 20px',
  backgroundColor: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'filter 0.15s, box-shadow 0.15s',
};

/** Botón ghost */
export const BTN_GHOST: CSSProperties = {
  padding: '10px 20px',
  backgroundColor: 'transparent',
  color: 'var(--text-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s',
};

/** Estilos de tooltip para Recharts */
export const TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: 'var(--raised)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '12px',
};

/** th de tabla */
export const TH: CSSProperties = {
  color: 'var(--text-3)',
  fontSize: '10px',
  fontWeight: 700,
  textAlign: 'left',
  paddingBottom: '10px',
  borderBottom: '1px solid var(--border)',
  letterSpacing: '0.6px',
  textTransform: 'uppercase',
};

/** td de tabla */
export const TD: CSSProperties = {
  padding: '11px 0',
  borderBottom: '1px solid var(--border)',
  fontSize: '13px',
  color: 'var(--text)',
};
