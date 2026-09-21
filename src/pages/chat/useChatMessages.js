import { useEffect, useRef, useState } from 'react';
import { decryptFromRecipients, decryptMessage } from '../../utils/crypto';

/** Un messaggio che non si riesce ad aprire resta visibile, ma dichiarato come tale. */
export const UNREADABLE = '🔒 [Messaggio non decifrabile]';

/**
 * Decifra i messaggi con la chiave privata dell'utente e tiene i testi già aperti, così cambiando
 * conversazione o ricevendo un messaggio nuovo non si rifà il lavoro.
 *
 * Formato 2 (cifratura ibrida): la chiave del messaggio si apre con RSA e il testo con AES-GCM.
 * Formato 1: i messaggi vecchi, cifrati direttamente con RSA.
 *
 * @param {Array<{id: number, format: number, body: string, iv: string, key: string}>} messages
 * @param {string|null} privateKey - Chiave privata in Base64, o null se la chat è bloccata.
 * @returns {Record<number, string>} testo in chiaro per ogni ID di messaggio già decifrato.
 */
export function useDecryptedTexts(messages, privateKey) {
  const [texts, setTexts] = useState({});
  const decryptedRef = useRef({});
  const keyRef = useRef(privateKey);

  // Cambiando chiave (sblocco, altro account) i testi vanno ricalcolati
  if (keyRef.current !== privateKey) {
    keyRef.current = privateKey;
    decryptedRef.current = {};
  }

  useEffect(() => {
    if (!privateKey) return undefined;
    let cancelled = false;

    (async () => {
      const opened = {};
      for (const message of messages) {
        if (decryptedRef.current[message.id] !== undefined) continue;
        let text = UNREADABLE;
        try {
          text = message.format === 2
            ? await decryptFromRecipients(message, privateKey)
            : await decryptMessage(message.body, privateKey);
        } catch {
          text = UNREADABLE;
        }
        decryptedRef.current[message.id] = text;
        opened[message.id] = text;
      }
      if (!cancelled && Object.keys(opened).length > 0) {
        setTexts((current) => ({ ...current, ...opened }));
      }
    })();

    return () => { cancelled = true; };
  }, [messages, privateKey]);

  return texts;
}
