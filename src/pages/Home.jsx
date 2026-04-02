import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]); 
  const [roommates, setRoommates] = useState([]);

  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const [isLoadingRoommates, setIsLoadingRoommates] = useState(true);
  
  useEffect(() => {
    const savedUser = localStorage.getItem('roomdate_user');
    if (savedUser) setUser(JSON.parse(savedUser));

    fetch('/api/get_listings')
      .then(res => res.json())
      .then(data => { if (data) setListings(data); })
      .catch(() => setListings([]))
      .finally(() => setIsLoadingListings(false)); // <--- Spegne il caricamento stanze

    fetch('/api/get_roommates')
      .then(res => res.json())
      .then(data => { if (data) setRoommates(data); })
      .catch(() => setRoommates([]))
      .finally(() => setIsLoadingRoommates(false)); // <--- Spegne il caricamento coinquilini
  }, []);

  return (
    <>
      {/* --- NAV --- */}
      <nav>
        <div className="logo">Room<span>Date</span></div>
        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/ricerca">Cerca Stanza</Link>
          <Link to="/chat">Chat</Link>
          <Link to="/dashboard">Profilo</Link>
          <Link to="/impostazioni">Impostazioni</Link>
        </div>
        <div className="nav-btns">
          {user ? (
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', marginRight: '0.5rem' }}>
              Ciao, <strong>{user.nome}</strong>!
            </span>
          ) : (
            <>
              <Link to="/accedi" className="btn-ghost">Accedi</Link>
              <Link to="/registrati" className="btn-fill">Registrati Gratis</Link>
            </>
          )}
        </div>
      </nav>

      {/* --- HERO --- */}
      <section className="hero">
        <div className="dot-grid"></div>
        <div className="hero-grid" style={{ gridTemplateColumns: '1fr', textAlign: 'center' }}>
          {/* Centrato e allargato visto che non c'è più il box laterale */}
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="hero-badge" style={{ display: 'inline-block' }}>🏡 Oltre 12.000 annunci attivi in Italia</div>
            <h1 className="serif">Trova la tua stanza,<br/><em>trova casa.</em></h1>
            <p style={{ margin: '0 auto' }}>Migliaia di stanze e coinquilini selezionati nelle città italiane. Senza agenzie, senza commissioni.</p>
            <div style={{ marginTop: '2rem' }}>
               <Link to="/ricerca" className="btn-fill" style={{ fontSize: '1.2rem', padding: '1rem 2rem' }}>Inizia la ricerca →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* --- STANZE IN EVIDENZA (CAROUSEL) --- */}
      <section className="listings" id="trova">
        <div className="listings-inner">
          <div className="section-eyebrow">Annunci in evidenza</div>
          <h2 className="section-h serif">Stanze selezionate per te</h2>
          
          <div className="carousel">
            {isLoadingListings ? (
              /* SKELETON PER LE STANZE */
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
                <div className="card" key={l.id}>
                  <div className="card-img" style={{ background: `linear-gradient(135deg, ${l.color}, ${l.color}88)` }}>
                    {l.emoji}
                    <span className={`card-badge ${l.avail ? 'avail' : 'busy'}`}>✅ Disponibile</span>
                    <div className="card-price"><span className="price-n">€{l.price}</span><span className="price-u">/mese</span></div>
                  </div>
                  <div className="card-body">
                    <div className="card-title">{l.title}</div>
                    <div className="card-loc">📍 {l.zone}, {l.city}</div>
                    <div className="tags">{l.tags.map(t => <span className="tag" key={t}>{t}</span>)}</div>
                    <Link 
                      to={`/dettagli/${l.id}`} 
                      className="btn-card"
                      style={{ 
                        display: 'block', 
                        textAlign: 'center', 
                        textDecoration: 'none',
                        boxSizing: 'border-box',
                        marginTop: '1rem'
                      }}
                    >
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
      <section className="roommates" id="coinquilini">
        <div className="roommates-inner">
          <div className="section-eyebrow">Profili in evidenza</div>
          <h2 className="section-h serif">Chi cerca con te</h2>
          
          <div className="carousel">
            {isLoadingRoommates ? (
              /* SKELETON PER I COINQUILINI */
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
                <div className="rm-card" key={rm.id}>
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
      <section className="how" id="come-funziona">
        <div className="how-inner">
          <div className="section-eyebrow">Come funziona</div>
          <h2 className="section-h serif">Trovare casa in 4 passi</h2>
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <span className="step-icon">📝</span>
              <h3>Crea il tuo profilo</h3>
              <p>Raccontaci di te, del tuo stile di vita e delle tue preferenze. Più sei specifico, migliori i match.</p>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <span className="step-icon">🔍</span>
              <h3>Cerca e filtra</h3>
              <p>Usa i filtri intelligenti per trovare stanze o coinquilini per budget, zona e compatibilità.</p>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <span className="step-icon">💬</span>
              <h3>Contatta direttamente</h3>
              <p>Chatta con proprietari o coinquilini senza intermediari. Nessuna agenzia, zero costi nascosti.</p>
            </div>
            <div className="step">
              <div className="step-num">04</div>
              <span className="step-icon">🏠</span>
              <h3>Benvenuto a casa!</h3>
              <p>Firma l&apos;accordo, prendi le chiavi e inizia la tua nuova convivenza. Semplice come dev&apos;essere.</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer>
        <div className="footer-inner">
          <div className="footer-grid">
            <div>
              <div className="footer-logo">Room<span>Date</span></div>
              <p className="footer-desc">Il modo più semplice per trovare stanze e coinquilini in Italia. Senza agenzie, senza stress.</p>
            </div>
            <div className="footer-col">
              <h4>Servizi</h4>
              <ul>
                <li><Link to="/ricerca">Cerca Stanza</Link></li>
                <li><Link to="/dashboard">Pubblica Annuncio</Link></li>
                <li><Link to="/ricerca?intent=coinquilino">Trova Coinquilini</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Supporto</h4>
              <ul>
                <li><a href="#come-funziona">Come Funziona</a></li>
                <li><a href="#">FAQ</a></li>
                <li><a href="#">Sicurezza</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Azienda</h4>
              <ul>
                <li><a href="#">Chi Siamo</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Lavora con Noi</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span className="footer-cr">© 2026 RoomDate. Tutti i diritti riservati.</span>
            <div className="footer-links">
              <a href="#">Privacy Policy</a>
              <a href="#">Termini di Servizio</a>
              <a href="#">Cookie</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}