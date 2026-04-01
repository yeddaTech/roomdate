import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  
  // STATO FONDAMENTALE: Capire cosa vuole fare l'utente
  const [intent, setIntent] = useState('cerca'); // Può essere 'cerca' o 'offro'

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

  if (!user) return null;

  return (
    <>
      {/* NAVBAR MINIMALE PER LA DASHBOARD */}
      <nav>
        <Link to="/" className="logo">Room<span>Date</span></Link>
        <div className="nav-btns" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/" className="btn-ghost">Torna alla Home</Link>
          <button onClick={handleLogout} className="btn-fill" style={{ background: '#E24B4A' }}>Esci</button>
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
                Non hai ancora inserito una descrizione. Racconta chi sei, cosa studi o che lavoro fai per trovare il coinquilino perfetto!
              </div>
              
              <h4>Il tuo Stile di vita</h4>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <span style={{ background: '#FBF3E8', color: '#7A4B2A', padding: '0.3rem 0.8rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '500' }}>In attesa di dati...</span>
              </div>

              <button className="btn-edit">✏️ Modifica Profilo</button>
            </div>
          </aside>

          {/* COLONNA DESTRA: OBIETTIVO E AZIONI */}
          <main className="dash-main">
            
            {/* BOX 1: LA SCELTA DELL'OBIETTIVO */}
            <div className="dash-card">
              <h2>Cosa stai cercando su RoomDate?</h2>
              <p>Seleziona il tuo obiettivo attuale per personalizzare la tua esperienza.</p>
              
              <div className="intent-grid">
                <button 
                  className={`intent-btn ${intent === 'cerca' ? 'active' : ''}`}
                  onClick={() => setIntent('cerca')}
                >
                  <span className="intent-icon">🔍</span>
                  <span className="intent-title">Cerco una stanza</span>
                  <span className="intent-desc">Voglio sfogliare gli annunci, salvare i miei preferiti e contattare i proprietari.</span>
                </button>
                
                <button 
                  className={`intent-btn ${intent === 'offro' ? 'active' : ''}`}
                  onClick={() => setIntent('offro')}
                >
                  <span className="intent-icon">🏠</span>
                  <span className="intent-title">Offro una stanza</span>
                  <span className="intent-desc">Ho un posto libero in casa e voglio pubblicare un annuncio per trovare coinquilini.</span>
                </button>
              </div>
            </div>

            {/* BOX 2: CONTENUTO DINAMICO IN BASE ALLA SCELTA */}
            {intent === 'cerca' ? (
              <div className="dash-card" style={{ borderTop: '4px solid var(--t)' }}>
                <h2>Le tue stanze salvate</h2>
                <p>Qui appariranno gli annunci che hai aggiunto ai preferiti.</p>
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--wg)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💔</div>
                  Non hai ancora salvato nessuna stanza. <br/><br/>
                  <Link to="/" className="btn-fill">Vai alla mappa</Link>
                </div>
              </div>
            ) : (
              <div className="dash-card" style={{ borderTop: '4px solid #4CAF50' }}>
                <h2>Il profilo della tua Casa</h2>
                <p>Crea o modifica l'annuncio della tua stanza per renderlo visibile a migliaia di utenti.</p>
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--wg)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛋️</div>
                  Non hai ancora nessun annuncio attivo. <br/><br/>
                  <button className="btn-fill" style={{ background: '#4CAF50' }}>+ Pubblica il tuo primo annuncio</button>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
    </>
  );
}