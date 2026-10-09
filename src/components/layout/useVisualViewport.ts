import { useEffect, useState } from 'react';

export interface VisibleArea {
  /** Altezza della parte di schermo visibile, in pixel. */
  height: number;
  /** Di quanto il browser ha spostato in giù la parte visibile (iOS, con la tastiera aperta). */
  offsetTop: number;
  /** La tastiera del telefono copre una parte della pagina. */
  keyboardOpen: boolean;
}

/** Sotto questa altezza coperta non è la tastiera, ma per esempio la barra del browser. */
const KEYBOARD_MIN_PX = 150;

/**
 * La parte di schermo davvero visibile, per le pagine a tutta altezza come la chat.
 *
 * Su iPhone e su Android (Chrome dalla versione 108) la tastiera copre la pagina senza
 * ridurla: 100dvh resta l'altezza intera e il campo di scrittura finirebbe sotto la tastiera,
 * oppure il browser sposterebbe tutta la pagina in alto, intestazione compresa. La visual
 * viewport è invece l'area che si vede: la pagina la segue in altezza e in posizione.
 *
 * null se il browser non la conosce o se l'utente ha ingrandito la pagina con le dita (in quel
 * caso l'area visibile è piccola per lo zoom, e la pagina non va rimpicciolita).
 */
export function useVisualViewport(enabled: boolean): VisibleArea | null {
  const [area, setArea] = useState<VisibleArea | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!enabled || !viewport) {
      setArea(null);
      return undefined;
    }
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (Math.abs(viewport.scale - 1) > 0.01) {
          setArea(null);
          return;
        }
        const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
        const height = Math.round(viewport.height);
        const offsetTop = Math.max(0, Math.round(viewport.offsetTop));
        const keyboardOpen = layoutHeight - height > KEYBOARD_MIN_PX;
        setArea((current) =>
          current && current.height === height && current.offsetTop === offsetTop && current.keyboardOpen === keyboardOpen
            ? current
            : { height, offsetTop, keyboardOpen });
      });
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [enabled]);

  return area;
}
