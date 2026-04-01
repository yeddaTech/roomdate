import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Login.css'; // <-- Importiamo il CSS!

export default function Login() {
  const navigate = useNavigate();

  // --- STATI DEL FORM ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Stati per gli errori e il successo
  const [errors, setErrors] = useState({ email: false, password: false });
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);


// --- LOGICA DI LOGIN VERA ---
  const handleLogin = async (e) => {
    e.preventDefault(); 
    
    let isValid = true;
    const newErrors = { email: false, password: false };

    if (!email || !/\S+@\S+\.\S+/.test(email)) { newErrors.email = true; isValid = false; }
    if (!password || password.length < 6) { newErrors.password = true; isValid = false; }

    setErrors(newErrors);

    if (isValid) {
      setIsSubmitting(true);
      
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        if (response.ok) {
          const data = await response.json();
          setIsSuccess(true);
          
          // Salviamo i dati dell'utente nel browser in modo sicuro
          localStorage.setItem('roomdate_user', JSON.stringify(data.user));

          // Aspettiamo 1.5s per far vedere il banner verde, poi andiamo all'area riservata
          setTimeout(() => {
            navigate('/dashboard'); // <-- Nuova rotta!
          }, 1500);

        } else {
          // Se la password è sbagliata o l'email non esiste
          const errorMsg = await response.text();
          alert('❌ Errore di accesso: ' + errorMsg);
        }
      } catch (error) {
        alert('Errore di connessione al server.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    const resetEmail = prompt('Inserisci la tua email per reimpostare la password:');
    if (resetEmail) {
      alert(`✅ Email inviata a ${resetEmail}!\nControlla la tua casella di posta.`);
    }
  };

  return (
    <>
      <nav>
        <Link to="/" className="logo">Room<span>Date</span></Link>
        <Link to="/" className="nav-back">← Torna alla home</Link>
        <div className="nav-reg">Non hai un account? <Link to="/registrati">Registrati gratis</Link></div>
      </nav>

      <div className="page">
        {/* LEFT */}
        <div className="left">
          <div className="dot-grid"></div>
          <div className="left-content">
            <div className="left-eyebrow">Bentornato su RoomDate</div>
            <h2>Riprendi da<br/>dove <em>hai lasciato.</em></h2>
            <p>I tuoi annunci salvati, i tuoi messaggi e i tuoi match ti aspettano.</p>

            <div className="t-card">
              <div className="t-stars">★★★★★</div>
              <p className="t-text">"Ho trovato il coinquilino perfetto in 4 giorni. Non avrei mai pensato fosse così semplice e veloce!"</p>
              <div className="t-author">
                <div className="t-av" style={{ background: 'linear-gradient(135deg, #F5C29A, #C4603A)' }}>👩</div>
                <div>
                  <div className="t-name">Martina F.</div>
                  <div className="t-sub">26 anni · Milano</div>
                </div>
              </div>
            </div>

            <div className="trust-row">
              <div className="trust-item"><div className="trust-dot"></div>Profili verificati e sicuri</div>
              <div className="trust-item"><div className="trust-dot"></div>Chat diretta senza intermediari</div>
              <div className="trust-item"><div className="trust-dot"></div>12.000+ annunci in tutta Italia</div>
              <div className="trust-item"><div className="trust-dot"></div>Zero commissioni, sempre</div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="right">
          <div className="right-inner">

            <h1>Bentornato!</h1>
            <p className="subtitle">Accedi al tuo account RoomDate per continuare la ricerca.</p>

            {/* Success banner */}
            <div className={`success-banner ${isSuccess ? 'show' : ''}`}>
              <span>✅ Accesso effettuato con successo! Reindirizzamento...</span>
            </div>

            {/* Social */}
            <div className="social-btns">
              <button className="social-btn">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Accedi con Google
              </button>
              <div className="social-row">
                <button className="social-btn">
                  <svg viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Facebook
                </button>
                <button className="social-btn">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.459 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z"/></svg>
                  Apple
                </button>
              </div>
            </div>

            <div className="divider">oppure accedi con email</div>

            {/* FORM EMULATO IN REACT */}
            <div className={`field ${errors.email ? 'error' : ''}`}>
              <div className="field-header">
                <label>Email</label>
              </div>
              <input 
                type="email" 
                placeholder="mario@esempio.it" 
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: false });
                }}
              />
              <div className="field-error">Inserisci un indirizzo email valido.</div>
            </div>

            <div className={`field ${errors.password ? 'error' : ''}`}>
              <div className="field-header">
                <label>Password</label>
                <a href="#reset" onClick={handleResetPassword}>Password dimenticata?</a>
              </div>
              <div className="pw-wrap">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="La tua password" 
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: false });
                  }}
                />
                <button 
                  type="button" 
                  className="pw-toggle" 
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Nascondi' : 'Mostra'}
                </button>
              </div>
              <div className="field-error">La password deve essere di almeno 6 caratteri.</div>
            </div>

            <div className="remember-row">
              <label className="remember-left">
                <input type="checkbox" defaultChecked />
                <span>Ricordami su questo dispositivo</span>
              </label>
            </div>

            <button 
              className="btn-submit" 
              onClick={handleLogin}
              style={{ opacity: isSubmitting ? 0.7 : 1 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Accesso in corso...' : 'Accedi al mio account'}
            </button>
            
            <div className="register-link">Non hai ancora un account? <Link to="/registrati">Registrati gratis</Link></div>

          </div>
        </div>
      </div>
    </>
  );
}