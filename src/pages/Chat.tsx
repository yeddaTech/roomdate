import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessagesSquare } from 'lucide-react';
import { ApiError, isSessionExpired } from '../api/client';
import {
  useBlockUser,
  useConversation,
  useConversations,
  useMarkConversationRead,
  useMessages,
  useUnblockUser,
  useUnreadCount,
} from '../api/hooks';
import { queryKeys } from '../api/queryKeys';
import type { ChatMessage, Conversation } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { getPublicKey } from '../auth/keyStorage';
import { nameOf } from '../chat/conversation';
import type { ThreadItem } from '../chat/thread';
import { useChatKey } from '../chat/useChatKey';
import { useChatRealtime } from '../chat/useChatRealtime';
import { UNREADABLE, useDecryptedTexts } from '../chat/useDecryptedTexts';
import { useOutbox, type Recipient } from '../chat/useOutbox';
import ConversationList from '../components/chat/ConversationList';
import ConversationView from '../components/chat/ConversationView';
import UnlockPanel from '../components/chat/UnlockPanel';
import { useHideTabBar } from '../components/layout/layoutContext';
import { useVisualViewport } from '../components/layout/useVisualViewport';
import PageLoader from '../components/PageLoader';
import PageMeta from '../components/PageMeta';
import ReportDialog from '../components/ReportDialog';
import { buttonClasses } from '../components/ui/buttonClasses';
import { cn } from '../components/ui/cn';
import { useConfirm } from '../components/ui/confirm';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';

/** ID della conversazione nell'indirizzo (/chat/7): null senza, NaN se non è un numero valido. */
function parseConversationId(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  return /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : Number.NaN;
}

