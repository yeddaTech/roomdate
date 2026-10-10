import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type Pusher from 'pusher-js';
import { getConversation } from '../api/chat';
import { invalidateConversations, pullLatestMessages } from '../api/hooks';
import { queryKeys } from '../api/queryKeys';
import { realtimeEnabled, userChannel } from '../api/realtime';
import type { ConversationsPage } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { alertNewMessage, wantsMessageAlert } from './notifications';
import { RealtimeContext, type RealtimeEvent } from './realtimeContext';

/**
 * Tempo reale per tutto il sito (modulo M2.7): una sola connessione a Pusher per chi ha fatto
 * l'accesso, sul suo canale privato. Un messaggio nuovo aggiorna subito il numero dei non letti
 * in qualunque pagina, e se la pagina non è in vista mostra l'avviso del browser (se acceso).
 * La chat usa la stessa connessione per "sta scrivendo".
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [client, setClient] = useState<Pusher | null>(null);
  const [live, setLive] = useState(false);
  const listeners = useRef(new Set<(event: RealtimeEvent) => void>());
  const open = useRef(navigate);
  useEffect(() => {
    open.current = navigate;
  });

  const subscribe = useCallback((listener: (event: RealtimeEvent) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!userId || !realtimeEnabled) return undefined;

    // Collega il canale dell'utente; restituisce la funzione che chiude tutto
    const connect = (pusher: Pusher): (() => void) => {
      const channel = pusher.subscribe(userChannel(userId));
      const emit = (event: RealtimeEvent) => listeners.current.forEach((listener) => listener(event));

      // Il nome di chi scrive per l'avviso: dall'elenco già caricato, altrimenti dal server
      const senderName = async (conversationId: number) => {
        const listed = queryClient.getQueryData<InfiniteData<ConversationsPage, string>>(queryKeys.conversations)
          ?.pages.flatMap((page) => page.items).find((c) => c.id === conversationId);
        const conversation = listed ?? await getConversation(conversationId).catch(() => null);
        return conversation?.other?.firstName || 'qualcuno';
      };

      channel.bind('nuovo-messaggio', ({ conversationId: raw }: { conversationId: number | string }) => {
        const conversationId = Number(raw);
        invalidateConversations(queryClient);
        pullLatestMessages(queryClient, conversationId).catch(() => {});
        emit({ type: 'message', conversationId });
        if (!wantsMessageAlert()) return;
        senderName(conversationId).then((from) => alertNewMessage({
          conversationId,
          from,
          onOpen: () => open.current(`/chat/${conversationId}`),
        }));
      });

      let connectedBefore = false;
      pusher.connection.bind('state_change', ({ current }: { current: string }) => {
        const connected = current === 'connected';
        setLive(connected);
        if (!connected) return;
        // Tornata la connessione: gli avvisi persi nel frattempo non arrivano più, si rilegge
        if (connectedBefore) {
          invalidateConversations(queryClient);
          emit({ type: 'reconnected' });
        }
        connectedBefore = true;
      });
      setClient(pusher);

      return () => {
        setClient(null);
        setLive(false);
        channel.unbind_all();
        pusher.connection.unbind('state_change');
        pusher.disconnect();
      };
    };

    let stopped = false;
    let stop = () => {};
    // Pusher si scarica solo ora, dopo l'accesso: chi visita il sito senza account non lo carica
    import('../api/realtimeClient').then(({ createRealtimeClient }) => {
      if (!stopped) stop = connect(createRealtimeClient());
    }).catch(() => {
      // Codice non disponibile (sito aggiornato nel frattempo): la chat si aggiorna da sola
    });
    return () => {
      stopped = true;
      stop();
    };
  }, [userId, queryClient]);

  const value = useMemo(() => ({ client, live, subscribe }), [client, live, subscribe]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
