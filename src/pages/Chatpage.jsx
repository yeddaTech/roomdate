import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Chatpage.css';

// ─── Dati mock ───────────────────────────────────────────────────────────────
const CONVERSATIONS = [
  {
    id: 1,
    name: 'Giulia M.',
    emoji: '👩',
    color1: '#F5C29A', color2: '#C4603A',
    city: 'Milano',
    job: 'Designer',
    age: 26,
    listing: { emoji: '🏠', title: 'Singola Navigli – Bilocale', price: 520, city: 'Milano', zone: 'Via Corsico' },
    online: true,
    lastMsg: 'Certo! Possiamo vederci domani mattina.',
    time: '10:32',
    unread: 2,
    tags: ['🚭 Non fumatore', '🧹 Ordinato', '🎉 Socievole'],
    messages: [
      { id: 1, type: 'received', text: 'Ciao! Ho visto il tuo annuncio per la singola ai Navigli. È ancora disponibile?', time: '10:15' },
      { id: 2, type: 'sent', text: 'Ciao Giulia! Sì, è ancora libera 😊 Vuoi sapere qualcosa di più sulla stanza?', time: '10:18' },
      { id: 3, type: 'received', text: 'Sì! Vorrei sapere se include le spese e se c\'è posto per la bici.', time: '10:22' },
      { id: 4, type: 'sent', text: 'Le spese sono incluse fino a 80€/mese. Per la bici abbiamo un piccolo locale al piano terra, perfetto!', time: '10:25' },
      { id: 5, type: 'listing', listing: { emoji: '🏠', title: 'Singola Navigli – Bilocale', price: 520, city: 'Milano', zone: 'Via Corsico' }, time: '10:26' },
      { id: 6, type: 'received', text: 'Ottimo! Potremmo organizzare una visita questa settimana?', time: '10:29' },
      { id: 7, type: 'sent', text: 'Certo! Sono disponibile giovedì pomeriggio o venerdì mattina. Quale preferisci?', time: '10:31' },
      { id: 8, type: 'received', text: 'Certo! Possiamo vederci domani mattina.', time: '10:32' },
    ]
  },
  {
    id: 2,
    name: 'Marco T.',
    emoji: '👨',
    color1: '#A8D8EA', color2: '#4A90D9',
    city: 'Bologna',
    job: 'Ingegnere',
    age: 29,
    listing: { emoji: '🏢', title: 'Doppia Bologna Centro', price: 380, city: 'Bologna', zone: 'Zona Universitaria' },
    online: false,
    lastMsg: 'Ti mando i dettagli sul contratto.',
    time: 'Ieri',
    unread: 0,
    tags: ['📚 Studente-lav.', '🚭 Non fumatore', '🐱 Ho un gatto'],
    messages: [
      { id: 1, type: 'received', text: 'Buongiorno! Ho visto che stai cercando un posto a Bologna.', time: 'Ieri 09:00' },
      { id: 2, type: 'sent', text: 'Sì esatto! La tua stanza mi sembra perfetta per il periodo del master.', time: 'Ieri 09:05' },
      { id: 3, type: 'received', text: 'Ti mando i dettagli sul contratto.', time: 'Ieri 09:30' },
    ]
  },
  {
    id: 3,
    name: 'Sara V.',
    emoji: '👱‍♀️',
    color1: '#C8E6C9', color2: '#2D7A44',
    city: 'Torino',
    job: 'Studentessa',
    age: 23,
    listing: { emoji: '🛋️', title: 'Posto letto doppia – Poli', price: 280, city: 'Torino', zone: 'Corso Duca' },
    online: true,
    lastMsg: 'Perfetto, ci vediamo alle 18!',
    time: 'Mer',
    unread: 0,
    tags: ['🎓 Studentessa', '🥦 Vegana', '🎵 Musicista'],
    messages: [
      { id: 1, type: 'sent', text: 'Ciao Sara! Sono interessata al posto letto nella doppia.', time: 'Mer 16:00' },
      { id: 2, type: 'received', text: 'Ciao! Sì, è disponibile da novembre. Vuoi fare una videochiamata?', time: 'Mer 16:15' },
      { id: 3, type: 'sent', text: 'Certo! Sono libera oggi pomeriggio dalle 17 in poi.', time: 'Mer 16:20' },
      { id: 4, type: 'received', text: 'Perfetto, ci vediamo alle 18!', time: 'Mer 16:22' },
    ]
  },
  {
    id: 4,
    name: 'Luca B.',
    emoji: '🧔',
    color1: '#FFD3B6', color2: '#E67E22',
    city: 'Roma',
    job: 'Freelancer',
    age: 31,
    listing: { emoji: '🏡', title: 'Monolocale – Trastevere', price: 750, city: 'Roma', zone: 'Trastevere' },
    online: false,
    lastMsg: 'Grazie per l\'interesse! A presto.',
    time: 'Lun',
    unread: 0,
    tags: ['💻 Remote', '🚭 Non fumatore', '🏋️ Sportivo'],
    messages: [
      { id: 1, type: 'received', text: 'Buonasera! Ho visto che sei interessato al monolocale.', time: 'Lun 20:00' },
      { id: 2, type: 'sent', text: 'Sì, è in una zona fantastica! Quando è libero?', time: 'Lun 20:10' },
      { id: 3, type: 'received', text: 'Da fine ottobre. Posso mandarti qualche foto in più se vuoi.', time: 'Lun 20:12' },
      { id: 4, type: 'sent', text: 'Sì please! Specialmente del bagno e della cucina.', time: 'Lun 20:15' },
      { id: 5, type: 'received', text: 'Grazie per l\'interesse! A presto.', time: 'Lun 20:30' },
    ]
  },
];

