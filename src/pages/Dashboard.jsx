import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  
  // STATI DI NAVIGAZIONE INTERNA
  const [intent, setIntent] = useState('cerca'); 
  const [activeView, setActiveView] = useState('overview'); // 'overview', 'editProfile', 'createListing'

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

// --- SALVA PROFILO ---
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    // Raccogliamo i tag selezionati
    const tags = Array.from(e.target.querySelectorAll('.tag-checkbox:checked'))
      .map(cb => cb.nextElementSibling.innerText)
      .join(', ');

    const data = {
      userId: user.id, // L'ID dell'utente loggato
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
        alert("❌ Errore durante il salvataggio.");
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
        setActiveView('overview');
      } else {
        alert("❌ Errore durante la pubblicazione.");
      }
    } catch (err) {
      alert("Errore di connessione al server.");
    }
  };

  if (!user) return null;

  return (
    <>
      <nav>
        <Link to="/" className="logo">Room<span>Date</span></Link>
        <div className="nav-btns" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/" className="btn-ghost">Torna alla Home</Link>
          <button onClick={handleLogout} className="btn-fill" style={{ background: '#E24B4A' }}>Esci</button>
        </div>
      </nav>

      <div className="dash-container">
        <div className="dash-inner">
          
          {/* COLONNA SINISTRA: PROFILO PERSONALE (Sempre visibile) */}
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
              
              <button 
                className="btn-edit" 
                onClick={() => setActiveView('editProfile')}
              >
                ✏️ Modifica Profilo Personale
              </button>
            </div>
          </aside>

          {/* COLONNA DESTRA: DINAMICA IN BASE ALLA VISTA */}
          <main className="dash-main">
            
            {/* VISTA 1: OVERVIEW STANDARD */}
            {activeView === 'overview' && (
              <>
                <div className="dash-card">
                  <h2>Cosa stai cercando su RoomDate?</h2>
                  <p>Seleziona il tuo obiettivo attuale.</p>
                  
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
                    <h2>I tuoi Annunci</h2>
                    <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--wg)' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛋️</div>
                      Non hai ancora nessun annuncio attivo. <br/><br/>
                      <button 
                        className="btn-fill" 
                        style={{ background: '#4CAF50' }}
                        onClick={() => setActiveView('createListing')}
                      >
                        + Pubblica il tuo primo annuncio
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* VISTA 2: MODIFICA PROFILO PERSONALE */}
            {activeView === 'editProfile' && (
              <div className="dash-card">
                <h2>Modifica Profilo Personale</h2>
                <p>Queste informazioni aiuteranno gli altri a capire se siete compatibili.</p>
                
                <form className="dash-form" onSubmit={handleSaveProfile}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Occupazione</label>
                      <select required>
                        <option value="">Seleziona...</option>
                        <option value="studente">Studente</option>
                        <option value="lavoratore">Lavoratore</option>
                        <option value="misto">Studente Lavoratore</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Data di Nascita</label>
                      <input type="date" required />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Bio (Parlaci di te)</label>
                    <textarea placeholder="Ciao! Mi chiamo... e mi piace..." required></textarea>
                  </div>

                  <div className="form-group">
                    <label>Il tuo Stile di Vita (Seleziona tutto ciò che si applica)</label>
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
                <p>Inserisci i dati della stanza che vuoi affittare.</p>
                
                <form className="dash-form" onSubmit={handleSaveListing}>
                  <div className="form-group">
                    <label>Titolo Annuncio</label>
                    <input type="text" placeholder="Es: Ampia singola luminosa in zona Navigli" required />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Città</label>
                      <input type="text" placeholder="Es: Milano" required />
                    </div>
                    <div className="form-group">
                      <label>Indirizzo o Zona</label>
                      <input type="text" placeholder="Es: Via Torino" required />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Tipo di Stanza</label>
                      <select required>
                        <option value="">Seleziona...</option>
                        <option value="singola">Singola</option>
                        <option value="doppia">Doppia (Posto letto)</option>
                        <option value="intera">Casa intera</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Prezzo Mensile (€)</label>
                      <input type="number" placeholder="Es: 500" required />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Descrizione della casa</label>
                    <textarea placeholder="Descrivi la casa, chi ci vive attualmente, i servizi vicini..." required></textarea>
                  </div>

                  <div className="form-group">
                    <label>Foto della Stanza</label>
                    <div className="photo-dropzone">
                      <span>📸</span>
                      <p>Clicca qui o trascina le foto della stanza per caricarle</p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--wg)', marginTop: '0.5rem' }}>Massimo 5 foto (JPG, PNG)</p>
                    </div>
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