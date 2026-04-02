import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  
  // STATI DI NAVIGAZIONE E DATI
  const [activeView, setActiveView] = useState('myListings'); 
  const [myListings, setMyListings] = useState([]);

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
    navigate('/');
  };

  // --- SCARICA I TUOI ANNUNCI DAL DB ---
  const fetchMyListings = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/get_my_listings?userId=${user.id}`);
      const data = await res.json();
      if (data) setMyListings(data);
    } catch (err) {
      console.error("Errore caricamento miei annunci", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMyListings();
    }
  }, [user]);

  // --- ELIMINA ANNUNCIO ---
  const handleDeleteListing = async (id) => {
    if (window.confirm("Sei sicuro di voler eliminare questo annuncio? L'azione è irreversibile!")) {
      try {
        const res = await fetch(`/api/delete_listing?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          alert("✅ Annuncio eliminato con successo.");
          fetchMyListings();
        } else {
          alert("❌ Errore durante l'eliminazione.");
        }
      } catch (err) {
        alert("Errore di connessione.");
      }
    }
  };

  // --- SALVA PROFILO ---
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const tags = Array.from(e.target.querySelectorAll('.tag-checkbox:checked'))
      .map(cb => cb.nextElementSibling.innerText)
      .join(', ');

    const data = {
      userId: user.id,
      occupation: formData.get('occupation'),
      birthdate: formData.get('birthdate'),
      bio: formData.get('bio'),
      tags: tags
    };

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        alert("✅ Profilo aggiornato con successo!");
        setActiveView('myListings');
      } else {
        const errorMsg = await res.text();
        alert("❌ Errore: " + errorMsg);
      }
    } catch (err) {
      alert("Errore di connessione al server.");
    }
  };

  // --- PUBBLICA ANNUNCIO ---
  const handleSaveListing = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const data = {
      userId: user.id,
      title: formData.get('title'),
      city: formData.get('city'),
      zone: formData.get('zone'),
      roomType: formData.get('roomType'),
      price: formData.get('price'),
      description: formData.get('description')
    };

    try {
      const res = await fetch('/api/create_listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        alert("🎉 Annuncio pubblicato! Ora è visibile sulla Home.");
        fetchMyListings(); 
        setActiveView('myListings');
      } else {
        const errorMsg = await res.text();
        alert("❌ Errore: " + errorMsg);
      }
    } catch (err) {
      alert("Errore di connessione al server.");
    }
  };

  if (!user) return null;

  // Stili per le Tab
  const getTabStyle = (tabName) => ({
    padding: '0.8rem 1.5rem',
    borderRadius: '2rem',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: '0.2s',
    backgroundColor: activeView === tabName ? '#C4603A' : '#EAE0D5',
    color: activeView === tabName ? 'white' : '#7A4B2A',
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

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 5%' }}>
        
        {/* --- HEADER PROFILO (Ispirato allo screenshot) --- */}
        <div style={{ background: '#2C1A0E', borderRadius: '1rem', padding: '3rem 2rem', textAlign: 'center', color: 'white', position: 'relative' }}>
          
          <div style={{ 
            width: '120px', height: '120px', borderRadius: '50%', 
            background: 'linear-gradient(135deg, #F5C29A, #C4603A)', 
            margin: '0 auto 1.5rem', display: 'flex', justifyContent: 'center', 
            alignItems: 'center', fontSize: '3.5rem', color: 'white', border: '4px solid #1E1008'
          }}>
            {user.nome.charAt(0).toUpperCase()}
          </div>
          
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.5rem', margin: '0 0 0.5rem 0' }}>
            {user.nome} {user.cognome}
          </h1>
          <p style={{ color: '#D4835E', margin: '0 0 1rem 0', fontSize: '1.1rem' }}>
            @{user.nome.toLowerCase()}{user.id?.substring(0,4)}
          </p>
          
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.1)', padding: '0.5rem 1.5rem', borderRadius: '2rem', fontSize: '0.85rem' }}>
            🎓 Profilo da completare
          </div>
        </div>

        {/* --- STAT BAR --- */}
        <div style={{ 
          display: 'flex', justifyContent: 'space-around', background: 'white', 
          padding: '1.5rem', borderRadius: '1rem', marginTop: '-2.5rem', 
          marginLeft: '2rem', marginRight: '2rem', boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
          position: 'relative', border: '1px solid #F5E3CC'
        }}>
          <div style={{ textAlign: 'center', flex: 1, borderRight: '1px solid #F5E3CC' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#C4603A' }}>{myListings.length}</div>
            <div style={{ fontSize: '0.75rem', color: '#8A7B6E', letterSpacing: '1px', fontWeight: 'bold' }}>ANNUNCI PUBBLICATI</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1, borderRight: '1px solid #F5E3CC' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#C4603A' }}>0</div>
            <div style={{ fontSize: '0.75rem', color: '#8A7B6E', letterSpacing: '1px', fontWeight: 'bold' }}>STANZE SALVATE</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#C4603A' }}>0</div>
            <div style={{ fontSize: '0.75rem', color: '#8A7B6E', letterSpacing: '1px', fontWeight: 'bold' }}>CHAT ATTIVE</div>
          </div>
        </div>

        {/* --- TABS --- */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button style={getTabStyle('myListings')} onClick={() => setActiveView('myListings')}>
            📄 I Miei Annunci
          </button>
          <button style={getTabStyle('savedRooms')} onClick={() => setActiveView('savedRooms')}>
            ❤️ Salvati
          </button>
          <button style={getTabStyle('editProfile')} onClick={() => setActiveView('editProfile')}>
            ⚙️ Modifica Profilo
          </button>
          <button style={getTabStyle('createListing')} onClick={() => setActiveView('createListing')}>
            ➕ Pubblica Annuncio
          </button>
        </div>

        {/* --- CONTENUTO DELLE TAB --- */}
        <div style={{ marginTop: '2rem' }}>
          
          {/* TAB: I MIEI ANNUNCI */}
          {activeView === 'myListings' && (
            <div className="dash-card" style={{ background: 'white', padding: '2rem', borderRadius: '1rem', border: '1px solid #F5E3CC' }}>
              <h2 style={{ marginBottom: '1.5rem' }}>Annunci Attivi</h2>
              {myListings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--wg)' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛋️</div>
                  <p>Non hai ancora nessun annuncio attivo.</p>
                  <button onClick={() => setActiveView('createListing')} className="btn-ghost" style={{ marginTop: '1rem' }}>Crea il tuo primo annuncio</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {myListings.map(l => (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', background: '#FEFAF4', borderRadius: '0.75rem', border: '1px solid #F5E3CC' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#2C1A0E', fontSize: '1.2rem', marginBottom: '0.3rem' }}>{l.title}</div>
                        <div style={{ fontSize: '0.9rem', color: '#8A7B6E' }}>📍 {l.city} · 🏠 {l.roomType} · <strong style={{color: '#C4603A'}}>€{l.price}/mese</strong></div>
                      </div>
                      <button 
                        onClick={() => handleDeleteListing(l.id)}
                        style={{ background: '#E24B4A', color: 'white', border: 'none', padding: '0.8rem 1.2rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}
                      >
                        Elimina
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: SALVATI */}
          {activeView === 'savedRooms' && (
            <div className="dash-card" style={{ background: 'white', padding: '2rem', borderRadius: '1rem', border: '1px solid #F5E3CC' }}>
              <h2 style={{ marginBottom: '1.5rem' }}>Le tue Stanze Preferite</h2>
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--wg)' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💔</div>
                <p>Non hai ancora salvato nessuna stanza.</p>
                <Link to="/ricerca" className="btn-ghost" style={{ display: 'inline-block', marginTop: '1rem' }}>Esplora gli annunci</Link>
              </div>
            </div>
          )}

          {/* TAB: MODIFICA PROFILO */}
          {activeView === 'editProfile' && (
            <div className="dash-card" style={{ background: 'white', padding: '2rem', borderRadius: '1rem', border: '1px solid #F5E3CC' }}>
              <h2 style={{ marginBottom: '1.5rem' }}>Informazioni Personali</h2>
              <form className="dash-form" onSubmit={handleSaveProfile}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Occupazione</label>
                    <select name="occupation" required>
                      <option value="">Seleziona...</option>
                      <option value="studente">Studente</option>
                      <option value="lavoratore">Lavoratore</option>
                      <option value="misto">Studente / Lavoratore</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Data di Nascita</label>
                    <input name="birthdate" type="date" required />
                  </div>
                </div>

                <div className="form-group">
                  <label>Bio (Parlaci di te)</label>
                  <textarea name="bio" placeholder="Ciao! Mi chiamo..." rows="4" required></textarea>
                </div>

                <div className="form-group">
                  <label>Il tuo Stile di Vita</label>
                  <div className="tag-grid">
                    <label><input type="checkbox" className="tag-checkbox" /><span className="tag-label">🚬 Fumatore</span></label>
                    <label><input type="checkbox" className="tag-checkbox" /><span className="tag-label">🚭 Non Fumatore</span></label>
                    <label><input type="checkbox" className="tag-checkbox" /><span className="tag-label">🐶 Ho animali</span></label>
                    <label><input type="checkbox" className="tag-checkbox" /><span className="tag-label">🧹 Ordinato/a</span></label>
                    <label><input type="checkbox" className="tag-checkbox" /><span className="tag-label">🎉 Socievole</span></label>
                    <label><input type="checkbox" className="tag-checkbox" /><span className="tag-label">🥦 Vegano/Vegetariano</span></label>
                  </div>
                </div>

                <div className="form-actions" style={{ marginTop: '2rem' }}>
                  <button type="submit" className="btn-save" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>Aggiorna Profilo</button>
                </div>
              </form>
            </div>
          )}

          {/* TAB: CREA ANNUNCIO */}
          {activeView === 'createListing' && (
            <div className="dash-card" style={{ background: 'white', padding: '2rem', borderRadius: '1rem', border: '1px solid #F5E3CC' }}>
              <h2 style={{ marginBottom: '1.5rem' }}>Inserisci una Stanza</h2>
              <form className="dash-form" onSubmit={handleSaveListing}>
                <div className="form-group">
                  <label>Titolo Annuncio</label>
                  <input name="title" type="text" placeholder="Es: Ampia camera singola in centro..." required />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Città</label>
                    <input name="city" type="text" placeholder="Es: Milano" required />
                  </div>
                  <div className="form-group">
                    <label>Indirizzo o Zona</label>
                    <input name="zone" type="text" placeholder="Es: Navigli" required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo di Stanza</label>
                    <select name="roomType" required>
                      <option value="">Seleziona...</option>
                      <option value="singola">Camera Singola</option>
                      <option value="doppia">Posto in Doppia</option>
                      <option value="intera">Casa intera</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Prezzo Mensile (€)</label>
                    <input name="price" type="number" placeholder="Es: 600" required />
                  </div>
                </div>

                <div className="form-group">
                  <label>Descrizione della casa e dei coinquilini</label>
                  <textarea name="description" placeholder="Descrivi l'ambiente, la casa e chi ci vive..." rows="5" required></textarea>
                </div>

                <div className="form-actions" style={{ marginTop: '2rem' }}>
                  <button type="submit" className="btn-save" style={{ background: '#4CAF50', width: '100%', padding: '1rem', fontSize: '1.1rem' }}>Pubblica Subito</button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}