import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { prepareRegistration } from '../auth/accountKeys';
import { passwordProblem } from '../auth/passwordPolicy';
import RecoveryCodePanel from '../components/RecoveryCodePanel';
import { MIN_PASSWORD_LENGTH, register } from '../api/auth';
import { ApiError } from '../api/client';
import { toast } from 'sonner';
import { CITIES, OCCUPATIONS } from '../api/options';
import { latestAdultBirthdate } from '../api/users';
import LifestyleTagsPicker from '../components/profile/LifestyleTagsPicker';

export default function Register() {
  const navigate = useNavigate();

  const [userType, setUserType] = useState('cerca'); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    email: '',
    password: '',
    citta: '',
    nascita: '',
    budgetMax: '',
    occupation: '',
    bio: '',
    lifestyleTags: [],
    accettaTermini: false,
    newsletter: false
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Conta la lunghezza, non i simboli: una frase lunga è più difficile da indovinare
  // di "Ciao1!" e più facile da ricordare (linee guida NIST 800-63B).
  const getPasswordScore = (pw) => {
    if (!pw) return 0;
    if (pw.length < MIN_PASSWORD_LENGTH) return 1;
    if (pw.length < 14) return 2;
    if (pw.length < 20) return 3;
    return 4;
  };

  const score = getPasswordScore(formData.password);
  
  const strengthLevels = [
    { text: 'Inserisci una password', color: 'text-neutral-400', barClass: 'bg-neutral-200' },
    { text: `Almeno ${MIN_PASSWORD_LENGTH} caratteri`, color: 'text-rose-500', barClass: 'bg-rose-500' },
    { text: 'Va bene', color: 'text-orange-400', barClass: 'bg-orange-400' },
    { text: 'Buona', color: 'text-emerald-500', barClass: 'bg-emerald-500' },
    { text: 'Ottima 💪', color: 'text-emerald-500', barClass: 'bg-emerald-500' }
  ];
  
  const currentStrength = strengthLevels[score];

  const handleSubmit = async (e) => {
    e.preventDefault();

    // La password non arriva al server (ne riceve solo una chiave ricavata): le regole si controllano qui
    const problem = passwordProblem(formData.password, formData.email, formData.nome);
    if (problem) {
      toast.error(problem);
      return;
    }

    setIsSubmitting(true);
    try {
      const { authKey, kdf, keys, recovery, recoveryCode: code } = await prepareRegistration(formData.password);

      await register({
        firstName: formData.nome,
        lastName: formData.cognome,
        email: formData.email,
        password: authKey,
        kdf,
        city: formData.citta,
        birthdate: formData.nascita,
        userType: userType,
        // 🔴 FIX: Se l'utente affitta, il budget personale è sempre 0
        budgetMax: userType === 'cerca' ? (parseInt(formData.budgetMax) || 0) : 0,
        occupation: formData.occupation,
        bio: formData.bio,
        lifestyleTags: formData.lifestyleTags,
        keys,
        recovery,
      });

      // Prima dell'accesso si mostra la chiave di recupero: è l'unica occasione per salvarla
      setRecoveryCode(code);
      window.scrollTo(0, 0);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        console.error("Errore di crittografia durante la registrazione:", error);
        toast.error('Non è stato possibile creare le chiavi di sicurezza. Riprova.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col font-sans bg-[#FAFAFA] selection:bg-orange-200">
      

      {/* --- MAIN LAYOUT SPLIT --- */}
      <div className="flex-1 flex flex-col lg:flex-row w-full pt-16 md:pt-0">
        
        {/* PARTE SINISTRA */}
        <div className="hidden lg:flex lg:w-4/12 xl:w-5/12 bg-linear-to-br from-orange-500 to-rose-500 p-12 xl:p-16 flex-col justify-center relative overflow-hidden text-white border-r border-orange-200/20">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-white/20 blur-[100px] rounded-full pointer-events-none"></div>

          <div className="relative z-10 max-w-lg mx-auto">
            <div className="text-white/80 text-xs font-bold uppercase tracking-widest mb-3">Unisciti a RoomDate</div>
            <h2 className="font-serif text-5xl xl:text-6xl font-extrabold leading-tight xl:leading-none mb-6 tracking-tight">Trova la tua stanza,<br/><em className="font-light opacity-90">trova casa.</em></h2>
            <p className="text-white/90 text-lg mb-12 leading-relaxed font-medium">Pubblica una stanza o cerca casa e coinquilini. Registrati gratis e parla direttamente con gli altri utenti, con messaggi cifrati end-to-end.</p>
          </div>
        </div>

        {/* PARTE DESTRA */}
        <div className="w-full lg:w-8/12 xl:w-7/12 flex flex-col justify-start items-center p-6 md:p-10 lg:py-24 overflow-y-auto relative">
          
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-orange-400/5 blur-[100px] rounded-full pointer-events-none"></div>

          <div className="w-full max-w-2xl bg-white p-8 md:p-10 rounded-3xl shadow-lg border border-neutral-100 relative z-10 animate-fade-in-up my-auto">
            {recoveryCode ? (
              <RecoveryCodePanel code={recoveryCode} doneLabel="Vai all'accesso" onDone={() => navigate('/accedi')} />
            ) : (
            <>
            <h1 className="font-serif text-4xl text-neutral-900 font-extrabold mb-2 tracking-tight">Crea il tuo account</h1>
            <p className="text-neutral-500 text-sm mb-8 font-medium">Compila il tuo profilo per farti notare subito dalla community.</p>

            {/* TIPO UTENTE */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button 
                type="button" 
                className={`flex flex-col items-center justify-center text-center p-5 rounded-3xl border-2 transition-all cursor-pointer ${userType === 'cerca' ? 'border-orange-500 bg-orange-50/50 shadow-xs' : 'border-neutral-100 bg-white hover:border-orange-200 hover:bg-neutral-50'}`} 
                onClick={() => setUserType('cerca')}
              >
                <span className="text-4xl mb-3 drop-shadow-xs">🔍</span>
                <span className="font-extrabold text-neutral-900 text-sm mb-1">Cerco stanza</span>
                <span className="text-xs text-neutral-500 font-medium">Voglio trovare dove abitare</span>
              </button>
              <button 
                type="button" 
                className={`flex flex-col items-center justify-center text-center p-5 rounded-3xl border-2 transition-all cursor-pointer ${userType === 'affitta' ? 'border-orange-500 bg-orange-50/50 shadow-xs' : 'border-neutral-100 bg-white hover:border-orange-200 hover:bg-neutral-50'}`} 
                onClick={() => setUserType('affitta')}
              >
                <span className="text-4xl mb-3 drop-shadow-xs">🏠</span>
                <span className="font-extrabold text-neutral-900 text-sm mb-1">Affitto stanza</span>
                <span className="text-xs text-neutral-500 font-medium">Ho uno spazio da condividere</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-8">
              
              {/* DATI ANAGRAFICI */}
              <div className="p-6 bg-neutral-50 rounded-3xl border border-neutral-100">
                <h3 className="font-bold text-neutral-900 mb-5 text-lg">I tuoi dati base</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Nome</label>
                    <input type="text" name="nome" value={formData.nome} onChange={handleChange} required className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-hidden transition-all shadow-xs" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Cognome</label>
                    <input type="text" name="cognome" value={formData.cognome} onChange={handleChange} required className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-hidden transition-all shadow-xs" />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-hidden transition-all shadow-xs" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Password</label>
                      <span className={`text-[10px] font-bold ${currentStrength.color}`}>{currentStrength.text}</span>
                    </div>
                    <input type="password" name="password" value={formData.password} onChange={handleChange} required className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-hidden transition-all shadow-xs" />
                    <div className="flex gap-1.5 mt-2">
                      {[1, 2, 3, 4].map(num => <div key={num} className={`h-1.5 w-full rounded-full transition-colors duration-300 ${score >= num ? currentStrength.barClass : 'bg-neutral-200'}`}></div>)}
                    </div>
                    <small className="text-[11px] text-neutral-400 font-medium mt-1">Una frase che ricordi facilmente è più sicura di una parola con simboli.</small>
                  </div>
                </div>
              </div>

              {/* DATI PROFILO */}
              <div className="p-6 bg-orange-50/50 rounded-3xl border border-orange-100">
                <h3 className="font-extrabold text-orange-600 mb-5 text-lg">Personalizza il tuo Profilo</h3>
                
                {/* 🔴 FIX: Se cerca casa -> 3 colonne (con budget). Se affitta -> 2 colonne (senza budget) */}
                <div className={`grid grid-cols-1 ${userType === 'cerca' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-5 mb-5`}>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Città</label>
                    <select name="citta" value={formData.citta} onChange={handleChange} required className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-hidden transition-all shadow-xs cursor-pointer">
                      <option value="">Seleziona...</option>
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Nascita</label>
                    <input type="date" name="nascita" value={formData.nascita} onChange={handleChange} required min="1900-01-01" max={latestAdultBirthdate()} title="Per usare RoomDate devi avere almeno 18 anni" className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-hidden transition-all shadow-xs" />
                  </div>
                  
                  {userType === 'cerca' && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Budget Max (€)</label>
                      <input type="number" name="budgetMax" placeholder="Es: 500" value={formData.budgetMax} onChange={handleChange} className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-hidden transition-all shadow-xs placeholder:text-neutral-300" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 mb-5">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Occupazione</label>
                  <select name="occupation" value={formData.occupation} onChange={handleChange} className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-hidden transition-all shadow-xs cursor-pointer">
                    <option value="">Preferisco non indicarla</option>
                    {OCCUPATIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 mb-6">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Bio (Parlaci di te)</label>
                  <textarea name="bio" rows="3" placeholder="Ciao! Sto cercando una stanza comoda e luminosa..." value={formData.bio} onChange={handleChange} className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-hidden transition-all shadow-xs resize-none placeholder:text-neutral-300"></textarea>
                </div>

                {/* STILE DI VITA: solo ciò che l'utente sceglie, nessun valore predefinito */}
                <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-3 block">Il tuo stile di vita (facoltativo)</span>
                <LifestyleTagsPicker value={formData.lifestyleTags} onChange={lifestyleTags => setFormData(prev => ({ ...prev, lifestyleTags }))} />
              </div>

              {/* TERMINI E CONDIZIONI */}
              <div className="flex flex-col gap-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    name="accettaTermini" 
                    checked={formData.accettaTermini} 
                    onChange={handleChange} 
                    required 
                    className="mt-0.5 w-5 h-5 text-orange-500 bg-neutral-50 border-neutral-300 rounded-sm focus:ring-orange-500 accent-orange-500 cursor-pointer transition-all" 
                  />
                  <span className="text-sm text-neutral-500 leading-relaxed font-medium group-hover:text-neutral-900 transition-colors">
                    Dichiaro di aver letto e accetto i <Link to="/termini" className="text-orange-500 font-bold hover:text-orange-600 transition-colors">Termini di Servizio</Link> e l'<Link to="/privacy" className="text-orange-500 font-bold hover:text-orange-600 transition-colors">Informativa sulla Privacy</Link>.
                  </span>
                </label>
              </div>

              <button type="submit" disabled={isSubmitting} className={`w-full mt-2 text-white py-4 rounded-full font-bold transition-all shadow-md flex justify-center items-center ${isSubmitting ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed shadow-none' : 'bg-linear-to-r from-orange-500 to-rose-500 hover:scale-[1.02] hover:shadow-orange-500/25 cursor-pointer'}`}>
                {isSubmitting ? 'Creazione in corso...' : 'Crea Account e Profilo 🚀'}
              </button>
            </form>
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}