import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './Home.css'; 

export default function Search() {
  const [searchParams] = useSearchParams();
  const intent = searchParams.get('intent') || 'stanza'; // 'stanza' o 'coinquilino'
  const cityParam = searchParams.get('citta');
  const budgetParam = searchParams.get('budget');

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtri
  const [cityFilter, setCityFilter] = useState(cityParam || '');
  const [maxPrice, setMaxPrice] = useState(budgetParam || '');

  useEffect(() => {
    setLoading(true);
    
    // SCEGLIAMO L'API GIUSTA IN BASE A COSA CERCA L'UTENTE
    const apiEndpoint = intent === 'coinquilino' ? '/api/get_roommates' : '/api/get_listings';

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
  }, [intent]); // Ricarica se l'utente cambia da "Stanza" a "Coinquilino"

  // Logica di Filtraggio in tempo reale
  const filteredResults = results.filter(item => {
    let match = true;
    
    // Filtro Città (funziona sia per stanze che per coinquilini)
    if (cityFilter && item.city && item.city.toLowerCase() !== cityFilter.toLowerCase()) match = false;
    
    // Filtro Prezzo (ha senso solo per le stanze)
    if (intent === 'stanza' && maxPrice && item.price > parseInt(maxPrice)) match = false;
    
    return match;
  });

  return (
    <div style={{ backgroundColor: '#FEFAF4', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      {/* NAVBAR */}
      <nav style={{ background: '#2C1A0E', padding: '1rem 5%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" className="logo" style={{ color: 'white', textDecoration: 'none', fontSize: '1.5rem', fontFamily: "'Playfair Display', serif" }}>
          Room<span style={{ color: '#D4835E' }}>Date</span>
        </Link>
        <Link to="/" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>← Torna alla Home</Link>
      </nav>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '3rem 5%', display: 'grid', gridTemplateColumns: '280px 1fr', gap: '3rem' }}>
        
        {/* SIDEBAR FILTRI */}
        <aside style={{ background: 'white', padding: '2rem', borderRadius: '1rem', height: 'fit-content', border: '1px solid #F5E3CC' }}>
          <h3 style={{ marginBottom: '1.5rem', color: '#2C1A0E' }}>Filtra Risultati</h3>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#7A4B2A' }}>Città</label>
            <select 
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1.5px solid #F5E3CC' }}
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            >
              <option value="">Tutte le città</option>
              <option value="Milano">Milano</option>
              <option value="Roma">Roma</option>
              <option value="Torino">Torino</option>
              <option value="Bologna">Bologna</option>
            </select>
          </div>

          {/* Il filtro budget lo mostriamo solo se cerca stanze */}
          {intent === 'stanza' && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#7A4B2A' }}>Budget Massimo (€)</label>
              <input 
                type="number" 
                placeholder="Es. 600"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1.5px solid #F5E3CC', boxSizing: 'border-box' }}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
          )}
          
          <button 
            style={{ width: '100%', padding: '0.8rem', background: '#FBF3E8', color: '#C4603A', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}
            onClick={() => { setCityFilter(''); setMaxPrice(''); }}
          >
            Azzera Filtri
          </button>
        </aside>

        {/* GRIGLIA RISULTATI */}
        <main>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', color: '#2C1A0E', marginBottom: '0.5rem' }}>
            {intent === 'coinquilino' ? 'Coinquilini disponibili' : 'Stanze disponibili'}
          </h1>
          <p style={{ color: '#8A7B6E', marginBottom: '2rem' }}>
            Trovati {filteredResults.length} risultati {cityFilter && `a ${cityFilter}`}
          </p>

          {loading ? (
            <p>Ricerca in corso...</p>
          ) : filteredResults.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '1rem', border: '1px dashed #C4603A' }}>
              <span style={{ fontSize: '3rem' }}>🏜️</span>
              <h3>Nessun risultato trovato</h3>
              <p style={{ color: '#8A7B6E' }}>Prova ad azzerare i filtri per vedere più risultati.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              
              {/* RENDER DINAMICO: Stanze o Coinquilini? */}
              {filteredResults.map(item => {
                
                if (intent === 'stanza') {
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
                        <button className="btn-card" style={{ marginTop: '1rem' }}>Vedi dettagli</button>
                      </div>
                    </div>
                  );
                } else {
                  // DISEGNA LA CARD DEL COINQUILINO
                  return (
                    <div className="rm-card" key={item.id}>
                      <div className="rm-avatar" style={{ background: `linear-gradient(135deg, ${item.color1}, ${item.color2})` }}>{item.emoji}</div>
                      <div className="rm-name">{item.name}</div>
                      <div className="rm-meta">{item.age} anni · {item.job}</div>
                      <div className="rm-quote" style={{ fontSize: '0.8rem', fontStyle: 'italic', margin: '0.5rem 0', color: 'var(--wg)' }}>"{item.quote}"</div>
                      <div className="tags" style={{ marginBottom: '1rem' }}>
                        {item.tags.map(t => <span className="tag" key={t}>{t}</span>)}
                      </div>
                      <button className="btn-fill" style={{ width: '100%', padding: '0.5rem' }}>Contatta</button>
                    </div>
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