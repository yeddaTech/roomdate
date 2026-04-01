import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Home.css';

export default function Home() {
  // --- STATI DELL'APP ---
  const [activeTab, setActiveTab] = useState('stanza');
  const [activeFilter, setActiveFilter] = useState('Tutte');
  
  // STATI PER L'AUTENTICAZIONE (Aggiunti!)
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  
  // Dati finti che poi sostituiremo col database
  const [listings, setListings] = useState([]); 
  const [roommates, setRoommates] = useState([]);

// Appena la Home si carica, scarichiamo tutto!
  useEffect(() => {
    // 1. Controlla il Login
    const savedUser = localStorage.getItem('roomdate_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    // 2. Scarica gli Annunci dal Database
    fetch('/api/get_listings')
      .then(res => res.json())
      .then(data => {
        if (data) setListings(data);
      })
      .catch(err => console.error("Errore caricamento stanze:", err));

    // 3. Scarica i Coinquilini dal Database
    fetch('/api/get_roommates')
      .then(res => res.json())
      .then(data => {
        if (data) setRoommates(data);
      })
      .catch(err => console.error("Errore caricamento coinquilini:", err));
  }, []);

  // Funzione per fare il logout
  const handleLogout = () => {
    localStorage.removeItem('roomdate_user');
    setUser(null);
    navigate('/');
  };

  // Logica di filtro (quando avrai i dati)
  const filteredListings = activeFilter === 'Tutte' 
    ? listings 
    : listings.filter(l => l.city === activeFilter);

  return (
    <>
      {/* NAV */}
      <nav>
        <div className="logo">Room<span>Date</span></div>
        <div className="nav-links">
          <Link to="/">Home</Link>
          <a href="#trova">Trova Stanza</a>
          <a href="#coinquilini">Cerca Coinquilini</a>
          <a href="#come-funziona">Come Funziona</a>
        </div>
        
        {/* BOTTONI NAV MODIFICATI PER IL LOGIN */}
        <div className="nav-btns">
          {user ? (
            <>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', marginRight: '0.5rem' }}>
                Ciao, <strong>{user.nome}</strong>!
              </span>
              <Link to="/dashboard" className="btn-ghost">Area Riservata</Link>
              <button onClick={handleLogout} className="btn-fill" style={{ background: '#E24B4A' }}>
                Esci
              </button>
            </>
          ) : (
            <>
              <Link to="/accedi" className="btn-ghost">Accedi</Link>
              <Link to="/registrati" className="btn-fill">Registrati Gratis</Link>
            </>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="dot-grid"></div>
        <div className="hero-grid">
          <div>
            
            {/* BADGE HERO MODIFICATO PER IL LOGIN */}
            {user ? (
              <div className="hero-badge" style={{ background: 'rgba(45, 122, 68, 0.9)', borderColor: '#4CAF50' }}>
                ✅ Sei loggato! Ora puoi usare l'app tranquillamente.
              </div>
            ) : (
              <div className="hero-badge">🏡 Oltre 12.000 annunci attivi in Italia</div>
            )}

            <h1 className="serif">Trova la tua stanza,<br/><em>trova casa.</em></h1>
            <p>Migliaia di stanze e coinquilini selezionati nelle città italiane. Senza agenzie, senza commissioni.</p>
            <div className="hero-stats">
              <div className="stat"><div className="stat-n">12K+</div><div className="stat-l">Annunci attivi</div></div>
              <div className="stat"><div className="stat-n">98%</div><div className="stat-l">Soddisfatti</div></div>
              <div className="stat"><div className="stat-n">0€</div><div className="stat-l">Commissioni</div></div>
            </div>
          </div>
          <div>
            <div className="search-box">
              <div className="tabs">
                <button 
                  className={`tab ${activeTab === 'stanza' ? 'active' : ''}`}
                  onClick={() => setActiveTab('stanza')}
                >🔍 Cerca Stanza</button>
                <button 
                  className={`tab ${activeTab === 'coinquilino' ? 'active' : ''}`}
                  onClick={() => setActiveTab('coinquilino')}
                >👥 Cerco Coinquilino</button>
              </div>
              <div className="inputs">
                <select><option value="">📍 Città</option><option>Milano</option><option>Roma</option><option>Torino</option><option>Bologna</option><option>Firenze</option><option>Napoli</option></select>
                <input type="number" placeholder="💶 Budget max €" />
                <select><option value="">🏠 Tipo stanza</option><option>Singola</option><option>Doppia</option><option>Posto letto</option></select>
                <select><option value="">📅 Disponibile da</option><option>Subito</option><option>Questo mese</option><option>Prossimo mese</option></select>
              </div>
              <button className="btn-search">Cerca Stanze Disponibili →</button>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAND */}
      <div className="trust">
        <div className="trust-item"><div className="trust-dot"></div>Profili verificati</div>
        <div className="trust-item"><div className="trust-dot"></div>Chat sicura integrata</div>
        <div className="trust-item"><div className="trust-dot"></div>Zero commissioni agenzie</div>
        <div className="trust-item"><div className="trust-dot"></div>4.9/5 · 2.400+ recensioni</div>
        <div className="trust-item"><div className="trust-dot"></div>Annunci aggiornati in tempo reale</div>
      </div>

      {/* LISTINGS */}
      <section className="listings" id="trova">
        <div className="listings-inner">
          <div className="section-eyebrow">Annunci in evidenza</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <h2 className="section-h serif" style={{ marginBottom: 0 }}>Stanze selezionate per te</h2>
            <div className="filters">
              {['Tutte', 'Milano', 'Roma', 'Torino', 'Bologna', 'Firenze'].map(city => (
                <button 
                  key={city}
                  className={`filter-btn ${activeFilter === city ? 'active' : ''}`} 
                  onClick={() => setActiveFilter(city)}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>
          
          <div className="grid-3">
            {/* Se non ci sono dati, mostriamo un messaggio */}
            {filteredListings.length === 0 ? (
              <p style={{ color: 'var(--wg)' }}>Nessun annuncio trovato. In attesa del database...</p>
            ) : (
              filteredListings.map(l => (
                <div className="card" key={l.id}>
                  <div className="card-img" style={{ background: `linear-gradient(135deg, ${l.color}, ${l.color}88)` }}>
                    {l.emoji}
                    <span className={`card-badge ${l.avail ? 'avail' : 'busy'}`}>
                      {l.avail ? '✅ Disponibile' : '⏳ Occupata'}
                    </span>
                    <div className="card-price"><span className="price-n">€{l.price}</span><span className="price-u">/mese</span></div>
                  </div>
                  <div className="card-body">
                    <div className="card-title">{l.title}</div>
                    <div className="card-loc">📍 {l.zone}, {l.city}</div>
                    <div className="tags">
                      {l.tags.map(t => <span className="tag" key={t}>{t}</span>)}
                    </div>
                    <button className="btn-card">Vedi dettagli</button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="listings-cta">
            <button className="btn-fill" style={{ padding: '.85rem 2.5rem', fontSize: '.95rem' }}>Vedi tutti gli annunci →</button>
          </div>
        </div>
      </section>

      {/* COINQUILINI */}
      <section className="roommates" id="coinquilini">
        <div className="roommates-inner">
          <div className="section-eyebrow">Profili coinquilini</div>
          <h2 className="section-h serif">Chi cerca con te</h2>
          <div className="grid-4">
            {roommates.length === 0 ? (
              <p style={{ color: 'var(--wg)' }}>Nessun coinquilino trovato. In attesa del database...</p>
            ) : (
              roommates.map(rm => (
                <div className="rm-card" key={rm.id}>
                  <div className="rm-avatar" style={{ background: `linear-gradient(135deg, ${rm.color1}, ${rm.color2})` }}>{rm.emoji}</div>
                  <div className="rm-name">{rm.name}</div>
                  <div className="rm-meta">{rm.age} anni · {rm.job} · {rm.city}</div>
                  <div className="rm-quote">"{rm.quote}"</div>
                  <div className="tags">
                    {rm.tags.map(t => <span className="tag" key={t}>{t}</span>)}
                  </div>
                  <div className="match-bar"><div className="match-fill" style={{ width: `${rm.match}%` }}></div></div>
                  <div className="match-label">{rm.match}% compatibile</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
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
              <p>Firma l'accordo, prendi le chiavi e inizia la tua nuova convivenza. Semplice come dev'essere.</p>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonials">
        <div className="testimonials-inner">
          <div className="section-eyebrow">Testimonianze</div>
          <h2 className="section-h serif">Cosa dicono i nostri utenti</h2>
          <div className="grid-3-t">
            <div className="t-card">
              <div className="stars">★★★★★</div>
              <p className="t-text">"Ho trovato la stanza perfetta in meno di una settimana! Il sistema di filtri è comodissimo e la chat con il proprietario è stata subito aperta."</p>
              <div className="t-author">
                <div className="t-av" style={{ background: 'linear-gradient(135deg, #F5C29A, #C4603A)' }}>👩</div>
                <div><div className="t-name">Giulia M.</div><div className="t-sub">24 anni · Milano</div></div>
              </div>
            </div>
            <div className="t-card">
              <div className="stars">★★★★★</div>
              <p className="t-text">"Ho trovato due coinquilini fantastici con cui condivido da 8 mesi. Zero agenzie, zero commissioni. RoomDate mi ha davvero sorpreso."</p>
              <div className="t-author">
                <div className="t-av" style={{ background: 'linear-gradient(135deg, #C4A882, #7A4B2A)' }}>👨</div>
                <div><div className="t-name">Lorenzo B.</div><div className="t-sub">28 anni · Roma</div></div>
              </div>
            </div>
            <div className="t-card">
              <div className="stars">★★★★★</div>
              <p className="t-text">"Per una studentessa fuori sede è stato essenziale. Profili verificati, prezzi chiari e ho fatto un tour virtuale prima di visitare la stanza."</p>
              <div className="t-author">
                <div className="t-av" style={{ background: 'linear-gradient(135deg, #D4B896, #9A4628)' }}>👩‍🎓</div>
                <div><div className="t-name">Sara K.</div><div className="t-sub">22 anni · Bologna</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <div className="cta-banner">
        <div className="cta-inner">
          <div style={{ position: 'relative', zIndex: 2 }}>
            <h2 className="cta-h serif">Pronto a trovare la tua prossima casa?</h2>
            <p className="cta-p">Registrazione gratuita. Nessuna carta di credito richiesta.</p>
          </div>
          <Link to="/registrati"><button className="btn-cta">Inizia ora — è gratis 🚀</button></Link>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div className="footer-grid">
            <div>
              <div className="footer-logo">Room<span>Date</span></div>
              <p className="footer-desc">Il modo più semplice per trovare stanze e coinquilini in Italia. Senza agenzie, senza stress.</p>
              <div className="socials">
                <button className="social-btn">f</button>
                <button className="social-btn">in</button>
                <button className="social-btn">ig</button>
                <button className="social-btn">tw</button>
              </div>
            </div>
            <div className="footer-col">
              <h4>Servizi</h4>
              <ul>
                <li><a href="#trova">Cerca Stanza</a></li>
                <li><Link to="/accedi">Pubblica Annuncio</Link></li>
                <li><a href="#coinquilini">Trova Coinquilini</a></li>
                <li><a href="#">Mappa Interattiva</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Supporto</h4>
              <ul>
                <li><a href="#come-funziona">Come Funziona</a></li>
                <li><a href="#">FAQ</a></li>
                <li><a href="#">Sicurezza</a></li>
                <li><a href="#">Contattaci</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Azienda</h4>
              <ul>
                <li><a href="#">Chi Siamo</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Lavora con Noi</a></li>
                <li><a href="#">Press Kit</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span className="footer-cr">© 2025 RoomDate. Tutti i diritti riservati.</span>
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