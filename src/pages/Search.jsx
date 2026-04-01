import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './Home.css'; // Usiamo le stesse classi delle card

export default function Search() {
  const [searchParams] = useSearchParams();
  const intent = searchParams.get('intent');
  const cityParam = searchParams.get('citta');
  const budgetParam = searchParams.get('budget');

  const [allListings, setAllListings] = useState([]);
  
  // Filtri attivi nella pagina
  const [cityFilter, setCityFilter] = useState(cityParam || '');
  const [maxPrice, setMaxPrice] = useState(budgetParam || '');

  useEffect(() => {
    // Per ora peschiamo tutte le stanze e le filtriamo qui nel frontend
    fetch('/api/get_listings')
      .then(res => res.json())
      .then(data => {
        if (data) setAllListings(data);
      });
  }, []);

  // Logica di Filtraggio in tempo reale
  const filteredListings = allListings.filter(listing => {
    let match = true;
    if (cityFilter && listing.city.toLowerCase() !== cityFilter.toLowerCase()) match = false;
    if (maxPrice && listing.price > parseInt(maxPrice)) match = false;
    return match;
  });

  return (
    <div style={{ backgroundColor: '#FEFAF4', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      {/* NAVBAR SEMPLICE */}
      <nav style={{ background: '#2C1A0E', padding: '1rem 5%', display: 'flex', justifyContent: 'space-between' }}>
        <Link to="/" className="logo" style={{ color: 'white', textDecoration: 'none', fontSize: '1.5rem', fontFamily: "'Playfair Display', serif" }}>
          Room<span style={{ color: '#D4835E' }}>Date</span>
        </Link>
        <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>Torna alla Home</Link>
      </nav>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '3rem 5%', display: 'grid', gridTemplateColumns: '280px 1fr', gap: '3rem' }}>
        
        {/* SIDEBAR FILTRI (Stile Amazon) */}
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
          
          <button 
            style={{ width: '100%', padding: '0.8rem', background: '#FBF3E8', color: '#C4603A', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}
            onClick={() => { setCityFilter(''); setMaxPrice(''); }}
          >
            Azzera Filtri
          </button>
        </aside>

        {/* RISULTATI RICERCA */}
        <main>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', color: '#2C1A0E', marginBottom: '0.5rem' }}>
            {intent === 'coinquilino' ? 'Coinquilini disponibili' : 'Stanze disponibili'}
          </h1>
          <p style={{ color: '#8A7B6E', marginBottom: '2rem' }}>
            Trovati {filteredListings.length} risultati {cityFilter && `a ${cityFilter}`}
          </p>

          {filteredListings.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '1rem', border: '1px dashed #C4603A' }}>
              <span style={{ fontSize: '3rem' }}>🏜️</span>
              <h3>Nessun risultato trovato</h3>
              <p style={{ color: '#8A7B6E' }}>Prova a cambiare città o ad alzare il budget.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {filteredListings.map(l => (
                <div className="card" key={l.id}>
                  <div className="card-img" style={{ background: `linear-gradient(135deg, ${l.color}, ${l.color}88)` }}>
                    {l.emoji}
                    <div className="card-price"><span className="price-n">€{l.price}</span><span className="price-u">/mese</span></div>
                  </div>
                  <div className="card-body">
                    <div className="card-title">{l.title}</div>
                    <div className="card-loc">📍 {l.zone}, {l.city}</div>
                    <button className="btn-card" style={{ marginTop: '1rem' }}>Vedi dettagli</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

      </div>
    </div>
  );
}