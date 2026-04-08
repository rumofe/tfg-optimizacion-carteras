import { THEMES, Theme } from '../hooks/useTheme';

interface Props {
  current: Theme;
  onChange: (t: Theme) => void;
}

export default function ThemeSelector({ current, onChange }: Props) {
  return (
    <div style={{ padding: '10px 12px 12px' }}>
      <div style={{
        color: 'var(--text-3)', fontSize: '10px', fontWeight: 600,
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
                width: '24px', height: '24px',
                borderRadius: '50%',
                backgroundColor: t.color,
                border: active
                  ? `2px solid var(--text)`
                  : '2px solid transparent',
                outline: active ? `2px solid ${t.color}` : 'none',
                outlineOffset: '1px',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
                transition: 'transform 0.12s, outline 0.12s',
                transform: active ? 'scale(1.15)' : 'scale(1)',
              }}
              aria-label={`Tema ${t.label}`}
            />
          );
        })}
      </div>
    </div>
  );
}