const QUICK_REPLIES = [
  '📅 Quando sei disponibile?',
  '🏠 Posso visitarla?',
  '💶 Spese incluse?',
  '📝 Contratto breve termine?',
  '🚇 Linea metro vicina?',
];

export default function ChatPage() {
  const [conversations, setConversations] = useState(CONVERSATIONS);
  const [activeConvId, setActiveConvId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Tutti');
  const [showProfile, setShowProfile] = useState(false);
  const [mobileView, setMobileView] = useState('list'); 

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const activeConv = conversations.find(c => c.id === activeConvId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages]);

  const handleTextareaChange = (e) => {
    setInputText(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  const handleSelectConv = (conv) => {
    setActiveConvId(conv.id);
    setMobileView('chat');
    setConversations(prev =>
      prev.map(c => c.id === conv.id ? { ...c, unread: 0 } : c)
    );
    if (conv.online) {
      setTimeout(() => {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 2800);
      }, 2000);
    }
  };

  const handleSend = () => {
    if (!inputText.trim() || !activeConvId) return;
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newMsg = {
      id: Date.now(),
      type: 'sent',
      text: inputText.trim(),
      time: timeStr,
    };

    setConversations(prev =>
      prev.map(c => {
        if (c.id !== activeConvId) return c;
        return {
          ...c,
          messages: [...c.messages, newMsg],
          lastMsg: inputText.trim(),
          time: timeStr,
        };
      })
    );
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    if (activeConv?.online) {
      setTimeout(() => {
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          const replies = [
            'Capito, grazie per le info! 😊',
            'Ok perfetto! Ti scrivo domani per confermare.',
            'Ottimo, mi sembra tutto chiaro.',
            'Va bene! Ci aggiorniamo presto.',
          ];
          const replyMsg = {
            id: Date.now() + 1,
            type: 'received',
            text: replies[Math.floor(Math.random() * replies.length)],
            time: timeStr,
          };
          setConversations(prev =>
            prev.map(c => c.id === activeConvId
              ? { ...c, messages: [...c.messages, replyMsg], lastMsg: replyMsg.text, time: timeStr }
              : c
            )
          );
        }, 2500);
      }, 800);
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
    const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMsg.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter =
      activeFilter === 'Tutti' ? true :
      activeFilter === 'Non letti' ? c.unread > 0 :
      activeFilter === 'Online' ? c.online : true;
    return matchSearch && matchFilter;
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  return (
    <div className="chat-page">

      {/* ── NAV ── */}
      <nav className="chat-nav">
        <Link to="/" className="logo">Room<span>Date</span></Link>
        <div className="nav-chat-title">
          <span></span>
          {conversations.filter(c => c.online).length} contatti online
        </div>
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
              {totalUnread > 0 && <span className="badge">{totalUnread} nuovi</span>}
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

          <div className="sidebar-filter">
            {['Tutti', 'Non letti', 'Online'].map(f => (
              <button
                key={f}
                className={`filter-pill ${activeFilter === f ? 'active' : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="conv-list">
            {filteredConvs.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--wg)', fontSize: '0.85rem' }}>
                Nessuna conversazione trovata
              </div>
            ) : filteredConvs.map(conv => (
              <div
                key={conv.id}
                className={`conv-item ${conv.id === activeConvId ? 'active' : ''} ${conv.unread > 0 ? 'unread' : ''}`}
                onClick={() => handleSelectConv(conv)}
              >
                <div
                  className="conv-avatar"
                  style={{ background: `linear-gradient(135deg, ${conv.color1}, ${conv.color2})` }}
                >
                  {conv.emoji}
                  {conv.online && <span className="online-dot"></span>}
                </div>
                <div className="conv-info">
                  <div className="conv-name">{conv.name}</div>
                  <div className="conv-preview">
                    {conv.id === activeConvId && isTyping ? '⌨️ sta scrivendo...' : conv.lastMsg}
                  </div>
                </div>
                <div className="conv-meta">
                  <span className="conv-time">{conv.time}</span>
                  {conv.unread > 0 && (
                    <span className="conv-unread-badge">{conv.unread}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ── CHAT MAIN ── */}
        <main className={`chat-main ${mobileView === 'chat' ? 'mobile-show' : ''}`}>

          {!activeConv ? (
            <div className="chat-empty">
              <div className="empty-icon">💬</div>
              <h3>Nessuna chat selezionata</h3>
              <p>Scegli una conversazione dalla lista per iniziare a chattare con proprietari o coinquilini.</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="chat-header">
                <button
                  className="back-btn-mobile"
                  onClick={() => setMobileView('list')}
                >
                  ←
                </button>
                <div
                  className="chat-header-avatar"
                  style={{ background: `linear-gradient(135deg, ${activeConv.color1}, ${activeConv.color2})` }}
                >
                  {activeConv.emoji}
                  {activeConv.online && <span className="online-dot"></span>}
                </div>
                <div className="chat-header-info">
                  <h3>{activeConv.name}</h3>
                  <p>
                    {activeConv.online
                      ? <span className="status-online">● Online ora</span>
                      : `${activeConv.age} anni · ${activeConv.job} · ${activeConv.city}`
                    }
                  </p>
                </div>
                <span className="listing-pill">
                  {activeConv.listing.emoji} {activeConv.listing.title}
                </span>
                <div className="chat-header-actions">
                  <button
                    className="icon-btn"
                    title="Info profilo"
                    onClick={() => setShowProfile(!showProfile)}
                  >
                    👤
                  </button>
                  <button className="icon-btn" title="Chiama">📞</button>
                </div>
              </div>

              {/* Messages */}
              <div className="messages-area">
                <div className="date-sep"><span>Oggi</span></div>

                {activeConv.messages.map(msg => {
                  if (msg.type === 'listing') {
                    return (
                      <div key={msg.id} className="msg received">
                        <div
                          className="msg-avatar"
                          style={{ background: `linear-gradient(135deg, ${activeConv.color1}, ${activeConv.color2})` }}
                        >
                          {activeConv.emoji}
                        </div>
                        <div>
                          <div className="listing-card-msg">
                            <span className="lc-emoji">{msg.listing.emoji}</span>
                            <div className="lc-title">{msg.listing.title}</div>
                            <div className="lc-price">€{msg.listing.price}/mese</div>
                            <div className="lc-loc">📍 {msg.listing.zone}, {msg.listing.city}</div>
                          </div>
                          <div className="msg-time">{msg.time}</div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`msg ${msg.type}`}>
                      {msg.type === 'received' && (
                        <div
                          className="msg-avatar"
                          style={{ background: `linear-gradient(135deg, ${activeConv.color1}, ${activeConv.color2})` }}
                        >
                          {activeConv.emoji}
                        </div>
                      )}
                      <div>
                        <div className="msg-bubble">
                          {msg.text}
                          {msg.type === 'sent' && <span className="msg-status"> ✓✓</span>}
                        </div>
                        <div className="msg-time">{msg.time}</div>
                      </div>
                    </div>
                  );
                })}

                {isTyping && (
                  <div className="msg received typing-indicator">
                    <div
                      className="msg-avatar"
                      style={{ background: `linear-gradient(135deg, ${activeConv.color1}, ${activeConv.color2})` }}
                    >
                      {activeConv.emoji}
                    </div>
                    <div className="typing-dots">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
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
                <div className="input-actions-left">
                  <button className="attach-btn" title="Allega foto">📷</button>
                  <button className="attach-btn" title="Manda annuncio">🏠</button>
                </div>
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
                <button
                  className="send-btn"
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  title="Invia"
                >
                  ➤
                </button>
              </div>
            </>
          )}
        </main>

        {/* ── PROFILE PANEL ── */}
        {activeConv && showProfile && (
          <aside className="profile-panel visible">
            <div className="pp-header">
              <div
                className="pp-avatar"
                style={{ background: `linear-gradient(135deg, ${activeConv.color1}, ${activeConv.color2})` }}
              >
                {activeConv.emoji}
              </div>
              <div className="pp-name">{activeConv.name}</div>
              <div className="pp-sub">{activeConv.age} anni · {activeConv.job}</div>
            </div>

            <div className="pp-section">
              <h4>Dettagli</h4>
              <div className="pp-stat"><span>Città</span><strong>{activeConv.city}</strong></div>
              <div className="pp-stat"><span>Professione</span><strong>{activeConv.job}</strong></div>
              <div className="pp-stat">
                <span>Stato</span>
                <strong style={{ color: activeConv.online ? '#4CAF50' : 'var(--wg)' }}>
                  {activeConv.online ? '● Online' : 'Offline'}
                </strong>
              </div>
            </div>

            <div className="pp-section">
              <h4>Annuncio</h4>
              <div className="pp-listing">
                <span className="pl-emoji">{activeConv.listing.emoji}</span>
                <div className="pl-title">{activeConv.listing.title}</div>
                <div className="pl-price">€{activeConv.listing.price}/mese</div>
              </div>
            </div>

            <div className="pp-section">
              <h4>Stile di vita</h4>
              <div className="pp-tags">
                {activeConv.tags.map(t => (
                  <span key={t} className="pp-tag">{t}</span>
                ))}
              </div>
            </div>

            <div className="pp-section">
              <button className="btn-report">🚩 Segnala profilo</button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}