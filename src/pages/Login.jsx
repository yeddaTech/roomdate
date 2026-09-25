import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { toast } from 'sonner';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

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
    // Nessun minimo di lunghezza qui: gli account registrati prima delle nuove regole
    // hanno password più corte e devono poter entrare lo stesso.
    if (!password) { newErrors.password = true; isValid = false; }

    setErrors(newErrors);

    if (isValid) {
      setIsSubmitting(true);
      
      try {
        // Accesso e preparazione delle chiavi di cifratura della chat (AuthProvider)
        const { keysUnlocked } = await login(email, password);
        if (!keysUnlocked) {
          toast.warning('Accesso effettuato, ma la chiave dei messaggi non si è aperta: potresti non riuscire a leggerli.');
        }

        setIsSuccess(true);
        // Torna alla pagina protetta da cui si era arrivati, se c'è
        setTimeout(() => {
          navigate(location.state?.from ?? '/', { replace: true });
        }, 1500);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col font-sans bg-[#FAFAFA] selection:bg-orange-200">
      

      {/* --- MAIN LAYOUT SPLIT --- */}
      <div className="flex-1 flex flex-col lg:flex-row w-full pt-16 md:pt-0">
        
        {/* LEFT COLUMN (Informativa - Nascosta su mobile) */}
        <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-orange-500 to-rose-500 p-16 flex-col justify-center relative overflow-hidden text-white">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-white/20 blur-[100px] rounded-full pointer-events-none"></div>
          
          <div className="relative z-10 max-w-lg mx-auto">
            <div className="text-white/80 text-xs font-bold uppercase tracking-widest mb-3">Bentornato su RoomDate</div>
            <h2 className="font-serif text-5xl font-extrabold leading-tight mb-6">Riprendi da<br/><em className="font-light opacity-90">dove hai lasciato.</em></h2>
            <p className="text-white/90 text-lg mb-12 font-medium">I tuoi annunci e i tuoi messaggi cifrati ti aspettano.</p>

            {/* Trust Badges */}
            <div className="flex flex-col gap-3">
              {['Chat cifrata end-to-end', 'Contatto diretto con chi affitta o cerca casa', 'Registrazione gratuita, nessuna commissione'].map((text, i) => (
                <div key={i} className="flex items-center gap-3 text-sm font-medium text-white/90">
                  <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Form di Login) */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 md:p-12 relative overflow-hidden">
          
          {/* Effetto Orb in background (tagliato dal contenitore: sul telefono è più largo dello schermo) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-orange-400/10 blur-[80px] rounded-full pointer-events-none"></div>

          <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-3xl shadow-lg border border-neutral-100 relative z-10 animate-fade-in-up">
            <h1 className="font-serif text-4xl text-neutral-900 font-extrabold mb-2 tracking-tight">Bentornato!</h1>
            <p className="text-neutral-500 text-sm mb-8 font-medium">Accedi al tuo account RoomDate per continuare la ricerca.</p>

            {/* Success Banner */}
            {isSuccess && (
              <div className="bg-green-50 text-green-700 px-4 py-4 rounded-2xl mb-6 font-bold text-sm border border-green-200 flex items-center gap-3 shadow-xs">
                <span className="text-lg">✅</span> Accesso effettuato! Reindirizzamento...
              </div>
            )}

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
                  className={`w-full bg-neutral-50 border text-neutral-900 text-base md:text-sm rounded-2xl px-5 py-3.5 focus:outline-hidden transition-all ${errors.email ? 'border-red-500 focus:ring-2 focus:ring-red-100 bg-red-50/30' : 'border-neutral-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'}`}
                />
                {errors.email && <div className="text-red-500 text-xs mt-1 ml-1 font-bold">Inserisci un indirizzo email valido.</div>}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-neutral-900">Password</label>
                  <Link to="/recupero" className="text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors">Password dimenticata?</Link>
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
                    className={`w-full bg-neutral-50 border text-neutral-900 text-base md:text-sm rounded-2xl pl-5 pr-20 py-3.5 focus:outline-hidden transition-all ${errors.password ? 'border-red-500 focus:ring-2 focus:ring-red-100 bg-red-50/30' : 'border-neutral-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'}`}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-bold text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                  >
                    {showPassword ? 'Nascondi' : 'Mostra'}
                  </button>
                </div>
                {errors.password && <div className="text-red-500 text-xs mt-1 ml-1 font-bold">Inserisci la tua password.</div>}
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className={`w-full mt-4 text-white py-4 rounded-full font-bold transition-all shadow-md flex justify-center items-center ${isSubmitting ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed shadow-none' : 'bg-linear-to-r from-orange-500 to-rose-500 hover:scale-[1.02] hover:shadow-orange-500/25 cursor-pointer'}`}
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