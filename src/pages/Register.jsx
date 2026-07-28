import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { generateKeyPair, wrapPrivateKey } from '../utils/crypto';
import { fetchAPI } from '../utils/api'; 

export default function Register() {
  const navigate = useNavigate();

  const [userType, setUserType] = useState('cerca'); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
    fumatore: false,
    animali: false,
    ordinato: false,
    socievole: false,
    vegano: false,
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
  
  const strengthLevels = [
    { text: 'Inserisci una password', color: 'text-neutral-400', barClass: 'bg-neutral-200' },
    { text: 'Troppo corta', color: 'text-rose-500', barClass: 'bg-rose-500' },
    { text: 'Debole', color: 'text-rose-500', barClass: 'bg-rose-500' },
    { text: 'Media', color: 'text-orange-400', barClass: 'bg-orange-400' },
    { text: 'Forte 💪', color: 'text-emerald-500', barClass: 'bg-emerald-500' }
  ];
  
  const currentStrength = strengthLevels[score];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const lifestyleTags = [];
    if (formData.fumatore) lifestyleTags.push('Fumatore');
    else lifestyleTags.push('Non Fumatore');
    if (formData.animali) lifestyleTags.push('Ho animali');
    if (formData.ordinato) lifestyleTags.push('Ordinato/a');
    if (formData.socievole) lifestyleTags.push('Socievole');
    if (formData.vegano) lifestyleTags.push('Vegano/Vegetariano');

    try {
      // --- 🔐 LOGICA CRITTOGRAFICA INIZIO ---
      const keys = await generateKeyPair();
      const wrappedData = await wrapPrivateKey(keys.privateKey, formData.password);
      // --- 🔐 LOGICA CRITTOGRAFICA FINE ---

      const response = await fetchAPI('/api/register', { 
        method: 'POST',
        body: JSON.stringify({
          nome: formData.nome,
          cognome: formData.cognome,
          email: formData.email,
          password: formData.password,
          citta: formData.citta,
          nascita: formData.nascita,
          userType: userType,
          budgetMax: parseInt(formData.budgetMax) || 0,
          occupation: formData.occupation,
          bio: formData.bio,
          lifestyle_tags: lifestyleTags.join(', '),
          
          publicKey: keys.publicKey,
          encryptedPrivateKey: wrappedData.encryptedPrivateKey,
          cryptoSalt: wrappedData.salt,
          cryptoIv: wrappedData.iv
        }),
      });

      if (response.ok) {
        alert('🎉 Registrazione completata! Ora puoi accedere e vedere il tuo profilo già impostato.');
        navigate('/accedi');
      } else {
        const errorMsg = await response.text();
        alert('❌ Errore: ' + errorMsg);
      }
    } catch (error) {
      console.error("Errore di registrazione o crittografia:", error);
      alert('⚠️ Errore di connessione col server o errore interno.');
    } finally {
      setIsSubmitting(false);
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
          <span className="hidden md:inline text-sm text-neutral-500 font-medium">Hai già un account?</span>
          <Link to="/accedi" className="bg-white border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 text-neutral-700 px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm">Accedi</Link>
        </div>
      </nav>

      {/* --- MAIN LAYOUT SPLIT --- */}
      <div className="flex-1 flex flex-col lg:flex-row w-full pt-16 md:pt-0">
        
        {/* PARTE SINISTRA (Hero Visivo) */}
        <div className="hidden lg:flex lg:w-4/12 xl:w-5/12 bg-gradient-to-br from-orange-500 to-rose-500 p-12 xl:p-16 flex-col justify-center relative overflow-hidden text-white border-r border-orange-200/20">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-white/20 blur-[100px] rounded-full pointer-events-none"></div>

          <div className="relative z-10 max-w-lg mx-auto">
            <div className="text-white/80 text-xs font-bold uppercase tracking-widest mb-3">Unisciti a RoomDate</div>
            <h2 className="font-serif text-5xl xl:text-6xl font-extrabold leading-tight mb-6 tracking-tight">Trova la tua stanza,<br/><em className="font-light opacity-90">trova casa.</em></h2>
            <p className="text-white/90 text-lg mb-12 leading-relaxed font-medium">Migliaia di stanze e coinquilini selezionati in tutta Italia. Registrati gratis e inizia subito a cercare la tua prossima sistemazione in totale sicurezza.</p>
          </div>
        </div>

        {/* PARTE DESTRA (Form) */}
        <div className="w-full lg:w-8/12 xl:w-7/12 flex flex-col justify-start items-center p-6 md:p-10 lg:py-24 overflow-y-auto relative">
          
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-orange-400/5 blur-[100px] rounded-full pointer-events-none"></div>

          <div className="w-full max-w-2xl bg-white p-8 md:p-10 rounded-3xl shadow-lg border border-neutral-100 relative z-10 animate-fade-in-up my-auto">
            
            <h1 className="font-serif text-4xl text-neutral-900 font-extrabold mb-2 tracking-tight">Crea il tuo account</h1>
            <p className="text-neutral-500 text-sm mb-8 font-medium">Compila il tuo profilo per farti notare subito dalla community.</p>

            {/* TIPO UTENTE */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button 
                type="button" 
                className={`flex flex-col items-center justify-center text-center p-5 rounded-3xl border-2 transition-all cursor-pointer ${userType === 'cerca' ? 'border-orange-500 bg-orange-50/50 shadow-sm' : 'border-neutral-100 bg-white hover:border-orange-200 hover:bg-neutral-50'}`} 
                onClick={() => setUserType('cerca')}
              >
                <span className="text-4xl mb-3 drop-shadow-sm">🔍</span>
                <span className="font-extrabold text-neutral-900 text-sm mb-1">Cerco stanza</span>
                <span className="text-xs text-neutral-500 font-medium">Voglio trovare dove abitare</span>
              </button>
              <button 
                type="button" 
                className={`flex flex-col items-center justify-center text-center p-5 rounded-3xl border-2 transition-all cursor-pointer ${userType === 'affitta' ? 'border-orange-500 bg-orange-50/50 shadow-sm' : 'border-neutral-100 bg-white hover:border-orange-200 hover:bg-neutral-50'}`} 
                onClick={() => setUserType('affitta')}
              >
                <span className="text-4xl mb-3 drop-shadow-sm">🏠</span>
                <span className="font-extrabold text-neutral-900 text-sm mb-1">Affitto stanza</span>
                <span className="text-xs text-neutral-500 font-medium">Ho uno spazio da condividere</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-8">
              
              {/* DATI ANAGRAFICI E ACCESSO */}
              <div className="p-6 bg-neutral-50 rounded-3xl border border-neutral-100">
                <h3 className="font-bold text-neutral-900 mb-5 text-lg">I tuoi dati base</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Nome</label>
                    <input type="text" name="nome" value={formData.nome} onChange={handleChange} required className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all shadow-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Cognome</label>
                    <input type="text" name="cognome" value={formData.cognome} onChange={handleChange} required className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all shadow-sm" />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all shadow-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Password</label>
                      <span className={`text-[10px] font-bold ${currentStrength.color}`}>{currentStrength.text}</span>
                    </div>
                    <input type="password" name="password" value={formData.password} onChange={handleChange} required className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all shadow-sm" />
                    <div className="flex gap-1.5 mt-2">
                      {[1, 2, 3, 4].map(num => <div key={num} className={`h-1.5 w-full rounded-full transition-colors duration-300 ${score >= num ? currentStrength.barClass : 'bg-neutral-200'}`}></div>)}
                    </div>
                  </div>
                </div>
              </div>

              {/* DATI DEL PROFILO PUBBLICO */}
              <div className="p-6 bg-orange-50/50 rounded-3xl border border-orange-100">
                <h3 className="font-extrabold text-orange-600 mb-5 text-lg">Personalizza il tuo Profilo</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Città</label>
                    <select name="citta" value={formData.citta} onChange={handleChange} required className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all shadow-sm cursor-pointer">
                      <option value="">Seleziona...</option>
                      <option>Milano</option><option>Roma</option><option>Torino</option><option>Bologna</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Nascita</label>
                    <input type="date" name="nascita" value={formData.nascita} onChange={handleChange} required className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all shadow-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">{userType === 'cerca' ? 'Budget Max' : 'Costo Stanza'}</label>
                    <input type="number" name="budgetMax" placeholder="Es: 500" value={formData.budgetMax} onChange={handleChange} className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all shadow-sm placeholder:text-neutral-300" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 mb-5">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Occupazione</label>
                  <select name="occupation" value={formData.occupation} onChange={handleChange} className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all shadow-sm cursor-pointer">
                    <option value="">Seleziona...</option>
                    <option value="Studente">Studente</option>
                    <option value="Lavoratore">Lavoratore</option>
                    <option value="Studente e Lavoratore">Studente e Lavoratore</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 mb-6">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Bio (Parlaci di te)</label>
                  <textarea name="bio" rows="3" placeholder="Ciao! Sto cercando una stanza comoda e luminosa..." value={formData.bio} onChange={handleChange} className="w-full bg-white border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all shadow-sm resize-none placeholder:text-neutral-300"></textarea>
                </div>

                {/* STILE DI VITA */}
                <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-3 block">Il tuo Stile di Vita</label>
                <div className="flex flex-wrap gap-2.5">
                  {[
                    { id: 'fumatore', label: '🚬 Fumatore' },
                    { id: 'animali', label: '🐶 Ho animali' },
                    { id: 'ordinato', label: '🧹 Ordinato/a' },
                    { id: 'socievole', label: '🎉 Socievole' },
                    { id: 'vegano', label: '🥦 Vegano/Vegetariano' }
                  ].map(tag => (
                    <label key={tag.id} className={`cursor-pointer px-4 py-2 rounded-full text-[13px] font-bold border transition-all shadow-sm ${formData[tag.id] ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200 hover:border-orange-300 hover:text-orange-600'}`}>
                      <input type="checkbox" name={tag.id} checked={formData[tag.id]} onChange={handleChange} className="hidden" />
                      {tag.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* CHECKBOX TERMINI E PRIVACY */}
              <div className="flex flex-col gap-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    name="accettaTermini" 
                    checked={formData.accettaTermini} 
                    onChange={handleChange} 
                    required 
                    className="mt-0.5 w-5 h-5 text-orange-500 bg-neutral-50 border-neutral-300 rounded focus:ring-orange-500 accent-orange-500 cursor-pointer transition-all" 
                  />
                  <span className="text-sm text-neutral-500 leading-relaxed font-medium group-hover:text-neutral-900 transition-colors">
                    Dichiaro di aver letto e accetto i <Link to="/termini" className="text-orange-500 font-bold hover:text-orange-600 transition-colors">Termini di Servizio</Link> e l'<Link to="/privacy" className="text-orange-500 font-bold hover:text-orange-600 transition-colors">Informativa sulla Privacy</Link>.
                  </span>
                </label>
              </div>

              <button type="submit" disabled={isSubmitting} className={`w-full mt-2 text-white py-4 rounded-full font-bold transition-all shadow-md flex justify-center items-center ${isSubmitting ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-orange-500 to-rose-500 hover:scale-[1.02] hover:shadow-orange-500/25 cursor-pointer'}`}>
                {isSubmitting ? 'Creazione in corso...' : 'Crea Account e Profilo 🚀'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}