// Avvisi del browser per i messaggi nuovi (modulo M2.7). Funzionano mentre RoomDate è aperto in
// una scheda o finestra: con il sito chiuso servirebbero le notifiche push, che non ci sono. La
// scelta vale per il dispositivo, perché il permesso lo dà il browser.

const PREFERENCE_KEY = 'roomdate-avvisi-messaggi';

/** Stato degli avvisi su questo browser. */
export type AlertsState =
  /** Il browser non li supporta (o li permette solo alle app installate, come Chrome su Android). */
  | 'unsupported'
  /** L'utente li ha bloccati per il sito: si riattivano solo dalle impostazioni del browser. */
  | 'blocked'
  | 'off'
  | 'on';

function preference(): boolean {
  try {
    return localStorage.getItem(PREFERENCE_KEY) === 'on';
  } catch {
    return false;
  }
}

function savePreference(on: boolean): void {
  try {
    if (on) localStorage.setItem(PREFERENCE_KEY, 'on');
    else localStorage.removeItem(PREFERENCE_KEY);
  } catch {
    // storage non disponibile: gli avvisi restano spenti
  }
}

/** Alcuni browser (Chrome su Android) hanno l'API ma rifiutano gli avvisi fuori da un service worker. */
let constructorRejected = false;

export function alertsState(): AlertsState {
  if (typeof window === 'undefined' || !('Notification' in window) || constructorRejected) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' && preference() ? 'on' : 'off';
}

/** Mostra un avviso; false se il browser lo rifiuta. */
function show(title: string, options: NotificationOptions, onClick?: () => void): boolean {
  try {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      onClick?.();
      notification.close();
    };
    return true;
  } catch {
    constructorRejected = true;
    return false;
  }
}

/** Accende gli avvisi: chiede il permesso (dal clic dell'utente) e ne mostra uno di prova. */
export async function enableAlerts(): Promise<AlertsState> {
  if (alertsState() === 'unsupported') return 'unsupported';
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  if (!show('Avvisi attivi', { body: 'Ti avviseremo qui quando arriva un messaggio.', icon: '/favicon.png', tag: 'roomdate-prova' })) {
    return 'unsupported';
  }
  savePreference(true);
  return 'on';
}

export function disableAlerts(): void {
  savePreference(false);
}

/** Un messaggio nuovo va segnalato: avvisi accesi e pagina non davanti agli occhi dell'utente. */
export function wantsMessageAlert(): boolean {
  return alertsState() === 'on' && !(document.visibilityState === 'visible' && document.hasFocus());
}

/**
 * Avviso di un messaggio nuovo. Non contiene il testo: resta cifrato finché non si apre la chat,
 * e l'avviso potrebbe comparire anche sullo schermo bloccato.
 */
export function alertNewMessage({ conversationId, from, onOpen }: { conversationId: number; from: string; onOpen: () => void }): void {
  // Lo stesso tag per conversazione: più messaggi di fila, un avviso solo (anche con più schede aperte)
  show(`Nuovo messaggio da ${from}`, { body: 'Apri RoomDate per leggerlo.', icon: '/favicon.png', tag: `roomdate-conversazione-${conversationId}` }, onOpen);
}
