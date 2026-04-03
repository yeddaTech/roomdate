import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]); 
  const [roommates, setRoommates] = useState([]);
  
  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const [isLoadingRoommates, setIsLoadingRoommates] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  useEffect(() => {
    const savedUser = localStorage.getItem('roomdate_user');
    if (savedUser) setUser(JSON.parse(savedUser));

    fetch('/api/get_listings')
      .then(res => res.json())
      .then(data => { if (data) setListings(data); })
      .catch(() => setListings([]))
      .finally(() => setIsLoadingListings(false));

    fetch('/api/get_roommates')
      .then(res => res.json())
      .then(data => { if (data) setRoommates(data); })
      .catch(() => setRoommates([]))
      .finally(() => setIsLoadingRoommates(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('roomdate_user');
    setUser(null);
    setIsMenuOpen(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#FEFAF4] pb-20 md:pb-0 font-sans">
      
      {/* --- TOP NAV --- */}
      <nav className="sticky top-0 z-50 bg-[#2C1A0E] text-white px-6 py-4 flex justify-between items-center shadow-md border-b-2 border-[#C4603A]">
        <div className="font-serif text-2xl font-bold tracking-tight">
          Room<span className="text-[#D4835E]">Date</span>
        </div>
        
        <div className="hidden md:flex gap-8 items-center text-sm font-medium text-neutral-300">
          <Link to="/" className="hover:text-[#D4835E] transition-colors">Home</Link>
          <Link to="/ricerca" className="hover:text-[#D4835E] transition-colors">Cerca Stanza</Link>
          <Link to="/chat" className="hover:text-[#D4835E] transition-colors">Chat</Link>
          <Link to="/dashboard" className="hover:text-[#D4835E] transition-colors">Profilo</Link>
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

      {/* --- MOBILE SIDEBAR --- */}
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
              <button onClick={handleLogout} className="bg-[#C4603A] w-full py-3 rounded-full font-bold">Esci dall'account</button>
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

      {/* --- HERO --- */}
      <section className="bg-[#C4603A] text-white py-20 px-6 text-center animate-fade-in-up relative overflow-hidden">
        {/* Decorative dots background */}
        <div className="absolute top-10 left-1/4 w-48 h-48 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '20px 20px' }}></div>
        
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="inline-block bg-white/10 border border-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-6 backdrop-blur-sm shadow-sm animate-[float_4s_ease-in-out_infinite]">
            🏡 Oltre 12.000 annunci attivi in Italia
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-bold leading-tight mb-6">
            Trova la tua stanza,<br/><em className="text-[#F5E3CC] font-light">trova casa.</em>
          </h1>
          <p className="text-white/80 text-lg mb-8 max-w-lg mx-auto">
            Migliaia di stanze e coinquilini selezionati nelle città italiane. Senza agenzie, senza commissioni.
          </p>
          <Link to="/ricerca" className="inline-block bg-[#2C1A0E] text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-black transition-all hover:scale-105 shadow-xl">
            Inizia la ricerca →
          </Link>
        </div>
      </section>

      {/* --- STANZE IN EVIDENZA --- */}
      <section className="py-16 px-6 max-w-7xl mx-auto animate-fade-in-up" style={{animationDelay: '0.2s'}}>
        <div className="text-[#C4603A] text-xs font-bold uppercase tracking-widest mb-2">Annunci in evidenza</div>
        <h2 className="font-serif text-3xl md:text-4xl text-[#2C1A0E] mb-8">Stanze selezionate per te</h2>
        
        <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-8">
          {isLoadingListings ? (
            [1, 2, 3, 4].map((n) => (
              <div key={`skel-list-${n}`} className="shrink-0 w-72 bg-white rounded-2xl shadow-sm border border-neutral-100 flex flex-col snap-start">
                <div className="h-48 w-full bg-neutral-200 animate-pulse rounded-t-2xl"></div>
                <div className="p-6 flex flex-col gap-4">
                  <div className="h-6 w-3/4 bg-neutral-200 animate-pulse rounded"></div>
                  <div className="h-4 w-1/2 bg-neutral-200 animate-pulse rounded"></div>
                  <div className="h-10 w-full bg-neutral-200 animate-pulse rounded-full mt-4"></div>
                </div>
              </div>
            ))
          ) : listings.length === 0 ? (
            <p className="text-[#8A7B6E]">Nessuna stanza caricata al momento.</p>
          ) : (
            listings.map(l => (
              <div key={l.id} className="shrink-0 w-72 bg-white rounded-2xl shadow-md border border-neutral-100 flex flex-col snap-start transition-all hover:-translate-y-2 hover:shadow-xl cursor-pointer overflow-hidden group">
                <div className="h-48 flex items-center justify-center text-5xl relative" style={{ background: `linear-gradient(135deg, ${l.color}, ${l.color}88)` }}>
                  {l.emoji}
                  <span className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold ${l.avail ? 'bg-white/90 text-green-700' : 'bg-black/40 text-white'}`}>✅ Disponibile</span>
                  <div className="absolute bottom-3 right-3 bg-white px-3 py-1 rounded-lg shadow-sm">
                    <span className="font-serif font-bold text-[#C4603A]">€{l.price}</span><span className="text-xs text-[#8A7B6E]">/mese</span>
                  </div>
                </div>
                <div className="p-5 flex flex-col grow">
                  <h3 className="font-serif font-bold text-lg text-[#2C1A0E]">{l.title}</h3>
                  <p className="text-sm text-[#8A7B6E] mt-1 mb-4">📍 {l.zone}, {l.city}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {l.tags.map(t => <span key={t} className="bg-[#FBF3E8] text-[#7A4B2A] px-3 py-1 rounded-full text-xs font-medium">{t}</span>)}
                  </div>
                  <Link to={`/dettagli/${l.id}`} className="mt-auto block text-center border-2 border-[#F5E3CC] text-[#C4603A] py-2 rounded-xl font-bold transition-colors group-hover:border-[#C4603A] group-hover:bg-[#FBF3E8]">
                    Vedi dettagli
                  </Link>                
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* --- COINQUILINI IN EVIDENZA --- */}
      <section className="bg-[#F5E3CC] py-16 px-6 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
        <div className="max-w-7xl mx-auto">
          <div className="text-[#C4603A] text-xs font-bold uppercase tracking-widest mb-2">Profili in evidenza</div>
          <h2 className="font-serif text-3xl md:text-4xl text-[#2C1A0E] mb-8">Chi cerca con te</h2>
          
          <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-8">
            {isLoadingRoommates ? (
              [1, 2, 3, 4].map((n) => (
                <div key={`skel-rm-${n}`} className="shrink-0 w-64 bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 flex flex-col snap-start">
                  <div className="h-16 w-16 bg-neutral-200 animate-pulse rounded-full mx-auto mb-4"></div>
                  <div className="h-5 w-3/4 bg-neutral-200 animate-pulse rounded mx-auto mb-2"></div>
                  <div className="h-3 w-1/2 bg-neutral-200 animate-pulse rounded mx-auto mb-4"></div>
                  <div className="h-3 w-full bg-neutral-200 animate-pulse rounded mb-6"></div>
                  <div className="h-2 w-full bg-neutral-200 animate-pulse rounded mt-auto"></div>
                </div>
              ))
            ) : roommates.length === 0 ? (
              <p className="text-[#8A7B6E]">Nessun profilo caricato al momento.</p>
            ) : (
              roommates.map(rm => (
                <div key={rm.id} className="shrink-0 w-64 bg-white rounded-2xl shadow-sm p-6 flex flex-col snap-start transition-all hover:-translate-y-2 hover:shadow-xl cursor-pointer">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto mb-4" style={{ background: `linear-gradient(135deg, ${rm.color1}, ${rm.color2})` }}>
                    {rm.emoji}
                  </div>
                  <div className="text-center font-bold text-[#2C1A0E] text-lg">{rm.name}</div>
                  <div className="text-center text-xs text-[#8A7B6E] mb-3">{rm.age} anni · {rm.job} · {rm.city}</div>
                  <div className="text-sm text-[#8A7B6E] italic text-center mb-4 leading-relaxed">"{rm.quote}"</div>
                  <div className="flex flex-wrap justify-center gap-1.5 mb-5">
                    {rm.tags.map(t => <span key={t} className="bg-[#FBF3E8] text-[#7A4B2A] px-2 py-1 rounded-md text-[10px] font-medium">{t}</span>)}
                  </div>
                  <div className="mt-auto">
                    <div className="w-full bg-[#FBF3E8] rounded-full h-1.5 mb-1 overflow-hidden">
                      <div className="bg-gradient-to-r from-[#D4835E] to-[#C4603A] h-1.5 rounded-full" style={{ width: `${rm.match}%` }}></div>
                    </div>
                    <div className="text-[10px] text-[#C4603A] font-bold text-center">{rm.match}% compatibile</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS --- */}
      <section className="bg-[#C4603A] py-16 px-6 animate-fade-in-up" style={{animationDelay: '0.6s'}}>
        <div className="max-w-7xl mx-auto">
          <div className="text-white/60 text-xs font-bold uppercase tracking-widest mb-2">Come funziona</div>
          <h2 className="font-serif text-3xl md:text-4xl text-white mb-8">Trovare casa in 4 passi</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white/10 border border-white/10 rounded-2xl p-6 transition-all hover:-translate-y-2 hover:bg-white/20">
              <div className="font-serif text-4xl font-bold text-white/20 mb-2 leading-none">01</div>
              <div className="text-3xl mb-3">📝</div>
              <h3 className="text-white font-bold mb-2">Crea il tuo profilo</h3>
              <p className="text-white/70 text-sm leading-relaxed">Raccontaci di te, del tuo stile di vita e delle tue preferenze. Più sei specifico, migliori i match.</p>
            </div>
            <div className="bg-white/10 border border-white/10 rounded-2xl p-6 transition-all hover:-translate-y-2 hover:bg-white/20">
              <div className="font-serif text-4xl font-bold text-white/20 mb-2 leading-none">02</div>
              <div className="text-3xl mb-3">🔍</div>
              <h3 className="text-white font-bold mb-2">Cerca e filtra</h3>
              <p className="text-white/70 text-sm leading-relaxed">Usa i filtri intelligenti per trovare stanze o coinquilini per budget, zona e compatibilità.</p>
            </div>
            <div className="bg-white/10 border border-white/10 rounded-2xl p-6 transition-all hover:-translate-y-2 hover:bg-white/20">
              <div className="font-serif text-4xl font-bold text-white/20 mb-2 leading-none">03</div>
              <div className="text-3xl mb-3">💬</div>
              <h3 className="text-white font-bold mb-2">Contatta direttamente</h3>
              <p className="text-white/70 text-sm leading-relaxed">Chatta con proprietari o coinquilini senza intermediari. Nessuna agenzia, zero costi nascosti.</p>
            </div>
            <div className="bg-white/10 border border-white/10 rounded-2xl p-6 transition-all hover:-translate-y-2 hover:bg-white/20">
              <div className="font-serif text-4xl font-bold text-white/20 mb-2 leading-none">04</div>
              <div className="text-3xl mb-3">🏠</div>
              <h3 className="text-white font-bold mb-2">Benvenuto a casa!</h3>
              <p className="text-white/70 text-sm leading-relaxed">Firma l'accordo, prendi le chiavi e inizia la tua nuova convivenza. Semplice come dev'essere.</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOOTER COMPLETO --- */}
      <footer className="bg-[#1A0E07] pt-16 pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-1">
              <div className="font-serif text-2xl font-bold tracking-tight text-white mb-4">
                Room<span className="text-[#D4835E]">Date</span>
              </div>
              <p className="text-white/40 text-sm leading-relaxed">
                Il modo più semplice per trovare stanze e coinquilini in Italia. Senza agenzie, senza stress.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-4 tracking-wide text-sm">Servizi</h4>
              <ul className="flex flex-col gap-3">
                <li><Link to="/ricerca" className="text-white/40 hover:text-[#D4835E] text-sm transition-colors">Cerca Stanza</Link></li>
                <li><Link to="/dashboard" className="text-white/40 hover:text-[#D4835E] text-sm transition-colors">Pubblica Annuncio</Link></li>
                <li><Link to="/ricerca?intent=coinquilino" className="text-white/40 hover:text-[#D4835E] text-sm transition-colors">Trova Coinquilini</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4 tracking-wide text-sm">Supporto</h4>
              <ul className="flex flex-col gap-3">
                <li><a href="#come-funziona" className="text-white/40 hover:text-[#D4835E] text-sm transition-colors">Come Funziona</a></li>
                <li><a href="#" className="text-white/40 hover:text-[#D4835E] text-sm transition-colors">FAQ</a></li>
                <li><a href="#" className="text-white/40 hover:text-[#D4835E] text-sm transition-colors">Sicurezza</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4 tracking-wide text-sm">Azienda</h4>
              <ul className="flex flex-col gap-3">
                <li><a href="#" className="text-white/40 hover:text-[#D4835E] text-sm transition-colors">Chi Siamo</a></li>
                <li><a href="#" className="text-white/40 hover:text-[#D4835E] text-sm transition-colors">Blog</a></li>
                <li><a href="#" className="text-white/40 hover:text-[#D4835E] text-sm transition-colors">Lavora con Noi</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <span className="text-white/30 text-xs">© 2026 RoomDate. Tutti i diritti riservati.</span>
            <div className="flex gap-6">
              <a href="#" className="text-white/30 hover:text-[#D4835E] text-xs transition-colors">Privacy Policy</a>
              <a href="#" className="text-white/30 hover:text-[#D4835E] text-xs transition-colors">Termini di Servizio</a>
              <a href="#" className="text-white/30 hover:text-[#D4835E] text-xs transition-colors">Cookie</a>
            </div>
          </div>
        </div>
      </footer>
      
      {/* --- MOBILE BOTTOM NAV --- */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-neutral-200 z-[990] pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-16">
          <Link to="/" className="flex flex-col items-center gap-1 text-[#C4603A]">
            <span className="text-xl">🏠</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
          </Link>
          <Link to="/ricerca" className="flex flex-col items-center gap-1 text-[#8A7B6E] hover:text-[#C4603A] transition-colors">
            <span className="text-xl">🔍</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Cerca</span>
          </Link>
          <Link to="/chat" className="flex flex-col items-center gap-1 text-[#8A7B6E] hover:text-[#C4603A] transition-colors">
            <span className="text-xl">💬</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Chat</span>
          </Link>
          <Link to="/dashboard" className="flex flex-col items-center gap-1 text-[#8A7B6E] hover:text-[#C4603A] transition-colors">
            <span className="text-xl">👤</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Profilo</span>
          </Link>
        </div>
      </nav>

    </div>
  );
}