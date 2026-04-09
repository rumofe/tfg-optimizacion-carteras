import { CSSProperties } from 'react';

export const COLORS = [
  '#4f86f7', '#0ea875', '#f0a020', '#9b6ef5',
  '#e84040', '#22d3ee', '#f472b6', '#a3e635',
];

export const CARD: CSSProperties = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '24px',
};

export const INPUT: CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  backgroundColor: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

export const LABEL: CSSProperties = {
  display: 'block',
  color: 'var(--text-2)',
  fontSize: '11px',
  marginBottom: '6px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
};
