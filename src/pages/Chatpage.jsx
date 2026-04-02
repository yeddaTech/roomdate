import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Pusher from 'pusher-js'; // <--- AGGIUNGI QUESTO!

const QUICK_REPLIES = [
  '📅 Quando sei disponibile?',
  '🏠 Posso visitarla?',
  '💶 Spese incluse?',
  '📝 Contratto breve termine?',
  '🚇 Linea metro vicina?',
];
export default function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation(); // <--- AGGIUNGI QUESTA!
  const [user, setUser] = useState(null);
  
  // STATI DINAMICI VERI
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [inputText, setInputText] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Tutti');
  const [showProfile, setShowProfile] = useState(false);
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

  // 2. IL MOTORE DELLA CHAT: Scarica dal DB ogni 3 secondi!
  const fetchChats = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/get_chats?userId=${user.id}`);
      const data = await res.json();
      if (data) {
        setConversations(data);
      }
    } catch (err) {
      console.error("Errore caricamento chat:", err);
    }
  };

  // MOTORE DELLA CHAT: REAL-TIME CON PUSHER!
  useEffect(() => {
    if (user) {
      // 1. Scarica le chat all'apertura
      fetchChats(); 

      // 2. Si connette a Pusher per ascoltare i messaggi in arrivo
      const pusher = new Pusher('29ac9eeeb3352ae5b069', {
        cluster: 'eu'
      });

      const channel = pusher.subscribe('roomdate-channel');
      
      // 3. Quando Pusher dice "nuovo-messaggio", React riscarica i messaggi all'istante
      channel.bind('nuovo-messaggio', function(data) {
        fetchChats();
      });

      // Pulisce la connessione se cambi pagina
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

  // 3. INVIA IL MESSAGGIO AL VERO DATABASE
  const handleSend = async () => {
    if (!inputText.trim() || !activeConvId || !user) return;
    
    const textToSend = inputText.trim();
    setInputText(''); 
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

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
      alert("Errore nell'invio del messaggio");
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
    const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lastMsg.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="chat-page">
      {/* ── NAV ── */}
      <nav className="chat-nav">
        <Link to="/" className="logo">Room<span>Date</span></Link>
        <div className="nav-chat-actions">
          <Link to="/dashboard" className="btn-ghost">Area Riservata</Link>
        </div>
      </nav>

      {/* ── LAYOUT ── */}
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
            {filteredConvs.length === 0 ? (
              <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--wg)' }}>
                <div style={{fontSize: '3rem', marginBottom: '1rem'}}>📭</div>
                Non hai ancora nessuna conversazione attiva.
              </div>
            ) : filteredConvs.map(conv => {
              const lastMsg = conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].text : 'Nessun messaggio';
              
              return (
                <div
                  key={conv.id}
                  className={`conv-item ${conv.id === activeConvId ? 'active' : ''}`}
                  onClick={() => handleSelectConv(conv)}
                >
                  <div className="conv-avatar" style={{ background: `linear-gradient(135deg, ${conv.color1}, ${conv.color2})` }}>
                    {conv.emoji}
                  </div>
                  <div className="conv-info">
                    <div className="conv-name">{conv.name}</div>
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
                <span className="listing-pill">
                  {activeConv.listing.emoji} {activeConv.listing.title} - €{activeConv.listing.price}
                </span>
                <div className="chat-header-actions">
                  <button className="icon-btn" onClick={() => setShowProfile(!showProfile)}>👤</button>
                </div>
              </div>

              {/* Messages */}
              <div className="messages-area">
                {!activeConv.messages || activeConv.messages.length === 0 ? (
                  <div style={{textAlign: 'center', padding: '2rem', color: 'var(--wg)'}}>Invia il primo messaggio per iniziare la conversazione!</div>
                ) : (
                  activeConv.messages.map(msg => (
                    <div key={msg.id} className={`msg ${msg.type}`}>
                      {msg.type === 'received' && (
                        <div className="msg-avatar" style={{ background: `linear-gradient(135deg, ${activeConv.color1}, ${activeConv.color2})` }}>
                          {activeConv.emoji}
                        </div>
                      )}
                      <div>
                        <div className="msg-bubble">
                          {msg.text}
                        </div>
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
                  <button key={qr} className="qr-btn" onClick={() => handleQuickReply(qr)}>
                    {qr}
                  </button>
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

        {/* ── PROFILE PANEL ── */}
        {activeConv && showProfile && (
          <aside className="profile-panel visible">
            <div className="pp-header">
              <div className="pp-avatar" style={{ background: `linear-gradient(135deg, ${activeConv.color1}, ${activeConv.color2})` }}>
                {activeConv.emoji}
              </div>
              <div className="pp-name">{activeConv.name}</div>
            </div>
            <div className="pp-section">
              <h4>Annuncio d'interesse</h4>
              <div className="pp-listing">
                <span className="pl-emoji">{activeConv.listing.emoji}</span>
                <div className="pl-title">{activeConv.listing.title}</div>
                <div className="pl-price">€{activeConv.listing.price}/mese</div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}