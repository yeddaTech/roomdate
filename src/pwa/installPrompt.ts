import { useCallback, useSyncExternalStore } from 'react';

// L'evento con cui Chrome, Edge e Samsung Internet propongono di installare il sito come app.
// Arriva presto, anche prima che esistano i componenti: lo si raccoglie all'avvio.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Da chiamare all'avvio (main.jsx): tiene da parte la proposta di installazione per il pulsante. */
export function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Niente barra automatica del browser: si installa dal pulsante "Installa l'app"
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * iPhone e iPad fuori dall'app installata: non hanno l'evento di installazione (si installa da
 * Condividi → Aggiungi alla schermata Home) e ricevono le notifiche push solo dall'app installata.
 */
export function isIosBrowser(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

/** Se il sito si può installare e come: con il pulsante (install) o con le istruzioni per iPhone. */
export function useInstallPrompt() {
  const canInstall = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  const install = useCallback(async () => {
    const event = deferred;
    if (!event) return false;
    // La proposta vale una volta sola
    deferred = null;
    notify();
    await event.prompt();
    return (await event.userChoice).outcome === 'accepted';
  }, []);
  return { canInstall, iosHint: !canInstall && isIosBrowser(), install };
}
