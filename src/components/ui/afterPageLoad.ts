// Dopo l'evento load la pagina scarica ancora il suo codice e i caratteri: si aspetta ancora un po'
const SETTLE_DELAY = 2000;

/**
 * Esegue fn quando la pagina ha finito di caricarsi e il browser è libero: dopo l'evento load, una
 * breve attesa e il primo momento di calma (al massimo timeout ms). Serve a scaricare in anticipo il
 * codice che servirà dopo senza togliere banda alla pagina (modulo M2.8). Restituisce la funzione
 * che annulla.
 */
export function afterPageLoad(fn: () => void, timeout = 4000): () => void {
  let cancel = () => {};
  const whenIdle = () => {
    // Safari non ha requestIdleCallback
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(fn, { timeout });
      cancel = () => window.cancelIdleCallback(id);
    } else {
      fn();
    }
  };
  const settle = () => {
    const id = window.setTimeout(whenIdle, SETTLE_DELAY);
    cancel = () => window.clearTimeout(id);
  };
  if (document.readyState === 'complete') settle();
  else window.addEventListener('load', settle, { once: true });
  return () => {
    window.removeEventListener('load', settle);
    cancel();
  };
}
