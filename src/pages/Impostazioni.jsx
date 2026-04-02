import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
// Puoi riutilizzare il CSS della Dashboard per avere uno stile coerente
import './Dashboard.css'; 

export default function Impostazioni() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // Stati fittizi per i toggle delle impostazioni
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('roomdate_user');
    if (!savedUser) {
      navigate('/accedi'); // Se non è loggato, via!
    } else {
      setUser(JSON.parse(savedUser));
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('roomdate_user');
    navigate('/');
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    alert("✅ Impostazioni salvate con successo!");
  };

  const handleDeleteAccount = () => {
    if (window.confirm("Sei sicuro di voler eliminare definitivamente il tuo account? Questa azione non può essere annullata.")) {
      alert("Account eliminato. (Simulazione)");
      handleLogout();
    }
  };

  if (!user) return null;

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

      <div style={{ maxWidth: '800px', margin: '3rem auto', padding: '0 5%' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.5rem', color: '#2C1A0E', marginBottom: '2rem' }}>Impostazioni Account</h1>
        
        <div className="dash-card" style={{ padding: '2rem', background: 'white', borderRadius: '1rem', border: '1px solid #F5E3CC' }}>
          <form onSubmit={handleSaveSettings}>
            
            {/* SEZIONE SICUREZZA */}
            <h3 style={{ borderBottom: '1px solid #F5E3CC', paddingBottom: '0.5rem', marginBottom: '1.5rem', color: '#7A4B2A' }}>Sicurezza</h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Email dell&apos;account</label>
              <input 
                type="email" 
                defaultValue={user.email} 
                disabled 
                style={{ width: '100%', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid #ccc', background: '#f5f5f5', color: '#888' }}
              />
              <small style={{ color: 'var(--wg)' }}>L&apos;email non può essere modificata.</small>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Nuova Password</label>
              <input 
                type="password" 
                placeholder="Lascia vuoto per non modificare" 
                style={{ width: '100%', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid #F5E3CC' }}
              />
            </div>

            {/* SEZIONE NOTIFICHE */}
            <h3 style={{ borderBottom: '1px solid #F5E3CC', paddingBottom: '0.5rem', marginBottom: '1.5rem', color: '#7A4B2A' }}>Notifiche</h3>
            
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <input 
                type="checkbox" 
                id="emailNotif" 
                checked={emailNotif} 
                onChange={(e) => setEmailNotif(e.target.checked)} 
                style={{ width: '1.2rem', height: '1.2rem', marginRight: '0.8rem', accentColor: '#C4603A' }}
              />
              <label htmlFor="emailNotif" style={{ cursor: 'pointer' }}>Ricevi aggiornamenti e messaggi via Email</label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2.5rem' }}>
              <input 
                type="checkbox" 
                id="pushNotif" 
                checked={pushNotif} 
                onChange={(e) => setPushNotif(e.target.checked)} 
                style={{ width: '1.2rem', height: '1.2rem', marginRight: '0.8rem', accentColor: '#C4603A' }}
              />
              <label htmlFor="pushNotif" style={{ cursor: 'pointer' }}>Abilita notifiche Push nel browser</label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button type="submit" className="btn-fill" style={{ background: '#4CAF50', padding: '0.8rem 2rem' }}>Salva Modifiche</button>
            </div>
          </form>
        </div>

        {/* DANGER ZONE */}
        <div className="dash-card" style={{ padding: '2rem', background: '#FFF5F5', borderRadius: '1rem', border: '1px solid #FBCBCB', marginTop: '2rem' }}>
          <h3 style={{ color: '#E24B4A', marginBottom: '1rem' }}>Zona Pericolosa</h3>
          <p style={{ color: '#888', marginBottom: '1.5rem' }}>Se elimini il tuo account, perderai tutti i tuoi annunci, le chat e i salvataggi. L&apos;operazione è irreversibile.</p>
          <button 
            onClick={handleDeleteAccount}
            style={{ background: 'transparent', color: '#E24B4A', border: '2px solid #E24B4A', padding: '0.8rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Elimina Account Definitivamente
          </button>
        </div>

      </div>
    </div>
  );
}