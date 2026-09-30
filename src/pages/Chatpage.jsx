import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import { useQueryClient } from '@tanstack/react-query';
import { encryptForRecipients } from '../utils/crypto';
import { useAuth } from '../auth/AuthContext';
import { getPrivateKey, getPublicKey, hasStoredVault, unlockPrivateKey } from '../auth/keyStorage';
import { useBlockUser, useConversations, useMarkConversationRead, useMessages, useSendMessage, useUnblockUser } from '../api/hooks';
import ReportDialog from '../components/ReportDialog';
import { useHideTabBar } from '../components/layout/layoutContext';
import { useConfirm } from '../components/ui/confirm';
import { toast } from 'sonner';
import { conversationChannel, createRealtimeClient, realtimeEnabled, TYPING_EVENT, userChannel } from '../api/realtime';
import { queryKeys } from '../api/queryKeys';
import { isSessionExpired } from '../api/client';
import { UNREADABLE, useDecryptedTexts } from './chat/useChatMessages';
import { dayLabel, shortDateLabel, timeLabel } from './chat/time';

const FALLBACK_REFRESH_MS = 5000;
const TYPING_NOTICE_MS = 1500;

const QUICK_REPLIES = [
  '📅 Quando sei disponibile?',
  '🏠 Posso visitarla?',
  '💶 Spese incluse?',
  '📝 Contratto breve termine?',
  '🚇 Linea metro vicina?',
];


// Nome dell'altro partecipante: chi ha eliminato l'account non ha più un nome da mostrare
const nameOf = (conversation) => conversation?.other?.firstName || 'Utente eliminato';
const initial = (name) => (name || '?').charAt(0).toUpperCase();

