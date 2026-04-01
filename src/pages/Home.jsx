import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]); 
  const [roommates, setRoommates] = useState([]);

  // --- STATI PER LA RICERCA ---
  const [searchIntent, setSearchIntent] = useState('stanza');
  const [searchCity, setSearchCity] = useState('');
  const [searchBudget, setSearchBudget] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('roomdate_user');
    if (savedUser) setUser(JSON.parse(savedUser));

    fetch('/api/get_listings')
      .then(res => res.json())
      .then(data => { if (data) setListings(data); })
      .catch(() => setListings([]));

    fetch('/api/get_roommates')
      .then(res => res.json())
      .then(data => { if (data) setRoommates(data); })
      .catch(() => setRoommates([]));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('roomdate_user');
    setUser(null);
    navigate('/');
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    params.append('intent', searchIntent);
    if (searchCity) params.append('citta', searchCity);
    if (searchBudget) params.append('budget', searchBudget);
    navigate(`/ricerca?${params.toString()}`);
  };

  return (
    <>
      {/* --- NAV --- */}
      <nav>
        <div className="logo">Room<span>Date</span></div>
        <div className="nav-links">
          <Link to="/">Home</Link>
          <a href="#trova">Trova Stanza</a>
          <a href="#coinquilini">Cerca Coinquilini</a>
        </div>
        <div className="nav-btns">
          {user ? (
            <>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', marginRight: '0.5rem' }}>
                Ciao, <strong>{user.nome}</strong>!
              </span>
              <Link to="/dashboard" className="btn-ghost">Area Riservata</Link>
              <button onClick={handleLogout} className="btn-fill" style={{ background: '#E24B4A' }}>Esci</button>
            </>
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
        <div className="hero-grid">
          <div>
            {user ? (
              <div className="hero-badge" style={{ background: 'rgba(45, 122, 68, 0.9)', borderColor: '#4CAF50' }}>✅ Sei loggato! Ora puoi usare l'app tranquillamente.</div>
            ) : (
              <div className="hero-badge">🏡 Oltre 12.000 annunci attivi in Italia</div>
            )}
            <h1 className="serif">Trova la tua stanza,<br/><em>trova casa.</em></h1>
            <p>Migliaia di stanze e coinquilini selezionati nelle città italiane. Senza agenzie, senza commissioni.</p>
          </div>
          <div>
            <div className="search-box">
              <div className="tabs">
                <button className={`tab ${searchIntent === 'stanza' ? 'active' : ''}`} onClick={() => setSearchIntent('stanza')}>🔍 Cerca Stanza</button>
                <button className={`tab ${searchIntent === 'coinquilino' ? 'active' : ''}`} onClick={() => setSearchIntent('coinquilino')}>👥 Cerco Coinquilino</button>
              </div>
              <div className="inputs">
                <select value={searchCity} onChange={(e) => setSearchCity(e.target.value)}>
                  <option value="">📍 Città (Tutte)</option>
                  <option value="Milano">Milano</option>
                  <option value="Roma">Roma</option>
                  <option value="Bologna">Bologna</option>
                  <option value="Torino">Torino</option>
                </select>
                <input 
                  type="number" 
                  placeholder="💶 Budget max €" 
                  value={searchBudget}
                  onChange={(e) => setSearchBudget(e.target.value)}
                />
              </div>
              <button className="btn-search" onClick={handleSearch}>Cerca Subito →</button>
            </div>
          </div>
        </div>
      </section>

      {/* --- TRUST BAND --- */}
      <div className="trust">
        <div className="trust-item"><div className="trust-dot"></div>Profili verificati</div>
        <div className="trust-item"><div className="trust-dot"></div>Chat sicura integrata</div>
        <div className="trust-item"><div className="trust-dot"></div>Zero commissioni agenzie</div>
        <div className="trust-item"><div className="trust-dot"></div>4.9/5 · 2.400+ recensioni</div>
      </div>

      {/* --- STANZE IN EVIDENZA (CAROUSEL) --- */}
      <section className="listings" id="trova">
        <div className="listings-inner">
          <div className="section-eyebrow">Annunci in evidenza</div>
          <h2 className="section-h serif">Stanze selezionate per te</h2>
          
          <div className="carousel">
            {listings.length === 0 ? <p style={{color: 'var(--wg)'}}>Nessuna stanza caricata al momento.</p> : listings.map(l => (
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
                    </Link>                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- COINQUILINI IN EVIDENZA (CAROUSEL) --- */}
      <section className="roommates" id="coinquilini">
        <div className="roommates-inner">
          <div className="section-eyebrow">Profili in evidenza</div>
          <h2 className="section-h serif">Chi cerca con te</h2>
          
          <div className="carousel">
            {roommates.length === 0 ? <p style={{color: 'var(--wg)'}}>Nessun profilo caricato al momento.</p> : roommates.map(rm => (
              <div className="rm-card" key={rm.id}>
                <div className="rm-avatar" style={{ background: `linear-gradient(135deg, ${rm.color1}, ${rm.color2})` }}>{rm.emoji}</div>
                <div className="rm-name">{rm.name}</div>
                <div className="rm-meta">{rm.age} anni · {rm.job} · {rm.city}</div>
                <div className="rm-quote">"{rm.quote}"</div>
                <div className="tags">{rm.tags.map(t => <span className="tag" key={t}>{t}</span>)}</div>
                <div className="match-bar"><div className="match-fill" style={{ width: `${rm.match}%` }}></div></div>
                <div className="match-label">{rm.match}% compatibile</div>
              </div>
            ))}
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
              <p>Firma l'accordo, prendi le chiavi e inizia la tua nuova convivenza. Semplice come dev'essere.</p>
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
                <li><a href="#trova">Cerca Stanza</a></li>
                <li><Link to="/accedi">Pubblica Annuncio</Link></li>
                <li><a href="#coinquilini">Trova Coinquilini</a></li>
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