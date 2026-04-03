import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]); 
  const [roommates, setRoommates] = useState([]);
  
  // Stati per caricamento e menu mobile
  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const [isLoadingRoommates, setIsLoadingRoommates] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  useEffect(() => {
    const savedUser = localStorage.getItem('roomdate_user');
    if (savedUser) setUser(JSON.parse(savedUser));

    fetch('/api/get_listings')
      .then(res => res.json())
      .then(data => { if (data) setListings(data); })
      .catch(() => setListings([]))
      .finally(() => setIsLoadingListings(false));

    fetch('/api/get_roommates')
      .then(res => res.json())
      .then(data => { if (data) setRoommates(data); })
      .catch(() => setRoommates([]))
      .finally(() => setIsLoadingRoommates(false));
  }, []);

  // Funzione di Logout
  const handleLogout = () => {
    localStorage.removeItem('roomdate_user');
    setUser(null);
    setIsMenuOpen(false); // Chiude il menu se è aperto da mobile
    navigate('/'); // Riporta alla home in modo pulito
  };

  return (
    <div className="home-container">
      {/* --- TOP NAV --- */}
      <nav className="topnav">
        <div className="logo">Room<span>Date</span></div>
        
        {/* Desktop Links */}
        <div className="nav-links desktop-only">
          <Link to="/">Home</Link>
          <Link to="/ricerca">Cerca Stanza</Link>
          <Link to="/chat">Chat</Link>
          <Link to="/dashboard">Profilo</Link>
          <Link to="/impostazioni">Impostazioni</Link>
        </div>

        {/* Desktop Buttons */}
        <div className="nav-btns desktop-only">
          {user ? (
            <>
              <span className="user-greeting" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', marginRight: '1rem' }}>
                Ciao, <strong>{user.nome}</strong>!
              </span>
              <button onClick={handleLogout} className="btn-ghost" style={{ cursor: 'pointer' }}>Esci</button>
            </>
          ) : (
            <>
              <Link to="/accedi" className="btn-ghost">Accedi</Link>
              <Link to="/registrati" className="btn-fill">Registrati</Link>
            </>
          )}
        </div>

        {/* Hamburger Icon (Mobile) */}
        <div className="hamburger mobile-only" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <div className={`line ${isMenuOpen ? 'open' : ''}`}></div>
          <div className={`line ${isMenuOpen ? 'open' : ''}`}></div>
          <div className={`line ${isMenuOpen ? 'open' : ''}`}></div>
        </div>
      </nav>

      {/* --- MOBILE SIDEBAR MENU --- */}
      <div className={`mobile-menu ${isMenuOpen ? 'active' : ''}`}>
        <div className="mobile-menu-content">
          {user ? (
            <div className="mobile-user-info">
              <div style={{ fontSize: '2rem' }}>👤</div>
              <h3>Ciao, {user.nome}!</h3>
            </div>
          ) : null}
          <Link to="/" onClick={() => setIsMenuOpen(false)}>🏠 Home</Link>
          <Link to="/ricerca" onClick={() => setIsMenuOpen(false)}>🔍 Cerca Stanza</Link>
          <Link to="/chat" onClick={() => setIsMenuOpen(false)}>💬 Chat</Link>
          <Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>👤 Il mio Profilo</Link>
          <Link to="/impostazioni" onClick={() => setIsMenuOpen(false)}>⚙️ Impostazioni</Link>
          
          <div className="mobile-menu-footer">
            {user ? (
              <button onClick={handleLogout} className="btn-fill w-100" style={{ marginTop: '1rem' }}>Esci dall'account</button>
            ) : (
              <>
                <Link to="/accedi" className="btn-ghost w-100" onClick={() => setIsMenuOpen(false)}>Accedi</Link>
                <Link to="/registrati" className="btn-fill w-100" onClick={() => setIsMenuOpen(false)} style={{ marginTop: '0.5rem' }}>Registrati</Link>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Overlay per cliccare fuori dal menu e chiuderlo */}
      {isMenuOpen && <div className="menu-overlay" onClick={() => setIsMenuOpen(false)}></div>}

      {/* --- BOTTOM NAV (Mobile) --- */}
      <nav className="bottom-nav mobile-only">
        <div className="bottom-nav__inner">
          <Link to="/" className="bottom-nav__item active">
            <span className="bottom-nav__icon">🏠</span>
            <span className="bottom-nav__label">Home</span>
          </Link>
          <Link to="/ricerca" className="bottom-nav__item">
            <span className="bottom-nav__icon">🔍</span>
            <span className="bottom-nav__label">Cerca</span>
          </Link>
          <Link to="/chat" className="bottom-nav__item">
            <span className="bottom-nav__icon">💬</span>
            <span className="bottom-nav__label">Chat</span>
          </Link>
          <Link to="/dashboard" className="bottom-nav__item">
            <span className="bottom-nav__icon">👤</span>
            <span className="bottom-nav__label">Profilo</span>
          </Link>
        </div>
      </nav>

      {/* --- HERO --- */}
      <section className="hero fade-in-up">
        <div className="dot-grid"></div>
        <div className="hero-grid" style={{ gridTemplateColumns: '1fr', textAlign: 'center' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <div className="hero-badge hover-float" style={{ display: 'inline-block' }}>🏡 Oltre 12.000 annunci attivi in Italia</div>
            <h1 className="serif title-animate">Trova la tua stanza,<br/><em>trova casa.</em></h1>
            <p className="hero-sub" style={{ margin: '0 auto' }}>Migliaia di stanze e coinquilini selezionati nelle città italiane. Senza agenzie, senza commissioni.</p>
            <div className="hero-ctas" style={{ marginTop: '2rem' }}>
               <Link to="/ricerca" className="btn-fill cta-primary pulse-btn" style={{ fontSize: '1.2rem', padding: '1rem 2rem' }}>Inizia la ricerca →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* --- STANZE IN EVIDENZA (CAROUSEL) --- */}
      <section className="listings fade-in-up delay-1" id="trova">
        <div className="listings-inner">
          <div className="section-eyebrow">Annunci in evidenza</div>
          <h2 className="section-h serif">Stanze selezionate per te</h2>
          
          <div className="carousel mobile-snap-grid">
            {isLoadingListings ? (
              [1, 2, 3, 4].map((n) => (
                <div className="card" key={`skel-list-${n}`} style={{ height: '360px', display: 'flex', flexDirection: 'column', flex: '0 0 auto', width: '280px' }}>
                  <div className="skeleton-box" style={{ height: '180px', width: '100%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}></div>
                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
                    <div className="skeleton-box" style={{ height: '24px', width: '80%' }}></div>
                    <div className="skeleton-box" style={{ height: '16px', width: '50%' }}></div>
                    <div className="skeleton-box" style={{ height: '40px', width: '100%', marginTop: 'auto', borderRadius: '2rem' }}></div>
                  </div>
                </div>
              ))
            ) : listings.length === 0 ? (
              <p style={{color: 'var(--wg)'}}>Nessuna stanza caricata al momento.</p>
            ) : (
              listings.map(l => (
                <div className="card snap-item card-hover" key={l.id}>
                  <div className="card-img" style={{ background: `linear-gradient(135deg, ${l.color}, ${l.color}88)` }}>
                    {l.emoji}
                    <span className={`card-badge ${l.avail ? 'avail' : 'busy'}`}>✅ Disponibile</span>
                    <div className="card-price"><span className="price-n">€{l.price}</span><span className="price-u">/mese</span></div>
                  </div>
                  <div className="card-body">
                    <div className="card-title">{l.title}</div>
                    <div className="card-loc">📍 {l.zone}, {l.city}</div>
                    <div className="tags">{l.tags.map(t => <span className="tag" key={t}>{t}</span>)}</div>
                    <Link to={`/dettagli/${l.id}`} className="btn-card" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box', marginTop: '1rem' }}>
                      Vedi dettagli
                    </Link>                
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* --- COINQUILINI IN EVIDENZA (CAROUSEL) --- */}
      <section className="roommates fade-in-up delay-2" id="coinquilini">
        <div className="roommates-inner">
          <div className="section-eyebrow">Profili in evidenza</div>
          <h2 className="section-h serif">Chi cerca con te</h2>
          
          <div className="carousel mobile-snap-grid">
            {isLoadingRoommates ? (
              [1, 2, 3, 4].map((n) => (
                <div className="rm-card" key={`skel-rm-${n}`} style={{ height: '280px', flex: '0 0 auto', width: '250px' }}>
                  <div className="skeleton-box" style={{ width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 1rem auto' }}></div>
                  <div className="skeleton-box" style={{ height: '20px', width: '60%', margin: '0 auto 0.5rem auto' }}></div>
                  <div className="skeleton-box" style={{ height: '14px', width: '80%', margin: '0 auto 1rem auto' }}></div>
                  <div className="skeleton-box" style={{ height: '12px', width: '90%', margin: '0 auto 1.5rem auto' }}></div>
                  <div className="skeleton-box" style={{ height: '8px', width: '100%', borderRadius: '4px', marginTop: 'auto' }}></div>
                </div>
              ))
            ) : roommates.length === 0 ? (
              <p style={{color: 'var(--wg)'}}>Nessun profilo caricato al momento.</p>
            ) : (
              roommates.map(rm => (
                <div className="rm-card snap-item card-hover" key={rm.id}>
                  <div className="rm-avatar" style={{ background: `linear-gradient(135deg, ${rm.color1}, ${rm.color2})` }}>{rm.emoji}</div>
                  <div className="rm-name">{rm.name}</div>
                  <div className="rm-meta">{rm.age} anni · {rm.job} · {rm.city}</div>
                  <div className="rm-quote">"{rm.quote}"</div>
                  <div className="tags">{rm.tags.map(t => <span className="tag" key={t}>{t}</span>)}</div>
                  <div className="match-bar"><div className="match-fill" style={{ width: `${rm.match}%` }}></div></div>
                  <div className="match-label">{rm.match}% compatibile</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS --- */}
      <section className="how fade-in-up delay-3" id="come-funziona">
        {/* ... (Lascia il contenuto originale intatto qui) ... */}
        <div className="how-inner">
          <div className="section-eyebrow">Come funziona</div>
          <h2 className="section-h serif">Trovare casa in 4 passi</h2>
          <div className="steps">
            <div className="step card-hover">
              <div className="step-num">01</div>
              <span className="step-icon">📝</span>
              <h3>Crea il tuo profilo</h3>
              <p>Raccontaci di te, del tuo stile di vita e delle tue preferenze. Più sei specifico, migliori i match.</p>
            </div>
            <div className="step card-hover">
              <div className="step-num">02</div>
              <span className="step-icon">🔍</span>
              <h3>Cerca e filtra</h3>
              <p>Usa i filtri intelligenti per trovare stanze o coinquilini per budget, zona e compatibilità.</p>
            </div>
            <div className="step card-hover">
              <div className="step-num">03</div>
              <span className="step-icon">💬</span>
              <h3>Contatta direttamente</h3>
              <p>Chatta con proprietari o coinquilini senza intermediari. Nessuna agenzia, zero costi nascosti.</p>
            </div>
            <div className="step card-hover">
              <div className="step-num">04</div>
              <span className="step-icon">🏠</span>
              <h3>Benvenuto a casa!</h3>
              <p>Firma l'accordo, prendi le chiavi e inizia la tua nuova convivenza. Semplice come dev'essere.</p>
            </div>
          </div>
        </div>
      </section>

          <div className="footer-bottom">
            <span className="footer-cr">© 2026 RoomDate. Tutti i diritti riservati.</span>
            <div className="footer-links">
              <a href="#">Privacy Policy</a>
              <a href="#">Termini di Servizio</a>
              <a href="#">Cookie</a>
            </div>
          </div>
    </div>
  );
}

