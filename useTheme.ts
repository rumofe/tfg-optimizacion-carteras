import { useState } from 'react';

export type Theme = 'slate' | 'electric' | 'violet' | 'dark' | 'light' | 'rose' | 'emerald' | 'amber';

export const THEMES: { id: Theme; label: string; bg: string; accent: string }[] = [
  { id: 'slate',   label: 'Slate',     bg: '#111115', accent: '#4f8ef7' },
  { id: 'electric',label: 'Electric',  bg: '#0c1219', accent: '#00c8ff' },
  { id: 'violet',  label: 'Violet',    bg: '#0d0820', accent: '#7c6ef5' },
  { id: 'dark',    label: 'Dark',      bg: '#161b22', accent: '#4f8ef7' },
  { id: 'light',   label: 'Light',     bg: '#ffffff', accent: '#2563eb' },
  { id: 'rose',    label: 'Rose',      bg: '#1c0d17', accent: '#f43f5e' },
  { id: 'emerald', label: 'Esmeralda', bg: '#0b1a12', accent: '#10b981' },
  { id: 'amber',   label: 'Ámbar',     bg: '#1a1509', accent: '#f59e0b' },
];

function applyTheme(theme: Theme) {
  // Slate es el default (:root), los demás usan data-theme
  if (theme === 'slate') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = (localStorage.getItem('theme') as Theme) ?? 'slate';
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
