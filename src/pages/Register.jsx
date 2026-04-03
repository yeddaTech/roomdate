import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Register() {
  const navigate = useNavigate();

  // --- STATI DELLA PAGINA ---
  const [userType, setUserType] = useState('cerca'); // 'cerca' o 'affitta'
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Stato unificato per i dati del form
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    email: '',
    telefono: '',
    citta: '',
    nascita: '',
    password: '',
    accettaTermini: false,
    newsletter: false
  });

  // Gestione dell'input per aggiornare lo stato
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // --- LOGICA PASSWORD STRENGTH ---
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

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.nome,
          cognome: formData.cognome,
          email: formData.email,
          password: formData.password,
          telefono: formData.telefono,
          citta: formData.citta,
          nascita: formData.nascita,
          userType: userType // <- AGGIUNTO QUESTO (importantissimo!)
        }),
      });

      if (response.ok) {
        alert('🎉 Registrazione completata! Ora puoi accedere.');
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
      
      {/* --- TOP NAV MINIMALE --- */}
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

      {/* --- MAIN LAYOUT SPLIT --- */}
      <div className="flex-1 flex flex-col lg:flex-row w-full">
        
        {/* LEFT COLUMN (Informativa - Nascosta su mobile) */}
        <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-[#2C1A0E] to-[#5A2C1A] p-12 xl:p-16 flex-col justify-center relative overflow-hidden text-white border-r border-[#C4603A]/20">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
          
          <div className="relative z-10 max-w-lg mx-auto">
            <div className="text-[#D4835E] text-xs font-bold uppercase tracking-widest mb-3">Unisciti a RoomDate</div>
            <h2 className="font-serif text-5xl xl:text-6xl font-bold leading-tight mb-6">Trova la tua stanza,<br/><em className="text-[#F5E3CC] font-light">trova casa.</em></h2>
            <p className="text-white/80 text-lg mb-12 leading-relaxed">Migliaia di stanze e coinquilini selezionati in tutta Italia. Registrati gratis e inizia subito a cercare la tua prossima sistemazione.</p>
            
            <div className="flex flex-col gap-6 mb-12">
              <div className="flex gap-4">
                <div className="text-2xl mt-1">🔍</div>
                <div>
                  <strong className="block text-lg mb-1">Annunci verificati</strong>
                  <span className="text-white/60 text-sm">Ogni annuncio è controllato dal nostro team prima della pubblicazione.</span>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-2xl mt-1">💬</div>
                <div>
                  <strong className="block text-lg mb-1">Chat diretta</strong>
                  <span className="text-white/60 text-sm">Parla subito con proprietari e coinquilini senza intermediari.</span>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-2xl mt-1">🛡️</div>
                <div>
                  <strong className="block text-lg mb-1">Zero commissioni</strong>
                  <span className="text-white/60 text-sm">Nessun costo nascosto, nessuna agenzia. Solo connessioni vere.</span>
                </div>
              </div>
            </div>

            <div className="flex gap-8 border-t border-white/10 pt-8">
              <div><div className="font-serif text-3xl font-bold text-[#F5C29A]">12K+</div><div className="text-xs text-white/50 uppercase tracking-widest mt-1">Annunci</div></div>
              <div><div className="font-serif text-3xl font-bold text-[#F5C29A]">98%</div><div className="text-xs text-white/50 uppercase tracking-widest mt-1">Match</div></div>
              <div><div className="font-serif text-3xl font-bold text-[#F5C29A]">0€</div><div className="text-xs text-white/50 uppercase tracking-widest mt-1">Commissioni</div></div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Form di Registrazione) */}
        <div className="w-full lg:w-7/12 flex flex-col justify-center items-center p-6 md:p-10 lg:p-12 overflow-y-auto">
          
          <div className="w-full max-w-xl bg-white p-8 md:p-10 rounded-3xl shadow-lg border border-orange-50 animate-fade-in-up my-auto">
            
            <div className="flex items-center gap-2 mb-6">
              <div className="flex gap-1">
                <div className="w-8 h-1.5 rounded-full bg-[#C4603A]"></div>
                <div className="w-8 h-1.5 rounded-full bg-orange-100"></div>
              </div>
              <span className="text-xs font-bold text-[#8A7B6E] uppercase tracking-widest ml-2">Passo 1 di 2</span>
            </div>

            <h1 className="font-serif text-4xl text-[#2C1A0E] font-bold mb-2">Crea il tuo account</h1>
            <p className="text-[#8A7B6E] text-sm mb-8">Gratis, sempre. Nessuna carta di credito richiesta.</p>

            {/* Tipo utente (Sostituisce la vecchia funzione JS selectType) */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button 
                className={`flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all ${userType === 'cerca' ? 'border-[#C4603A] bg-[#FEFAF4]' : 'border-neutral-100 bg-white hover:border-orange-200'}`} 
                onClick={() => setUserType('cerca')}
              >
                <span className="text-3xl mb-2">🔍</span>
                <span className="font-bold text-[#2C1A0E] text-sm mb-1">Cerco stanza</span>
                <span className="text-xs text-[#8A7B6E]">Voglio trovare dove abitare</span>
              </button>
              <button 
                className={`flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all ${userType === 'affitta' ? 'border-[#C4603A] bg-[#FEFAF4]' : 'border-neutral-100 bg-white hover:border-orange-200'}`} 
                onClick={() => setUserType('affitta')}
              >
                <span className="text-3xl mb-2">🏠</span>
                <span className="font-bold text-[#2C1A0E] text-sm mb-1">Affitto stanza</span>
                <span className="text-xs text-[#8A7B6E]">Ho uno spazio da condividere</span>
              </button>
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-neutral-200"></div>
              <span className="text-xs text-[#8A7B6E] uppercase tracking-wider font-bold">compila con email</span>
              <div className="flex-1 h-px bg-neutral-200"></div>
            </div>

            {/* FORM REACT */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-[#2C1A0E]">Nome</label>
                  <input type="text" name="nome" value={formData.nome} onChange={handleChange} placeholder="Mario" required className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] text-base md:text-sm rounded-2xl px-5 py-3 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A] transition-colors" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-[#2C1A0E]">Cognome</label>
                  <input type="text" name="cognome" value={formData.cognome} onChange={handleChange} placeholder="Rossi" required className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] text-base md:text-sm rounded-2xl px-5 py-3 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A] transition-colors" />
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-[#2C1A0E]">Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="mario@esempio.it" required className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] text-base md:text-sm rounded-2xl px-5 py-3 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A] transition-colors" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-[#2C1A0E]">Città preferita</label>
                  <select name="citta" value={formData.citta} onChange={handleChange} required className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] text-base md:text-sm rounded-2xl px-4 py-3 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A] transition-colors">
                    <option value="">Seleziona...</option>
                    <option>Milano</option><option>Roma</option><option>Torino</option>
                    <option>Bologna</option><option>Firenze</option><option>Napoli</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-[#2C1A0E]">Data di nascita</label>
                  <input type="date" name="nascita" value={formData.nascita} onChange={handleChange} required className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] text-base md:text-sm rounded-2xl px-4 py-3 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A] transition-colors" />
                </div>
              </div>
              
              {/* PASSWORD FIELD & STRENGTH INDICATOR */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-[#2C1A0E]">Password</label>
                <input 
                  type="password" 
                  name="password"
                  placeholder="Minimo 8 caratteri" 
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] text-base md:text-sm rounded-2xl px-5 py-3 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A] transition-colors"
                />
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4].map(num => (
                    <div key={num} className={`h-1.5 w-full rounded-full transition-colors ${score >= num ? currentStrength.barClass : 'bg-neutral-200'}`}></div>
                  ))}
                </div>
                <div className={`text-xs font-bold text-right mt-1 transition-colors ${currentStrength.color}`}>
                  {currentStrength.text}
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" name="accettaTermini" checked={formData.accettaTermini} onChange={handleChange} required className="mt-1 w-5 h-5 text-[#C4603A] bg-neutral-50 border-neutral-300 rounded focus:ring-[#C4603A] accent-[#C4603A] cursor-pointer shrink-0" />
                  <span className="text-sm text-[#8A7B6E] group-hover:text-[#2C1A0E] transition-colors leading-tight">
                    Accetto i <a href="#" className="text-[#C4603A] hover:underline font-medium">Termini di Servizio</a> e la <a href="#" className="text-[#C4603A] hover:underline font-medium">Privacy Policy</a> di RoomDate
                  </span>
                </label>
                
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" name="newsletter" checked={formData.newsletter} onChange={handleChange} className="mt-1 w-5 h-5 text-[#C4603A] bg-neutral-50 border-neutral-300 rounded focus:ring-[#C4603A] accent-[#C4603A] cursor-pointer shrink-0" />
                  <span className="text-sm text-[#8A7B6E] group-hover:text-[#2C1A0E] transition-colors leading-tight">
                    Voglio ricevere aggiornamenti sugli annunci nella mia città via email
                  </span>
                </label>
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className={`w-full mt-4 text-white py-4 rounded-full font-bold transition-all shadow-md flex justify-center items-center ${isSubmitting ? 'bg-neutral-400 cursor-not-allowed' : 'bg-[#C4603A] hover:bg-[#9A4628] hover:-translate-y-0.5 hover:shadow-lg'}`}
              >
                {isSubmitting ? 'Creazione in corso...' : 'Crea il mio account gratuito 🚀'}
              </button>
            </form>
            
            <div className="text-center mt-8 text-sm text-[#8A7B6E]">
              Hai già un account? <Link to="/accedi" className="text-[#C4603A] font-bold hover:underline">Accedi qui</Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}