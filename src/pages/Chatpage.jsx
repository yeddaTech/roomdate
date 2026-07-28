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

// Array unico centralizzato a 5 opzioni per mantenere la coerenza
const NAV_LINKS = [
  { name: 'Home', path: '/', icon: '🏠' },
  { name: 'Cerca Stanza', path: '/ricerca', icon: '🔍' },
  { name: 'Chat', path: '/chat', icon: '💬' },
  { name: 'Profilo', path: '/dashboard', icon: '👤' },
  { name: 'Impostazioni', path: '/impostazioni', icon: '⚙️' },
];

const sanitizeHTML = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '');
};

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

  const [isLocked, setIsLocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutsRef = useRef({});
  const lastTypedRef = useRef(0);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const conversationsRef = useRef(conversations);
  const activeConvIdRef = useRef(activeConvId);
  const userRef = useRef(user);

  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);
  useEffect(() => { userRef.current = user; }, [user]);

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
    sessionStorage.clear();
    localStorage.removeItem('roomdate_crypto');
    localStorage.removeItem('roomdate_public_key');
    setUser(null);
    setIsMenuOpen(false);
    navigate('/');
  };

  const fetchChats = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    
    try {
      const res = await fetchAPI(`/api/get_chats`); 
      if (!res.ok) throw new Error("Errore fetch");
      const data = await res.json();
      
      if (data) {
        const myPrivateKey = sessionStorage.getItem('roomdate_private_key'); 

        if (myPrivateKey) {
          setIsLocked(false);
          const decryptedData = await Promise.all(data.map(async (conv) => {
            const decryptedMessages = await Promise.all((conv.messages || []).map(async (msg) => {
              try {
                if (msg.isTemp) return msg; 
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
  }, []);

  const handleUnlock = async (e) => {
    e.preventDefault();
    setUnlockError('');
    setIsLoading(true);
    
    const cryptoDataStr = localStorage.getItem('roomdate_crypto');
    if (!cryptoDataStr) {
      setUnlockError('Dati di sicurezza mancanti. Fai il logout e riaccedi.');
      setIsLoading(false);
      return;
    }

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
      await fetchChats(); 
    } catch (err) {
      setUnlockError('Password errata. Riprova.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    fetchChats(); 

    const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER
    });

    const channel = pusher.subscribe('roomdate-channel');
    
    channel.bind('nuovo-messaggio', () => fetchChats());
    channel.bind('nuova-chat', () => fetchChats());
    
    channel.bind('sta-scrivendo', (data) => {
      const convId = String(data.conversationId);
      const senderId = String(data.senderId);
      const myId = String(userRef.current?.id);

      if (senderId !== myId) {
        setTypingUsers(prev => ({ ...prev, [convId]: true }));
        
        if (typingTimeoutsRef.current[convId]) {
          clearTimeout(typingTimeoutsRef.current[convId]);
        }
        
        typingTimeoutsRef.current[convId] = setTimeout(() => {
          setTypingUsers(prev => ({ ...prev, [convId]: false }));
        }, 3000);
      }
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, [user, fetchChats]);

  const activeConv = conversations.find(c => String(c.id) === String(activeConvId));

  useEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConv?.messages, typingUsers]);

  useEffect(() => {
    if (location.state?.openChatId && conversations.length > 0) {
      setActiveConvId(location.state.openChatId);
      setMobileView('chat');
    }
  }, [conversations, location.state]);

  const handleSelectConv = (conv) => {
    setActiveConvId(conv.id);
    setMobileView('chat');
    setTimeout(() => {
        if (textareaRef.current) textareaRef.current.focus();
    }, 100);
  };

  const handleTextareaChange = (e) => {
    setInputText(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';

    const now = Date.now();
    if (activeConvId && user && (now - lastTypedRef.current > 1500)) {
      lastTypedRef.current = now;
        fetchAPI('/api/typing', {
        method: 'POST',
        body: JSON.stringify({ 
            conversationId: String(activeConvId), 
            senderId: String(user.id) 
        })
      }).catch(err => console.error("Errore typing:", err));
    }
  };

  const handleSend = () => {
    if (!inputText.trim() || !activeConvId || !user || isSending) return;
    
    const textToSend = inputText.trim();
    setInputText(''); 
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsSending(true);

    const tempMsg = {
      id: `temp-${Date.now()}`, 
      type: 'sent',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isTemp: true
    };

    setConversations(prev => prev.map(conv => {
      if (String(conv.id) === String(activeConvId)) {
        return { ...conv, messages: [...(conv.messages || []), tempMsg] };
      }
      return conv;
    }));

    setTimeout(async () => {
      try {
        const targetPubKey = activeConv?.targetPublicKey;
        const myPublicKey = localStorage.getItem('roomdate_public_key');
        
        if (!targetPubKey || !myPublicKey) throw new Error("Chiavi crittografiche mancanti.");

        const encryptedForTarget = await encryptMessage(textToSend, targetPubKey);
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
        console.error(err);
        alert("Errore durante l'invio sicuro. Riprova.");
        setConversations(prev => prev.map(conv => {
            if (String(conv.id) === String(activeConvId)) {
              return { ...conv, messages: conv.messages.filter(m => m.id !== tempMsg.id) };
            }
            return conv;
        }));
      } finally {
        setIsSending(false);
      }
    }, 10);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickReply = (qr) => {
    setInputText(qr);
    if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.value = qr;
        handleTextareaChange({ target: textareaRef.current });
    }
  };

  const filteredConvs = conversations.filter(c => {
    const lastMsg = c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1].text : '';
    return c.name.toLowerCase().includes(searchQuery.toLowerCase()) || lastMsg.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-[100vw] bg-white font-sans overflow-hidden selection:bg-orange-200">
      <Helmet>
        <title>Area Privata | RoomDate</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

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
      
      {/* --- TOP NAV GENERATA DINAMICAMENTE (5 OPZIONI) --- */}
      <nav className="shrink-0 z-50 bg-white/80 backdrop-blur-md px-6 py-4 flex justify-between items-center shadow-sm border-b border-neutral-100 sticky top-0">
        <Link to="/" className="font-serif text-2xl font-bold tracking-tight text-neutral-900 decoration-none">
          Room<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">Date</span>
        </Link>
        
        {/* Menu Desktop integrato con l'array a 5 elementi */}
        <div className="hidden md:flex gap-8 items-center text-sm font-medium">
          {NAV_LINKS.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link 
                key={link.path} 
                to={link.path} 
                className={`transition-colors ${isActive ? 'text-orange-500 font-bold' : 'text-neutral-500 hover:text-neutral-900'}`}
              >
                {link.name}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:flex gap-4 items-center">
          {user && user.nome ? (
            <>
              <span className="text-sm text-neutral-500">Ciao, <strong className="text-neutral-900">{sanitizeHTML(user.nome)}</strong>!</span>
              <button onClick={handleLogout} className="border border-neutral-200 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 px-4 py-2 rounded-full text-sm transition-colors cursor-pointer font-medium">Esci</button>
            </>
          ) : (
            <>
              <Link to="/accedi" className="text-neutral-600 hover:text-neutral-900 px-4 py-2 text-sm font-medium transition-colors">Accedi</Link>
              <Link to="/registrati" className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-2 rounded-full text-sm font-bold transition-colors shadow-sm">Registrati</Link>
            </>
          )}
        </div>

        <button className="md:hidden flex flex-col gap-1.5 z-[1001] cursor-pointer" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Menu">          
          <div className={`w-6 h-0.5 bg-neutral-900 transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
          <div className={`w-6 h-0.5 bg-neutral-900 transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></div>
          <div className={`w-6 h-0.5 bg-neutral-900 transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
        </button>
      </nav>

      {/* --- MOBILE SIDEBAR APP MENU (5 OPZIONI AGGIORNATE) --- */}
      <div className={`fixed inset-y-0 right-0 w-72 bg-white shadow-2xl z-[1000] p-8 pt-24 transform transition-transform duration-300 ease-in-out border-l border-neutral-100 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col gap-6 text-lg font-medium text-neutral-600">
          {user && (
             <div className="border-b border-neutral-100 pb-4 mb-2">
               <h3 className="text-xl text-neutral-900 font-bold">👤 Ciao, {sanitizeHTML(user.nome)}!</h3>
             </div>
          )}
          
          {NAV_LINKS.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link 
                key={link.path} 
                to={link.path} 
                onClick={() => setIsMenuOpen(false)} 
                className={`transition-colors flex items-center gap-3 ${isActive ? 'text-orange-500 font-bold' : 'hover:text-orange-500'}`}
              >
                <span>{link.icon}</span> {link.name}
              </Link>
            );
          })}
          
          <div className="mt-8 flex flex-col gap-3">
            {user ? (
              <button onClick={handleLogout} className="bg-neutral-900 text-white w-full py-3 rounded-2xl font-bold hover:bg-neutral-800 transition-colors cursor-pointer">Esci</button>
            ) : (
              <>
                <Link to="/accedi" className="border border-neutral-200 text-center py-3 rounded-2xl hover:bg-neutral-50 transition-colors" onClick={() => setIsMenuOpen(false)}>Accedi</Link>
                <Link to="/registrati" className="bg-neutral-900 text-white text-center py-3 rounded-2xl font-bold shadow-sm" onClick={() => setIsMenuOpen(false)}>Registrati</Link>
              </>
            )}
          </div>
        </div>
      </div>
      {isMenuOpen && <div className="fixed inset-0 bg-neutral-900/20 backdrop-blur-sm z-[999] md:hidden transition-opacity" onClick={() => setIsMenuOpen(false)}></div>}

      {/* ── LAYOUT CHAT CONTAINER ── */}
      <div className={`flex-1 flex overflow-hidden relative w-full bg-white border-t border-neutral-100 ${mobileView === 'list' ? 'pb-16 md:pb-0' : ''}`}>

        {/* ── SIDEBAR LISTA CHAT ── */}
        <aside className={`${mobileView === 'chat' ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[380px] bg-white border-r border-neutral-100 flex-col h-full shrink-0 z-10`}>
          <div className="p-5 border-b border-neutral-100 shrink-0 bg-white">
            <h2 className="text-2xl text-neutral-900 font-extrabold mb-4 tracking-tight">Messaggi</h2>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">🔍</span>
              <input
                type="text"
                placeholder="Cerca conversazioni..."
                className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-base md:text-sm rounded-2xl pl-11 pr-4 py-3 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-neutral-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
            {isLoading && conversations.length === 0 ? (
              [1, 2, 3, 4, 5].map(n => (
                <div key={n} className="flex gap-4 p-5 border-b border-neutral-50 pointer-events-none">
                  <div className="w-14 h-14 bg-neutral-100 animate-pulse rounded-full shrink-0"></div>
                  <div className="flex flex-col gap-2 w-full justify-center">
                    <div className="h-4 w-3/5 bg-neutral-100 animate-pulse rounded-md"></div>
                    <div className="h-3 w-2/5 bg-neutral-100 animate-pulse rounded-md"></div>
                  </div>
                </div>
              ))
            ) : filteredConvs.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center h-full text-neutral-400">
                <div className="text-6xl mb-4 opacity-50">📭</div>
                <p className="font-medium text-neutral-500">Nessuna conversazione trovata.</p>
              </div>
            ) : filteredConvs.map(conv => {
              const lastMsg = conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].text : 'Nessun messaggio';
              const isActive = String(conv.id) === String(activeConvId);
              
              return (
                <div 
                  key={conv.id} 
                  className={`flex gap-4 p-5 cursor-pointer transition-all border-b border-neutral-50/50 ${isActive ? 'bg-orange-50/50 relative' : 'hover:bg-neutral-50'}`} 
                  onClick={() => handleSelectConv(conv)}
                >
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500 rounded-r-md"></div>}
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shrink-0 shadow-sm relative transition-transform duration-300 hover:scale-105" style={{ background: `linear-gradient(135deg, ${conv.color1}, ${conv.color2})` }}>
                    <span className="drop-shadow-sm">{conv.emoji}</span>
                  </div>
                  <div className="flex flex-col justify-center overflow-hidden w-full">
                    <div className="font-bold text-neutral-900 text-[15px] truncate">{conv.name}</div>
                    {conv.listing && (
                      <div className="text-[10px] text-orange-600 font-extrabold mb-0.5 truncate uppercase tracking-wider">
                        🏠 {conv.listing.title}
                      </div>
                    )}
                    <div className={`text-sm truncate mt-0.5 ${isActive ? 'text-orange-600 font-medium' : 'text-neutral-500'}`}>
                      {typingUsers[conv.id] ? (
                        <div className="flex gap-0.5 items-center mt-1">
                          <span className="typing-dot-sidebar"></span>
                          <span className="typing-dot-sidebar"></span>
                          <span className="typing-dot-sidebar"></span>
                        </div>
                      ) : (
                        lastMsg
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── CHAT MAIN AREA ── */}
        <main className={`${mobileView === 'list' ? 'hidden md:flex' : 'flex'} flex-1 flex-col h-full bg-[#FAFAFA] w-full max-w-full relative`}>
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#FAFAFA]">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6 border border-neutral-100">
                <span className="text-4xl opacity-50">💬</span>
              </div>
              <h3 className="text-2xl text-neutral-900 mb-2 font-extrabold tracking-tight">I tuoi messaggi</h3>
              <p className="text-neutral-500 font-medium max-w-xs">Seleziona una conversazione dalla barra laterale per iniziare a chattare.</p>
            </div>
          ) : (
            <>
              {/* Header Chat Attiva */}
              <div className="bg-white/90 backdrop-blur-md px-4 md:px-6 py-4 border-b border-neutral-100 flex items-center gap-4 shrink-0 shadow-sm z-10 w-full">
                <button className="md:hidden text-2xl text-neutral-500 hover:text-neutral-900 px-2 cursor-pointer transition-colors" onClick={() => setMobileView('list')}>←</button>
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-sm shrink-0" style={{ background: `linear-gradient(135deg, ${activeConv.color1}, ${activeConv.color2})` }}>
                  <span className="drop-shadow-sm">{activeConv.emoji}</span>
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-bold text-neutral-900 leading-tight truncate text-lg">{activeConv.name}</h3>
                  <p className="text-xs text-neutral-500 font-medium truncate h-4 mt-0.5">Inquilino/Proprietario</p>
                </div>
              </div>

              {/* Area Messaggi */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 flex flex-col gap-6 w-full custom-scrollbar bg-[#FAFAFA]">
                {!activeConv.messages || activeConv.messages.length === 0 ? (
                  <div className="text-center p-6 text-neutral-500 text-sm font-medium bg-white rounded-3xl border border-neutral-100 shadow-sm self-center my-auto">
                    👋 Invia il primo messaggio a {activeConv.name} per iniziare!
                  </div>
                ) : (
                  activeConv.messages.map(msg => {
                    const isMine = msg.type === 'sent';
                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} items-end gap-3 w-full ${msg.isTemp ? 'opacity-70 transition-opacity' : ''}`}>
                        {!isMine && (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 shadow-sm relative bottom-1" style={{ background: `linear-gradient(135deg, ${activeConv.color1}, ${activeConv.color2})` }}>
                            {activeConv.emoji}
                          </div>
                        )}
                        <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[70%]`}>
                          <div className={`px-5 py-3.5 text-[15px] shadow-sm break-words whitespace-pre-wrap w-full leading-relaxed ${
                            isMine 
                            ? 'bg-neutral-900 text-white rounded-3xl rounded-br-sm' 
                            : 'bg-white border border-neutral-100 text-neutral-800 rounded-3xl rounded-bl-sm'
                          }`}>
                            {msg.text}
                          </div>
                          <span className="text-[11px] text-neutral-400 mt-1.5 px-1 font-medium">
                              {msg.time} {msg.isTemp && ' • Inviando...'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                
                {/* Bolla Puntini Scrittura */}
                {typingUsers[activeConv.id] && (
                  <div className="flex justify-start items-end gap-3 w-full mt-2 animate-fade-in-up">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 shadow-sm opacity-60 relative bottom-1" style={{ background: `linear-gradient(135deg, ${activeConv.color1}, ${activeConv.color2})` }}>
                      {activeConv.emoji}
                    </div>
                    <div className="bg-white border border-neutral-100 px-5 py-4 rounded-3xl rounded-bl-sm shadow-sm flex gap-1.5 items-center h-[42px]">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies */}
              <div className="shrink-0 bg-white border-t border-neutral-100 p-3 md:px-6 md:py-4 overflow-x-auto flex gap-2 w-full custom-scrollbar">
                {QUICK_REPLIES.map(qr => (
                  <button 
                    key={qr} 
                    className="shrink-0 bg-white border border-neutral-200 text-neutral-600 text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-neutral-50 hover:border-orange-300 hover:text-orange-600 transition-all cursor-pointer whitespace-nowrap shadow-sm" 
                    onClick={() => handleQuickReply(qr)}
                  >
                    {qr}
                  </button>
                ))}
              </div>

              {/* Input Area */}
              <div className="shrink-0 bg-white p-4 md:px-6 md:pb-6 flex items-end gap-3 w-full border-t border-neutral-50">
                <textarea
                  ref={textareaRef}
                  className="flex-1 bg-neutral-50 border border-neutral-200 text-neutral-900 text-base rounded-3xl px-5 py-3.5 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all resize-none max-h-[140px] w-full placeholder:text-neutral-400 custom-scrollbar"
                  placeholder="Scrivi un messaggio..."
                  value={inputText}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button 
                  className={`shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-white font-bold transition-all duration-200 ${(!inputText.trim() || isSending) ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-orange-500 to-rose-500 hover:scale-[1.05] shadow-lg hover:shadow-orange-500/25 cursor-pointer'}`}
                  onClick={handleSend} 
                  disabled={!inputText.trim() || isSending}
                  aria-label="Invia messaggio"
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                </button>
              </div>
            </>
          )}
        </main>
        
        {/* 🔐 OVERLAY SBLOCCO CRITTOGRAFIA */}
        {isLocked && (
          <div className="absolute inset-0 z-[1100] bg-white/60 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl max-w-sm w-full text-center border border-neutral-100 animate-fade-in-up">
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner">
                🔐
              </div>
              <h3 className="text-2xl font-extrabold text-neutral-900 mb-3 tracking-tight">Chat Protetta</h3>
              <p className="text-sm text-neutral-500 mb-8 leading-relaxed font-medium">
                La tua privacy è al sicuro con crittografia end-to-end. Inserisci la password per sbloccare i messaggi.
              </p>
              
              <form onSubmit={handleUnlock} className="flex flex-col gap-4">
                <input
                  type="password"
                  placeholder="La tua password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  className="w-full bg-neutral-50 border text-center text-neutral-900 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all font-medium"
                />
                {unlockError && <div className="text-rose-500 text-xs font-bold -mt-2">{unlockError}</div>}
                
                <button
                  type="submit"
                  disabled={!unlockPassword || isLoading}
                  className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold hover:bg-neutral-800 transition-colors shadow-lg disabled:bg-neutral-300 disabled:shadow-none cursor-pointer mt-2"
                >
                  {isLoading ? 'Sblocco in corso...' : 'Sblocca Messaggi'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}