import { createContext, useContext } from 'react';
import type Pusher from 'pusher-js';

/** Cosa succede sul canale dell'utente: un messaggio nuovo, o la connessione tornata dopo un'interruzione. */
export type RealtimeEvent = { type: 'message'; conversationId: number } | { type: 'reconnected' };

export interface RealtimeValue {
  /** La connessione a Pusher condivisa da tutto il sito; null senza sessione o senza Pusher. */
  client: Pusher | null;
  /** Connessi in questo momento: se è false, chi ha bisogno di aggiornamenti li chiede da sé. */
  live: boolean;
  /** Avvisa la funzione a ogni evento; restituisce la funzione per smettere. */
  subscribe(listener: (event: RealtimeEvent) => void): () => void;
}

export const RealtimeContext = createContext<RealtimeValue>({ client: null, live: false, subscribe: () => () => {} });

export function useRealtime(): RealtimeValue {
  return useContext(RealtimeContext);
}
