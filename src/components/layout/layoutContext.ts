import { createContext, useContext, useEffect } from 'react';

// Le pagine dell'area personale possono chiedere al layout di nascondere la barra in basso: la chat
// lo fa quando una conversazione è aperta sul telefono, per lasciare spazio a messaggi e tastiera.
export const TabBarContext = createContext<((hidden: boolean) => void) | null>(null);

export function useHideTabBar(hidden: boolean) {
  const setHidden = useContext(TabBarContext);
  useEffect(() => {
    if (!setHidden) return undefined;
    setHidden(hidden);
    return () => setHidden(false);
  }, [hidden, setHidden]);
}

/** Dati che una rotta passa al suo layout (campo "handle" della rotta). */
export interface RouteHandle {
  /** La pagina occupa tutta l'altezza dello schermo e gestisce da sé lo scorrimento (la chat). */
  fullHeight?: boolean;
  /** Collegamento in alto a destra nelle pagine di accesso, es. "Non hai un account? Registrati". */
  authSwitch?: { text: string; label: string; to: string };
}
