import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Register() {
  const navigate = useNavigate();

  const [userType, setUserType] = useState('cerca'); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // STATO ESPANSO: Ora include i dati del profilo!
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    email: '',
    password: '',
    citta: '',
    nascita: '',
    // Nuovi campi per il Profilo:
    budgetMax: '',
    occupation: '',
    bio: '',
    // Stile di vita (Checkbox)
    fumatore: false,
    animali: false,
    ordinato: false,
    socievole: false,
    vegano: false,
    // Varie
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
    { text: 'Troppo corta', color: 'text-red-500', barClass: 'bg-red-500' },
    { text: 'Debole', color: 'text-red-500', barClass: 'bg-red-500' },
    { text: 'Media', color: 'text-orange-400', barClass: 'bg-orange-400' },
    { text: 'Forte 💪', color: 'text-green-600', barClass: 'bg-green-600' }
  ];
  
  const currentStrength = strengthLevels[score];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Compattiamo i tag dello stile di vita in una stringa, come si aspetta il database
    const lifestyleTags = [];
    if (formData.fumatore) lifestyleTags.push('Fumatore');
    else lifestyleTags.push('Non Fumatore');
    if (formData.animali) lifestyleTags.push('Ho animali');
    if (formData.ordinato) lifestyleTags.push('Ordinato/a');
    if (formData.socievole) lifestyleTags.push('Socievole');
    if (formData.vegano) lifestyleTags.push('Vegano/Vegetariano');

    try {
      // ORA CHIAMIAMO LA TUA API DI REGISTRAZIONE DEDICATA
      const response = await fetch('/api/register', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          lifestyle_tags: lifestyleTags.join(', ')
        }),
      });
      // ... (il resto rimane uguale, i vari if/else per il messaggio di successo/errore)

      if (response.ok) {
        alert('🎉 Registrazione completata! Ora puoi accedere e vedere il tuo profilo già impostato.');
        navigate('/accedi');
      } else {
        const errorMsg = await response.text();
        alert('❌ Errore: ' + errorMsg);
      }
    } catch (error) {
      alert('⚠️ Errore di connessione col server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col font-sans bg-[#FEFAF4]">
      
      <nav className="shrink-0 z-50 bg-[#2C1A0E] text-white px-6 py-4 flex justify-between items-center shadow-md border-b-2 border-[#C4603A]">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-serif text-2xl font-bold tracking-tight text-white decoration-none">
            Room<span className="text-[#D4835E]">Date</span>
          </Link>
          <Link to="/" className="hidden md:flex text-sm text-[#8A7B6E] hover:text-white transition-colors">
            ← Torna alla home
          </Link>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-sm text-neutral-300">Hai già un account?</span>
          <Link to="/accedi" className="bg-transparent border border-white/20 hover:border-white px-5 py-2 rounded-full text-sm font-bold transition-colors">Accedi</Link>
        </div>
      </nav>

      <div className="flex-1 flex flex-col lg:flex-row w-full">
        
        {/* PARTE SINISTRA (Testo) */}
        <div className="hidden lg:flex lg:w-4/12 xl:w-5/12 bg-gradient-to-br from-[#2C1A0E] to-[#5A2C1A] p-12 xl:p-16 flex-col justify-center relative overflow-hidden text-white border-r border-[#C4603A]/20">
          {/* ... Lascia pure intatto il testo e la grafica a sinistra ... */}
          <div className="relative z-10 max-w-lg mx-auto">
            <div className="text-[#D4835E] text-xs font-bold uppercase tracking-widest mb-3">Unisciti a RoomDate</div>
            <h2 className="font-serif text-5xl xl:text-6xl font-bold leading-tight mb-6">Trova la tua stanza,<br/><em className="text-[#F5E3CC] font-light">trova casa.</em></h2>
            <p className="text-white/80 text-lg mb-12 leading-relaxed">Migliaia di stanze e coinquilini selezionati in tutta Italia. Registrati gratis e inizia subito a cercare la tua prossima sistemazione.</p>
          </div>
        </div>

        {/* PARTE DESTRA (Form) */}
        <div className="w-full lg:w-8/12 xl:w-7/12 flex flex-col justify-start items-center p-6 md:p-10 overflow-y-auto">
          
          <div className="w-full max-w-2xl bg-white p-8 md:p-10 rounded-3xl shadow-lg border border-orange-50 animate-fade-in-up my-auto">
            
            <h1 className="font-serif text-4xl text-[#2C1A0E] font-bold mb-2">Crea il tuo account</h1>
            <p className="text-[#8A7B6E] text-sm mb-8">E compila già il tuo profilo per farti notare subito.</p>

            {/* TIPO UTENTE */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button type="button" className={`flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all ${userType === 'cerca' ? 'border-[#C4603A] bg-[#FEFAF4]' : 'border-neutral-100 bg-white hover:border-orange-200'}`} onClick={() => setUserType('cerca')}>
                <span className="text-3xl mb-2">🔍</span>
                <span className="font-bold text-[#2C1A0E] text-sm mb-1">Cerco stanza</span>
                <span className="text-xs text-[#8A7B6E]">Voglio trovare dove abitare</span>
              </button>
              <button type="button" className={`flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all ${userType === 'affitta' ? 'border-[#C4603A] bg-[#FEFAF4]' : 'border-neutral-100 bg-white hover:border-orange-200'}`} onClick={() => setUserType('affitta')}>
                <span className="text-3xl mb-2">🏠</span>
                <span className="font-bold text-[#2C1A0E] text-sm mb-1">Affitto stanza</span>
                <span className="text-xs text-[#8A7B6E]">Ho uno spazio da condividere</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              
              {/* DATI ANAGRAFICI E ACCESSO */}
              <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-100">
                <h3 className="font-bold text-[#2C1A0E] mb-4">I tuoi dati base</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-[#8A7B6E] uppercase">Nome</label>
                    <input type="text" name="nome" value={formData.nome} onChange={handleChange} required className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 focus:border-[#C4603A] focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-[#8A7B6E] uppercase">Cognome</label>
                    <input type="text" name="cognome" value={formData.cognome} onChange={handleChange} required className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 focus:border-[#C4603A] focus:outline-none" />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-[#8A7B6E] uppercase">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 focus:border-[#C4603A] focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-[#8A7B6E] uppercase">Password</label>
                    <input type="password" name="password" value={formData.password} onChange={handleChange} required className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 focus:border-[#C4603A] focus:outline-none" />
                    <div className="flex gap-1 mt-1">
                      {[1, 2, 3, 4].map(num => <div key={num} className={`h-1 w-full rounded-full ${score >= num ? currentStrength.barClass : 'bg-neutral-200'}`}></div>)}
                    </div>
                  </div>
                </div>
              </div>

              {/* DATI DEL PROFILO PUBBLICO */}
              <div className="p-5 bg-orange-50/50 rounded-2xl border border-[#C4603A]/20">
                <h3 className="font-bold text-[#C4603A] mb-4">Crea il tuo profilo</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-[#8A7B6E] uppercase">Città</label>
                    <select name="citta" value={formData.citta} onChange={handleChange} required className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 focus:border-[#C4603A] focus:outline-none">
                      <option value="">Seleziona...</option>
                      <option>Milano</option><option>Roma</option><option>Torino</option><option>Bologna</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-[#8A7B6E] uppercase">Nascita</label>
                    <input type="date" name="nascita" value={formData.nascita} onChange={handleChange} required className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 focus:border-[#C4603A] focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-[#8A7B6E] uppercase">{userType === 'cerca' ? 'Budget Max' : 'Costo Stanza'}</label>
                    <input type="number" name="budgetMax" placeholder="Es: 500" value={formData.budgetMax} onChange={handleChange} className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 focus:border-[#C4603A] focus:outline-none" />
                  </div>
                </div>

                <div className="flex flex-col gap-1 mb-4">
                  <label className="text-xs font-bold text-[#8A7B6E] uppercase">Occupazione</label>
                  <select name="occupation" value={formData.occupation} onChange={handleChange} className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 focus:border-[#C4603A] focus:outline-none">
                    <option value="">Seleziona...</option>
                    <option value="Studente">Studente</option>
                    <option value="Lavoratore">Lavoratore</option>
                    <option value="Studente e Lavoratore">Studente e Lavoratore</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1 mb-4">
                  <label className="text-xs font-bold text-[#8A7B6E] uppercase">Bio (Parlaci di te)</label>
                  <textarea name="bio" rows="2" placeholder="Ciao! Sto cercando..." value={formData.bio} onChange={handleChange} className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 focus:border-[#C4603A] focus:outline-none resize-none"></textarea>
                </div>

                {/* STILE DI VITA (Lifestyle Tags) */}
                <label className="text-xs font-bold text-[#8A7B6E] uppercase mb-2 block">Il tuo Stile di Vita</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'fumatore', label: '🚬 Fumatore' },
                    { id: 'animali', label: '🐶 Ho animali' },
                    { id: 'ordinato', label: '🧹 Ordinato/a' },
                    { id: 'socievole', label: '🎉 Socievole' },
                    { id: 'vegano', label: '🥦 Vegano/Vegetariano' }
                  ].map(tag => (
                    <label key={tag.id} className={`cursor-pointer px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${formData[tag.id] ? 'bg-[#C4603A] text-white border-[#C4603A]' : 'bg-white text-[#8A7B6E] border-neutral-200 hover:border-[#C4603A]'}`}>
                      <input type="checkbox" name={tag.id} checked={formData[tag.id]} onChange={handleChange} className="hidden" />
                      {tag.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" name="accettaTermini" checked={formData.accettaTermini} onChange={handleChange} required className="mt-1 w-5 h-5 accent-[#C4603A] cursor-pointer" />
                  <span className="text-sm text-[#8A7B6E]">Accetto i Termini e la Privacy Policy.</span>
                </label>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full text-white py-4 rounded-full font-bold transition-all shadow-md bg-[#C4603A] hover:bg-[#9A4628]">
                {isSubmitting ? 'Salvataggio...' : 'Crea Account e Profilo 🚀'}
              </button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
}