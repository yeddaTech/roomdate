import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../api/types';
import { decryptFromRecipients, decryptMessage } from '../utils/crypto';

/** Un messaggio che non si riesce ad aprire resta visibile, ma dichiarato come tale. */
export const UNREADABLE = 'Messaggio non decifrabile';

interface Cache {
  key: CryptoKey | null;
  texts: Map<number, string>;
}

/**
 * Decifra i messaggi con la chiave privata dell'utente e tiene i testi già aperti, così cambiando
 * conversazione o ricevendo un messaggio nuovo non si rifà il lavoro.
 *
 * Formato 2 (cifratura ibrida): la chiave del messaggio si apre con RSA e il testo con AES-GCM.
 * Formato 1: i messaggi vecchi, cifrati direttamente con RSA.
 *
 * remember() registra il testo di un messaggio appena inviato: lo si conosce già, non serve
 * decifrarlo (e non compare per un attimo come "…").
 */
export function useDecryptedTexts(messages: ChatMessage[], privateKey: CryptoKey | null) {
  const [texts, setTexts] = useState<Record<number, string>>({});
  const cache = useRef<Cache>({ key: privateKey, texts: new Map() });

  useEffect(() => {
    if (!privateKey) return undefined;
    // Cambiando chiave (sblocco, altro account) i testi vanno ricalcolati
    if (cache.current.key !== privateKey) {
      cache.current = { key: privateKey, texts: new Map() };
      setTexts({});
    }
    const current = cache.current;
    let cancelled = false;
    (async () => {
      const fresh: Record<number, string> = {};
      for (const message of messages) {
        if (cancelled) break;
        if (current.texts.has(message.id)) continue;
        let text = UNREADABLE;
        try {
          text = message.format === 2
            ? await decryptFromRecipients(message, privateKey)
            : await decryptMessage(message.body, privateKey);
        } catch {
          text = UNREADABLE;
        }
        current.texts.set(message.id, text);
        fresh[message.id] = text;
      }
      // Anche se nel frattempo sono arrivati altri messaggi: quelli aperti fin qui restano validi
      if (cache.current === current && Object.keys(fresh).length > 0) setTexts((all) => ({ ...all, ...fresh }));
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, privateKey]);

  const remember = useCallback((id: number, text: string) => {
    cache.current.texts.set(id, text);
    setTexts((all) => ({ ...all, [id]: text }));
  }, []);

  return { texts, remember };
}
