import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../theme/theme';
import { cn, focusRing } from '../ui/cn';

/**
 * Passa dal tema chiaro allo scuro e viceversa. È un interruttore: il nome resta "Tema scuro" e
 * aria-pressed dice se è attivo. Per tornare al tema del dispositivo c'è ThemeSelect nei menu.
 */
export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, setPreference } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      aria-pressed={dark}
      aria-label="Tema scuro"
      title={dark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
      onClick={() => setPreference(dark ? 'light' : 'dark')}
      className={cn('inline-flex size-11 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-muted hover:text-foreground [&_svg]:size-5', focusRing, className)}
    >
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}
