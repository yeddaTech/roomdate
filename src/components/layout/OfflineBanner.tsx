import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

/**
 * Avviso quando manca la connessione (modulo M2.8): con l'app installata il sito si apre anche
 * offline, ma cercare, salvare e scrivere richiede la rete.
 */
export default function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  return (
    <div role="status">
      {!online && (
        <p className="flex items-center justify-center gap-2 bg-foreground px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-sm font-bold text-background">
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          Sei offline: per cercare, salvare e scrivere serve la connessione.
        </p>
      )}
    </div>
  );
}
