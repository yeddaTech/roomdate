import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  
  // STATI DI NAVIGAZIONE E DATI
  const [intent, setIntent] = useState('cerca'); 
  const [activeView, setActiveView] = useState('overview'); 
  const [myListings, setMyListings] = useState([]); // <-- Stato per i tuoi annunci

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

  // --- FUNZIONE PER SCARICARE I TUOI ANNUNCI DAL DB ---
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

  // Carichiamo i tuoi annunci solo se selezioni "Offro" e se c'è un utente
  useEffect(() => {
    if (intent === 'offro' && user) {
      fetchMyListings();
    }
  }, [intent, user]);

  // --- FUNZIONE PER ELIMINARE UN ANNUNCIO ---
  const handleDeleteListing = async (id) => {
    if (window.confirm("Sei sicuro di voler eliminare questo annuncio? Questa azione è irreversibile!")) {
      try {
        const res = await fetch(`/api/delete_listing?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          alert("✅ Annuncio eliminato con successo.");
          fetchMyListings(); // Ricarichiamo la lista aggiornata
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
        setActiveView('overview');
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
        fetchMyListings(); // Ricarichiamo la lista appena lo salvi!
        setActiveView('overview');
      } else {
        const errorMsg = await res.text();
        alert("❌ Errore: " + errorMsg);
      }
    } catch (err) {
      alert("Errore di connessione al server.");
    }
  };

  if (!user) return null;

  return (
    <>
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

      <div className="dash-container">
        <div className="dash-inner">
          
          {/* COLONNA SINISTRA: PROFILO PERSONALE */}
          <aside className="dash-sidebar">
            <div className="avatar-large">
              {user.nome.charAt(0).toUpperCase()}
            </div>
            <h1 className="dash-name">{user.nome} {user.cognome}</h1>
            <p className="dash-email">{user.email}</p>

            <div className="profile-section">
              <h4>La tua Bio</h4>
              <div className="bio-text">
                Non hai ancora inserito una descrizione. Racconta chi sei!
              </div>
              <button className="btn-edit" onClick={() => setActiveView('editProfile')}>
                ✏️ Modifica Profilo Personale
              </button>
            </div>
          </aside>

          {/* COLONNA DESTRA */}
          <main className="dash-main">
            
            {/* VISTA 1: OVERVIEW STANDARD */}
            {activeView === 'overview' && (
              <>
                <div className="dash-card">
                  <h2>Cosa stai cercando su RoomDate?</h2>
                  <div className="intent-grid">
                    <button className={`intent-btn ${intent === 'cerca' ? 'active' : ''}`} onClick={() => setIntent('cerca')}>
                      <span className="intent-icon">🔍</span>
                      <span className="intent-title">Cerco una stanza</span>
                      <span className="intent-desc">Voglio sfogliare gli annunci e contattare i proprietari.</span>
                    </button>
                    <button className={`intent-btn ${intent === 'offro' ? 'active' : ''}`} onClick={() => setIntent('offro')}>
                      <span className="intent-icon">🏠</span>
                      <span className="intent-title">Offro una stanza</span>
                      <span className="intent-desc">Ho un posto libero e voglio trovare coinquilini.</span>
                    </button>
                  </div>
                </div>

                {intent === 'cerca' ? (
                  <div className="dash-card" style={{ borderTop: '4px solid var(--t)' }}>
                    <h2>Le tue stanze salvate</h2>
                    <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--wg)' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💔</div>
                      Non hai ancora salvato nessuna stanza. <br/><br/>
                      <Link to="/" className="btn-fill">Vai alla mappa</Link>
                    </div>
                  </div>
                ) : (
                  <div className="dash-card" style={{ borderTop: '4px solid #4CAF50' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h2>I tuoi Annunci</h2>
                      <button 
                        className="btn-fill" 
                        style={{ background: '#4CAF50', padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                        onClick={() => setActiveView('createListing')}
                      >
                        + Nuovo Annuncio
                      </button>
                    </div>

                    {/* --- QUI MOSTRIAMO I TUOI ANNUNCI REALI --- */}
                    {myListings.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--wg)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛋️</div>
                        Non hai ancora nessun annuncio attivo.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {myListings.map(l => (
                          <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', background: 'var(--sl)', borderRadius: '0.75rem', border: '1px solid var(--s)' }}>
                            <div>
                              <div style={{ fontWeight: 'bold', color: 'var(--wd)', fontSize: '1.1rem', marginBottom: '0.3rem' }}>{l.title}</div>
                              <div style={{ fontSize: '0.9rem', color: 'var(--wg)' }}>📍 {l.city} · 🏠 {l.roomType} · <strong style={{color: 'var(--t)'}}>€{l.price}/mese</strong></div>
                            </div>
                            <button 
                              onClick={() => handleDeleteListing(l.id)}
                              style={{ background: '#E24B4A', color: 'white', border: 'none', padding: '0.6rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', transition: '0.2s' }}
                              onMouseOver={(e) => e.target.style.background = '#C9302C'}
                              onMouseOut={(e) => e.target.style.background = '#E24B4A'}
                            >
                              Rimuovi
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* VISTA 2: MODIFICA PROFILO PERSONALE */}
            {activeView === 'editProfile' && (
              <div className="dash-card">
                <h2>Modifica Profilo Personale</h2>
                <form className="dash-form" onSubmit={handleSaveProfile}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Occupazione</label>
                      <select name="occupation" required>
                        <option value="">Seleziona...</option>
                        <option value="studente">Studente</option>
                        <option value="lavoratore">Lavoratore</option>
                        <option value="misto">Studente Lavoratore</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Data di Nascita</label>
                      <input name="birthdate" type="date" required />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Bio (Parlaci di te)</label>
                    <textarea name="bio" placeholder="Ciao! Mi chiamo..." required></textarea>
                  </div>

                  <div className="form-group">
                    <label>Il tuo Stile di Vita</label>
                    <div className="tag-grid">
                      <label><input type="checkbox" className="tag-checkbox" /><span className="tag-label">🚬 Fumatore</span></label>
                      <label><input type="checkbox" className="tag-checkbox" /><span className="tag-label">🚭 Non Fumatore</span></label>
                      <label><input type="checkbox" className="tag-checkbox" /><span className="tag-label">🐶 Ho un animale</span></label>
                      <label><input type="checkbox" className="tag-checkbox" /><span className="tag-label">🧹 Ordinato/a</span></label>
                      <label><input type="checkbox" className="tag-checkbox" /><span className="tag-label">🎉 Socievole</span></label>
                      <label><input type="checkbox" className="tag-checkbox" /><span className="tag-label">🥦 Vegano/Vegetariano</span></label>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-cancel" onClick={() => setActiveView('overview')}>Annulla</button>
                    <button type="submit" className="btn-save">Salva Profilo</button>
                  </div>
                </form>
              </div>
            )}

            {/* VISTA 3: CREA ANNUNCIO DELLA CASA */}
            {activeView === 'createListing' && (
              <div className="dash-card">
                <h2>Dettagli della Stanza</h2>
                <form className="dash-form" onSubmit={handleSaveListing}>
                  <div className="form-group">
                    <label>Titolo Annuncio</label>
                    <input name="title" type="text" placeholder="Es: Ampia singola..." required />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Città</label>
                      <input name="city" type="text" placeholder="Es: Milano" required />
                    </div>
                    <div className="form-group">
                      <label>Indirizzo o Zona</label>
                      <input name="zone" type="text" placeholder="Es: Via Torino" required />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Tipo di Stanza</label>
                      <select name="roomType" required>
                        <option value="">Seleziona...</option>
                        <option value="singola">Singola</option>
                        <option value="doppia">Doppia (Posto letto)</option>
                        <option value="intera">Casa intera</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Prezzo Mensile (€)</label>
                      <input name="price" type="number" placeholder="Es: 500" required />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Descrizione della casa</label>
                    <textarea name="description" placeholder="Descrivi la casa..." required></textarea>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-cancel" onClick={() => setActiveView('overview')}>Annulla</button>
                    <button type="submit" className="btn-save" style={{ background: '#4CAF50' }}>Pubblica Annuncio</button>
                  </div>
                </form>
              </div>
            )}

          </main>
        </div>
      </div>
    </>
  );
}