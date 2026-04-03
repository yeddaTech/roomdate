import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';

export default function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Usiamo i parametri dell'URL per gestire la vista corrente
  const currentIntent = searchParams.get('intent') || 'stanza'; 
  const currentCity = searchParams.get('citta') || '';
  const currentBudget = searchParams.get('budget') || '';

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Recupero utente per la navbar
  useEffect(() => {
    const savedUser = localStorage.getItem('roomdate_user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('roomdate_user');
    setUser(null);
    navigate('/');
  };
  // --- NUOVA FUNZIONE: CONTATTA COINQUILINO ---
  const handleDirectContact = async (targetUserId) => {
    if (!user) {
      alert("Devi accedere o registrarti per chattare!");
      navigate('/accedi');
      return;
    }

    try {
      // Chiama start_chat passando l'ID dell'altra persona, SENZA stanza
      const res = await fetch('/api/start_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: user.id,
          targetId: targetUserId
        })
      });

      if (res.ok) {
        const data = await res.json();
        navigate('/chat', { state: { openChatId: data.conversationId } });
      } else {
        alert("Errore nell'avvio della chat.");
      }
    } catch (err) {
      console.error(err);
      alert("Errore di connessione.");
    }
  };
  // Fetch dei dati ogni volta che l'intento cambia
  useEffect(() => {
    setLoading(true);
    const apiEndpoint = currentIntent === 'coinquilino' ? '/api/get_roommates' : '/api/get_listings';

    fetch(apiEndpoint)
      .then(res => res.json())
      .then(data => {
        if (data) setResults(data);
        setLoading(false);
      })
      .catch(() => {
        setResults([]);
        setLoading(false);
      });
  }, [currentIntent]);

  // Aggiorna l'URL quando l'utente usa il box superiore
  const handleTopSearch = (newIntent, newCity, newBudget) => {
    const params = new URLSearchParams();
    params.append('intent', newIntent);
    if (newCity) params.append('citta', newCity);
    if (newBudget) params.append('budget', newBudget);
    setSearchParams(params);
  };

  const filteredResults = results.filter(item => {
    let match = true;
    if (currentCity && item.city && item.city.toLowerCase() !== currentCity.toLowerCase()) match = false;
    if (currentIntent === 'stanza' && currentBudget && item.price > parseInt(currentBudget)) match = false;
    return match;
  });

  return (
    <div style={{ backgroundColor: '#FEFAF4', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      
      {/* --- NAVBAR UNIFICATA --- */}
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
            <>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', marginRight: '0.5rem' }}>
                Ciao, <strong>{user.nome}</strong>!
              </span>
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

      {/* --- HERO SEARCH BOX (Spostato dalla Home) --- */}
      <div style={{ background: 'var(--p)', padding: '3rem 5%', display: 'flex', justifyContent: 'center' }}>
         <div className="search-box" style={{ margin: 0, width: '100%', maxWidth: '800px' }}>
            <div className="tabs">
              <button 
                className={`tab ${currentIntent === 'stanza' ? 'active' : ''}`} 
                onClick={() => handleTopSearch('stanza', currentCity, currentBudget)}
              >
                🔍 Cerca Stanza
              </button>
              <button 
                className={`tab ${currentIntent === 'coinquilino' ? 'active' : ''}`} 
                onClick={() => handleTopSearch('coinquilino', currentCity, currentBudget)}
              >
                👥 Cerco Coinquilino
              </button>
            </div>
            <div className="inputs">
              <select 
                value={currentCity} 
                onChange={(e) => handleTopSearch(currentIntent, e.target.value, currentBudget)}
              >
                <option value="">📍 Città (Tutte)</option>
                <option value="Milano">Milano</option>
                <option value="Roma">Roma</option>
                <option value="Bologna">Bologna</option>
                <option value="Torino">Torino</option>
              </select>
              <input 
                type="number" 
                placeholder="💶 Budget max €" 
                value={currentBudget}
                onChange={(e) => handleTopSearch(currentIntent, currentCity, e.target.value)}
                disabled={currentIntent === 'coinquilino'}
                style={{ opacity: currentIntent === 'coinquilino' ? 0.5 : 1 }}
              />
            </div>
          </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '3rem 5%' }}>
        
        {/* GRIGLIA RISULTATI (Senza la vecchia sidebar fissa) */}
        <main>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', color: '#2C1A0E', marginBottom: '0.5rem' }}>
            {currentIntent === 'coinquilino' ? 'Coinquilini disponibili' : 'Stanze disponibili'}
          </h1>
          <p style={{ color: '#8A7B6E', marginBottom: '2rem' }}>
            Trovati {filteredResults.length} risultati {currentCity && `a ${currentCity}`}
          </p>

            {loading ? (
            /* GRIGLIA DEGLI SKELETON (Mostra 6 finte card che lampeggiano) */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div className="card" key={n} style={{ height: '360px', display: 'flex', flexDirection: 'column' }}>
                  {/* Finta Immagine/Header */}
                  <div className="skeleton-box" style={{ height: '180px', width: '100%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}></div>
                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
                    {/* Finto Titolo */}
                    <div className="skeleton-box" style={{ height: '24px', width: '80%' }}></div>
                    {/* Finta Posizione/Sottotitolo */}
                    <div className="skeleton-box" style={{ height: '16px', width: '50%' }}></div>
                    {/* Finto Bottone */}
                    <div className="skeleton-box" style={{ height: '40px', width: '100%', marginTop: 'auto', borderRadius: '2rem' }}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredResults.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '1rem', border: '1px dashed #C4603A' }}>
              <span style={{ fontSize: '3rem' }}>🏜️</span>
              <h3>Nessun risultato trovato</h3>
              <p style={{ color: '#8A7B6E' }}>Prova ad ampliare i filtri di ricerca nel box in alto.</p>
              <button 
                className="btn-ghost" 
                onClick={() => handleTopSearch(currentIntent, '', '')}
                style={{ marginTop: '1rem', color: '#C4603A', borderColor: '#C4603A' }}
              >
                Azzera Filtri
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              
              {/* RENDER DINAMICO: Stanze o Coinquilini? */}
              {filteredResults.map(item => {
                
                if (currentIntent === 'stanza') {
                  // DISEGNA LA CARD DELLA STANZA
                  return (
                    <div className="card" key={item.id}>
                      <div className="card-img" style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}88)` }}>
                        {item.emoji}
                        <div className="card-price"><span className="price-n">€{item.price}</span><span className="price-u">/mese</span></div>
                      </div>
                      <div className="card-body">
                        <div className="card-title">{item.title}</div>
                        <div className="card-loc">📍 {item.zone}, {item.city}</div>
                          <Link 
                              to={`/dettagli/${item.id}`} 
                              className="btn-card" 
                              style={{ 
                                marginTop: '1rem', 
                                display: 'block', 
                                textAlign: 'center', 
                                textDecoration: 'none' 
                              }}
                            >
                          Vedi dettagli
                            </Link>                      </div>
                    </div>
                  );
                } else {
                  // DISEGNA LA CARD DEL COINQUILINO
                  return (
                    <div className="rm-card" key={item.id}>
                      <div className="rm-avatar" style={{ background: `linear-gradient(135deg, ${item.color1}, ${item.color2})` }}>{item.emoji}</div>
                      <div className="rm-name">{item.name}</div>
                      <div className="rm-meta">{item.age} anni · {item.job}</div>
                      <div className="rm-quote" style={{ fontSize: '0.8rem', fontStyle: 'italic', margin: '0.5rem 0', color: 'var(--wg)' }}>&quot;{item.quote}&quot;</div>
                      <div className="tags" style={{ marginBottom: '1rem' }}>
                        {item.tags.map(t => <span className="tag" key={t}>{t}</span>)}
                      </div>
                      {/* SOSTITUISCI IL VECCHIO LINK CON QUESTO BOTTONE */}
                      <button 
                        onClick={() => handleDirectContact(item.id)} 
                        className="btn-fill" 
                        style={{ width: '100%', padding: '0.6rem', display: 'block', textAlign: 'center', border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxSizing: 'border-box' }}
                      >
                        Contatta
                      </button>                 </div>
                  );
                }

              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}