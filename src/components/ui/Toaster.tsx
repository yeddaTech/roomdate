import { Toaster as Sonner } from 'sonner';
// Lo stile di sonner come file (modulo M3.7): sonner lo scriverebbe in un <style> all'avvio, che la
// CSP non ammette; il plugin "sonner-css" di vite.config.js toglie quella scrittura dalla build
import 'sonner/dist/styles.css';
import { useTheme } from '../../theme/theme';

/**
 * Notifiche brevi in basso (sonner), al posto di alert(): non bloccano la pagina e i lettori di
 * schermo le annunciano. Si mostrano con toast.success(...) / toast.error(...) da "sonner".
 */
export default function Toaster() {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme}
      position="bottom-center"
      closeButton
      toastOptions={{
        classNames: {
          toast: 'rounded-control! border! border-line! bg-surface! text-foreground! shadow-overlay! font-sans!',
          description: 'text-foreground-muted!',
          error: 'border-danger/40! [&_[data-icon]]:text-danger!',
          success: '[&_[data-icon]]:text-success-soft-foreground!',
          closeButton: 'border-line! bg-surface! text-foreground-muted!',
        },
      }}
    />
  );
}
