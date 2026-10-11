import { useCallback, useEffect, useState } from 'react';

// Oltre questo tempo le altre foto partono comunque, anche se la prima non è ancora arrivata
const LEAD_TIMEOUT = 3000;

/**
 * La foto principale della pagina passa davanti alle altre (modulo M2.8). Con una connessione lenta
 * le foto si dividono la banda e quella in vista, che è anche la misura del caricamento (LCP), arriva
 * per ultima insieme a quelle fuori dallo schermo: queste aspettano che la prima sia arrivata.
 * leadUrl è la foto principale (nessuna attesa se non c'è); settle va chiamata al suo onLoad/onError.
 */
export function useLeadImage(leadUrl: string | null | undefined): { waiting: boolean; settle: () => void } {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!leadUrl || settled) return undefined;
    const timer = setTimeout(() => setSettled(true), LEAD_TIMEOUT);
    return () => clearTimeout(timer);
  }, [leadUrl, settled]);
  const settle = useCallback(() => setSettled(true), []);
  return { waiting: Boolean(leadUrl) && !settled, settle };
}
