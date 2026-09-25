import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import { useAuth } from '../auth/AuthContext';
import { changePassword } from '../api/auth';
import { deleteMyAccount } from '../api/users';
import { useQueryClient } from '@tanstack/react-query';
import { useBlocks, useMyProfile, useRevokeOtherSessions, useRevokeSession, useSessions, useUnblockUser } from '../api/hooks';
import { buildDataExport } from '../auth/exportData';
import { queryKeys } from '../api/queryKeys';
import { preparePasswordChange, setupRecoveryKey } from '../auth/accountKeys';
import RecoveryCodePanel from '../components/RecoveryCodePanel';
import { useConfirm } from '../components/ui/confirm';
import { passwordProblem } from '../auth/passwordPolicy';

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
  const confirm = useConfirm();
  // La pagina è protetta: qui l'utente in sessione c'è sempre
  const { user, endLocalSession } = useAuth();

  // Stati per le password e i messaggi a schermo
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' }); // type: 'success' o 'error'
  const [isLoading, setIsLoading] = useState(false);


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

      // La password non arriva al server: le regole si controllano qui
      const problem = passwordProblem(newPassword, user.email, user.firstName);
      if (problem) {
        setStatusMsg({ text: problem, type: 'error' });
        return;
      }

      setIsLoading(true);
      try {
        // 🔐 La chiave privata della chat è cifrata con una chiave ricavata dalla password: va cifrata
        // di nuovo con quella nuova, altrimenti tutti i messaggi diventerebbero illeggibili.
        const prepared = await preparePasswordChange(user.email, currentPassword, newPassword);
        if (!prepared.ok) {
          setStatusMsg({ text: 'Password attuale errata, oppure le chiavi di cifratura salvate su questo dispositivo non sono aggiornate. Se la password è corretta, esci, accedi di nuovo e riprova.', type: 'error' });
          return;
        }

        await changePassword({
          currentPassword: prepared.currentPassword,
          newPassword: prepared.newPassword,
          kdf: prepared.kdf,
          keys: prepared.keys,
        });
        prepared.commit();
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

  // --- CHIAVE DI RECUPERO ---
  // Il server non conosce il codice: si mostra una volta sola, appena creato.
  const queryClient = useQueryClient();
  const profileQuery = useMyProfile();
  const hasRecoveryKey = profileQuery.data?.hasRecoveryKey ?? false;
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [newRecoveryCode, setNewRecoveryCode] = useState(null);
  const [isCreatingRecovery, setIsCreatingRecovery] = useState(false);

  const handleCreateRecovery = async (e) => {
    e.preventDefault();
    setStatusMsg({ text: '', type: '' });
    setIsCreatingRecovery(true);
    try {
      const code = await setupRecoveryKey(user.email, recoveryPassword);
      if (!code) {
        setStatusMsg({ text: 'La password non è corretta.', type: 'error' });
        return;
      }
      setRecoveryPassword('');
      setNewRecoveryCode(code);
    } catch (err) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setIsCreatingRecovery(false);
    }
  };

  const handleRecoveryDone = () => {
    setNewRecoveryCode(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
    setStatusMsg({ text: 'Chiave di recupero salvata. Quella precedente non vale più.', type: 'success' });
  };

  // --- UTENTI BLOCCATI ---
  const blocksQuery = useBlocks();
  const unblockUser = useUnblockUser();

  const handleUnblock = async (blocked) => {
    try {
      await unblockUser.mutateAsync(blocked.userId);
      setStatusMsg({ text: `${blocked.firstName} è stato sbloccato.`, type: 'success' });
    } catch (err) {
      setStatusMsg({ text: err.message, type: 'error' });
    }
  };

  // --- I TUOI DATI ---
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const url = URL.createObjectURL(await buildDataExport(user.id));
      const link = document.createElement('a');
      link.href = url;
      link.download = `roomdate-dati-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setIsExporting(false);
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
    const ok = await confirm({
      title: 'Eliminare definitivamente l\'account?',
      description: 'Profilo, annunci, foto e dispositivi collegati verranno cancellati per sempre. Non si può annullare.',
      confirmLabel: 'Elimina account',
      tone: 'danger',
    });
    if (!ok) return;
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
    <div className="bg-[#FAFAFA] pb-12 font-sans selection:bg-orange-200">
      <PageMeta title="Impostazioni | RoomDate" noindex />
      

      {/* --- CONTENUTO PAGINA --- */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 animate-fade-in-up">
        
        <div className="mb-10 text-center md:text-left">
          <h1 className="font-serif text-3xl md:text-5xl text-neutral-900 mb-3 font-extrabold tracking-tight">Impostazioni Account</h1>
          <p className="text-neutral-500 font-medium">Gestisci l'accesso al tuo account.</p>
        </div>
        
        {/* MESSAGGIO DI STATO */}
        {statusMsg.text && (
          <div className={`mb-8 p-4 rounded-2xl font-bold flex items-center gap-3 shadow-xs ${statusMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            <span className="text-xl">{statusMsg.type === 'success' ? '✅' : '⚠️'}</span> {statusMsg.text}
          </div>
        )}

        {user?.isAdmin && (
          <Link to="/moderazione" data-testid="moderation-link" className="mb-8 flex items-center justify-between bg-neutral-900 text-white p-6 rounded-3xl shadow-xs font-bold hover:bg-neutral-800 transition-colors">
            <span>🛡️ Area moderazione: segnalazioni da esaminare</span>
            <span aria-hidden="true">→</span>
          </Link>
        )}

        {/* CARD IMPOSTAZIONI */}
        <div className="bg-white p-6 md:p-10 rounded-3xl shadow-xs border border-neutral-100 mb-8 relative overflow-hidden">
          
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
                  className="w-full bg-neutral-50 border border-neutral-200 text-neutral-500 rounded-2xl px-5 py-3.5 focus:outline-hidden cursor-not-allowed opacity-80 font-medium"
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
                  className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-5 py-3.5 focus:outline-hidden focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all font-medium placeholder:text-neutral-400"
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
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-5 py-3.5 focus:outline-hidden focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all font-medium placeholder:text-neutral-400"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-neutral-900">Conferma Nuova Password</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ripeti la nuova password" 
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-5 py-3.5 focus:outline-hidden focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all font-medium placeholder:text-neutral-400"
                  />
                </div>
              </div>
            </section>

            {/* PULSANTE SALVATAGGIO */}
            <div className="pt-6 border-t border-neutral-100 flex justify-end">
              <button 
                type="submit" 
                disabled={isLoading}
                className={`w-full md:w-auto px-10 py-4 rounded-full font-bold transition-all shadow-md flex justify-center items-center ${isLoading ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed shadow-none' : 'bg-linear-to-r from-orange-500 to-rose-500 text-white hover:scale-[1.02] hover:shadow-orange-500/25 cursor-pointer'}`}
              >
                {isLoading ? 'Salvataggio in corso...' : 'Salva Modifiche'}
              </button>
            </div>
          </form>
        </div>

        {/* CHIAVE DI RECUPERO */}
        <div className="bg-white p-6 md:p-10 rounded-3xl shadow-xs border border-neutral-100 mb-8" data-testid="recovery-section">
          {newRecoveryCode ? (
            <RecoveryCodePanel code={newRecoveryCode} doneLabel="Ho finito" onDone={handleRecoveryDone} />
          ) : (
            <>
              <h3 className="text-lg font-extrabold text-neutral-900 border-b border-neutral-100 pb-4 mb-6 flex items-center gap-2">
                🔑 Chiave di recupero
              </h3>
              <p className="text-neutral-600 text-sm font-medium mb-2">
                {hasRecoveryKey
                  ? 'Hai una chiave di recupero: se dimentichi la password, con quella e la tua email ne imposti una nuova senza perdere i messaggi.'
                  : 'Non hai ancora una chiave di recupero. Senza, se dimentichi la password non potrai più accedere: i messaggi sono cifrati sul tuo dispositivo e nemmeno noi possiamo aprirli.'}
              </p>
              <p className="text-neutral-500 text-sm font-medium mb-6">
                {hasRecoveryKey ? 'Creandone una nuova, quella precedente smette di valere.' : 'Crea la chiave e salvala in un posto sicuro.'}
              </p>
              <form onSubmit={handleCreateRecovery} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="password"
                  name="recoveryPassword"
                  autoComplete="current-password"
                  value={recoveryPassword}
                  onChange={(e) => setRecoveryPassword(e.target.value)}
                  placeholder="La tua password"
                  className="flex-1 bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-5 py-3.5 focus:outline-hidden focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all font-medium placeholder:text-neutral-400"
                />
                <button
                  type="submit"
                  disabled={!recoveryPassword || isCreatingRecovery}
                  className="bg-neutral-900 text-white hover:bg-neutral-800 px-6 py-3.5 rounded-full font-bold transition-colors cursor-pointer disabled:bg-neutral-300 disabled:cursor-not-allowed"
                >
                  {isCreatingRecovery ? 'Creazione...' : hasRecoveryKey ? 'Crea una nuova chiave' : 'Crea la chiave di recupero'}
                </button>
              </form>
            </>
          )}
        </div>

        {/* DISPOSITIVI COLLEGATI */}
        <div className="bg-white p-6 md:p-10 rounded-3xl shadow-xs border border-neutral-100 mb-8">
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

        {/* UTENTI BLOCCATI */}
        <div className="bg-white p-6 md:p-10 rounded-3xl shadow-xs border border-neutral-100 mb-8">
          <h3 className="text-lg font-extrabold text-neutral-900 border-b border-neutral-100 pb-4 mb-6 flex items-center gap-2">
            🚫 Utenti bloccati
          </h3>
          <p className="text-neutral-500 text-sm font-medium mb-6">
            Con chi hai bloccato non potete scrivervi né trovarvi nelle ricerche. Sbloccando, torna tutto come prima.
          </p>
          {blocksQuery.isPending ? (
            <p className="text-neutral-400 font-medium">Caricamento...</p>
          ) : blocksQuery.isError ? (
            <p className="text-rose-600 font-medium">{blocksQuery.error.message}</p>
          ) : blocksQuery.data.length === 0 ? (
            <p className="text-neutral-500 font-medium" data-testid="no-blocks">Non hai bloccato nessuno.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {blocksQuery.data.map((blocked) => (
                <li key={blocked.userId} data-testid="blocked-user" className="flex flex-wrap items-center justify-between gap-3 bg-neutral-50 border border-neutral-100 rounded-2xl px-5 py-4">
                  <div>
                    <div className="font-bold text-neutral-900">{blocked.firstName}</div>
                    <div className="text-xs text-neutral-500 font-medium mt-0.5">Bloccato {whenLabel(blocked.createdAt)}</div>
                  </div>
                  <button
                    onClick={() => handleUnblock(blocked)}
                    disabled={unblockUser.isPending}
                    className="bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-400 px-5 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    Sblocca
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* I TUOI DATI */}
        <div className="bg-white p-6 md:p-10 rounded-3xl shadow-xs border border-neutral-100 mb-8">
          <h3 className="text-lg font-extrabold text-neutral-900 border-b border-neutral-100 pb-4 mb-6 flex items-center gap-2">
            📦 I tuoi dati
          </h3>
          <p className="text-neutral-500 text-sm font-medium mb-6">
            Scarica in un file tutti i dati che RoomDate conserva su di te: profilo, annunci, conversazioni, dispositivi,
            blocchi e segnalazioni. I messaggi li decifra il tuo browser: sul server sono solo in forma cifrata.
          </p>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-neutral-900 text-white hover:bg-neutral-800 px-6 py-3 rounded-full font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            {isExporting ? 'Preparazione del file...' : '⬇️ Scarica i miei dati'}
          </button>
        </div>

        {/* DANGER ZONE */}
        <div className="bg-rose-50/50 p-6 md:p-10 rounded-3xl shadow-xs border border-rose-100">
          <h3 className="text-rose-600 font-extrabold text-xl mb-3 flex items-center gap-2">
            ⚠️ Zona Pericolosa
          </h3>
          <p className="text-rose-800/80 text-sm mb-8 leading-relaxed max-w-2xl font-medium">
            Eliminando l&apos;account cancelli definitivamente profilo, annunci con le foto, dispositivi collegati, blocchi e
            segnalazioni ricevute. I messaggi che hai inviato restano, cifrati e senza il tuo nome, nelle conversazioni
            degli altri partecipanti, come accade con un messaggio già consegnato. Prima puoi scaricare una copia dei tuoi dati.
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
                className="flex-1 bg-white border border-rose-200 text-neutral-900 rounded-2xl px-5 py-3.5 focus:outline-hidden focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all font-medium placeholder:text-neutral-400"
              />
              <button
                type="submit"
                disabled={!deletePassword}
                className="bg-rose-600 text-white hover:bg-rose-700 px-8 py-3.5 rounded-full font-bold transition-all shadow-xs cursor-pointer disabled:bg-neutral-300 disabled:cursor-not-allowed"
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
              className="bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 px-8 py-3.5 rounded-full font-bold transition-all shadow-xs w-full md:w-auto text-center cursor-pointer"
            >
              Elimina Account Definitivamente
            </button>
          )}
        </div>

      </div>
    </div>
  );
}