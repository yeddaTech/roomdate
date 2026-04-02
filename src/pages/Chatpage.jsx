import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Pusher from 'pusher-js'; 
import './Chatpage.css';

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
  
  // STATI DINAMICI
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [inputText, setInputText] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState('list'); 

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // 1. RECUPERA L'UTENTE LOGGATO
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
    navigate('/');
  };

  // 2. SCARICA DAL DATABASE
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

  // 3. REAL-TIME CON PUSHER
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

  // Scroll automatico in basso
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages]);

  // Apre automaticamente una chat se proveniamo da un'altra pagina
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

  // 4. INVIO MESSAGGIO CON UI OTTIMISTICA
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
    <div className="chat-page">
      
      {/* ── NAVBAR TOP ── */}
      <nav className="chat-nav">
        <div className="logo">Room<span>Date</span></div>
        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/ricerca">Cerca Stanza</Link>
          <Link to="/chat">Chat</Link>
          <Link to="/dashboard">Profilo</Link>
        </div>
        <div className="nav-btns">
          {user ? (
            <>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', marginRight: '0.5rem' }} className="mobile-hide">
                Ciao, <strong>{user.nome}</strong>!
              </span>
              <button onClick={handleLogout} className="btn-fill" style={{ background: '#E24B4A' }}>Esci</button>
            </>
          ) : (
            <>
              <Link to="/accedi" className="btn-ghost mobile-hide">Accedi</Link>
              <Link to="/registrati" className="btn-fill">Registrati</Link>
            </>
          )}
        </div>
      </nav>

      {/* ── LAYOUT CHAT ── */}
      <div className="chat-layout">

        {/* ── SIDEBAR ── */}
        <aside className={`chat-sidebar ${mobileView === 'chat' ? 'mobile-hide' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-top">
              <h2>Messaggi</h2>
            </div>
            <div className="search-convs">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Cerca conversazioni..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="conv-list">
            {isLoading ? (
              [1, 2, 3, 4, 5].map(n => (
                <div key={n} className="conv-item" style={{ pointerEvents: 'none' }}>
                  <div className="skeleton-box" style={{ width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0 }}></div>
                  <div className="conv-info" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                    <div className="skeleton-box" style={{ height: '16px', width: '60%' }}></div>
                    <div className="skeleton-box" style={{ height: '12px', width: '40%' }}></div>
                  </div>
                </div>
              ))
            ) : filteredConvs.length === 0 ? (
              <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--wg)' }}>
                <div style={{fontSize: '3rem', marginBottom: '1rem'}}>📭</div>
                Non hai ancora nessuna conversazione.
              </div>
            ) : filteredConvs.map(conv => {
              const lastMsg = conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].text : 'Nessun messaggio';
              return (
                <div key={conv.id} className={`conv-item ${conv.id === activeConvId ? 'active' : ''}`} onClick={() => handleSelectConv(conv)}>
                  <div className="conv-avatar" style={{ background: `linear-gradient(135deg, ${conv.color1}, ${conv.color2})` }}>
                    {conv.emoji}
                  </div>
                  <div className="conv-info">
                    <div className="conv-name">{conv.name}</div>
                    {conv.listing && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--t)', fontWeight: 'bold', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        🏠 {conv.listing.title}
                      </div>
                    )}
                    <div className="conv-preview">{lastMsg}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── CHAT MAIN ── */}
        <main className={`chat-main ${mobileView === 'chat' ? 'mobile-show' : ''}`}>
          {!activeConv ? (
            <div className="chat-empty">
              <div className="empty-icon">💬</div>
              <h3>Nessuna chat selezionata</h3>
              <p>Scegli una conversazione dalla lista a sinistra per iniziare a chattare.</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="chat-header">
                <button className="back-btn-mobile" onClick={() => setMobileView('list')}>←</button>
                <div className="chat-header-avatar" style={{ background: `linear-gradient(135deg, ${activeConv.color1}, ${activeConv.color2})` }}>
                  {activeConv.emoji}
                </div>
                <div className="chat-header-info">
                  <h3>{activeConv.name}</h3>
                  <p>Inquilino/Proprietario</p>
                </div>
              </div>

              {/* Messages */}
              <div className="messages-area">
                {!activeConv.messages || activeConv.messages.length === 0 ? (
                  <div style={{textAlign: 'center', padding: '2rem', color: 'var(--wg)'}}>Invia il primo messaggio per iniziare!</div>
                ) : (
                  activeConv.messages.map(msg => (
                    <div key={msg.id} className={`msg ${msg.type}`}>
                      {msg.type === 'received' && (
                        <div className="msg-avatar" style={{ background: `linear-gradient(135deg, ${activeConv.color1}, ${activeConv.color2})` }}>
                          {activeConv.emoji}
                        </div>
                      )}
                      <div>
                        <div className="msg-bubble">{msg.text}</div>
                        <div className="msg-time">{msg.time}</div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick replies */}
              <div className="quick-replies">
                {QUICK_REPLIES.map(qr => (
                  <button key={qr} className="qr-btn" onClick={() => handleQuickReply(qr)}>{qr}</button>
                ))}
              </div>

              {/* Input */}
              <div className="chat-input-area">
                <div className="input-wrapper">
                  <textarea
                    ref={textareaRef}
                    className="chat-textarea"
                    placeholder="Scrivi un messaggio..."
                    value={inputText}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                  />
                </div>
                <button className="send-btn" onClick={handleSend} disabled={!inputText.trim()}>➤</button>
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── BOTTOM NAV (Mobile) ── */}
      <nav className="bottom-nav">
        <div className="bottom-nav__inner">
          <Link to="/" className="bottom-nav__item">
            <span className="bottom-nav__icon">🏠</span>
            <span className="bottom-nav__label">Home</span>
          </Link>
          <Link to="/ricerca" className="bottom-nav__item">
            <span className="bottom-nav__icon">🔍</span>
            <span className="bottom-nav__label">Cerca</span>
          </Link>
          <Link to="/chat" className="bottom-nav__item active">
            <span className="bottom-nav__icon">💬</span>
            <span className="bottom-nav__label">Chat</span>
          </Link>
          <Link to="/dashboard" className="bottom-nav__item">
            <span className="bottom-nav__icon">👤</span>
            <span className="bottom-nav__label">Profilo</span>
          </Link>
        </div>
      </nav>

    </div>
  );
}