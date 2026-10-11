// Avvisi dei messaggi nuovi su questo dispositivo (moduli M2.7 e M2.8), su due livelli scelti
// dall'utente:
// - con RoomDate aperto, anche in una scheda nascosta: li mostra la pagina quando arriva l'evento
//   in tempo reale;
// - anche a sito chiuso: notifiche push, mostrate dal service worker (public/sw.js). Passano dal
//   servizio push del browser cifrate (RFC 8291): lì si vede solo che arriva un avviso.
// L'avviso dice solo chi ha scritto: il testo resta cifrato finché non si apre la chat. La scelta
// vale per il dispositivo, perché il permesso lo dà il browser.
import { deletePushSubscription, getPushKey, savePushSubscription } from '../api/push';
import { isIosBrowser } from '../pwa/installPrompt';

const PREFERENCE_KEY = 'roomdate-avvisi-messaggi';
const ICON = '/icons/icon-192.png';

// "on" è il valore salvato dal modulo M2.7: avvisi con il sito aperto
type Preference = 'off' | 'open' | 'push';

function preference(): Preference {
  try {
    const value = localStorage.getItem(PREFERENCE_KEY);
    if (value === 'push') return 'push';
    return value === 'open' || value === 'on' ? 'open' : 'off';
  } catch {
    return 'off';
  }
}

function savePreference(value: Preference): void {
  try {
    if (value === 'off') localStorage.removeItem(PREFERENCE_KEY);
    else localStorage.setItem(PREFERENCE_KEY, value);
  } catch {
    // storage non disponibile: gli avvisi restano spenti
  }
}

/** Stato degli avvisi su questo browser. */
export type AlertsState =
  /** Il browser non li supporta. */
  | 'unsupported'
  /** L'utente li ha bloccati per il sito: si riattivano solo dalle impostazioni del browser. */
  | 'blocked'
  | 'off'
  | 'on';

/** Senza service worker alcuni browser (Chrome su Android) rifiutano gli avvisi della pagina. */
let constructorRejected = false;

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;
  return navigator.serviceWorker.getRegistration().catch(() => undefined);
}

export function alertsState(): AlertsState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (constructorRejected && !navigator.serviceWorker?.controller) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' && preference() !== 'off' ? 'on' : 'off';
}

/**
 * Mostra un avviso: dal service worker se c'è (il clic lo gestisce public/sw.js), altrimenti dalla
 * pagina. false se il browser lo rifiuta.
 */
async function show(title: string, options: NotificationOptions, onClick?: () => void): Promise<boolean> {
  const worker = await registration();
  if (worker) {
    try {
      await worker.showNotification(title, options);
      return true;
    } catch {
      // si prova dalla pagina
    }
  }
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

/** Accende gli avvisi con il sito aperto: chiede il permesso (dal clic dell'utente) e ne mostra uno di prova. */
export async function enableAlerts(): Promise<AlertsState> {
  if (!('Notification' in window)) return 'unsupported';
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  if (!(await show('Avvisi attivi', { body: 'Ti avviseremo qui quando arriva un messaggio.', icon: ICON, tag: 'roomdate-prova' }))) {
    return 'unsupported';
  }
  if (preference() === 'off') savePreference('open');
  return 'on';
}

/** Spegne tutti gli avvisi, anche quelli a sito chiuso. */
export async function disableAlerts(): Promise<void> {
  await disableClosedSiteAlerts();
  savePreference('off');
}

/** Gli avvisi a sito chiuso su questo browser. */
export type ClosedSiteState =
  | 'on'
  | 'off'
  /** Il browser non ha le notifiche push (o il service worker, come in sviluppo). */
  | 'unsupported'
  /** iPhone e iPad: solo con l'app installata sulla schermata Home. */
  | 'install'
  /** Il server non ha le notifiche push (chiave VAPID mancante). */
  | 'unavailable';

export async function closedSiteState(): Promise<ClosedSiteState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return isIosBrowser() ? 'install' : 'unsupported';
  const worker = await registration();
  if (!worker) return 'unsupported';
  const subscription = await worker.pushManager.getSubscription().catch(() => null);
  if (preference() === 'push' && subscription) return 'on';
  try {
    await getPushKey();
  } catch {
    return 'unavailable';
  }
  return 'off';
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sameKey(current: ArrayBuffer | null, key: Uint8Array): boolean {
  if (!current || current.byteLength !== key.length) return false;
  const bytes = new Uint8Array(current);
  return bytes.every((byte, i) => byte === key[i]);
}

/** Accende gli avvisi a sito chiuso: iscrive il browser al servizio push e lo dice al server. */
export async function enableClosedSiteAlerts(): Promise<void> {
  const worker = await navigator.serviceWorker.ready;
  const key = base64UrlToBytes((await getPushKey()).publicKey);
  let subscription = await worker.pushManager.getSubscription();
  // Un'iscrizione fatta con un'altra chiave del server (chiave cambiata) non vale più
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await savePushSubscription(subscription.toJSON());
  savePreference('push');
}

/** Spegne gli avvisi a sito chiuso; restano quelli con il sito aperto. */
export async function disableClosedSiteAlerts(): Promise<void> {
  const worker = await registration();
  const subscription = await worker?.pushManager.getSubscription().catch(() => null);
  if (subscription) {
    await deletePushSubscription(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe().catch(() => false);
  }
  if (preference() === 'push') savePreference('open');
}

/**
 * Uscendo dall'account (o eliminandolo) il browser smette di ricevere gli avvisi di quell'utente:
 * sul server l'iscrizione sparisce con la sessione. Chi entra dopo sceglie da sé.
 */
export async function forgetAlerts(): Promise<void> {
  const worker = await registration();
  const subscription = await worker?.pushManager.getSubscription().catch(() => null);
  await subscription?.unsubscribe().catch(() => false);
  savePreference('off');
}

/**
 * All'avvio, con gli avvisi a sito chiuso attivi: il server deve avere l'iscrizione di questo
 * browser per la sessione di adesso (dopo un nuovo accesso la sessione è un'altra).
 */
export async function syncClosedSiteAlerts(): Promise<void> {
  if (preference() !== 'push') return;
  const worker = await registration();
  const subscription = await worker?.pushManager.getSubscription().catch(() => null);
  if (!subscription) {
    // Il browser ha perso l'iscrizione (dati del sito cancellati): restano gli avvisi a sito aperto
    savePreference('open');
    return;
  }
  await savePushSubscription(subscription.toJSON());
}

/**
 * Un messaggio nuovo va segnalato dalla pagina: avvisi con il sito aperto e pagina non davanti agli
 * occhi dell'utente. Con le notifiche push li mostra il service worker, una volta sola.
 */
export function wantsMessageAlert(): boolean {
  return preference() === 'open' && alertsState() === 'on' && !(document.visibilityState === 'visible' && document.hasFocus());
}

/**
 * Avviso di un messaggio nuovo. Non contiene il testo: resta cifrato finché non si apre la chat,
 * e l'avviso potrebbe comparire anche sullo schermo bloccato.
 */
export function alertNewMessage({ conversationId, from, onOpen }: { conversationId: number; from: string; onOpen: () => void }): void {
  // Lo stesso tag per conversazione (anche nel service worker): più messaggi di fila, un avviso solo
  void show(`Nuovo messaggio da ${from}`, {
    body: 'Apri RoomDate per leggerlo.',
    icon: ICON,
    tag: `roomdate-conversazione-${conversationId}`,
    data: { url: `/chat/${conversationId}` },
  }, onOpen);
}
