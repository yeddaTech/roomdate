import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Pusher from 'pusher-js'; 
import { Helmet } from 'react-helmet-async';
import { encryptMessage, decryptMessage, unwrapPrivateKey } from '../utils/crypto';
import { fetchAPI } from '../utils/api'; 

const QUICK_REPLIES = [
  '📅 Quando sei disponibile?',
  '🏠 Posso visitarla?',
  '💶 Spese incluse?',
  '📝 Contratto breve termine?',
  '🚇 Linea metro vicina?',
];

export default function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation(); 
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [inputText, setInputText] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState('list'); 

  // Stato per l'indicatore "sta scrivendo"
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);
  const lastTypedRef = useRef(0);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const [isLocked, setIsLocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');

  // 1. Controllo utente
  useEffect(() => {
    const savedUser = localStorage.getItem('roomdate_user');
    if (!savedUser) {
      navigate('/accedi');
    } else {
      setUser(JSON.parse(savedUser));
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('roomdate_user');
    sessionStorage.removeItem('roomdate_private_key'); 
    localStorage.removeItem('roomdate_crypto');
    localStorage.removeItem('roomdate_public_key');
    setUser(null);
    navigate('/');
  };

  // 2. Fetch Chat con useCallback per evitare "stale closures"
  const fetchChats = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetchAPI(`/api/get_chats`); 
      const data = await res.json();
      
      if (data) {
        const myPrivateKey = sessionStorage.getItem('roomdate_private_key'); 

        if (myPrivateKey) {
          setIsLocked(false);
          const decryptedData = await Promise.all(data.map(async (conv) => {
            const decryptedMessages = await Promise.all((conv.messages || []).map(async (msg) => {
              try {
                msg.text = await decryptMessage(msg.text, myPrivateKey);
              } catch (e) {
                msg.text = "🔒 [Messaggio non decifrabile]";
              }
              return msg;
            }));
            return { ...conv, messages: decryptedMessages };
          }));
          setConversations(decryptedData);
        } else {
          setIsLocked(true);
          setConversations(data);
        }
      }
    } catch (err) {
      console.error("Errore caricamento chat:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const handleUnlock = async (e) => {
    e.preventDefault();
    setUnlockError('');
    const cryptoDataStr = localStorage.getItem('roomdate_crypto');
    if (!cryptoDataStr) return setUnlockError('Dati mancanti. Fai logout e riaccedi.');

    try {
      const cryptoData = JSON.parse(cryptoDataStr);
      const privateKey = await unwrapPrivateKey(
        cryptoData.encryptedPrivateKey,
        unlockPassword,
        cryptoData.cryptoSalt,
        cryptoData.cryptoIv
      );
      
      sessionStorage.setItem('roomdate_private_key', privateKey);
      setIsLocked(false);
      setUnlockPassword('');
      fetchChats(); 
    } catch (err) {
      setUnlockError('Password errata. Riprova.');
    }
  };

  // 3. Configurazione Pusher ROBUSTA
  useEffect(() => {
    if (user) {
      fetchChats(); 

      const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
        cluster: import.meta.env.VITE_PUSHER_CLUSTER
      });

      const channel = pusher.subscribe('roomdate-channel');
      
      // Assicurati che l'app ricarichi i messaggi sia su nuovo messaggio che su nuova chat
      channel.bind('nuovo-messaggio', () => fetchChats());
      channel.bind('nuova-chat', () => fetchChats());
      
      // Ascolta l'evento sta scrivendo
      channel.bind('sta-scrivendo', (data) => {
        if (data.senderId !== user.id) {
          setTypingUsers(prev => ({ ...prev, [data.conversationId]: true }));
          
          // Nascondi dopo 3 secondi
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setTypingUsers(prev => ({ ...prev, [data.conversationId]: false }));
          }, 3000);
        }
      });

      return () => {
        channel.unbind_all();
        channel.unsubscribe();
      };
    }
  }, [user, fetchChats]);

  const activeConv = conversations.find(c => c.id === activeConvId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages, typingUsers]);

  const handleTextareaChange = (e) => {
    setInputText(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';

    // Logica di Debouncing per il "sta scrivendo" (evita spam di richieste API)
    const now = Date.now();
    if (activeConvId && user && (now - lastTypedRef.current > 2000)) {
      lastTypedRef.current = now;
      // Invia segnale al backend (non crasha se l'endpoint non esiste ancora)
      fetchAPI('/api/typing', {
        method: 'POST',
        body: JSON.stringify({ conversationId: activeConvId, senderId: user.id })
      }).catch(() => {});
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !activeConvId || !user) return;
    
    const textToSend = inputText.trim();
    setInputText(''); 
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const tempMsg = {
      id: Date.now(), 
      type: 'sent',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setConversations(prev => prev.map(conv => 
      conv.id === activeConvId ? { ...conv, messages: [...(conv.messages || []), tempMsg] } : conv
    ));

    try {
      const myPublicKey = localStorage.getItem('roomdate_public_key');
      if (!myPublicKey || !activeConv.targetPublicKey) {
        return alert("Errore crittografico: chiavi mancanti.");
      }

      const encryptedForTarget = await encryptMessage(textToSend, activeConv.targetPublicKey);
      const encryptedForMe = await encryptMessage(textToSend, myPublicKey);

      await fetchAPI('/api/send_message', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: activeConvId,
          text: encryptedForTarget, 
          senderText: encryptedForMe 
        })
      });
    } catch (err) {
      alert("Errore di connessione durante l'invio.");
    }
  };

  // ... (Tutta la parte di Navigazione e Sidebar resta identica, salto al blocco della chat main) ...
  
  return (
    // <... mantieni il tuo div contenitore e la navigazione esattamente uguali ...>
    // Incolla qui sotto solo la sostituzione della main area per brevità visiva
    <div className="flex flex-col h-[100dvh] w-full max-w-[100vw] bg-[#FEFAF4] font-sans overflow-hidden">
      {/* TODO: Inserisci la tua top nav e sidebar qui, ometto per brevità */}
      
      <main className={`${mobileView === 'list' ? 'hidden md:flex' : 'flex'} flex-1 flex-col h-full bg-[#FEFAF4] w-full max-w-full relative`}>
          {!activeConv ? (
             // ... stato vuoto ...
             <div></div>
          ) : (
            <>
              {/* Header Chat */}
              <div className="bg-white px-4 md:px-6 py-3 border-b border-neutral-200 flex items-center gap-4 shadow-sm z-10 w-full">
                <button className="md:hidden text-2xl" onClick={() => setMobileView('list')}>←</button>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: `linear-gradient(135deg, ${activeConv.color1}, ${activeConv.color2})` }}>
                  {activeConv.emoji}
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-bold text-[#2C1A0E] truncate">{activeConv.name}</h3>
                  <p className="text-xs text-[#8A7B6E] truncate">
                    {/* UI Sta scrivendo aggiornata nell'header */}
                    {typingUsers[activeConv.id] ? (
                      <span className="text-[#C4603A] font-medium animate-pulse">sta scrivendo...</span>
                    ) : "Inquilino/Proprietario"}
                  </p>
                </div>
              </div>

              {/* Area Messaggi */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 flex flex-col gap-4 w-full">
                {!activeConv.messages || activeConv.messages.length === 0 ? (
                  <div className="text-center p-8 text-[#8A7B6E] text-sm bg-white rounded-2xl border border-neutral-100 shadow-sm self-center my-auto">
                    👋 Invia il primo messaggio per iniziare!
                  </div>
                ) : (
                  activeConv.messages.map(msg => {
                    const isMine = msg.type === 'sent';
                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} items-end gap-2 w-full`}>
                        {/* Messaggi esistenti */}
                        <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[80%] md:max-w-[70%]`}>
                          <div className={`px-4 py-2.5 text-sm md:text-base shadow-sm break-words whitespace-pre-wrap w-full ${
                            isMine ? 'bg-[#C4603A] text-white rounded-2xl rounded-br-sm' : 'bg-white border border-neutral-100 text-[#2C1A0E] rounded-2xl rounded-bl-sm'
                          }`}>
                            {msg.text}
                          </div>
                          <span className="text-[10px] text-neutral-400 mt-1 px-1">{msg.time}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                
                {/* Visualizzazione "Sta scrivendo" nei messaggi */}
                {typingUsers[activeConv.id] && (
                  <div className="flex justify-start items-end gap-2 w-full animate-fade-in-up">
                    <div className="bg-white border border-neutral-100 text-[#2C1A0E] px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex gap-1">
                      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* ... Quick Replies e Input Area come li avevi prima ... */}
              <div className="shrink-0 bg-white p-3 pb-6 border-t border-neutral-100 flex items-end gap-3 w-full">
                <textarea
                  ref={textareaRef}
                  className="flex-1 bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3 focus:outline-none focus:border-[#C4603A] transition-colors resize-none max-h-[120px]"
                  placeholder="Scrivi un messaggio..."
                  value={inputText}
                  onChange={handleTextareaChange} // ORA INVIA L'EVENTO TYPING
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  rows={1}
                />
                <button onClick={handleSend} disabled={!inputText.trim()} className="..."> Invia </button>
              </div>
            </>
          )}
        </main>
      
      {/* Overlay Sblocco */}
    </div>
  );
}