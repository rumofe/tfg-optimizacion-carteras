import { useState } from 'react';

export type Theme = 'navy' | 'dark' | 'light' | 'rose' | 'emerald' | 'amber';

export const THEMES: { id: Theme; label: string; bg: string; accent: string }[] = [
  { id: 'navy',    label: 'Navy',       bg: '#0c1929', accent: '#4f86f7' },
  { id: 'dark',    label: 'Dark',       bg: '#161b22', accent: '#848d97' },
  { id: 'light',   label: 'Light',      bg: '#ffffff', accent: '#2563eb' },
  { id: 'rose',    label: 'Rose',       bg: '#1c0d17', accent: '#f43f5e' },
  { id: 'emerald', label: 'Esmeralda',  bg: '#0b1a12', accent: '#10b981' },
  { id: 'amber',   label: 'Ámbar',      bg: '#1a1509', accent: '#f59e0b' },
];

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = (localStorage.getItem('theme') as Theme) ?? 'navy';
    applyTheme(saved);
    return saved;
  });

  function setTheme(t: Theme) {
    applyTheme(t);
    localStorage.setItem('theme', t);
    setThemeState(t);
  }

  return { theme, setTheme };
}
