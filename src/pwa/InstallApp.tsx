import { Download } from 'lucide-react';
import { buttonClasses } from '../components/ui/buttonClasses';
import { cn } from '../components/ui/cn';
import { useInstallPrompt } from './installPrompt';

/**
 * Installa RoomDate come app (modulo M2.8): il pulsante quando il browser lo permette, le istruzioni
 * su iPhone e iPad; niente se è già installata o il browser non lo prevede.
 */
export default function InstallApp({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  const { canInstall, iosHint, install } = useInstallPrompt();
  if (canInstall) {
    return (
      <button type="button" onClick={install} className={buttonClasses({ variant: 'secondary', size: 'sm', className: cn(onDark && 'border-stone-500 bg-transparent text-white hover:bg-white/10', className) })}>
        <Download aria-hidden="true" /> Installa l&apos;app
      </button>
    );
  }
  if (iosHint) {
    return (
      <p className={cn('text-sm', onDark ? 'text-stone-300' : 'text-foreground-muted', className)}>
        Per averla come app: tocca Condividi e poi «Aggiungi alla schermata Home».
      </p>
    );
  }
  return null;
}
