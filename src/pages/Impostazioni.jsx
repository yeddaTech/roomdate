import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Impostazioni() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Stati per i toggle delle impostazioni
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
    setIsMenuOpen(false);
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
    <div className="min-h-screen bg-[#FEFAF4] pb-20 md:pb-0 font-sans">
      
      {/* --- TOP NAV (Coerente) --- */}
      <nav className="sticky top-0 z-50 bg-[#2C1A0E] text-white px-6 py-4 flex justify-between items-center shadow-md border-b-2 border-[#C4603A]">
        <Link to="/" className="font-serif text-2xl font-bold tracking-tight text-white decoration-none">
          Room<span className="text-[#D4835E]">Date</span>
        </Link>
        
        <div className="hidden md:flex gap-8 items-center text-sm font-medium text-neutral-300">
          <Link to="/" className="hover:text-[#D4835E] transition-colors">Home</Link>
          <Link to="/ricerca" className="hover:text-[#D4835E] transition-colors">Cerca Stanza</Link>
          <Link to="/chat" className="hover:text-[#D4835E] transition-colors">Chat</Link>
          <Link to="/dashboard" className="hover:text-[#D4835E] transition-colors">Profilo</Link>
          <Link to="/impostazioni" className="text-[#D4835E] transition-colors">Impostazioni</Link>
        </div>

        <div className="hidden md:flex gap-4 items-center">
          {user ? (
            <>
              <span className="text-sm text-neutral-300">Ciao, <strong className="text-white">{user.nome}</strong>!</span>
              <button onClick={handleLogout} className="border border-neutral-500 hover:border-[#D4835E] hover:text-[#D4835E] px-4 py-2 rounded-full text-sm transition-colors">Esci</button>
            </>
          ) : (
            <>
              <Link to="/accedi" className="border border-neutral-500 hover:border-[#D4835E] hover:text-[#D4835E] px-4 py-2 rounded-full text-sm transition-colors">Accedi</Link>
              <Link to="/registrati" className="bg-[#C4603A] hover:bg-[#9A4628] px-5 py-2 rounded-full text-sm font-bold transition-colors">Registrati Gratis</Link>
            </>
          )}
        </div>

        {/* Hamburger Mobile */}
        <button className="md:hidden flex flex-col gap-1.5 z-[1001]" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <div className={`w-7 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
          <div className={`w-7 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></div>
          <div className={`w-7 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
        </button>
      </nav>

      {/* --- MOBILE SIDEBAR APP MENU --- */}
      <div className={`fixed inset-y-0 right-0 w-72 bg-[#2C1A0E] shadow-2xl z-[1000] p-8 pt-24 transform transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col gap-6 text-lg font-medium text-white">
          {user && (
             <div className="border-b border-neutral-700 pb-4 mb-2">
               <h3 className="text-xl">👤 Ciao, {user.nome}!</h3>
             </div>
          )}
          <Link to="/" onClick={() => setIsMenuOpen(false)}>🏠 Home</Link>
          <Link to="/ricerca" onClick={() => setIsMenuOpen(false)}>🔍 Cerca Stanza</Link>
          <Link to="/chat" onClick={() => setIsMenuOpen(false)}>💬 Chat</Link>
          <Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>👤 Il mio Profilo</Link>
          <Link to="/impostazioni" onClick={() => setIsMenuOpen(false)}>⚙️ Impostazioni</Link>
          
          <div className="mt-8 flex flex-col gap-3">
            {user ? (
              <button onClick={handleLogout} className="bg-[#C4603A] w-full py-3 rounded-full font-bold">Esci</button>
            ) : (
              <>
                <Link to="/accedi" className="border border-neutral-500 text-center py-3 rounded-full" onClick={() => setIsMenuOpen(false)}>Accedi</Link>
                <Link to="/registrati" className="bg-[#C4603A] text-center py-3 rounded-full font-bold" onClick={() => setIsMenuOpen(false)}>Registrati</Link>
              </>
            )}
          </div>
        </div>
      </div>
      {isMenuOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] md:hidden" onClick={() => setIsMenuOpen(false)}></div>}

      {/* --- CONTENUTO PAGINA --- */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 animate-fade-in-up">
        <h1 className="font-serif text-3xl md:text-5xl text-[#2C1A0E] mb-8 font-bold">Impostazioni Account</h1>
        
        {/* CARD IMPOSTAZIONI */}
        <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-orange-50 mb-8">
          <form onSubmit={handleSaveSettings} className="flex flex-col gap-8">
            
            {/* SEZIONE SICUREZZA */}
            <section>
              <h3 className="text-[#C4603A] font-bold text-lg border-b border-orange-100 pb-3 mb-6">Sicurezza</h3>
              
              <div className="flex flex-col gap-2 mb-6">
                <label className="text-sm font-bold text-[#2C1A0E]">Email dell'account</label>
                <input 
                  type="email" 
                  defaultValue={user.email} 
                  disabled 
                  className="w-full bg-neutral-100 border border-neutral-200 text-[#8A7B6E] rounded-2xl px-5 py-3.5 focus:outline-none cursor-not-allowed opacity-80"
                />
                <small className="text-xs text-[#8A7B6E] mt-1 ml-2">L'email non può essere modificata.</small>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-[#2C1A0E]">Nuova Password</label>
                <input 
                  type="password" 
                  placeholder="Lascia vuoto per non modificare" 
                  className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-5 py-3.5 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A] transition-colors"
                />
              </div>
            </section>

            {/* SEZIONE NOTIFICHE */}
            <section>
              <h3 className="text-[#C4603A] font-bold text-lg border-b border-orange-100 pb-3 mb-6">Notifiche</h3>
              
              <div className="flex flex-col gap-4">
                <label className="flex items-center gap-4 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={emailNotif} 
                    onChange={(e) => setEmailNotif(e.target.checked)} 
                    className="w-6 h-6 text-[#C4603A] bg-neutral-50 border-neutral-300 rounded-lg focus:ring-[#C4603A] accent-[#C4603A] cursor-pointer"
                  />
                  <span className="text-[#2C1A0E] font-medium group-hover:text-[#C4603A] transition-colors">Ricevi aggiornamenti e messaggi via Email</span>
                </label>

                <label className="flex items-center gap-4 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={pushNotif} 
                    onChange={(e) => setPushNotif(e.target.checked)} 
                    className="w-6 h-6 text-[#C4603A] bg-neutral-50 border-neutral-300 rounded-lg focus:ring-[#C4603A] accent-[#C4603A] cursor-pointer"
                  />
                  <span className="text-[#2C1A0E] font-medium group-hover:text-[#C4603A] transition-colors">Abilita notifiche Push nel browser</span>
                </label>
              </div>
            </section>

            {/* PULSANTE SALVATAGGIO */}
            <div className="mt-4 pt-6 border-t border-neutral-100 flex justify-end">
              <button type="submit" className="w-full md:w-auto bg-[#4CAF50] hover:bg-[#388E3C] text-white px-8 py-4 rounded-full font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5">
                Salva Modifiche
              </button>
            </div>
          </form>
        </div>

        {/* DANGER ZONE */}
        <div className="bg-[#FFF5F5] p-6 md:p-10 rounded-3xl shadow-sm border border-red-100">
          <h3 className="text-red-600 font-bold text-xl mb-3 flex items-center gap-2">
            ⚠️ Zona Pericolosa
          </h3>
          <p className="text-[#8A7B6E] text-sm mb-8 leading-relaxed max-w-2xl">
            Se elimini il tuo account, perderai tutti i tuoi annunci, le conversazioni e le stanze salvate. 
            Questa operazione è irreversibile e i tuoi dati verranno cancellati dai nostri server.
          </p>
          <button 
            onClick={handleDeleteAccount}
            className="bg-transparent border-2 border-red-500 text-red-600 hover:bg-red-50 px-6 py-3 rounded-2xl font-bold transition-colors w-full md:w-auto text-center"
          >
            Elimina Account Definitivamente
          </button>
        </div>

      </div>

    </div>
  );
}