import { useId, type ReactNode } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '../../theme/theme';
import { cn } from '../ui/cn';

const options: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Chiaro', icon: <Sun /> },
  { value: 'dark', label: 'Scuro', icon: <Moon /> },
  { value: 'system', label: 'Automatico', icon: <Monitor /> },
];

/**
 * Scelta del tema in tre opzioni ("Automatico" segue il dispositivo). Pulsanti di opzione nativi:
 * le frecce passano da una scelta all'altra. Sul piè di pagina, scuro in entrambi i temi, si usa onDark.
 */
export default function ThemeSelect({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  const { preference, setPreference } = useTheme();
  const name = useId();
  return (
    <fieldset className={cn('flex flex-col gap-2', className)}>
      <legend className={cn('mb-2 text-sm font-bold', onDark ? 'text-white' : 'text-foreground')}>Tema</legend>
      <div className={cn('grid grid-cols-3 gap-1 rounded-control p-1', onDark ? 'bg-white/10' : 'bg-surface-muted')}>
        {options.map(({ value, label, icon }) => (
          <label
            key={value}
            className={cn(
              // Icona sopra il testo: le tre opzioni stanno anche nel menu dell'account, largo 16rem
              'flex h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-[0.625rem] px-1 text-xs font-bold transition-colors duration-150 [&_svg]:size-4',
              'has-focus-visible:ring-2 has-focus-visible:ring-focus',
              onDark
                ? 'text-stone-300 hover:text-white has-checked:bg-white/15 has-checked:text-white'
                : 'text-foreground-muted hover:text-foreground has-checked:bg-surface has-checked:text-foreground has-checked:shadow-card',
            )}
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={preference === value}
              onChange={() => setPreference(value)}
              className="sr-only"
            />
            <span aria-hidden="true">{icon}</span>
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
