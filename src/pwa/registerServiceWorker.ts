/**
 * Registra il service worker (public/sw.js), solo nel sito pubblicato: in sviluppo la cache
 * nasconderebbe le modifiche. Dopo il caricamento della pagina, per non toglierle banda.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then((registration) => {
      // Il codice della prima pagina è arrivato prima del service worker: glielo si indica, così
      // finisce in cache e la pagina si apre anche senza rete (lo prende dalla cache del browser)
      const files = performance.getEntriesByType('resource').map((entry) => entry.name)
        .filter((url) => new URL(url).origin === window.location.origin && new URL(url).pathname.startsWith('/assets/'));
      registration.active?.postMessage({ type: 'roomdate-cache', urls: files });
    }).catch(() => {
      // Senza service worker il sito funziona lo stesso, solo non offline né installabile
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
