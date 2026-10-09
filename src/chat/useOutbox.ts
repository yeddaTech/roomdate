import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, isSessionExpired } from '../api/client';
import type { OutgoingMessage } from '../api/chat';
import { invalidateConversations, useSendMessage } from '../api/hooks';
import type { ChatMessage } from '../api/types';
import { encryptForRecipients } from '../utils/crypto';

/** Un messaggio scritto qui e non ancora salvato sul server. */
export interface OutboxItem {
  localId: string;
  conversationId: number;
  text: string;
  /** Quando è stato scritto (ISO): resta al suo posto nella conversazione. */
  createdAt: string;
  status: 'sending' | 'failed';
  /**
   * Il messaggio già cifrato. "Riprova" rimanda esattamente questo: se il primo invio era arrivato
   * ma la risposta si era persa, il server riconosce il messaggio e non lo duplica.
   */
  payload: OutgoingMessage | null;
  /** Perché non è partito, da mostrare sotto il messaggio. */
  error: string | null;
  /** Non è partito per un problema di rete: riparte da solo quando torna la connessione. */
  network: boolean;
}

export interface Recipient {
  userId: string;
  publicKey: string;
}

interface Options {
  /** Destinatari della conversazione (sé compresi), letti al momento di cifrare. */
  recipientsFor: (conversationId: number) => Recipient[];
  /** Messaggio salvato: il testo è già noto, non va decifrato. */
  onSent: (saved: ChatMessage, text: string) => void;
  onSessionExpired: () => void;
}

let sequence = 0;

/** La cifratura nel browser non è riuscita (per esempio una chiave pubblica non valida). */
class EncryptionError extends Error {}

/** Cosa dire sotto un messaggio non partito, e se va rimandato identico (problema di rete). */
export function describeFailure(err: unknown, online: boolean): { network: boolean; error: string } {
  if (err instanceof EncryptionError) return { network: false, error: 'Impossibile cifrare il messaggio: ricarica la pagina e riprova.' };
  if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
    // Rifiutato dal server (blocco, account sospeso, chiavi cambiate): il motivo è il suo
    return { network: false, error: err.message };
  }
  if (!online) return { network: true, error: 'Sei offline: parte da solo appena torni online.' };
  if (err instanceof ApiError && err.status === 0) return { network: true, error: 'Non inviato: connessione assente o instabile.' };
  return { network: true, error: 'Non inviato: il server non risponde.' };
}

/**
 * Messaggi in uscita: compaiono subito nella conversazione ("Invio…"), poi lasciano il posto a
 * quello salvato. Se l'invio non riesce restano con "Riprova" ed "Elimina" (anomalia F10).
 */
export function useOutbox({ recipientsFor, onSent, onSessionExpired }: Options) {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const queryClient = useQueryClient();
  const send = useSendMessage();
  const { mutateAsync } = send;
  // Le funzioni passate dalla pagina cambiano a ogni disegno: qui serve sempre la più recente
  const latest = useRef({ recipientsFor, onSent, onSessionExpired });
  useEffect(() => {
    latest.current = { recipientsFor, onSent, onSessionExpired };
  });
  const inFlight = useRef(new Set<string>());

  const update = (localId: string, change: Partial<OutboxItem>) =>
    setItems((all) => all.map((item) => (item.localId === localId ? { ...item, ...change } : item)));

  const deliver = useCallback(async (item: OutboxItem) => {
    if (inFlight.current.has(item.localId)) return;
    inFlight.current.add(item.localId);
    update(item.localId, { status: 'sending', error: null, network: false });
    let payload = item.payload;
    try {
      if (!payload) {
        payload = await (encryptForRecipients(item.text, latest.current.recipientsFor(item.conversationId)) as Promise<OutgoingMessage>)
          .catch(() => {
            throw new EncryptionError();
          });
        const encrypted = payload;
        update(item.localId, { payload: encrypted });
      }
      const saved = await mutateAsync({ conversationId: item.conversationId, message: payload });
      latest.current.onSent(saved, item.text);
      setItems((all) => all.filter((m) => m.localId !== item.localId));
    } catch (err) {
      if (isSessionExpired(err)) {
        latest.current.onSessionExpired();
        return;
      }
      // Rete assente o server in difficoltà: il messaggio cifrato si rimanda identico. Se invece il
      // server lo ha rifiutato (blocco, chiavi cambiate) al nuovo tentativo si cifra di nuovo, e la
      // conversazione si rilegge: un blocco appena arrivato la mostra chiusa
      const { network, error } = describeFailure(err, typeof navigator === 'undefined' || navigator.onLine !== false);
      update(item.localId, { status: 'failed', network, payload: network ? payload : null, error });
      if (!network) invalidateConversations(queryClient);
    } finally {
      inFlight.current.delete(item.localId);
    }
  }, [mutateAsync, queryClient]);

  const enqueue = useCallback((conversationId: number, text: string) => {
    sequence += 1;
    const item: OutboxItem = {
      localId: `local-${Date.now()}-${sequence}`,
      conversationId,
      text,
      createdAt: new Date().toISOString(),
      status: 'sending',
      payload: null,
      error: null,
      network: false,
    };
    setItems((all) => [...all, item]);
    deliver(item);
  }, [deliver]);

  const retry = useCallback((localId: string) => {
    const item = items.find((m) => m.localId === localId);
    if (item) deliver(item);
  }, [items, deliver]);

  const discard = useCallback((localId: string) => {
    setItems((all) => all.filter((m) => m.localId !== localId));
  }, []);

  // Tornata la connessione, i messaggi rimasti indietro per la rete ripartono da soli
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });
  useEffect(() => {
    const onOnline = () => {
      for (const item of itemsRef.current) {
        if (item.status === 'failed' && item.network) deliver(item);
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [deliver]);

  /**
   * Un messaggio dato per non partito può essere arrivato lo stesso (risposta persa): se compare
   * tra quelli del server, identico, non è più da inviare.
   */
  const reconcile = useCallback((saved: ChatMessage[]) => {
    const pending = itemsRef.current.filter((item) => item.payload);
    if (pending.length === 0) return;
    for (const item of pending) {
      const match = saved.find((m) => m.body === item.payload?.body && m.iv === item.payload?.iv);
      if (!match) continue;
      latest.current.onSent(match, item.text);
      setItems((all) => all.filter((m) => m.localId !== item.localId));
    }
  }, []);

  return { items, enqueue, retry, discard, reconcile };
}
