import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Register.css'; // <-- Importiamo il CSS!

export default function Register() {
  // --- STATI DELLA PAGINA ---
  const [userType, setUserType] = useState('cerca'); // 'cerca' o 'affitta'
  
  // Stato unificato per i dati del form
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    email: '',
    telefono: '',
    citta: '',
    nascita: '',
    password: '',
    accettaTermini: false,
    newsletter: false
  });

  // Gestione dell'input per aggiornare lo stato
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // --- LOGICA PASSWORD STRENGTH ---
  // Calcola il punteggio della password da 0 a 4
  const getPasswordScore = (pw) => {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };

  const score = getPasswordScore(formData.password);
  
  // Mappiamo il punteggio alle classi e ai testi corretti
  const strengthLevels = [
    { text: 'Inserisci una password', color: 'var(--wg)', barClass: '' },
    { text: 'Troppo corta', color: '#E24B4A', barClass: 'weak' },
    { text: 'Debole', color: '#E24B4A', barClass: 'weak' },
    { text: 'Media', color: '#EF9F27', barClass: 'medium' },
    { text: 'Forte 💪', color: '#639922', barClass: 'strong' }
  ];
  
  const currentStrength = strengthLevels[score];

// --- SUBMIT ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Disabilitiamo il bottone e cambiamo il testo per dare feedback all'utente
    const btn = e.target.querySelector('.btn-submit');
    const originalText = btn.innerText;
    btn.innerText = 'Registrazione in corso...';
    btn.disabled = true;

    try {
      // Facciamo la chiamata POST al nostro nuovo backend in Go
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: formData.nome,
          cognome: formData.cognome,
          email: formData.email,
          password: formData.password
        }),
      });

      if (response.ok) {
        alert('🎉 Registrazione completata con successo!');
        // Se vuoi, dopo l'alert puoi svuotare il form o reindirizzare al login
      } else {
        const errorMsg = await response.text();
        alert('❌ Errore: ' + errorMsg);
      }
    } catch (error) {
      alert('⚠️ Si è verificato un errore di connessione con il server.');
    } finally {
      // Riattiviamo il bottone
      btn.innerText = originalText;
      btn.disabled = false;
    }
  };

  return (
    <>
      <nav>
        <Link to="/" className="logo">Room<span>Date</span></Link>
        <Link to="/" className="nav-back">← Torna alla home</Link>
        <div className="nav-login">Hai già un account? <Link to="/accedi">Accedi</Link></div>
      </nav>

      <div className="page">
        {/* LEFT */}
        <div className="left">
          <div className="dot-grid"></div>
          <div className="left-content">
            <div className="left-eyebrow">Unisciti a RoomDate</div>
            <h2>Trova la tua stanza,<br/><em>trova casa.</em></h2>
            <p>Migliaia di stanze e coinquilini selezionati in tutta Italia. Registrati gratis e inizia subito.</p>
            
            <div className="benefits">
              <div className="benefit">
                <div className="benefit-icon">🔍</div>
                <div className="benefit-text">
                  <strong>Annunci verificati</strong>
                  <span>Ogni annuncio è controllato dal nostro team prima della pubblicazione.</span>
                </div>
              </div>
              <div className="benefit">
                <div className="benefit-icon">💬</div>
                <div className="benefit-text">
                  <strong>Chat diretta</strong>
                  <span>Parla subito con proprietari e coinquilini senza intermediari.</span>
                </div>
              </div>
              <div className="benefit">
                <div className="benefit-icon">🤝</div>
                <div className="benefit-text">
                  <strong>Match intelligente</strong>
                  <span>Ti mostriamo i profili più compatibili con il tuo stile di vita.</span>
                </div>
              </div>
              <div className="benefit">
                <div className="benefit-icon">🛡️</div>
                <div className="benefit-text">
                  <strong>Zero commissioni</strong>
                  <span>Nessun costo nascosto, nessuna agenzia. Solo connessioni vere.</span>
                </div>
              </div>
            </div>

            <div className="left-stats">
              <div className="lst"><div className="lst-n">12K+</div><div className="lst-l">Annunci attivi</div></div>
              <div className="lst"><div className="lst-n">98%</div><div className="lst-l">Soddisfatti</div></div>
              <div className="lst"><div className="lst-n">0€</div><div className="lst-l">Commissioni</div></div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="right">
          <div className="right-inner">

            {/* Steps */}
            <div className="steps-indicator">
              <div className="step-dot active"></div>
              <div className="step-dot"></div>
              <div className="step-dot"></div>
              <span className="step-label">Passo 1 di 3 — Tipo di account</span>
            </div>

            <h1>Crea il tuo account</h1>
            <p className="subtitle">Gratis, sempre. Nessuna carta di credito richiesta.</p>

            {/* Tipo utente (Sostituisce la vecchia funzione JS selectType) */}
            <div className="user-type">
              <button 
                className={`type-card ${userType === 'cerca' ? 'selected' : ''}`} 
                onClick={() => setUserType('cerca')}
              >
                <span className="type-icon">🔍</span>
                <span className="type-label">Cerco stanza</span>
                <span className="type-sub">Voglio trovare dove abitare</span>
              </button>
              <button 
                className={`type-card ${userType === 'affitta' ? 'selected' : ''}`} 
                onClick={() => setUserType('affitta')}
              >
                <span className="type-icon">🏠</span>
                <span className="type-label">Affitto stanza</span>
                <span className="type-sub">Ho uno spazio da condividere</span>
              </button>
            </div>

            {/* Social */}
            <div className="social-btns">
              <button className="social-btn">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continua con Google
              </button>
              <button className="social-btn">
                <svg viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Continua con Facebook
              </button>
            </div>

            <div className="divider">oppure registrati con email</div>

            {/* FORM EMULATO IN REACT */}
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="field">
                  <label>Nome</label>
                  <input type="text" name="nome" value={formData.nome} onChange={handleChange} placeholder="Mario" required/>
                </div>
                <div className="field">
                  <label>Cognome</label>
                  <input type="text" name="cognome" value={formData.cognome} onChange={handleChange} placeholder="Rossi" required/>
                </div>
              </div>
              
              <div className="field">
                <label>Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="mario@esempio.it" required/>
              </div>
              
              <div className="field">
                <label>Numero di telefono</label>
                <input type="tel" name="telefono" value={formData.telefono} onChange={handleChange} placeholder="+39 333 000 0000"/>
              </div>
              
              <div className="form-row">
                <div className="field">
                  <label>Città</label>
                  <select name="citta" value={formData.citta} onChange={handleChange} required>
                    <option value="">Seleziona...</option>
                    <option>Milano</option><option>Roma</option><option>Torino</option>
                    <option>Bologna</option><option>Firenze</option><option>Napoli</option>
                    <option>Altra città</option>
                  </select>
                </div>
                <div className="field">
                  <label>Data di nascita</label>
                  <input type="date" name="nascita" value={formData.nascita} onChange={handleChange} required/>
                </div>
              </div>
              
              {/* PASSWORD FIELD & STRENGTH INDICATOR */}
              <div className="field">
                <label>Password</label>
                <input 
                  type="password" 
                  name="password"
                  placeholder="Minimo 8 caratteri" 
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <div className="pw-strength">
                  {/* Generiamo dinamicamente le 4 barrette in base al punteggio */}
                  {[1, 2, 3, 4].map(num => (
                    <div 
                      key={num} 
                      className={`pw-bar ${score >= num ? currentStrength.barClass : ''}`}
                    ></div>
                  ))}
                </div>
                <div className="pw-label" style={{ color: currentStrength.color }}>
                  {currentStrength.text}
                </div>
              </div>

              <label className="checkbox-row">
                <input 
                  type="checkbox" 
                  name="accettaTermini" 
                  checked={formData.accettaTermini} 
                  onChange={handleChange}
                  required
                />
                <span>Accetto i <a href="#">Termini di Servizio</a> e la <a href="#">Privacy Policy</a> di RoomDate</span>
              </label>
              
              <label className="checkbox-row">
                <input 
                  type="checkbox" 
                  name="newsletter" 
                  checked={formData.newsletter} 
                  onChange={handleChange}
                />
                <span>Voglio ricevere aggiornamenti sugli annunci nella mia città via email</span>
              </label>

              <button type="submit" className="btn-submit">Crea il mio account gratuito 🚀</button>
            </form>
            
            <div className="login-link">Hai già un account? <Link to="/accedi">Accedi qui</Link></div>
          </div>
        </div>
      </div>
    </>
  );
}