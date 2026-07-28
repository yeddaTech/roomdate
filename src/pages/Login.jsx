import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { unwrapPrivateKey } from '../utils/crypto';
import { fetchAPI } from '../utils/api';

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
        const response = await fetchAPI('/api/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }) 
        });

        if (response.ok) {
          const data = await response.json();
          
          try {
          // --- 🔐 LOGICA CRITTOGRAFICA INIZIO ---
            if (data.encryptedPrivateKey && data.cryptoSalt && data.cryptoIv) {
                localStorage.setItem('roomdate_crypto', JSON.stringify({
                  encryptedPrivateKey: data.encryptedPrivateKey,
                  cryptoSalt: data.cryptoSalt,
                  cryptoIv: data.cryptoIv
                }));

                const privateKey = await unwrapPrivateKey(
                  data.encryptedPrivateKey,
                  password,
                  data.cryptoSalt,
                  data.cryptoIv
                );
                sessionStorage.setItem('roomdate_private_key', privateKey);
            }
          // --- 🔐 LOGICA CRITTOGRAFICA FINE ---

            setIsSuccess(true);
            localStorage.setItem('roomdate_user', JSON.stringify(data.user));

            if (data.publicKey) {
                localStorage.setItem('roomdate_public_key', data.publicKey);
            }

            setTimeout(() => {
              navigate('/'); 
            }, 1500);

          } catch (cryptoError) {
             console.error("Impossibile decifrare la chiave:", cryptoError);
             alert('⚠️ Accesso effettuato, ma la chiave di sicurezza non è valida. Potresti non riuscire a leggere i messaggi.');
             setIsSubmitting(false);
          }

        } else {
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
    <div className="min-h-[100dvh] flex flex-col font-sans bg-[#FAFAFA] selection:bg-orange-200">
      
      {/* --- TOP NAV MINIMALE (GLASSMORPHISM) --- */}
      <nav className="shrink-0 z-50 bg-white/80 backdrop-blur-md px-6 py-4 flex justify-between items-center shadow-sm border-b border-neutral-100 absolute top-0 w-full">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-serif text-2xl font-bold tracking-tight text-neutral-900 decoration-none">
            Room<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">Date</span>
          </Link>
          <Link to="/" className="hidden md:flex text-sm text-neutral-500 hover:text-neutral-900 font-medium transition-colors">
            ← Torna alla home
          </Link>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-sm text-neutral-500 font-medium">Non hai un account?</span>
          <Link to="/registrati" className="bg-neutral-900 hover:bg-neutral-800 px-5 py-2 rounded-full text-sm font-bold text-white transition-colors shadow-sm">Registrati gratis</Link>
        </div>
      </nav>

      {/* --- MAIN LAYOUT SPLIT --- */}
      <div className="flex-1 flex flex-col lg:flex-row w-full pt-16 md:pt-0">
        
        {/* LEFT COLUMN (Informativa - Nascosta su mobile) */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-orange-500 to-rose-500 p-16 flex-col justify-center relative overflow-hidden text-white">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-white/20 blur-[100px] rounded-full pointer-events-none"></div>
          
          <div className="relative z-10 max-w-lg mx-auto">
            <div className="text-white/80 text-xs font-bold uppercase tracking-widest mb-3">Bentornato su RoomDate</div>
            <h2 className="font-serif text-5xl font-extrabold leading-tight mb-6">Riprendi da<br/><em className="font-light opacity-90">dove hai lasciato.</em></h2>
            <p className="text-white/90 text-lg mb-12 font-medium">I tuoi annunci salvati, i tuoi messaggi protetti e i tuoi match ti aspettano.</p>

            {/* Testimonial Card */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-3xl shadow-xl mb-12 transform transition-transform hover:scale-[1.02]">
              <div className="text-orange-200 text-xl mb-4 tracking-widest">★★★★★</div>
              <p className="text-white italic leading-relaxed mb-6 font-medium">"Ho trovato il coinquilino perfetto in 4 giorni. Non avrei mai pensato fosse così semplice e sicuro!"</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl bg-white shadow-inner">
                  👩
                </div>
                <div>
                  <div className="font-bold text-white">Martina F.</div>
                  <div className="text-xs text-white/70 font-medium">26 anni · Milano</div>
                </div>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-col gap-3">
              {['Profili verificati e sicuri', 'Chat crittografata E2EE', '12.000+ annunci in tutta Italia', 'Zero commissioni, sempre'].map((text, i) => (
                <div key={i} className="flex items-center gap-3 text-sm font-medium text-white/90">
                  <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Form di Login) */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 md:p-12 relative">
          
          {/* Effetto Orb in background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-orange-400/10 blur-[80px] rounded-full pointer-events-none"></div>

          <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-3xl shadow-lg border border-neutral-100 relative z-10 animate-fade-in-up">
            <h1 className="font-serif text-4xl text-neutral-900 font-extrabold mb-2 tracking-tight">Bentornato!</h1>
            <p className="text-neutral-500 text-sm mb-8 font-medium">Accedi al tuo account RoomDate per continuare la ricerca.</p>

            {/* Success Banner */}
            {isSuccess && (
              <div className="bg-green-50 text-green-700 px-4 py-4 rounded-2xl mb-6 font-bold text-sm border border-green-200 flex items-center gap-3 shadow-sm">
                <span className="text-lg">✅</span> Accesso effettuato! Reindirizzamento...
              </div>
            )}

            {/* Social Login */}
            <div className="flex flex-col gap-3 mb-8">
              <button className="w-full flex justify-center items-center gap-3 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-sm cursor-pointer">
                <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Accedi con Google
              </button>
              <div className="flex gap-3">
                <button className="flex-1 flex justify-center items-center gap-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-sm cursor-pointer">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Facebook
                </button>
                <button className="flex-1 flex justify-center items-center gap-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-sm cursor-pointer">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.459 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z"/></svg>
                  Apple
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-neutral-200"></div>
              <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-bold">oppure accedi con email</span>
              <div className="flex-1 h-px bg-neutral-200"></div>
            </div>

            {/* FORM REACT */}
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-neutral-900">Email</label>
                <input 
                  type="email" 
                  placeholder="mario@esempio.it" 
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: false });
                  }}
                  className={`w-full bg-neutral-50 border text-neutral-900 text-base md:text-sm rounded-2xl px-5 py-3.5 focus:outline-none transition-all ${errors.email ? 'border-red-500 focus:ring-2 focus:ring-red-100 bg-red-50/30' : 'border-neutral-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'}`}
                />
                {errors.email && <div className="text-red-500 text-xs mt-1 ml-1 font-bold">Inserisci un indirizzo email valido.</div>}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-neutral-900">Password</label>
                  <a href="#reset" onClick={handleResetPassword} className="text-[13px] text-orange-500 font-bold hover:text-orange-600 transition-colors">Password dimenticata?</a>
                </div>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="La tua password" 
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors({ ...errors, password: false });
                    }}
                    className={`w-full bg-neutral-50 border text-neutral-900 text-base md:text-sm rounded-2xl pl-5 pr-20 py-3.5 focus:outline-none transition-all ${errors.password ? 'border-red-500 focus:ring-2 focus:ring-red-100 bg-red-50/30' : 'border-neutral-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'}`}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-bold text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                  >
                    {showPassword ? 'Nascondi' : 'Mostra'}
                  </button>
                </div>
                {errors.password && <div className="text-red-500 text-xs mt-1 ml-1 font-bold">La password deve essere di almeno 6 caratteri.</div>}
              </div>

              <label className="flex items-center gap-3 cursor-pointer mt-2 group w-max">
                <input type="checkbox" defaultChecked className="w-5 h-5 text-orange-500 bg-neutral-50 border-neutral-300 rounded focus:ring-orange-500 accent-orange-500 cursor-pointer transition-all" />
                <span className="text-sm text-neutral-500 font-medium group-hover:text-neutral-900 transition-colors">Ricordami su questo dispositivo</span>
              </label>

              <button 
                type="submit"
                disabled={isSubmitting}
                className={`w-full mt-4 text-white py-4 rounded-full font-bold transition-all shadow-md flex justify-center items-center ${isSubmitting ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-orange-500 to-rose-500 hover:scale-[1.02] hover:shadow-orange-500/25 cursor-pointer'}`}
              >
                {isSubmitting ? 'Accesso in corso...' : 'Accedi al mio account'}
              </button>
              
            </form>

            <div className="text-center mt-8 text-sm text-neutral-500 font-medium">
              Non hai ancora un account? <Link to="/registrati" className="text-orange-500 font-bold hover:text-orange-600 transition-colors">Registrati gratis</Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}