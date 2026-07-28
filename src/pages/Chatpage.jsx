import React, { useState, useRef, useEffect } from 'react';
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

// HELPER DI SICUREZZA: Previene l'iniezione di tag HTML
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

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const [isLocked, setIsLocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');

  // 1. Controllo utente loggato con Safe Parsing
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('roomdate_user');
      if (!savedUser) {
        navigate('/accedi', { replace: true });
        return;
      }
      const parsedUser = JSON.parse(savedUser);
      if (typeof parsedUser === 'object' && parsedUser !== null && parsedUser.id) {
        setUser(parsedUser);
      } else {
        throw new Error("Dati utente corrotti");
      }
    } catch (e) {
      console.error("Errore di sicurezza: dati sessione compromessi");
      localStorage.removeItem('roomdate_user');
      navigate('/accedi', { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    try {
      localStorage.removeItem('roomdate_user');
      sessionStorage.removeItem('roomdate_private_key'); 
      localStorage.removeItem('roomdate_crypto');
      localStorage.removeItem('roomdate_public_key');
    } catch (e) {
      console.error("Errore durante la pulizia dei token");
    }
    setUser(null);
    setIsMenuOpen(false);
    navigate('/', { replace: true });
  };

  // 2. Scarica e DECIFRA le chat in sicurezza
  const fetchChats = async () => {
    if (!user) return;
    try {
      const res = await fetchAPI(`/api/get_chats`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        const myPrivateKey = sessionStorage.getItem('roomdate_private_key'); 

        if (myPrivateKey) {
          setIsLocked(false);
          const decryptedData = await Promise.all(data.map(async (conv) => {
            const decryptedMessages = await Promise.all((conv.messages || []).map(async (msg) => {
              try {
                // Decifratura del messaggio
                const clearText = await decryptMessage(msg.text, myPrivateKey);
                msg.text = sanitizeHTML(clearText); // Sanitizzazione post-decifratura
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
  };

  // 3. Sblocco Cassaforte Crittografica
  const handleUnlock = async (e) => {
    e.preventDefault();
    setUnlockError('');
    
    try {
      const cryptoDataStr = localStorage.getItem('roomdate_crypto');
      if (!cryptoDataStr) throw new Error("Dati crittografici mancanti");
      
      const cryptoData = JSON.parse(cryptoDataStr);
      if (!cryptoData.encryptedPrivateKey || !cryptoData.cryptoSalt || !cryptoData.cryptoIv) {
        throw new Error("Dati crittografici corrotti");
      }

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
      setUnlockError('Password errata o dati corrotti. Riprova.');
    }
  };

  // 4. Configurazione WebSockets (Pusher)
  useEffect(() => {
    if (user) {
      fetchChats(); 

      const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
        cluster: import.meta.env.VITE_PUSHER_CLUSTER
      });

      const channel = pusher.subscribe('roomdate-channel');
      channel.bind('nuovo-messaggio', function() {
        fetchChats();
      });

      return () => {
        channel.unbind_all();
        channel.unsubscribe();
      };
    }
  }, [user]);

  const activeConv = conversations.find(c => c.id === activeConvId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages]);

  useEffect(() => {
    if (location.state?.openChatId && conversations.length > 0) {
      setActiveConvId(location.state.openChatId);
      setMobileView('chat');
    }
  }, [conversations, location.state]);

  const handleTextareaChange = (e) => {
    setInputText(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  const handleSelectConv = (conv) => {
    setActiveConvId(conv.id);
    setMobileView('chat');
  };

  // 5. DOPPIA CIFRATURA E2E e invio del messaggio
  const handleSend = async () => {
    const rawText = inputText.trim();
    if (!rawText || !activeConvId || !user) return;
    
    // Sanitizziamo prima di crittografare (XSS Prevention)
    const textToSend = sanitizeHTML(rawText);
    setInputText(''); 
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const tempMsg = {
      id: Date.now(), 
      type: 'sent',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setConversations(prevConvs => prevConvs.map(conv => {
      if (conv.id === activeConvId) {
        return { ...conv, messages: [...(conv.messages || []), tempMsg] };
      }
      return conv;
    }));

    try {
      if (!activeConv.targetPublicKey) {
        alert("Errore crittografico: impossibile trovare la chiave del destinatario.");
        return;
      }

      const myPublicKey = localStorage.getItem('roomdate_public_key');
      if (!myPublicKey) {
        alert("Errore crittografico: impossibile trovare la tua chiave pubblica. Fai di nuovo il login.");
        return;
      }

      // Cifratura asimmetrica per il destinatario e per noi stessi
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
      console.error(err);
      alert("Errore di rete. Il messaggio potrebbe non essere stato inviato.");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickReply = (qr) => {
    setInputText(qr);
    textareaRef.current?.focus();
  };

  const filteredConvs = conversations.filter(c => {
    const lastMsg = c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1].text : '';
    const query = sanitizeHTML(searchQuery).toLowerCase();
    return c.name.toLowerCase().includes(query) || lastMsg.toLowerCase().includes(query);
  });

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-[100vw] bg-[#FAFAFA] font-sans overflow-hidden selection:bg-orange-200">
      <Helmet>
        <title>Area Privata | RoomDate</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      {/* --- TOP NAV GLASSMORPHISM --- */}
      <nav className="shrink-0 z-50 bg-white/80 backdrop-blur-md px-6 py-3 flex justify-between items-center shadow-sm border-b border-neutral-200 transition-all">
        <Link to="/" className="flex items-center gap-2 group decoration-none" aria-label="Torna alla Home">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <span className="font-bold text-xl" aria-hidden="true">R</span>
          </div>
          <span className="font-display text-2xl font-extrabold tracking-tight text-neutral-800">
            Room<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">Date</span>
          </span>
        </Link>
        
        <div className="hidden md:flex gap-8 items-center text-sm font-semibold text-neutral-500">
          <Link to="/" className="hover:text-orange-500 transition-colors">Home</Link>
          <Link to="/ricerca" className="hover:text-orange-500 transition-colors">Cerca Stanza</Link>
          <Link to="/chat" className="text-orange-500 transition-colors">Chat</Link>
          <Link to="/dashboard" className="hover:text-orange-500 transition-colors">Profilo</Link>
        </div>

        <div className="hidden md:flex gap-4 items-center">
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-neutral-600">Ciao, <strong className="text-neutral-900">{sanitizeHTML(user.nome)}</strong></span>
              <button onClick={handleLogout} className="px-5 py-2 rounded-full text-sm font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 transition-all">Esci</button>
            </div>
          ) : null}
        </div>

        <button className="md:hidden p-2" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label={isMenuOpen ? "Chiudi menu" : "Apri menu"}>          
          <div className="w-6 flex flex-col gap-1.5" aria-hidden="true">
            <span className={`block h-0.5 bg-neutral-800 transition-all ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
            <span className={`block h-0.5 bg-neutral-800 transition-all ${isMenuOpen ? 'opacity-0' : ''}`}></span>
            <span className={`block h-0.5 bg-neutral-800 transition-all ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
          </div>
        </button>
      </nav>

      {/* --- MOBILE SIDEBAR APP MENU --- */}
      <div className={`fixed inset-y-0 right-0 w-72 bg-white shadow-2xl z-[1000] p-8 pt-24 transform transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col gap-6 text-lg font-bold text-neutral-700">
          {user && (
             <div className="border-b border-neutral-100 pb-4 mb-2">
               <h3 className="text-xl text-neutral-900">👤 Ciao, {sanitizeHTML(user.nome)}!</h3>
             </div>
          )}
          <Link to="/" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">🏠 Home</Link>
          <Link to="/ricerca" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">🔍 Cerca Stanza</Link>
          <Link to="/chat" onClick={() => setIsMenuOpen(false)} className="text-orange-500 transition-colors">💬 Chat</Link>
          <Link to="/dashboard" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">👤 Profilo</Link>
          
          <div className="mt-8">
            <button onClick={handleLogout} className="w-full bg-neutral-900 text-white py-3 rounded-full font-bold hover:bg-neutral-800 transition-all shadow-md">Esci dall'account</button>
          </div>
        </div>
      </div>
      {isMenuOpen && <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-[999] md:hidden" onClick={() => setIsMenuOpen(false)}></div>}

      {/* ── LAYOUT CHAT ── */}
      <div className={`flex-1 flex overflow-hidden relative w-full ${mobileView === 'list' ? 'pb-16 md:pb-0' : ''}`}>

        {/* ── SIDEBAR LISTA CHAT ── */}
        <aside className={`${mobileView === 'chat' ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[380px] bg-white border-r border-neutral-200 flex-col h-full shrink-0 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]`}>
          <div className="p-5 border-b border-neutral-100 shrink-0 bg-white">
            <h2 className="font-extrabold text-2xl text-neutral-900 mb-4 tracking-tight">Messaggi</h2>
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input
                type="text"
                placeholder="Cerca conversazioni..."
                className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 transition-all placeholder:text-neutral-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto hide-scrollbar bg-white">
            {isLoading ? (
              [1, 2, 3, 4].map(n => (
                <div key={n} className="flex gap-4 p-5 border-b border-neutral-50 pointer-events-none">
                  <div className="w-12 h-12 bg-neutral-100 animate-pulse rounded-full shrink-0"></div>
                  <div className="flex flex-col gap-2 w-full justify-center">
                    <div className="h-4 w-3/5 bg-neutral-100 animate-pulse rounded"></div>
                    <div className="h-3 w-2/5 bg-neutral-100 animate-pulse rounded"></div>
                  </div>
                </div>
              ))
            ) : filteredConvs.length === 0 ? (
              <div className="p-12 text-center text-neutral-400 flex flex-col items-center">
                <div className="text-5xl mb-4 opacity-50">📭</div>
                <p className="font-medium">Nessuna conversazione attiva.</p>
              </div>
            ) : filteredConvs.map(conv => {
              const lastMsg = conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].text : 'Nessun messaggio';
              const isActive = conv.id === activeConvId;
              return (
                <div 
                  key={conv.id} 
                  className={`flex gap-4 p-4 border-b border-neutral-50 cursor-pointer transition-all ${isActive ? 'bg-orange-50/50 border-r-4 border-r-orange-500' : 'hover:bg-neutral-50'}`} 
                  onClick={() => handleSelectConv(conv)}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 shadow-sm" style={{ background: `linear-gradient(135deg, ${sanitizeHTML(conv.color1)}, ${sanitizeHTML(conv.color2)})` }}>
                    <span role="img" aria-label="Avatar">{sanitizeHTML(conv.emoji)}</span>
                  </div>
                  <div className="flex flex-col justify-center overflow-hidden w-full">
                    <div className="font-bold text-neutral-900 text-sm truncate">{sanitizeHTML(conv.name)}</div>
                    {conv.listing && (
                      <div className="text-[10px] text-orange-600 font-bold mb-0.5 truncate uppercase tracking-wider">
                        🏠 {sanitizeHTML(conv.listing.title)}
                      </div>
                    )}
                    <div className={`text-xs truncate ${isActive ? 'text-orange-600 font-semibold' : 'text-neutral-500 font-medium'}`}>{sanitizeHTML(lastMsg)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── CHAT MAIN AREA ── */}
        <main className={`${mobileView === 'list' ? 'hidden md:flex' : 'flex'} flex-1 flex-col h-full bg-[#FAFAFA] w-full max-w-full relative`}>
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-neutral-400">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm border border-neutral-100 mb-6 text-4xl">💬</div>
              <h3 className="text-xl text-neutral-800 mb-2 font-bold tracking-tight">I tuoi messaggi protetti</h3>
              <p className="text-sm max-w-xs font-medium">Seleziona una chat dalla lista per iniziare a comunicare in modo sicuro tramite crittografia End-to-End.</p>
            </div>
          ) : (
            <>
              {/* Header Chat Attiva */}
              <div className="bg-white/90 backdrop-blur-md px-4 md:px-6 py-3 md:py-4 border-b border-neutral-200 flex items-center gap-4 shrink-0 shadow-sm z-10 w-full">
                <button className="md:hidden text-neutral-500 hover:text-neutral-800 transition-colors p-1" onClick={() => setMobileView('list')} aria-label="Torna alla lista">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <div className="w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center text-lg shadow-sm shrink-0" style={{ background: `linear-gradient(135deg, ${sanitizeHTML(activeConv.color1)}, ${sanitizeHTML(activeConv.color2)})` }}>
                  <span role="img" aria-hidden="true">{sanitizeHTML(activeConv.emoji)}</span>
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-bold text-neutral-900 leading-tight truncate">{sanitizeHTML(activeConv.name)}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                    <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wide truncate">Chat Sicura E2E</p>
                  </div>
                </div>
              </div>

              {/* Area Messaggi */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 flex flex-col gap-5 w-full">
                {!activeConv.messages || activeConv.messages.length === 0 ? (
                  <div className="text-center p-6 text-neutral-500 text-sm bg-white rounded-2xl border border-neutral-100 shadow-sm self-center my-auto font-medium">
                    👋 Nessun messaggio. Rompi il ghiaccio!
                  </div>
                ) : (
                  activeConv.messages.map(msg => {
                    const isMine = msg.type === 'sent';
                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} items-end gap-2.5 w-full`}>
                        {!isMine && (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 shadow-sm" style={{ background: `linear-gradient(135deg, ${sanitizeHTML(activeConv.color1)}, ${sanitizeHTML(activeConv.color2)})` }}>
                             <span role="img" aria-hidden="true">{sanitizeHTML(activeConv.emoji)}</span>
                          </div>
                        )}
                        <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[75%] md:max-w-[65%]`}>
                          <div className={`px-4 py-2.5 text-sm md:text-base shadow-sm break-words whitespace-pre-wrap w-full font-medium ${
                            isMine 
                              ? 'bg-gradient-to-br from-orange-500 to-rose-500 text-white rounded-2xl rounded-br-sm' 
                              : 'bg-white border border-neutral-100 text-neutral-800 rounded-2xl rounded-bl-sm'
                          }`}>
                            {msg.text}
                          </div>
                          <span className="text-[10px] text-neutral-400 mt-1.5 px-1 font-semibold tracking-wide">{sanitizeHTML(msg.time)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies */}
              <div className="shrink-0 bg-transparent p-2 md:px-6 pb-2 overflow-x-auto hide-scrollbar flex gap-2 w-full">
                {QUICK_REPLIES.map(qr => (
                  <button 
                    key={qr} 
                    className="shrink-0 bg-white border border-neutral-200 text-neutral-600 text-xs font-semibold px-4 py-2 rounded-full hover:border-orange-400 hover:text-orange-500 shadow-sm transition-all" 
                    onClick={() => handleQuickReply(qr)}
                  >
                    {sanitizeHTML(qr)}
                  </button>
                ))}
              </div>

              {/* Input Area */}
              <div className="shrink-0 bg-white p-3 md:p-4 border-t border-neutral-100 flex items-end gap-3 w-full shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
                <textarea
                  ref={textareaRef}
                  className="flex-1 bg-neutral-50 border border-neutral-200 text-neutral-900 text-sm md:text-base rounded-2xl px-4 py-3 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 transition-all resize-none max-h-[120px] w-full placeholder:text-neutral-400"
                  placeholder="Scrivi un messaggio..."
                  value={inputText}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  aria-label="Scrivi un messaggio"
                />
                <button 
                  className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold transition-all ${!inputText.trim() ? 'bg-neutral-200 cursor-not-allowed' : 'bg-neutral-900 hover:bg-neutral-800 hover:scale-105 shadow-[0_8px_20px_rgb(0,0,0,0.12)]'}`}
                  onClick={handleSend} 
                  disabled={!inputText.trim()}
                  aria-label="Invia messaggio"
                >
                  <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                </button>
              </div>
            </>
          )}
        </main>
        
        {/* 🔐 OVERLAY SBLOCCO CHAT GLASSMORPHISM */}
        {isLocked && (
          <div className="absolute inset-0 z-[1100] bg-white/40 backdrop-blur-xl flex items-center justify-center p-4 transition-all">
            <div className="bg-white/95 p-8 md:p-10 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.1)] max-w-sm w-full text-center border border-white/50 animate-fade-in-up">
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner border border-orange-100">🔐</div>
              <h3 className="text-2xl font-extrabold text-neutral-900 mb-2 tracking-tight">Chat Protetta</h3>
              <p className="text-sm text-neutral-500 mb-8 leading-relaxed font-medium">
                La tua privacy è garantita dalla crittografia End-to-End. Inserisci la password per sbloccare la tua chiave privata.
              </p>
              
              <form onSubmit={handleUnlock} className="flex flex-col gap-4">
                <input
                  type="password"
                  placeholder="La tua password di sblocco"
                  value={unlockPassword}
                  onChange={(e) => {
                    setUnlockPassword(e.target.value);
                    setUnlockError('');
                  }}
                  className={`w-full bg-neutral-50 border text-center text-neutral-900 rounded-2xl px-5 py-4 focus:outline-none transition-colors placeholder:text-neutral-400 font-medium ${unlockError ? 'border-red-400 focus:ring-2 focus:ring-red-400/20' : 'border-neutral-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20'}`}
                />
                {unlockError && <div className="text-red-500 text-xs font-bold -mt-2">{unlockError}</div>}
                
                <button
                  type="submit"
                  disabled={!unlockPassword}
                  className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed transition-all shadow-md mt-2"
                >
                  Sblocca Cassaforte
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}