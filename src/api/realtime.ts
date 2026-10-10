import { request } from './client';

// Tempo reale privato (modulo M3.5). Pusher accetta l'iscrizione a un canale "private-" solo con
// una firma del server, che la rilascia per il proprio canale utente e per le conversazioni di cui
// si fa parte. Sui canali passano solo ID, mai contenuti.

export const PUSHER_KEY: string | undefined = import.meta.env.VITE_PUSHER_KEY;

/** Pusher può mancare in sviluppo locale: in quel caso le chat si aggiornano periodicamente. */
export const realtimeEnabled = Boolean(PUSHER_KEY);

/** Avvisi delle conversazioni dell'utente ("nuovo-messaggio"), inviati dal server. */
export const userChannel = (userId: string) => `private-user-${userId}`;

/** Canale dei partecipanti di una conversazione, per gli eventi scambiati tra i browser. */
export const conversationChannel = (conversationId: number) => `private-conversation-${conversationId}`;

/**
 * "Sta scrivendo": evento inviato direttamente dal browser agli altri partecipanti, senza
 * chiamare il server. Pusher accetta dai client solo eventi con il prefisso "client-".
 */
export const TYPING_EVENT = 'client-typing';

export interface TypingEvent {
  userId: string;
}

/** Chiede al server la firma per iscrivere la connessione al canale privato. */
export function authorizeChannel(socketId: string, channelName: string): Promise<{ auth: string }> {
  return request<{ auth: string }>('/api/v1/realtime/auth', { method: 'POST', body: { socketId, channelName } });
}
