import { THEMES, Theme } from '../hooks/useTheme';

interface Props {
  current: Theme;
  onChange: (t: Theme) => void;
}

export default function ThemeSelector({ current, onChange }: Props) {
  return (
    <div style={{ padding: '10px 12px 12px' }}>
      <div style={{
        color: 'var(--text-3)', fontSize: '10px', fontWeight: 700,
        letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '10px',
      }}>
        Tema
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {THEMES.map((t) => {
          const active = t.id === current;
          return (
            <button
              key={t.id}
              title={t.label}
              onClick={() => onChange(t.id)}
              style={{
                width: '22px', height: '22px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)`,
                border: active ? `2px solid var(--text)` : `2px solid var(--border)`,
                outline: active ? `2px solid ${t.accent}` : 'none',
                outlineOffset: '2px',
                cursor: 'pointer', padding: 0, flexShrink: 0,
                transition: 'transform 0.12s',
                transform: active ? 'scale(1.25)' : 'scale(1)',
              }}
              aria-label={`Tema ${t.label}`}
            />
          );
        })}
      </div>
    </div>
  );
}
