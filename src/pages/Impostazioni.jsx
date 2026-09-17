import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../auth/AuthContext';
import { changePassword } from '../api/auth';
import { deleteMyAccount } from '../api/users';
import { useRevokeOtherSessions, useRevokeSession, useSessions } from '../api/hooks';
import { prepareKeysForPasswordChange, saveKeysAfterPasswordChange } from '../auth/keyStorage';
import { MIN_PASSWORD_LENGTH } from '../api/auth';

/** "oggi alle 14:05", "ieri alle 9:12" oppure "12 settembre alle 18:40". */
function whenLabel(isoDate) {
  const date = new Date(isoDate);
  const time = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (days === 0) return `oggi alle ${time}`;
  if (days === 1) return `ieri alle ${time}`;
  return `${date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} alle ${time}`;
}

export default function Impostazioni() {
  const navigate = useNavigate();
  // La pagina è protetta: qui l'utente in sessione c'è sempre
  const { user, logout, endLocalSession } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Stati per le password e i messaggi a schermo
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' }); // type: 'success' o 'error'
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsMenuOpen(false);
    navigate('/');
    await logout();
  };

  // --- CAMBIO PASSWORD ---
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setStatusMsg({ text: '', type: '' });

    // Se l'utente ha scritto qualcosa nella password, procediamo con l'aggiornamento
    if (newPassword) {
      if (!currentPassword) {
        setStatusMsg({ text: 'Inserisci la password attuale per confermare il cambio.', type: 'error' });
        return;
      }
      if (newPassword !== confirmPassword) {
        setStatusMsg({ text: 'Le password non coincidono!', type: 'error' });
        return;
      }
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        setStatusMsg({ text: `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`, type: 'error' });
        return;
      }

      setIsLoading(true);
      try {
        // 🔐 La chiave privata della chat è cifrata con la password: va cifrata di nuovo
        // con quella nuova, altrimenti tutti i messaggi diventerebbero illeggibili.
        const prepared = await prepareKeysForPasswordChange(currentPassword, newPassword);
        if (!prepared.ok) {
          setStatusMsg({ text: 'Password attuale errata, oppure le chiavi di cifratura salvate su questo dispositivo non sono aggiornate. Se la password è corretta, esci, accedi di nuovo e riprova.', type: 'error' });
          return;
        }

        await changePassword({ currentPassword, newPassword, keys: prepared.keys });

        if (prepared.keys) {
          saveKeysAfterPasswordChange(prepared.keys);
        }
        setStatusMsg({ text: 'Password aggiornata con successo!', type: 'success' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } catch (err) {
        setStatusMsg({ text: err.message, type: 'error' });
      } finally {
        setIsLoading(false);
      }
    } else {
      setStatusMsg({ text: 'Inserisci una nuova password per cambiarla.', type: 'error' });
    }
  };

  // --- DISPOSITIVI COLLEGATI ---
  const sessionsQuery = useSessions();
  const revokeSession = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  const handleRevokeSession = async (session) => {
    try {
      await revokeSession.mutateAsync(session.id);
      setStatusMsg({ text: 'Accesso chiuso su quel dispositivo.', type: 'success' });
    } catch (err) {
      setStatusMsg({ text: err.message, type: 'error' });
    }
  };

  const handleRevokeOthers = async () => {
    try {
      const closed = await revokeOthers.mutateAsync();
      setStatusMsg({
        text: closed === 0 ? 'Non c\'erano altri dispositivi collegati.' : `Chiusi ${closed} accessi sugli altri dispositivi.`,
        type: 'success',
      });
    } catch (err) {
      setStatusMsg({ text: err.message, type: 'error' });
    }
  };

  // --- ELIMINAZIONE ACCOUNT ---
  // L'operazione è definitiva: il server richiede la password, che va chiesta qui.
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (!window.confirm('Sei assolutamente sicuro? Tutti i tuoi dati verranno cancellati per sempre.')) return;
    try {
      await deleteMyAccount(deletePassword);
      // Il server ha già chiuso la sessione: resta da pulire il browser (la pagina protetta rimanda alla home)
      endLocalSession('signed_out');
    } catch (err) {
      setDeletePassword('');
      setStatusMsg({ text: err.message, type: 'error' });
    }
  };

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
          <span className="text-sm text-neutral-500">Ciao, <strong className="text-neutral-900">{user.firstName}</strong>!</span>
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
               <h3 className="text-xl text-neutral-900 font-bold">👤 Ciao, {user.firstName}!</h3>
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
          <p className="text-neutral-500 font-medium">Gestisci l'accesso al tuo account.</p>
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

              <div className="flex flex-col gap-2 mb-5">
                <label className="text-sm font-bold text-neutral-900">Password Attuale</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Necessaria per cambiare la password"
                  autoComplete="current-password"
                  className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all font-medium placeholder:text-neutral-400"
                />
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

        {/* DISPOSITIVI COLLEGATI */}
        <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-neutral-100 mb-8">
          <h3 className="text-lg font-extrabold text-neutral-900 border-b border-neutral-100 pb-4 mb-6 flex items-center gap-2">
            💻 Dispositivi collegati
          </h3>
          <p className="text-neutral-500 text-sm font-medium mb-6">
            Qui vedi da dove è aperto il tuo account. Se non riconosci un dispositivo, chiudine l&apos;accesso e cambia la password.
          </p>

          {sessionsQuery.isPending ? (
            <p className="text-neutral-400 font-medium">Caricamento...</p>
          ) : sessionsQuery.isError ? (
            <p className="text-rose-600 font-medium">{sessionsQuery.error.message}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {sessionsQuery.data.map(session => (
                <li key={session.id} data-testid="session" className="flex flex-wrap items-center justify-between gap-3 bg-neutral-50 border border-neutral-100 rounded-2xl px-5 py-4">
                  <div>
                    <div className="font-bold text-neutral-900">
                      {session.device}
                      {session.current && <span className="ml-2 text-[11px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">questo dispositivo</span>}
                    </div>
                    <div className="text-xs text-neutral-500 font-medium mt-0.5">
                      Ultimo utilizzo {whenLabel(session.lastUsedAt)} · accesso {whenLabel(session.createdAt)}
                    </div>
                  </div>
                  {!session.current && (
                    <button
                      onClick={() => handleRevokeSession(session)}
                      disabled={revokeSession.isPending}
                      className="bg-white border border-neutral-200 text-neutral-700 hover:border-rose-300 hover:text-rose-600 px-5 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      Chiudi accesso
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleRevokeOthers}
              disabled={revokeOthers.isPending}
              className="bg-neutral-900 text-white hover:bg-neutral-800 px-6 py-3 rounded-full font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {revokeOthers.isPending ? 'Chiusura...' : 'Esci dagli altri dispositivi'}
            </button>
          </div>
        </div>

        {/* DANGER ZONE */}
        <div className="bg-rose-50/50 p-6 md:p-10 rounded-3xl shadow-sm border border-rose-100">
          <h3 className="text-rose-600 font-extrabold text-xl mb-3 flex items-center gap-2">
            ⚠️ Zona Pericolosa
          </h3>
          <p className="text-rose-800/80 text-sm mb-8 leading-relaxed max-w-2xl font-medium">
            Se elimini il tuo account, perderai tutti i tuoi annunci e le conversazioni crittografate. 
            Questa operazione è irreversibile e i tuoi dati verranno cancellati in modo permanente dai nostri server.
          </p>
          {isDeleting ? (
            <form onSubmit={handleDeleteAccount} className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <input
                type="password"
                name="deletePassword"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Conferma con la tua password"
                className="flex-1 bg-white border border-rose-200 text-neutral-900 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all font-medium placeholder:text-neutral-400"
              />
              <button
                type="submit"
                disabled={!deletePassword}
                className="bg-rose-600 text-white hover:bg-rose-700 px-8 py-3.5 rounded-full font-bold transition-all shadow-sm cursor-pointer disabled:bg-neutral-300 disabled:cursor-not-allowed"
              >
                Elimina definitivamente
              </button>
              <button
                type="button"
                onClick={() => { setIsDeleting(false); setDeletePassword(''); }}
                className="text-neutral-500 hover:text-neutral-900 font-bold px-4 py-3.5 cursor-pointer"
              >
                Annulla
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsDeleting(true)}
              className="bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 px-8 py-3.5 rounded-full font-bold transition-all shadow-sm w-full md:w-auto text-center cursor-pointer"
            >
              Elimina Account Definitivamente
            </button>
          )}
        </div>

      </div>
    </div>
  );
}