/** La pagina è in primo piano: solo allora i messaggi che arrivano contano come letti. */
function usePageVisible() {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

/**
 * Chat (modulo M2.6): elenco delle conversazioni e conversazione aperta, che ha un indirizzo suo
 * (/chat/7). Sul telefono si vede una delle due e "Indietro" del telefono torna all'elenco.
 */
export default function Chat() {
  const params = useParams();
  const conversationId = parseConversationId(params.conversationId);
  const openId = conversationId !== null && !Number.isNaN(conversationId) ? conversationId : null;
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { user, endLocalSession, logout } = useAuth();
  const myId = user?.id ?? '';
  const key = useChatKey();
  const keyboardOpen = useVisualViewport(true)?.keyboardOpen ?? false;
  const pageVisible = usePageVisible();
  const unread = useUnreadCount({ enabled: Boolean(user) }).data ?? 0;

  // Sul telefono, con una conversazione aperta, la barra in basso lascia il posto a messaggi e tastiera
  useHideTabBar(conversationId !== null);

  const conversationsQuery = useConversations();
  const conversations = useMemo(() => {
    const seen = new Set<number>();
    return (conversationsQuery.data?.pages.flatMap((page) => page.items) ?? []).filter((c) => !seen.has(c.id) && seen.add(c.id));
  }, [conversationsQuery.data]);
  const conversationQuery = useConversation(openId);
  const conversation: Conversation | null = conversationQuery.data ?? null;

  // I messaggi arrivano a pagine, dal più recente: qui si mettono in ordine dal più vecchio (anomalia F12)
  const messagesQuery = useMessages(openId);
  const serverMessages = useMemo(() => {
    const seen = new Set<number>();
    return (messagesQuery.data?.pages.flatMap((page) => page.items) ?? [])
      .filter((m) => !seen.has(m.id) && seen.add(m.id))
      .reverse();
  }, [messagesQuery.data]);

  const toDecrypt = useMemo(
    () => [...conversations.map((c) => c.lastMessage).filter((m): m is ChatMessage => m !== null), ...serverMessages],
    [conversations, serverMessages],
  );
  const { texts, remember } = useDecryptedTexts(toDecrypt, key.key);
  const locked = key.checked && !key.key;

  // Destinatari di un messaggio, letti al momento di cifrarlo: sé stessi e l'altro, ognuno con la sua chiave
  const recipientsFor = useCallback((id: number): Recipient[] => {
    const current = queryClient.getQueryData<Conversation>(queryKeys.conversation(id))
      ?? conversations.find((c) => c.id === id);
    const recipients: Recipient[] = [];
    const myKey = getPublicKey();
    if (myKey && myId) recipients.push({ userId: myId, publicKey: myKey });
    if (current?.other?.publicKey) recipients.push({ userId: current.other.id, publicKey: current.other.publicKey });
    return recipients;
  }, [queryClient, conversations, myId]);
  const outbox = useOutbox({
    recipientsFor,
    onSent: (saved, text) => remember(saved.id, text),
    onSessionExpired: () => endLocalSession('expired'),
  });
  const { reconcile } = outbox;
  useEffect(() => {
    reconcile(serverMessages);
  }, [serverMessages, reconcile]);

  // Con un blocco, un account sospeso o eliminato non si scrive più: la conversazione resta leggibile
  const canWrite = Boolean(conversation?.other) && !conversation?.blocked && !conversation?.other?.unavailable;
  const realtime = useChatRealtime({ userId: user?.id, conversationId: openId, canWrite: canWrite && !locked });

  // Sessione scaduta mentre la pagina è aperta: si torna all'accesso
  useEffect(() => {
    const error = conversationsQuery.error ?? conversationQuery.error ?? messagesQuery.error;
    if (error && isSessionExpired(error)) endLocalSession('expired');
  }, [conversationsQuery.error, conversationQuery.error, messagesQuery.error, endLocalSession]);

  // Separatore "Nuovi messaggi": l'ultima lettura com'era all'apertura, che poi non si sposta. Si
  // decide con la conversazione appena letta dal server: quella dell'elenco o una rimasta in cache
  // da un'apertura precedente può non sapere dei messaggi arrivati nel frattempo
  const [divider, setDivider] = useState<{ id: number; after: string | null | undefined } | null>(null);
  const fresh = conversation?.id === openId && !conversationQuery.isPlaceholderData && !conversationQuery.isFetching;
  if (conversation && fresh && divider?.id !== openId) {
    setDivider({ id: conversation.id, after: conversation.unreadCount > 0 ? conversation.lastReadAt : undefined });
  }
  const dividerDecided = openId !== null && divider?.id === openId;

  // Letta la conversazione aperta: solo con la pagina in primo piano, i messaggi davvero leggibili e
  // la conversazione letta dal server (non quella dell'elenco, mostrata intanto). Si ripete a ogni
  // ultimo messaggio nuovo, anche se il numero dei non letti resta lo stesso
  const { mutate: markRead } = useMarkConversationRead();
  const current = conversation?.id === openId && !conversationQuery.isPlaceholderData ? conversation : null;
  const unreadHere = current?.unreadCount ?? 0;
  const latestId = current?.lastMessage?.id ?? 0;
  useEffect(() => {
    if (openId !== null && unreadHere > 0 && pageVisible && !locked && key.checked && messagesQuery.isSuccess) markRead(openId);
  }, [openId, unreadHere, latestId, pageVisible, locked, key.checked, messagesQuery.isSuccess, markRead]);

  // Bozze per conversazione, solo in memoria: tornando su una chat si ritrova quello che si scriveva
  const drafts = useRef(new Map<number, string>());

  const items: ThreadItem[] = useMemo(() => [
    ...serverMessages.map((m): ThreadItem => ({
      key: `m-${m.id}`,
      senderId: m.senderId,
      createdAt: m.createdAt,
      text: texts[m.id] ?? '…',
      status: 'sent',
    })),
    ...outbox.items.filter((m) => m.conversationId === openId).map((m): ThreadItem => ({
      key: m.localId,
      senderId: myId,
      createdAt: m.createdAt,
      text: m.text,
      status: m.status,
    })),
  ], [serverMessages, texts, outbox.items, openId, myId]);
  const errors = useMemo(() => Object.fromEntries(outbox.items.map((m) => [m.localId, m.error])), [outbox.items]);

  const previewOf = (c: Conversation) => {
    if (!c.lastMessage) return 'Nessun messaggio';
    const text = texts[c.lastMessage.id];
    if (text === undefined) return '…';
    if (text === UNREADABLE) return text;
    return c.lastMessage.senderId === myId ? `Tu: ${text}` : text;
  };

  const [reporting, setReporting] = useState(false);
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const toggleBlock = async () => {
    const other = conversation?.other;
    if (!other) return;
    try {
      if (conversation.blocked === 'by_me') {
        await unblockUser.mutateAsync(other.id);
        toast.success(`${other.firstName} è stato sbloccato.`);
      } else if (await confirm({
        title: `Bloccare ${other.firstName}?`,
        description: "Nessuno dei due potrà più scrivere in questa conversazione né trovare l'altro nelle ricerche. Puoi sbloccare in qualsiasi momento.",
        confirmLabel: 'Blocca',
        tone: 'danger',
      })) {
        await blockUser.mutateAsync(other.id);
        toast.success(`${other.firstName} è stato bloccato.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operazione non riuscita.');
    }
  };

  // "Indietro" nella conversazione: all'elenco da cui si è arrivati, o all'elenco se si è arrivati da fuori
  const back = () => {
    if ((location.state as { fromList?: boolean } | null)?.fromList) navigate(-1);
    else navigate('/chat');
  };

  const name = conversation ? nameOf(conversation) : '';
  const title = `${unread > 0 ? `(${unread}) ` : ''}${openId !== null && name ? `Chat con ${name}` : 'Messaggi'} | RoomDate`;

  if (!key.checked) return <PageLoader />;

  if (locked) {
    return (
      <div className="h-full overflow-y-auto bg-background">
        <PageMeta title="Sblocca i messaggi | RoomDate" noindex />
        <UnlockPanel
          email={user?.email ?? ''}
          hasVault={key.hasVault}
          onUnlock={key.unlock}
          onSignInAgain={() => logout({ signInAgain: true })}
        />
      </div>
    );
  }

  const notFound = Number.isNaN(conversationId) ||
    (conversationQuery.error instanceof ApiError && [400, 403, 404].includes(conversationQuery.error.status));

  return (
    <div className="flex h-full min-h-0 w-full bg-surface">
      <PageMeta title={title} noindex />

      <aside
        aria-label="Conversazioni"
        className={cn('w-full flex-col border-line md:flex md:w-80 md:shrink-0 md:border-r lg:w-96', conversationId !== null ? 'hidden' : 'flex')}
      >
        <ConversationList
          conversations={conversations}
          activeId={openId}
          shown={conversationId === null}
          status={conversationsQuery.isPending ? 'pending' : conversationsQuery.isError && !conversationsQuery.data ? 'error' : 'success'}
          errorMessage={conversationsQuery.error?.message}
          onRetry={() => conversationsQuery.refetch()}
          previewOf={previewOf}
          typingIn={realtime.typing ? openId : null}
          hasNextPage={conversationsQuery.hasNextPage}
          isFetchingNextPage={conversationsQuery.isFetchingNextPage}
          isNextPageError={conversationsQuery.isFetchNextPageError}
          fetchNextPage={conversationsQuery.fetchNextPage}
        />
      </aside>

      <section
        aria-label={name ? `Conversazione con ${name}` : 'Conversazione'}
        className={cn('min-w-0 flex-1 flex-col bg-background', conversationId === null ? 'hidden md:flex' : 'flex')}
      >
        {conversationId === null ? (
          <EmptyState
            className="my-auto"
            icon={<MessagesSquare />}
            title="I tuoi messaggi"
            description="Scegli una conversazione dall'elenco per leggerla e rispondere."
          />
        ) : notFound ? (
          <EmptyState
            className="my-auto"
            icon={<MessagesSquare />}
            title="Conversazione non trovata"
            description="Non esiste o non ne fai parte."
            action={<Link to="/chat" className={buttonClasses({ variant: 'secondary' })}>Tutte le conversazioni</Link>}
          />
        ) : !conversation ? (
          conversationQuery.isError ? (
            <EmptyState
              className="my-auto"
              icon={<MessagesSquare />}
              title="Impossibile caricare la conversazione"
              description={conversationQuery.error.message}
              action={<button type="button" onClick={() => conversationQuery.refetch()} className={buttonClasses({ variant: 'secondary' })}>Riprova</button>}
            />
          ) : (
            <div className="flex flex-col gap-4 p-6" aria-busy="true">
              <span className="sr-only" role="status">Caricamento della conversazione…</span>
              <div className="flex items-center gap-3"><Skeleton className="size-11 rounded-full" /><Skeleton className="h-5 w-40" /></div>
              <Skeleton className="h-16 w-2/3 rounded-card" />
              <Skeleton className="ml-auto h-12 w-1/2 rounded-card" />
            </div>
          )
        ) : (
          <ConversationView
            conversation={conversation}
            myId={myId}
            items={items}
            errors={errors}
            messages={{
              ready: messagesQuery.isSuccess && dividerDecided,
              error: messagesQuery.isError && !messagesQuery.data ? messagesQuery.error.message : null,
              retry: () => messagesQuery.refetch(),
              hasOlder: messagesQuery.hasNextPage,
              loadingOlder: messagesQuery.isFetchingNextPage,
              loadOlder: messagesQuery.fetchNextPage,
            }}
            unreadAfter={divider?.id === conversation.id ? divider.after : undefined}
            typing={realtime.typing}
            keyboardOpen={keyboardOpen}
            draft={drafts.current.get(conversation.id) ?? ''}
            onDraftChange={(text) => drafts.current.set(conversation.id, text)}
            onBack={back}
            onSend={(text) => outbox.enqueue(conversation.id, text)}
            onTyping={realtime.notifyTyping}
            onRetry={outbox.retry}
            onDiscard={outbox.discard}
            onReport={() => setReporting(true)}
            onToggleBlock={toggleBlock}
            blockPending={blockUser.isPending || unblockUser.isPending}
          />
        )}
      </section>

      {reporting && conversation?.other && (
        <ReportDialog
          target={{ userId: conversation.other.id }}
          title={`Segnala ${conversation.other.firstName}`}
          // Solo i messaggi ricevuti dall'altro, già decifrati: il server non li può leggere
          conversation={{
            id: conversation.id,
            received: serverMessages
              .filter((m) => m.senderId === conversation.other?.id && texts[m.id] && texts[m.id] !== UNREADABLE)
              .map((m) => ({ text: texts[m.id], sentAt: m.createdAt })),
          }}
          onClose={() => setReporting(false)}
        />
      )}
    </div>
  );
}
