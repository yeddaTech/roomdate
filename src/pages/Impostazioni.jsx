import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { fetchAPI } from '../utils/api'; 

export default function Impostazioni() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Stati per le password e i messaggi a schermo
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' }); // type: 'success' o 'error'
  const [isLoading, setIsLoading] = useState(false);

  // Stati per i toggle delle impostazioni
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(false);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('roomdate_user');
      if (!savedUser) {
        navigate('/accedi'); // Se non è loggato, via!
      } else {
        setUser(JSON.parse(savedUser));
      }
    } catch {
      navigate('/accedi');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('roomdate_user');
    sessionStorage.clear();
    setIsMenuOpen(false);
    navigate('/');
  };

  // --- LA VERA CHIAMATA API PER LA PASSWORD (Usando il trucco del Login Multiplexer) ---
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setStatusMsg({ text: '', type: '' });

    // Se l'utente ha scritto qualcosa nella password, procediamo con l'aggiornamento
    if (newPassword) {
      if (newPassword !== confirmPassword) {
        setStatusMsg({ text: 'Le password non coincidono!', type: 'error' });
        return;
      }
      if (newPassword.length < 6) {
        setStatusMsg({ text: 'La password deve avere almeno 6 caratteri.', type: 'error' });
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetchAPI('/api/login', {
          method: 'POST',
          body: JSON.stringify({ 
            action: 'update_password', 
            userId: user.id, 
            newPassword: newPassword 
          })
        });

        if (res.ok) {
          setStatusMsg({ text: 'Password aggiornata con successo!', type: 'success' });
          setNewPassword('');
          setConfirmPassword('');
        } else {
          const data = await res.text();
          setStatusMsg({ text: data || 'Errore durante l\'aggiornamento.', type: 'error' });
        }
      } catch (err) {
        setStatusMsg({ text: 'Errore di connessione al server.', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    } else {
      // Se non ha toccato la password ma ha premuto salva (es. per le notifiche)
      setStatusMsg({ text: 'Impostazioni generali aggiornate.', type: 'success' });
    }
  };

  // --- LA VERA CHIAMATA API PER ELIMINARE L'ACCOUNT ---
  const handleDeleteAccount = async () => {
    if (window.confirm("Sei assolutamente sicuro? Tutti i tuoi dati verranno cancellati per sempre.")) {
      try {
        const res = await fetchAPI('/api/login', {
          method: 'POST',
          body: JSON.stringify({ 
            action: 'delete_account', 
            userId: user.id 
          })
        });

        if (res.ok) {
          handleLogout(); 
        } else {
          alert("Impossibile eliminare l'account in questo momento. Riprova più tardi.");
        }
      } catch (err) {
        alert("Errore di connessione al server.");
      }
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-20 md:pb-12 font-sans selection:bg-orange-200">
      <Helmet>
        <title>Impostazioni | RoomDate</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      {/* --- TOP NAV (GLASSMORPHISM) --- */}
      <nav className="shrink-0 z-50 bg-white/80 backdrop-blur-md px-6 py-4 flex justify-between items-center shadow-sm border-b border-neutral-100 sticky top-0">
        <Link to="/" className="font-serif text-2xl font-bold tracking-tight text-neutral-900 decoration-none">
          Room<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">Date</span>
        </Link>
        
        <div className="hidden md:flex gap-8 items-center text-sm font-medium text-neutral-500">
          <Link to="/" className="hover:text-neutral-900 transition-colors">Home</Link>
          <Link to="/ricerca" className="hover:text-neutral-900 transition-colors">Cerca Stanza</Link>
          <Link to="/chat" className="hover:text-neutral-900 transition-colors">Chat</Link>
          <Link to="/dashboard" className="hover:text-neutral-900 transition-colors">Profilo</Link>
          <Link to="/impostazioni" className="text-orange-500 font-bold transition-colors">Impostazioni</Link>
        </div>

        <div className="hidden md:flex gap-4 items-center">
          <span className="text-sm text-neutral-500">Ciao, <strong className="text-neutral-900">{user.nome || user.first_name || 'Utente'}</strong>!</span>
          <button onClick={handleLogout} className="border border-neutral-200 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer">Esci</button>
        </div>

        {/* Hamburger Mobile */}
        <button className="md:hidden flex flex-col gap-1.5 z-[1001] cursor-pointer" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Menu">          
          <div className={`w-6 h-0.5 bg-neutral-900 transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
          <div className={`w-6 h-0.5 bg-neutral-900 transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></div>
          <div className={`w-6 h-0.5 bg-neutral-900 transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
        </button>
      </nav>

      {/* --- MOBILE SIDEBAR APP MENU --- */}
      <div className={`fixed inset-y-0 right-0 w-72 bg-white shadow-2xl z-[1000] p-8 pt-24 transform transition-transform duration-300 ease-in-out border-l border-neutral-100 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col gap-6 text-lg font-medium text-neutral-600">
          {user && (
             <div className="border-b border-neutral-100 pb-4 mb-2">
               <h3 className="text-xl text-neutral-900 font-bold">👤 Ciao, {user.nome || user.first_name || 'Utente'}!</h3>
             </div>
          )}
          <Link to="/" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">🏠 Home</Link>
          <Link to="/ricerca" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">🔍 Cerca Stanza</Link>
          <Link to="/chat" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">💬 Chat</Link>
          <Link to="/dashboard" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">👤 Il mio Profilo</Link>
          <Link to="/impostazioni" onClick={() => setIsMenuOpen(false)} className="text-orange-500 font-bold">⚙️ Impostazioni</Link>
          
          <button onClick={handleLogout} className="bg-neutral-900 text-white w-full py-3 rounded-2xl font-bold mt-4 hover:bg-neutral-800 transition-colors cursor-pointer">Esci</button>
        </div>
      </div>
      {isMenuOpen && <div className="fixed inset-0 bg-neutral-900/20 backdrop-blur-sm z-[999] md:hidden transition-opacity" onClick={() => setIsMenuOpen(false)}></div>}

      {/* --- CONTENUTO PAGINA --- */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 animate-fade-in-up">
        
        <div className="mb-10 text-center md:text-left">
          <h1 className="font-serif text-3xl md:text-5xl text-neutral-900 mb-3 font-extrabold tracking-tight">Impostazioni Account</h1>
          <p className="text-neutral-500 font-medium">Gestisci la tua sicurezza, le notifiche e le preferenze del tuo account.</p>
        </div>
        
        {/* MESSAGGIO DI STATO */}
        {statusMsg.text && (
          <div className={`mb-8 p-4 rounded-2xl font-bold flex items-center gap-3 shadow-sm ${statusMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            <span className="text-xl">{statusMsg.type === 'success' ? '✅' : '⚠️'}</span> {statusMsg.text}
          </div>
        )}

        {/* CARD IMPOSTAZIONI */}
        <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-neutral-100 mb-8 relative overflow-hidden">
          
          {/* Sottile orb decorativo */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-orange-400/5 blur-[80px] rounded-full pointer-events-none"></div>

          <form onSubmit={handleSaveSettings} className="flex flex-col gap-10 relative z-10">
            
            {/* SEZIONE SICUREZZA E ACCESSO */}
            <section>
              <h3 className="text-lg font-extrabold text-neutral-900 border-b border-neutral-100 pb-4 mb-6 flex items-center gap-2">
                🔒 Sicurezza & Accesso
              </h3>
              
              <div className="flex flex-col gap-2 mb-6">
                <label className="text-sm font-bold text-neutral-900">Email dell'account</label>
                <input 
                  type="email" 
                  defaultValue={user.email} 
                  disabled 
                  className="w-full bg-neutral-50 border border-neutral-200 text-neutral-500 rounded-2xl px-5 py-3.5 focus:outline-none cursor-not-allowed opacity-80 font-medium"
                />
                <small className="text-xs text-neutral-400 mt-1 ml-2 font-medium">L'indirizzo email non può essere modificato.</small>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-neutral-900">Nuova Password</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Scrivi qui per cambiare" 
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all font-medium placeholder:text-neutral-400"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-neutral-900">Conferma Nuova Password</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ripeti la nuova password" 
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all font-medium placeholder:text-neutral-400"
                  />
                </div>
              </div>
            </section>

            {/* SEZIONE NOTIFICHE */}
            <section>
              <h3 className="text-lg font-extrabold text-neutral-900 border-b border-neutral-100 pb-4 mb-6 flex items-center gap-2">
                🔔 Notifiche
              </h3>
              
              <div className="flex flex-col gap-4">
                <label className="flex items-center gap-4 cursor-pointer group bg-neutral-50 p-4 rounded-2xl border border-neutral-100 hover:border-orange-200 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={emailNotif} 
                    onChange={(e) => setEmailNotif(e.target.checked)} 
                    className="w-5 h-5 text-orange-500 bg-white border-neutral-300 rounded focus:ring-orange-500 accent-orange-500 cursor-pointer"
                  />
                  <span className="text-neutral-700 font-medium group-hover:text-neutral-900 transition-colors">Ricevi aggiornamenti e messaggi via Email</span>
                </label>

                <label className="flex items-center gap-4 cursor-pointer group bg-neutral-50 p-4 rounded-2xl border border-neutral-100 hover:border-orange-200 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={pushNotif} 
                    onChange={(e) => setPushNotif(e.target.checked)} 
                    className="w-5 h-5 text-orange-500 bg-white border-neutral-300 rounded focus:ring-orange-500 accent-orange-500 cursor-pointer"
                  />
                  <span className="text-neutral-700 font-medium group-hover:text-neutral-900 transition-colors">Abilita notifiche Push nel browser</span>
                </label>
              </div>
            </section>

            {/* PULSANTE SALVATAGGIO */}
            <div className="pt-6 border-t border-neutral-100 flex justify-end">
              <button 
                type="submit" 
                disabled={isLoading}
                className={`w-full md:w-auto px-10 py-4 rounded-full font-bold transition-all shadow-md flex justify-center items-center ${isLoading ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:scale-[1.02] hover:shadow-orange-500/25 cursor-pointer'}`}
              >
                {isLoading ? 'Salvataggio in corso...' : 'Salva Modifiche'}
              </button>
            </div>
          </form>
        </div>

        {/* DANGER ZONE */}
        <div className="bg-rose-50/50 p-6 md:p-10 rounded-3xl shadow-sm border border-rose-100">
          <h3 className="text-rose-600 font-extrabold text-xl mb-3 flex items-center gap-2">
            ⚠️ Zona Pericolosa
          </h3>
          <p className="text-rose-800/80 text-sm mb-8 leading-relaxed max-w-2xl font-medium">
            Se elimini il tuo account, perderai tutti i tuoi annunci, le conversazioni crittografate e le stanze salvate. 
            Questa operazione è irreversibile e i tuoi dati verranno cancellati in modo permanente dai nostri server.
          </p>
          <button 
            onClick={handleDeleteAccount}
            className="bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 px-8 py-3.5 rounded-full font-bold transition-all shadow-sm w-full md:w-auto text-center cursor-pointer"
          >
            Elimina Account Definitivamente
          </button>
        </div>

      </div>
    </div>
  );
}