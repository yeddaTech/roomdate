import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import { recoverAccount } from '../auth/accountKeys';
import { passwordProblem } from '../auth/passwordPolicy';

const inputClass = 'w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-5 py-3.5 focus:outline-hidden focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all font-medium placeholder:text-neutral-400';

/**
 * Password dimenticata: con l'email e la chiave di recupero si imposta una password nuova.
 * I messaggi restano leggibili, perché la chiave privata si apre con il codice nel browser.
 */
export default function RecoverAccount() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Le due password non coincidono.');
      return;
    }
    const problem = passwordProblem(password, email, '');
    if (problem) {
      setError(problem);
      return;
    }

    setIsSubmitting(true);
    try {
      await recoverAccount(email, code, password);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Recupero non riuscito. Riprova.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#FAFAFA] font-sans flex items-center justify-center p-6 selection:bg-orange-200">
      <PageMeta title="Recupera l'accesso | RoomDate" noindex />

      <div className="w-full max-w-lg bg-white p-8 md:p-10 rounded-3xl shadow-lg border border-neutral-100">
        <Link to="/" className="font-serif text-2xl font-bold tracking-tight text-neutral-900">
          Room<span className="text-transparent bg-clip-text bg-linear-to-r from-orange-500 to-rose-500">Date</span>
        </Link>

        {done ? (
          <div className="mt-8 flex flex-col gap-4" data-testid="recovery-done">
            <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Password aggiornata</h1>
            <p className="text-neutral-600 font-medium leading-relaxed">
              Ora puoi accedere con la nuova password: i tuoi messaggi sono ancora tutti leggibili.
              Per sicurezza abbiamo chiuso l&apos;accesso su tutti i dispositivi. Se pensi che qualcun
              altro abbia visto la tua chiave di recupero, creane una nuova nelle Impostazioni.
            </p>
            <Link to="/accedi" className="mt-2 text-center bg-neutral-900 text-white py-4 rounded-full font-bold hover:bg-neutral-800 transition-colors">
              Vai all&apos;accesso
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <div>
              <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight mb-2">Password dimenticata?</h1>
              <p className="text-neutral-500 font-medium leading-relaxed">
                Inserisci la tua email e la chiave di recupero che hai salvato alla registrazione.
                Senza chiave di recupero non è possibile reimpostare la password: i messaggi sono
                cifrati sul tuo dispositivo e nemmeno noi possiamo aprirli.
              </p>
            </div>

            {error && <div className="p-4 rounded-2xl font-bold bg-rose-50 text-rose-700 border border-rose-200" role="alert">⚠️ {error}</div>}

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-neutral-900">Email</span>
              <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputClass} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-neutral-900">Chiave di recupero</span>
              <input
                type="text"
                name="recoveryCode"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoComplete="off"
                spellCheck={false}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                className={`${inputClass} font-mono tracking-wider uppercase`}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-neutral-900">Nuova password</span>
              <input type="password" name="newPassword" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" className={inputClass} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-neutral-900">Ripeti la nuova password</span>
              <input type="password" name="confirmPassword" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" className={inputClass} />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full bg-linear-to-r from-orange-500 to-rose-500 text-white py-4 rounded-full font-bold transition-all disabled:bg-none disabled:bg-neutral-300 cursor-pointer"
            >
              {isSubmitting ? 'Verifica in corso...' : 'Imposta la nuova password'}
            </button>
            <Link to="/accedi" className="text-center text-sm font-bold text-neutral-500 hover:text-neutral-900 transition-colors">← Torna all&apos;accesso</Link>
          </form>
        )}
      </div>
    </div>
  );
}
