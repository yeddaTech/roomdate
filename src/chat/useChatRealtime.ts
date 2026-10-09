import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type Pusher from 'pusher-js';
import { invalidateConversations, pullLatestMessages } from '../api/hooks';
import { conversationChannel, createRealtimeClient, realtimeEnabled, TYPING_EVENT, userChannel, type TypingEvent } from '../api/realtime';

/** Senza tempo reale (Pusher assente o disconnesso) si controlla con questa frequenza. */
export const FALLBACK_REFRESH_MS = 5000;
/** Ogni quanto, al massimo, si avvisa l'altro che si sta scrivendo. */
const TYPING_NOTICE_MS = 1500;
/** Per quanto resta "sta scrivendo" dopo l'ultimo avviso ricevuto. */
const TYPING_VISIBLE_MS = 3000;

interface Options {
  userId: string | undefined;
  /** Conversazione aperta, o null. */
  conversationId: number | null;
  /** Nella conversazione aperta si può scrivere: solo allora passa "sta scrivendo". */
  canWrite: boolean;
}

/**
 * Tempo reale della chat sui canali privati (modulo M3.5): l'avviso dei messaggi nuovi sul canale
 * dell'utente e "sta scrivendo" su quello della conversazione aperta. Se Pusher manca o la
 * connessione cade, la chat si aggiorna da sola ogni pochi secondi finché non torna.
 */
export function useChatRealtime({ userId, conversationId, canWrite }: Options) {
  const queryClient = useQueryClient();
  const [client, setClient] = useState<Pusher | null>(null);
  const [live, setLive] = useState(false);
  const [typing, setTyping] = useState(false);
  const typingChannel = useRef<ReturnType<Pusher['subscribe']> | null>(null);
  const lastNotice = useRef(0);
  const activeId = useRef(conversationId);
  useEffect(() => {
    activeId.current = conversationId;
  });

  // Rilegge ciò che può essere cambiato senza avviso: elenco, badge e messaggi della chat aperta
  const refresh = useCallback(() => {
    invalidateConversations(queryClient);
    if (activeId.current !== null) pullLatestMessages(queryClient, activeId.current).catch(() => {});
  }, [queryClient]);

  // Canale privato dell'utente: arriva l'avviso con gli ID, mai il contenuto (anomalia F12)
  useEffect(() => {
    if (!userId || !realtimeEnabled) return undefined;
    const pusher = createRealtimeClient();
    const channel = pusher.subscribe(userChannel(userId));
    channel.bind('nuovo-messaggio', ({ conversationId: raw }: { conversationId: number | string }) => {
      const id = Number(raw);
      invalidateConversations(queryClient);
      pullLatestMessages(queryClient, id).catch(() => {});
      // L'altro ha inviato quello che stava scrivendo: i puntini spariscono subito
      if (id === activeId.current) setTyping(false);
    });
    let connectedBefore = false;
    pusher.connection.bind('state_change', ({ current }: { current: string }) => {
      const connected = current === 'connected';
      setLive(connected);
      if (!connected) return;
      // Tornata la connessione: gli avvisi persi nel frattempo non arrivano più, si rilegge
      if (connectedBefore) refresh();
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
  }, [userId, queryClient, refresh]);

  // "Sta scrivendo" della conversazione aperta, passato tra i browser senza chiamare il server
  useEffect(() => {
    if (!client || conversationId === null || !canWrite) return undefined;
    const channel = client.subscribe(conversationChannel(conversationId));
    typingChannel.current = channel;
    let timer: ReturnType<typeof setTimeout> | undefined;
    channel.bind(TYPING_EVENT, (data: TypingEvent) => {
      // Lo stesso utente in un'altra scheda non conta come "l'altro sta scrivendo"
      if (data?.userId === userId) return;
      setTyping(true);
      clearTimeout(timer);
      timer = setTimeout(() => setTyping(false), TYPING_VISIBLE_MS);
    });
    return () => {
      typingChannel.current = null;
      channel.unbind_all();
      client.unsubscribe(channel.name);
      clearTimeout(timer);
      setTyping(false);
    };
  }, [client, conversationId, canWrite, userId]);

  // Senza tempo reale si controlla periodicamente, solo mentre la pagina è in vista
  useEffect(() => {
    if (!userId || live) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, FALLBACK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [userId, live, refresh]);

  // Tornando sulla scheda (telefono sbloccato, altra app) si rilegge subito
  useEffect(() => {
    if (!userId) return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, refresh]);

  /** Da chiamare mentre si scrive: avvisa l'altro, al massimo ogni TYPING_NOTICE_MS. */
  const notifyTyping = useCallback(() => {
    const channel = typingChannel.current;
    const now = Date.now();
    if (!channel?.subscribed || now - lastNotice.current < TYPING_NOTICE_MS) return;
    lastNotice.current = now;
    channel.trigger(TYPING_EVENT, { userId } satisfies Partial<TypingEvent>);
  }, [userId]);

  return { live, typing, notifyTyping };
}
