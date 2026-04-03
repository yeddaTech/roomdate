import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Pusher from 'pusher-js'; 

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
  
  // STATI DINAMICI
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [inputText, setInputText] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState('list'); 

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

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
    setUser(null);
    setIsMenuOpen(false);
    navigate('/');
  };

  const fetchChats = async () => {
      if (!user) return;
      try {
        const res = await fetch(`/api/get_chats?userId=${user.id}`);
        const data = await res.json();
        if (data) setConversations(data);
      } catch (err) {
        console.error("Errore caricamento chat:", err);
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    if (user) {
      fetchChats(); 

      const pusher = new Pusher('29ac9eeeb3352ae5b069', {
        cluster: 'eu'
      });

      const channel = pusher.subscribe('roomdate-channel');
      channel.bind('nuovo-messaggio', function(data) {
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

    setConversations(prevConvs => prevConvs.map(conv => {
      if (conv.id === activeConvId) {
        return { ...conv, messages: [...(conv.messages || []), tempMsg] };
      }
      return conv;
    }));

    try {
      await fetch('/api/send_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConvId,
          senderId: user.id,
          text: textToSend
        })
      });
    } catch (err) {
      alert("Errore di connessione. Il messaggio potrebbe non essere stato inviato.");
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
    return c.name.toLowerCase().includes(searchQuery.toLowerCase()) || lastMsg.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    // FIX 1: Usa h-[100dvh] invece di h-screen, e forza w-full e overflow-hidden
    <div className="flex flex-col h-[100dvh] w-full max-w-[100vw] bg-[#FEFAF4] font-sans overflow-hidden">
      
      {/* --- TOP NAV --- */}
      <nav className="shrink-0 z-50 bg-[#2C1A0E] text-white px-6 py-4 flex justify-between items-center shadow-md border-b-2 border-[#C4603A]">
        <Link to="/" className="font-serif text-2xl font-bold tracking-tight text-white decoration-none">
          Room<span className="text-[#D4835E]">Date</span>
        </Link>
        
        <div className="hidden md:flex gap-8 items-center text-sm font-medium text-neutral-300">
          <Link to="/" className="hover:text-[#D4835E] transition-colors">Home</Link>
          <Link to="/ricerca" className="hover:text-[#D4835E] transition-colors">Cerca Stanza</Link>
          <Link to="/chat" className="text-[#D4835E] transition-colors">Chat</Link>
          <Link to="/dashboard" className="hover:text-[#D4835E] transition-colors">Profilo</Link>
          <Link to="/impostazioni" className="text-[#D4835E] transition-colors">Impostazioni</Link>
          
        </div>

        <div className="hidden md:flex gap-4 items-center">
          {user ? (
            <>
              <span className="text-sm text-neutral-300">Ciao, <strong className="text-white">{user.nome}</strong>!</span>
              <button onClick={handleLogout} className="border border-neutral-500 hover:border-[#D4835E] hover:text-[#D4835E] px-4 py-2 rounded-full text-sm transition-colors">Esci</button>
            </>
          ) : (
            <>
              <Link to="/accedi" className="border border-neutral-500 hover:border-[#D4835E] hover:text-[#D4835E] px-4 py-2 rounded-full text-sm transition-colors">Accedi</Link>
              <Link to="/registrati" className="bg-[#C4603A] hover:bg-[#9A4628] px-5 py-2 rounded-full text-sm font-bold transition-colors">Registrati Gratis</Link>
            </>
          )}
        </div>

        <button className="md:hidden flex flex-col gap-1.5 z-[1001]" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <div className={`w-7 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
          <div className={`w-7 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></div>
          <div className={`w-7 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
        </button>
      </nav>

      {/* --- MOBILE SIDEBAR APP MENU --- */}
      <div className={`fixed inset-y-0 right-0 w-72 bg-[#2C1A0E] shadow-2xl z-[1000] p-8 pt-24 transform transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col gap-6 text-lg font-medium text-white">
          {user && (
             <div className="border-b border-neutral-700 pb-4 mb-2">
               <h3 className="text-xl">👤 Ciao, {user.nome}!</h3>
             </div>
          )}
          <Link to="/" onClick={() => setIsMenuOpen(false)}>🏠 Home</Link>
          <Link to="/ricerca" onClick={() => setIsMenuOpen(false)}>🔍 Cerca Stanza</Link>
          <Link to="/chat" onClick={() => setIsMenuOpen(false)}>💬 Chat</Link>
          <Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>👤 Il mio Profilo</Link>
          
          <div className="mt-8 flex flex-col gap-3">
            {user ? (
              <button onClick={handleLogout} className="bg-[#C4603A] w-full py-3 rounded-full font-bold">Esci</button>
            ) : (
              <>
                <Link to="/accedi" className="border border-neutral-500 text-center py-3 rounded-full" onClick={() => setIsMenuOpen(false)}>Accedi</Link>
                <Link to="/registrati" className="bg-[#C4603A] text-center py-3 rounded-full font-bold" onClick={() => setIsMenuOpen(false)}>Registrati</Link>
              </>
            )}
          </div>
        </div>
      </div>
      {isMenuOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] md:hidden" onClick={() => setIsMenuOpen(false)}></div>}

      {/* ── LAYOUT CHAT ── */}
      <div className="flex-1 flex overflow-hidden pb-16 md:pb-0 relative w-full">

        {/* ── SIDEBAR LISTA CHAT ── */}
        <aside className={`${mobileView === 'chat' ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[380px] bg-white border-r border-neutral-200 flex-col h-full shrink-0`}>
          <div className="p-4 border-b border-neutral-100 shrink-0">
            <h2 className="font-serif text-2xl text-[#2C1A0E] font-bold mb-4">Messaggi</h2>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">🔍</span>
              {/* FIX ZOOM: Usa text-base (16px) per evitare lo zoom su iOS */}
              <input
                type="text"
                placeholder="Cerca conversazioni..."
                className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] text-base md:text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#C4603A] transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto hide-scrollbar">
            {isLoading ? (
              [1, 2, 3, 4, 5].map(n => (
                <div key={n} className="flex gap-4 p-4 border-b border-neutral-50 pointer-events-none">
                  <div className="w-12 h-12 bg-neutral-200 animate-pulse rounded-full shrink-0"></div>
                  <div className="flex flex-col gap-2 w-full justify-center">
                    <div className="h-4 w-3/5 bg-neutral-200 animate-pulse rounded"></div>
                    <div className="h-3 w-2/5 bg-neutral-200 animate-pulse rounded"></div>
                  </div>
                </div>
              ))
            ) : filteredConvs.length === 0 ? (
              <div className="p-12 text-center text-[#8A7B6E] flex flex-col items-center">
                <div className="text-5xl mb-4">📭</div>
                <p>Non hai ancora nessuna conversazione attiva.</p>
              </div>
            ) : filteredConvs.map(conv => {
              const lastMsg = conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].text : 'Nessun messaggio';
              const isActive = conv.id === activeConvId;
              return (
                <div 
                  key={conv.id} 
                  className={`flex gap-4 p-4 border-b border-neutral-50 cursor-pointer transition-colors ${isActive ? 'bg-orange-50/50 border-r-4 border-r-[#C4603A]' : 'hover:bg-neutral-50'}`} 
                  onClick={() => handleSelectConv(conv)}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 shadow-sm" style={{ background: `linear-gradient(135deg, ${conv.color1}, ${conv.color2})` }}>
                    {conv.emoji}
                  </div>
                  <div className="flex flex-col justify-center overflow-hidden w-full">
                    <div className="font-bold text-[#2C1A0E] text-sm truncate">{conv.name}</div>
                    {conv.listing && (
                      <div className="text-[10px] text-[#C4603A] font-bold mb-0.5 truncate uppercase tracking-wider">
                        🏠 {conv.listing.title}
                      </div>
                    )}
                    <div className={`text-xs truncate ${isActive ? 'text-[#C4603A] font-medium' : 'text-[#8A7B6E]'}`}>{lastMsg}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── CHAT MAIN AREA ── */}
        <main className={`${mobileView === 'list' ? 'hidden md:flex' : 'flex'} flex-1 flex-col h-full bg-[#FEFAF4] w-full max-w-full relative`}>
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#8A7B6E]">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="font-serif text-2xl text-[#2C1A0E] mb-2 font-bold">Nessuna chat selezionata</h3>
              <p>Scegli una conversazione dalla lista a sinistra per iniziare a chattare.</p>
            </div>
          ) : (
            <>
              {/* Header Chat Attiva */}
              <div className="bg-white px-4 md:px-6 py-3 md:py-4 border-b border-neutral-200 flex items-center gap-4 shrink-0 shadow-sm z-10 w-full">
                <button className="md:hidden text-2xl text-[#8A7B6E] px-2" onClick={() => setMobileView('list')}>←</button>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-xl shadow-sm shrink-0" style={{ background: `linear-gradient(135deg, ${activeConv.color1}, ${activeConv.color2})` }}>
                  {activeConv.emoji}
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-bold text-[#2C1A0E] leading-tight truncate">{activeConv.name}</h3>
                  <p className="text-xs text-[#8A7B6E] truncate">Inquilino/Proprietario</p>
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
                        {!isMine && (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 shadow-sm" style={{ background: `linear-gradient(135deg, ${activeConv.color1}, ${activeConv.color2})` }}>
                            {activeConv.emoji}
                          </div>
                        )}
                        <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[80%] md:max-w-[70%]`}>
                          {/* FIX WRAP: Aggiunto break-words per non far esplodere la chat con parole lunghe */}
                          <div className={`px-4 py-2.5 text-sm md:text-base shadow-sm break-words whitespace-pre-wrap w-full ${
                            isMine 
                              ? 'bg-[#C4603A] text-white rounded-2xl rounded-br-sm' 
                              : 'bg-white border border-neutral-100 text-[#2C1A0E] rounded-2xl rounded-bl-sm'
                          }`}>
                            {msg.text}
                          </div>
                          <span className="text-[10px] text-neutral-400 mt-1 px-1">{msg.time}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies */}
              <div className="shrink-0 bg-white border-t border-neutral-100 p-2 md:p-3 overflow-x-auto hide-scrollbar flex gap-2 w-full">
                {QUICK_REPLIES.map(qr => (
                  <button 
                    key={qr} 
                    className="shrink-0 bg-orange-50 border border-orange-100 text-[#C4603A] text-xs font-semibold px-4 py-2 rounded-full hover:bg-[#C4603A] hover:text-white transition-colors" 
                    onClick={() => handleQuickReply(qr)}
                  >
                    {qr}
                  </button>
                ))}
              </div>

              {/* Input Area */}
              <div className="shrink-0 bg-white p-3 md:p-4 border-t border-neutral-100 flex items-end gap-3 w-full pb-safe">
                {/* FIX ZOOM: text-base forzato su mobile */}
                <textarea
                  ref={textareaRef}
                  className="flex-1 bg-neutral-50 border border-neutral-200 text-[#2C1A0E] text-base md:text-sm rounded-2xl px-4 py-3 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A] transition-colors resize-none max-h-[120px] w-full"
                  placeholder="Scrivi un messaggio..."
                  value={inputText}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button 
                  className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold transition-all ${!inputText.trim() ? 'bg-neutral-300 cursor-not-allowed' : 'bg-[#C4603A] hover:bg-[#9A4628] hover:scale-105 shadow-md'}`}
                  onClick={handleSend} 
                  disabled={!inputText.trim()}
                >
                  <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                </button>
              </div>
            </>
          )}
        </main>
      </div>

    </div>
  );
}