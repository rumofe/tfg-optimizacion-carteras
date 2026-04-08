import { useState } from 'react';

export type Theme = 'navy' | 'dark' | 'light' | 'rose' | 'emerald' | 'amber';

export const THEMES: { id: Theme; label: string; color: string; dark: boolean }[] = [
  { id: 'navy',    label: 'Navy',    color: '#4f86f7', dark: true  },
  { id: 'dark',    label: 'Dark',    color: '#848d97', dark: true  },
  { id: 'light',   label: 'Light',   color: '#2563eb', dark: false },
  { id: 'rose',    label: 'Rose',    color: '#f43f5e', dark: true  },
  { id: 'emerald', label: 'Esmeralda', color: '#10b981', dark: true },
  { id: 'amber',   label: 'Ámbar',   color: '#f59e0b', dark: true  },
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
