import { useCallback, useSyncExternalStore } from 'react';

/**
 * Vero se la media query vale ora, e si aggiorna quando cambia (es. ruotando il telefono). Serve
 * quando nascondere con le classi non basta: un'immagine dentro un elemento nascosto con
 * "hidden" si scarica lo stesso, quindi conviene non metterla proprio nella pagina.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
