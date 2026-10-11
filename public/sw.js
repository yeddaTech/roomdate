// Service worker di RoomDate (modulo M2.8): rende il sito installabile come un'app, lo fa aprire
// anche senza rete e mostra gli avvisi dei messaggi a sito chiuso (notifiche push). Lo registra
// src/pwa/registerServiceWorker.ts, solo nel sito pubblicato.
//
// Cosa passa dalla cache:
// - /assets/: i file dell'app con l'impronta nel nome, che non cambiano mai. Prima la cache, poi la rete.
// - le pagine: prima la rete; senza rete l'ultima versione dell'app salvata, che mostra i suoi avvisi.
// - /api/ e ciò che viene da altri siti (foto, Pusher) no: passa sempre dalla rete. I dati delle
//   persone e i messaggi non restano nel dispositivo per colpa del service worker.
//
// Cambiando le regole qui sotto si cambia VERSION: all'attivazione le cache vecchie si cancellano.

const VERSION = 'v1';
const ASSETS = `roomdate-assets-${VERSION}`;
const SHELL = `roomdate-app-${VERSION}`;
const SHELL_KEY = '/index.html';
// I file dell'app di versioni passate si accumulano: si tengono gli ultimi
const MAX_ASSETS = 80;

// Senza rete e senza un'app salvata (prima visita interrotta): una pagina semplice
const OFFLINE_PAGE = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sei offline | RoomDate</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fafaf9;color:#1c1917;font-family:system-ui,sans-serif}
main{max-width:28rem;padding:1.5rem;text-align:center;line-height:1.5}a{color:#c2410c;font-weight:700}</style></head>
<body><main><h1>Sei offline</h1><p>RoomDate ha bisogno della connessione per aprirsi la prima volta.</p><p><a href="">Riprova</a></p></main></body></html>`;

self.addEventListener('install', (event) => {
  // L'app e i file che carica subito, così si apre senza rete già dopo la prima visita
  event.waitUntil(precacheApp().catch(() => {}));
  self.skipWaiting();
});

async function precacheApp() {
  const response = await fetch('/', { cache: 'no-cache' });
  if (!response.ok) return;
  const html = await response.clone().text();
  await (await caches.open(SHELL)).put(SHELL_KEY, response);
  const files = [...new Set([...html.matchAll(/\/assets\/[\w.-]+\.(?:js|css)/g)].map((match) => match[0]))];
  await (await caches.open(ASSETS)).addAll(files);
}

// Niente clients.claim(): il service worker controlla le pagine dalla navigazione successiva. Se
// prendesse il controllo di una pagina a metà caricamento, la foto principale già chiesta in
// anticipo (src/api/early.ts) non verrebbe riusata e si scaricherebbe due volte.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('roomdate-') && name !== ASSETS && name !== SHELL) await caches.delete(name);
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(openPage(event));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(fromCacheFirst(event));
  }
});

async function openPage(event) {
  try {
    const response = await fetch(event.request);
    // Tutte le pagine sono la stessa app (index.html): si tiene l'ultima per quando manca la rete
    if (response.ok && (response.headers.get('Content-Type') ?? '').includes('text/html')) {
      const copy = response.clone();
      event.waitUntil(caches.open(SHELL).then((cache) => cache.put(SHELL_KEY, copy)));
    }
    return response;
  } catch {
    const saved = await caches.match(SHELL_KEY, { cacheName: SHELL });
    return saved ?? new Response(OFFLINE_PAGE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function fromCacheFirst(event) {
  const cache = await caches.open(ASSETS);
  // ignoreVary: i moduli si chiedono con l'header Origin, i file in cache no; con l'impronta nel
  // nome il contenuto è comunque lo stesso
  const saved = await cache.match(event.request, { ignoreVary: true });
  if (saved) return saved;
  const response = await fetch(event.request);
  if (response.ok) {
    const copy = response.clone();
    event.waitUntil(cache.put(event.request, copy).then(() => trim(cache)));
  }
  return response;
}

// La pagina indica i file dell'app scaricati prima che il service worker fosse attivo
// (src/pwa/registerServiceWorker.ts): solo file di /assets/ di questo sito
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'roomdate-cache' || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((url) => typeof url === 'string' && url.startsWith(`${self.location.origin}/assets/`)).slice(0, MAX_ASSETS);
  event.waitUntil(caches.open(ASSETS).then(async (cache) => {
    for (const url of urls) {
      if (!(await cache.match(url, { ignoreVary: true }))) await cache.add(url).catch(() => {});
    }
    await trim(cache);
  }));
});

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(key);
}

// Notifiche push (internal/push): un messaggio nuovo. Il contenuto dice solo la conversazione e
// il nome di chi scrive; il testo resta cifrato e si legge aprendo la chat.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    return;
  }
  if (data.type === 'message' && Number.isInteger(data.conversationId)) event.waitUntil(showMessage(data));
});

async function showMessage({ conversationId, from }) {
  // Con una finestra di RoomDate davanti agli occhi l'avviso non serve: lo dice già la pagina
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (windows.some((client) => client.focused)) return;
  await self.registration.showNotification(`Nuovo messaggio da ${from || 'qualcuno'}`, {
    body: 'Apri RoomDate per leggerlo.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    // Lo stesso tag degli avvisi della pagina: più messaggi della conversazione, un avviso solo
    tag: `roomdate-conversazione-${conversationId}`,
    renotify: true,
    data: { url: `/chat/${conversationId}` },
  });
}

// Tocco su un avviso: la conversazione, nella finestra di RoomDate già aperta se c'è
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = typeof event.notification.data?.url === 'string' && event.notification.data.url.startsWith('/') ? event.notification.data.url : '/chat';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (open) {
      await open.focus();
      // L'app cambia pagina da sola, senza ricaricarsi (src/pwa/ServiceWorkerBridge.tsx)
      open.postMessage({ type: 'roomdate-open', url: path });
      return;
    }
    await self.clients.openWindow(path);
  })());
});

// Il browser ha rinnovato l'iscrizione (succede con Firefox): la nuova va al server
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const options = event.oldSubscription?.options;
    if (!options) return;
    const subscription = await self.registration.pushManager.subscribe(options);
    await fetch('/api/v1/me/push-subscriptions', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    });
  })());
});
