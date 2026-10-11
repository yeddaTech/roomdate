import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { afterPageLoad } from './afterPageLoad';

/**
 * Un componente che serve solo dopo un tocco (menu, finestre, foto a schermo intero), con il codice
 * in un file a parte (modulo M2.8): si scarica quando la pagina ha finito di caricarsi e il browser
 * è libero, oppure subito con load() se serve prima. Così non rallenta l'apertura della pagina.
 * Niente React.lazy: con Suspense React 19 aspetta almeno 300 ms prima di mostrarlo.
 * importer va definito fuori dal componente, perché resti sempre la stessa funzione.
 */
export function useLazyComponent<P extends object>(importer: () => Promise<{ default: ComponentType<P> }>) {
  const [Component, setComponent] = useState<ComponentType<P> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const download = useCallback(() => importer().then((module) => setComponent(() => module.default)), [importer]);

  // In anticipo: se non riesce, si riprova al tocco
  useEffect(() => afterPageLoad(() => { download().catch(() => {}); }), [download]);
  const load = useCallback(() => {
    if (!Component) download().catch(setError);
  }, [Component, download]);

  // Codice non più disponibile (sito aggiornato nel frattempo): la pagina d'errore propone di ricaricare
  if (error) throw error;
  return { Component, load };
}