export default function ChatPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, endLocalSession } = useAuth();

  const [activeId, setActiveId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState('list');
  // Sul telefono, con una conversazione aperta, la barra in basso lascia il posto a messaggi e tastiera
  useHideTabBar(mobileView === 'chat');
  // La chiave privata è una CryptoKey conservata in IndexedDB: si legge in modo asincrono
  const [privateKey, setPrivateKey] = useState(null);
  const [keyChecked, setKeyChecked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getPrivateKey().then((key) => {
      if (cancelled) return;
      setPrivateKey(key);
      setKeyChecked(true);
    });
    return () => { cancelled = true; };
  }, []);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [outgoing, setOutgoing] = useState([]);
  const [typingIn, setTypingIn] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const lastTypedRef = useRef(0);
  const typingTimeoutRef = useRef(null);
  const typingChannelRef = useRef(null);
  const [realtime, setRealtime] = useState(null);
  const activeIdRef = useRef(null);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // Chat aperta da un annuncio o da un profilo: vale una volta sola, poi l'indirizzo torna pulito (anomalia F9)
  const openChatId = location.state?.openChatId ?? null;
  useEffect(() => {
    if (openChatId === null) return;
    setActiveId(openChatId);
    setMobileView('chat');
    navigate(location.pathname, { replace: true, state: null });
  }, [openChatId, location.pathname, navigate]);

  const conversationsQuery = useConversations();
  const conversations = useMemo(
    () => conversationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [conversationsQuery.data],
  );
  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  // I messaggi arrivano a pagine, dal più recente: qui si mostrano dal più vecchio (anomalia F12)
  const messagesQuery = useMessages(activeId);
  const messages = useMemo(
    () => (messagesQuery.data?.pages.flatMap((page) => page.items) ?? []).slice().reverse(),
    [messagesQuery.data],
  );

  const lastMessages = useMemo(
    () => conversations.map((c) => c.lastMessage).filter(Boolean),
    [conversations],
  );
  const previewTexts = useDecryptedTexts(lastMessages, privateKey);
  const messageTexts = useDecryptedTexts(messages, privateKey);
  // Finché la chiave non è stata cercata la chat non si mostra bloccata (niente lampo del lucchetto)
  const isLocked = keyChecked && !privateKey;

  const sendMessage = useSendMessage();
  const { mutate: markConversationRead } = useMarkConversationRead();
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const [reporting, setReporting] = useState(false);
  // Con un blocco o un account sospeso non si scrive più: la conversazione resta leggibile
  const canWrite = Boolean(activeConv) && !activeConv.blocked && !activeConv.other?.unavailable;

  // Aprire una conversazione azzera i suoi messaggi non letti
  const unreadHere = activeConv?.unreadCount ?? 0;
  useEffect(() => {
    if (activeId && unreadHere > 0) markConversationRead(activeId);
  }, [activeId, unreadHere, markConversationRead]);

  // Eventi in tempo reale del solo utente, sul suo canale privato: arriva l'avviso, non l'intera
  // lista (anomalia F12), e nessun altro può ascoltarlo
  const userId = user?.id;
  useEffect(() => {
    if (!userId || !realtimeEnabled) return undefined;
    const client = createRealtimeClient();
    const channel = client.subscribe(userChannel(userId));
    channel.bind('nuovo-messaggio', ({ conversationId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(Number(conversationId)) });
    });
    setRealtime(client);

    return () => {
      setRealtime(null);
      channel.unbind_all();
      client.disconnect();
    };
  }, [userId, queryClient]);

  // "Sta scrivendo" della conversazione aperta: passa tra i browser dei partecipanti sul canale
  // privato della conversazione, senza chiamate al server
  useEffect(() => {
    if (!realtime || !activeId) return undefined;
    const channel = realtime.subscribe(conversationChannel(activeId));
    typingChannelRef.current = channel;
    channel.bind(TYPING_EVENT, (data) => {
      // Lo stesso utente in un'altra scheda non conta come "l'altro sta scrivendo"
      if (data?.userId === userId) return;
      setTypingIn(activeId);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingIn(null), 3000);
    });

    return () => {
      typingChannelRef.current = null;
      channel.unbind_all();
      realtime.unsubscribe(channel.name);
      clearTimeout(typingTimeoutRef.current);
      setTypingIn(null);
    };
  }, [realtime, activeId, userId]);

  // Senza Pusher (sviluppo locale) si controlla periodicamente
  useEffect(() => {
    if (!user || realtimeEnabled) return undefined;
    const timer = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      if (activeIdRef.current) queryClient.invalidateQueries({ queryKey: queryKeys.messages(activeIdRef.current) });
    }, FALLBACK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [user, queryClient]);

  // Sessione scaduta mentre la pagina è aperta: si torna all'accesso
  useEffect(() => {
    const error = conversationsQuery.error ?? messagesQuery.error;
    if (error && isSessionExpired(error)) endLocalSession('expired');
  }, [conversationsQuery.error, messagesQuery.error, endLocalSession]);

  const pendingHere = outgoing.filter((m) => m.conversationId === activeId);
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeId, lastMessageId, pendingHere.length, typingIn]);


  const handleUnlock = async (e) => {
    e.preventDefault();
    setUnlockError('');
    if (!hasStoredVault()) {
      setUnlockError('Dati di sicurezza mancanti. Esci e accedi di nuovo.');
      return;
    }
    setIsUnlocking(true);
    try {
      if (await unlockPrivateKey(unlockPassword)) {
        setPrivateKey(await getPrivateKey());
        setUnlockPassword('');
      } else {
        setUnlockError('Password errata. Riprova.');
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleSelectConv = (conversation) => {
    setActiveId(conversation.id);
    setMobileView('chat');
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  /**
   * Invia un messaggio: si cifra una volta sola e la chiave del messaggio viene cifrata
   * per ogni partecipante. Se l'invio fallisce il testo resta a schermo, con "Riprova" (anomalia F10).
   */
  const deliver = async (text, id) => {
    const myPublicKey = getPublicKey();
    const recipients = [];
    if (myPublicKey) recipients.push({ userId: user.id, publicKey: myPublicKey });
    if (activeConv?.other?.publicKey) recipients.push({ userId: activeConv.other.id, publicKey: activeConv.other.publicKey });

    try {
      const encrypted = await encryptForRecipients(text, recipients);
      await sendMessage.mutateAsync({ conversationId: activeConv.id, message: encrypted });
      setOutgoing((current) => current.filter((m) => m.id !== id));
    } catch (err) {
      if (isSessionExpired(err)) {
        endLocalSession('expired');
        return;
      }
      setOutgoing((current) => current.map((m) => (m.id === id ? { ...m, isPending: false, isFailed: true } : m)));
    }
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !activeConv) return;
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const id = `temp-${Date.now()}`;
    setOutgoing((current) => [...current, {
      id, conversationId: activeConv.id, senderId: user.id, text, createdAt: new Date().toISOString(), isPending: true,
    }]);
    deliver(text, id);
  };

  const handleRetry = (message) => {
    setOutgoing((current) => current.map((m) => (m.id === message.id ? { ...m, isPending: true, isFailed: false } : m)));
    deliver(message.text, message.id);
  };

  const handleDiscard = (message) => {
    setOutgoing((current) => current.filter((m) => m.id !== message.id));
  };

  const handleTextareaChange = (e) => {
    setInputText(e.target.value);
    const area = e.target;
    area.style.height = 'auto';
    area.style.height = Math.min(area.scrollHeight, 120) + 'px';

    const now = Date.now();
    const channel = typingChannelRef.current;
    if (channel?.subscribed && now - lastTypedRef.current > TYPING_NOTICE_MS) {
      lastTypedRef.current = now;
      channel.trigger(TYPING_EVENT, { userId });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleBlockToggle = async () => {
    const other = activeConv?.other;
    if (!other) return;
    try {
      if (activeConv.blocked === 'by_me') {
        await unblockUser.mutateAsync(other.id);
        toast.success(`${other.firstName} è stato sbloccato.`);
      } else if (await confirm({
        title: `Bloccare ${other.firstName}?`,
        description: "Nessuno dei due potrà più scrivere in questa conversazione né trovare l'altro nelle ricerche. Puoi sbloccare in qualsiasi momento.",
        confirmLabel: 'Blocca',
        tone: 'danger',
      })) {
        await blockUser.mutateAsync(other.id);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleQuickReply = (reply) => {
    setInputText(reply);
    textareaRef.current?.focus();
  };

  const previewOf = (conversation) => {
    if (!conversation.lastMessage) return 'Nessun messaggio';
    if (isLocked) return '🔒 Messaggi protetti';
    return previewTexts[conversation.lastMessage.id] ?? '…';
  };

  const search = searchQuery.trim().toLowerCase();
  const filteredConvs = conversations.filter((c) => {
    if (!search) return true;
    return nameOf(c).toLowerCase().includes(search) ||
      (c.listing?.title ?? '').toLowerCase().includes(search) ||
      previewOf(c).toLowerCase().includes(search);
  });

  // Messaggi da mostrare: quelli salvati più quelli ancora in viaggio
  const visibleMessages = [
    ...messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      createdAt: m.createdAt,
      text: isLocked ? '🔒 Messaggio protetto' : messageTexts[m.id] ?? '…',
    })),
    ...pendingHere,
  ];

  return (
    <div className="flex flex-col h-full w-full max-w-[100vw] bg-surface font-sans overflow-hidden selection:bg-primary/25">
      <PageMeta title="Area Privata | RoomDate" noindex />

      {/* STILI PER L'ANIMAZIONE DEI 3 PUNTINI E SCROLLBAR */}
      <style>
        {`
          .typing-dot {
            width: 6px;
            height: 6px;
            background-color: #9CA3AF;
            border-radius: 50%;
            display: inline-block;
            animation: typing-bounce 1.4s infinite ease-in-out both;
          }
          .typing-dot:nth-child(1) { animation-delay: -0.32s; }
          .typing-dot:nth-child(2) { animation-delay: -0.16s; }
          
          .typing-dot-sidebar {
            width: 4px;
            height: 4px;
            background-color: #f97316;
            border-radius: 50%;
            display: inline-block;
            animation: typing-bounce 1.4s infinite ease-in-out both;
          }
          .typing-dot-sidebar:nth-child(1) { animation-delay: -0.32s; }
          .typing-dot-sidebar:nth-child(2) { animation-delay: -0.16s; }

          @keyframes typing-bounce {
            0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
            40% { transform: scale(1); opacity: 1; }
          }
          
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: #E5E7EB;
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: #D1D5DB;
          }
        `}
      </style>
      

      {/* ── LAYOUT CHAT CONTAINER ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative w-full bg-surface">

        {/* ── SIDEBAR LISTA CHAT ── */}
        <aside className={`${mobileView === 'chat' ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[380px] bg-surface border-r border-line flex-col h-full shrink-0 z-10`}>
          <div className="p-5 border-b border-line shrink-0 bg-surface">
            <h2 className="text-2xl text-foreground font-extrabold mb-4 tracking-tight">Messaggi</h2>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-subtle">🔍</span>
              <input
                type="text"
                placeholder="Cerca conversazioni..."
                className="w-full bg-background border border-line text-foreground text-base md:text-sm rounded-2xl pl-11 pr-4 py-3 focus:outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-foreground-subtle"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface">
            {conversationsQuery.isPending ? (
              [1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="flex gap-4 p-5 border-b border-line pointer-events-none">
                  <div className="w-14 h-14 bg-surface-muted animate-pulse rounded-full shrink-0"></div>
                  <div className="flex flex-col gap-2 w-full justify-center">
                    <div className="h-4 w-3/5 bg-surface-muted animate-pulse rounded-md"></div>
                    <div className="h-3 w-2/5 bg-surface-muted animate-pulse rounded-md"></div>
                  </div>
                </div>
              ))
            ) : conversationsQuery.isError ? (
              <div className="p-10 text-center flex flex-col items-center gap-4">
                <p className="font-medium text-foreground-subtle">{conversationsQuery.error.message}</p>
                <button onClick={() => conversationsQuery.refetch()} className="bg-foreground text-background px-6 py-3 rounded-2xl font-bold cursor-pointer">Riprova</button>
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center h-full text-foreground-subtle">
                <div className="text-6xl mb-4 opacity-50">📭</div>
                <p className="font-medium text-foreground-subtle">Nessuna conversazione trovata.</p>
              </div>
            ) : (
              <>
                {filteredConvs.map((conversation) => {
                  const isActive = conversation.id === activeId;
                  return (
                    <div
                      key={conversation.id}
                      data-testid="conversation"
                      className={`flex gap-4 p-5 cursor-pointer transition-all border-b border-line/50 ${isActive ? 'bg-primary-soft/50 relative' : 'hover:bg-background'}`}
                      onClick={() => handleSelectConv(conversation)}
                    >
                      {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-md"></div>}
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0 shadow-xs bg-linear-to-br from-orange-400 to-rose-500">
                        <span className="drop-shadow-xs">{initial(nameOf(conversation))}</span>
                      </div>
                      <div className="flex flex-col justify-center overflow-hidden w-full">
                        <div className="flex justify-between items-center gap-2">
                          <div className="font-bold text-foreground text-[15px] truncate">{nameOf(conversation)}</div>
                          <div className="flex items-center gap-2 shrink-0">
                            {conversation.lastMessage && (
                              <span className="text-[11px] text-foreground-subtle font-medium">{shortDateLabel(conversation.lastMessage.createdAt)}</span>
                            )}
                            {conversation.unreadCount > 0 && (
                              <span data-testid="unread-badge" className="bg-primary text-primary-foreground text-[11px] font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                                {conversation.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                        {conversation.listing && (
                          <div className="text-[10px] text-primary font-extrabold mb-0.5 truncate uppercase tracking-wider">
                            🏠 {conversation.listing.title}
                          </div>
                        )}
                        <div className={`text-sm truncate mt-0.5 ${conversation.unreadCount > 0 ? 'text-foreground font-semibold' : 'text-foreground-subtle'}`}>
                          {typingIn === conversation.id ? (
                            <div className="flex gap-0.5 items-center mt-1">
                              <span className="typing-dot-sidebar"></span>
                              <span className="typing-dot-sidebar"></span>
                              <span className="typing-dot-sidebar"></span>
                            </div>
                          ) : (
                            previewOf(conversation)
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {conversationsQuery.hasNextPage && (
                  <button
                    onClick={() => conversationsQuery.fetchNextPage()}
                    disabled={conversationsQuery.isFetchingNextPage}
                    className="w-full py-4 text-sm font-bold text-foreground-subtle hover:text-foreground transition-colors cursor-pointer"
                  >
                    {conversationsQuery.isFetchingNextPage ? 'Caricamento...' : 'Carica altre conversazioni'}
                  </button>
                )}
              </>
            )}
          </div>
        </aside>

        {/* ── CHAT MAIN AREA ── */}
        <section aria-label="Conversazione" className={`${mobileView === 'list' ? 'hidden md:flex' : 'flex'} flex-1 min-w-0 flex-col h-full bg-background w-full max-w-full relative`}>
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background">
              <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center shadow-xs mb-6 border border-line">
                <span className="text-4xl opacity-50">💬</span>
              </div>
              <h3 className="text-2xl text-foreground mb-2 font-extrabold tracking-tight">I tuoi messaggi</h3>
              <p className="text-foreground-subtle font-medium max-w-xs">Seleziona una conversazione dalla barra laterale per iniziare a chattare.</p>
            </div>
          ) : (
            <>
              {/* Header Chat Attiva */}
              <div className="bg-surface/90 backdrop-blur-md px-4 md:px-6 py-4 border-b border-line flex items-center gap-4 shrink-0 shadow-xs z-10 w-full">
                <button className="md:hidden text-2xl text-foreground-subtle hover:text-foreground px-2 cursor-pointer transition-colors" onClick={() => setMobileView('list')}>←</button>
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-xs shrink-0 bg-linear-to-br from-orange-400 to-rose-500">
                  <span className="drop-shadow-xs">{initial(nameOf(activeConv))}</span>
                </div>
                <div className="overflow-hidden flex-1 min-w-0">
                  <h3 className="font-bold text-foreground leading-tight truncate text-lg">{nameOf(activeConv)}</h3>
                  <p className="text-xs text-foreground-subtle font-medium truncate h-4 mt-0.5">
                    {activeConv.listing ? `🏠 ${activeConv.listing.title} · €${activeConv.listing.price}/mese` : 'Chat diretta'}
                  </p>
                </div>
                {activeConv.other && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => setReporting(true)} className="text-sm font-bold text-foreground-subtle hover:text-danger px-3 py-2 rounded-full hover:bg-background transition-colors cursor-pointer">
                      🚩 <span className="hidden sm:inline">Segnala</span>
                    </button>
                    {activeConv.blocked !== 'by_other' && (
                      <button type="button" onClick={handleBlockToggle} disabled={blockUser.isPending || unblockUser.isPending} className="text-sm font-bold text-foreground-subtle hover:text-danger px-3 py-2 rounded-full hover:bg-background transition-colors cursor-pointer">
                        {activeConv.blocked === 'by_me' ? '✅' : '🚫'} <span className="hidden sm:inline">{activeConv.blocked === 'by_me' ? 'Sblocca' : 'Blocca'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Area Messaggi */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 flex flex-col gap-6 w-full custom-scrollbar bg-background">
                {messagesQuery.hasNextPage && (
                  <button
                    onClick={() => messagesQuery.fetchNextPage()}
                    disabled={messagesQuery.isFetchingNextPage}
                    className="self-center bg-surface border border-line text-foreground-muted text-sm font-bold px-5 py-2.5 rounded-full hover:bg-background transition-colors cursor-pointer shadow-xs"
                  >
                    {messagesQuery.isFetchingNextPage ? 'Caricamento...' : 'Carica messaggi precedenti'}
                  </button>
                )}

                {visibleMessages.length === 0 ? (
                  <div className="text-center p-6 text-foreground-subtle text-sm font-medium bg-surface rounded-3xl border border-line shadow-xs self-center my-auto">
                    👋 Invia il primo messaggio a {nameOf(activeConv)} per iniziare!
                  </div>
                ) : (
                  visibleMessages.map((message, index) => {
                    const isMine = message.senderId === user?.id;
                    const previous = visibleMessages[index - 1];
                    const newDay = !previous || dayLabel(previous.createdAt) !== dayLabel(message.createdAt);
                    return (
                      <div key={message.id} className="flex flex-col gap-6 w-full min-w-0">
                        {newDay && (
                          <div className="self-center bg-surface border border-line text-foreground-subtle text-[11px] font-bold px-4 py-1.5 rounded-full shadow-xs">
                            {dayLabel(message.createdAt)}
                          </div>
                        )}
                        <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} items-end gap-3 w-full ${message.isPending ? 'opacity-70' : ''}`}>
                          {!isMine && (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-xs relative bottom-1 bg-linear-to-br from-orange-400 to-rose-500">
                              {initial(nameOf(activeConv))}
                            </div>
                          )}
                          <div className={`flex flex-col min-w-0 ${isMine ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[70%]`}>
                            <div className={`px-5 py-3.5 text-[15px] shadow-xs wrap-break-word whitespace-pre-wrap w-full leading-relaxed ${
                              isMine
                                ? `bg-foreground text-background rounded-3xl rounded-br-sm ${message.isFailed ? 'ring-2 ring-danger/40' : ''}`
                                : 'bg-surface border border-line text-foreground rounded-3xl rounded-bl-sm'
                            }`}>
                              {message.text}
                            </div>
                            {message.isFailed ? (
                              <span className="text-[11px] text-danger mt-1.5 px-1 font-bold flex gap-2 items-center">
                                Non inviato
                                <button onClick={() => handleRetry(message)} className="underline cursor-pointer">Riprova</button>
                                <button onClick={() => handleDiscard(message)} className="underline cursor-pointer text-foreground-subtle">Elimina</button>
                              </span>
                            ) : (
                              <span data-testid="message-time" className="text-[11px] text-foreground-subtle mt-1.5 px-1 font-medium">
                                {timeLabel(message.createdAt)}{message.isPending && ' • Inviando...'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {typingIn === activeConv.id && (
                  <div className="flex justify-start items-end gap-3 w-full mt-2 animate-fade-in-up">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-xs opacity-60 relative bottom-1 bg-linear-to-br from-orange-400 to-rose-500">
                      {initial(nameOf(activeConv))}
                    </div>
                    <div className="bg-surface border border-line px-5 py-4 rounded-3xl rounded-bl-sm shadow-xs flex gap-1.5 items-center h-[42px]">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {!canWrite && (
                <div data-testid="conversation-closed" className="shrink-0 bg-surface border-t border-line p-5 md:px-6 text-center text-sm font-medium text-foreground-muted">
                  {activeConv.other?.unavailable
                    ? 'Questo account non è più disponibile: non puoi inviargli messaggi.'
                    : activeConv.blocked === 'by_me'
                      ? `Hai bloccato ${nameOf(activeConv)}: nessuno dei due può scrivere in questa conversazione.`
                      : 'Non puoi più inviare messaggi in questa conversazione.'}
                </div>
              )}

              {canWrite && (<>
              {/* Quick Replies */}
              <div className="shrink-0 bg-surface border-t border-line p-3 md:px-6 md:py-4 overflow-x-auto flex gap-2 w-full custom-scrollbar">
                {QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply}
                    className="shrink-0 bg-surface border border-line text-foreground-muted text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-background hover:border-primary/50 hover:text-primary transition-all cursor-pointer whitespace-nowrap shadow-xs"
                    onClick={() => handleQuickReply(reply)}
                  >
                    {reply}
                  </button>
                ))}
              </div>

              {/* Input Area */}
              <div className="shrink-0 bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:pb-6 flex items-end gap-3 w-full border-t border-line">
                <textarea
                  ref={textareaRef}
                  className="flex-1 bg-background border border-line text-foreground text-base rounded-3xl px-5 py-3.5 focus:outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none max-h-[140px] w-full placeholder:text-foreground-subtle custom-scrollbar"
                  placeholder="Scrivi un messaggio..."
                  value={inputText}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button
                  className={`shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-white font-bold transition-all duration-200 ${!inputText.trim() ? 'bg-line text-foreground-subtle cursor-not-allowed shadow-none' : 'bg-linear-to-r from-orange-500 to-rose-500 hover:scale-[1.05] shadow-lg hover:shadow-orange-500/25 cursor-pointer'}`}
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  aria-label="Invia messaggio"
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                </button>
              </div>
              </>)}
            </>
          )}
        </section>

        {reporting && activeConv?.other && (
          <ReportDialog
            target={{ userId: activeConv.other.id }}
            title={`Segnala ${activeConv.other.firstName}`}
            // Solo i messaggi ricevuti dall'altro, già decifrati: il server non li può leggere
            conversation={{
              id: activeConv.id,
              received: isLocked ? [] : messages
                .filter((m) => m.senderId === activeConv.other.id && messageTexts[m.id] && messageTexts[m.id] !== UNREADABLE)
                .map((m) => ({ text: messageTexts[m.id], sentAt: m.createdAt })),
            }}
            onClose={() => setReporting(false)}
          />
        )}

        {/* 🔐 OVERLAY SBLOCCO CRITTOGRAFIA */}
        {isLocked && (
          <div className="absolute inset-0 z-1100 bg-surface/60 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="bg-surface p-8 md:p-10 rounded-3xl shadow-2xl max-w-sm w-full text-center border border-line animate-fade-in-up">
              <div className="w-20 h-20 bg-primary-soft rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner">
                🔐
              </div>
              <h3 className="text-2xl font-extrabold text-foreground mb-3 tracking-tight">Chat Protetta</h3>
              <p className="text-sm text-foreground-subtle mb-8 leading-relaxed font-medium">
                La tua privacy è al sicuro con crittografia end-to-end. Inserisci la password per sbloccare i messaggi.
              </p>
              
              <form onSubmit={handleUnlock} className="flex flex-col gap-4">
                <input
                  type="password"
                  placeholder="La tua password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  className="w-full bg-background border text-center text-foreground rounded-2xl px-5 py-4 focus:outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
                {unlockError && <div className="text-danger text-xs font-bold -mt-2">{unlockError}</div>}
                
                <button
                  type="submit"
                  disabled={!unlockPassword || isUnlocking}
                  className="w-full bg-foreground text-background py-4 rounded-2xl font-bold hover:bg-foreground/85 transition-colors shadow-lg disabled:bg-control disabled:shadow-none cursor-pointer mt-2"
                >
                  {isUnlocking ? 'Sblocco in corso...' : 'Sblocca Messaggi'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
