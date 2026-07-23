import React, { useState, useEffect } from 'sreact';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';
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
          <Link to="/" className="text-[#D4835E] transition-colors">Home</Link>
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
        <button className="md:hidden flex flex-col gap-1.5 z-[1001]" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label={isMenuOpen ? "Chiudi menu" : "Apri menu di navigazione"}>
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

      {/* --- HERO OTTMIZZATA PER SEO E AIO --- */}
      <section className="bg-gradient-to-br from-[#2C1A0E] via-[#5A2C1A] to-[#C4603A] text-white py-24 px-6 text-center animate-fade-in-up relative overflow-hidden">
        {/* Pattern di sfondo sottile */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
        
        <div className="max-w-4xl mx-auto relative z-10">
          
          {/* MODIFICA 1: H1 descrittivo con parole chiave vere */}
          <h1 className="font-serif text-5xl md:text-7xl font-bold leading-tight mb-6">
            Trova stanze in affitto e <br/><em className="text-[#F5E3CC] font-light">coinquilini ideali.</em>
          </h1>
          
          {/* MODIFICA 2: Paragrafo che spiega esattamente all'AI cosa fa l'app */}
          <p className="text-white/80 text-lg md:text-xl mb-12 max-w-2xl mx-auto font-light leading-relaxed">
            La piattaforma per cercare posti letto e appartamenti in condivisione senza agenzia. Esplora gli annunci, chatta in tempo reale e trova la tua sistemazione perfetta.
          </p>
          
          {/* Doppia CTA Funzionale (RESTANO UGUALI) */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6">
            <Link to="/ricerca?intent=stanza" className="bg-white text-[#C4603A] px-8 py-4 rounded-2xl text-lg font-bold hover:bg-[#F5E3CC] hover:-translate-y-1 transition-all shadow-xl flex items-center justify-center gap-3">
              Cerca una Stanza
            </Link>
            <Link to="/ricerca?intent=coinquilino" className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-8 py-4 rounded-2xl text-lg font-bold hover:bg-white/20 hover:-translate-y-1 transition-all shadow-xl flex items-center justify-center gap-3">
              Cerca Coinquilini
            </Link>
          </div>
        </div>
      </section>

      {/* --- STANZE REALI DAL DATABASE --- */}
      <section className="py-20 px-6 max-w-7xl mx-auto animate-fade-in-up" style={{animationDelay: '0.2s'}}>
        <div className="flex justify-between items-end mb-8">
          <div>
            <div className="text-[#C4603A] text-xs font-bold uppercase tracking-widest mb-2">Aggiunte di recente</div>
            <h2 className="font-serif text-3xl md:text-4xl text-[#2C1A0E]">Le ultime stanze</h2>
          </div>
          <Link to="/ricerca" className="hidden md:block text-[#C4603A] font-bold hover:underline">Vedi tutte →</Link>
        </div>
        
        <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-8 -mx-6 px-6 md:mx-0 md:px-0">
          {isLoadingListings ? (
            [1, 2, 3, 4].map((n) => (
              <div key={`skel-list-${n}`} className="shrink-0 w-[280px] md:w-72 bg-white rounded-3xl shadow-sm border border-neutral-100 flex flex-col snap-start">
                <div className="h-48 w-full bg-neutral-200 animate-pulse rounded-t-3xl"></div>
                <div className="p-6 flex flex-col gap-4">
                  <div className="h-6 w-3/4 bg-neutral-200 animate-pulse rounded"></div>
                  <div className="h-4 w-1/2 bg-neutral-200 animate-pulse rounded"></div>
                  <div className="h-12 w-full bg-neutral-200 animate-pulse rounded-2xl mt-4"></div>
                </div>
              </div>
            ))
          ) : listings.length === 0 ? (
            <div className="bg-white rounded-3xl border border-neutral-100 p-8 w-full text-center">
              <p className="text-[#8A7B6E]">Non ci sono ancora stanze caricate. Sii il primo a pubblicare un annuncio!</p>
            </div>
          ) : (
            listings.map(l => (
              <div key={l.id} className="shrink-0 w-[280px] md:w-72 bg-white rounded-3xl shadow-md border border-neutral-100 flex flex-col snap-start transition-all hover:-translate-y-2 hover:shadow-xl cursor-pointer overflow-hidden group">
                <div className="h-48 flex items-center justify-center text-6xl relative" style={{ background: `linear-gradient(135deg, ${l.color}, ${l.color}88)` }}>
                  {l.emoji}
                  <span className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold shadow-sm ${l.avail ? 'bg-white text-green-700' : 'bg-black/60 text-white backdrop-blur-sm'}`}>
                    {l.avail ? '✅ Disponibile' : 'Occupata'}
                  </span>
                  <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm px-4 py-1.5 rounded-xl shadow-sm">
                    <span className="font-serif font-bold text-lg text-[#C4603A]">€{l.price}</span><span className="text-xs text-[#8A7B6E] font-medium">/mese</span>
                  </div>
                </div>
                <div className="p-6 flex flex-col grow">
                  <h3 className="font-serif font-bold text-xl text-[#2C1A0E] leading-tight mb-1">{l.title}</h3>
                  <p className="text-sm text-[#8A7B6E] mb-5 flex items-center gap-1">
                    <span className="text-[#C4603A]">📍</span> {l.zone}, {l.city}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {l.tags.map(t => <span key={t} className="bg-neutral-100 text-[#7A4B2A] px-3 py-1 rounded-lg text-xs font-semibold">{t}</span>)}
                  </div>
                  <Link to={`/dettagli/${l.id}`} className="mt-auto block text-center bg-neutral-50 text-[#C4603A] py-3 rounded-2xl font-bold transition-colors group-hover:bg-[#C4603A] group-hover:text-white">
                    Vedi dettagli
                  </Link>                
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* --- COINQUILINI REALI DAL DATABASE --- */}
      <section className="bg-white border-y border-neutral-100 py-20 px-6 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-8">
            <div>
              <div className="text-[#C4603A] text-xs font-bold uppercase tracking-widest mb-2">Nuovi utenti</div>
              <h2 className="font-serif text-3xl md:text-4xl text-[#2C1A0E]">Chi cerca con te</h2>
            </div>
            <Link to="/ricerca?intent=coinquilino" className="hidden md:block text-[#C4603A] font-bold hover:underline">Vedi tutti →</Link>
          </div>
          
          <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-8 -mx-6 px-6 md:mx-0 md:px-0">
            {isLoadingRoommates ? (
              [1, 2, 3, 4].map((n) => (
                <div key={`skel-rm-${n}`} className="shrink-0 w-64 bg-[#FEFAF4] rounded-3xl shadow-sm border border-orange-50 p-6 flex flex-col snap-start">
                  <div className="h-20 w-20 bg-orange-100 animate-pulse rounded-full mx-auto mb-4"></div>
                  <div className="h-5 w-3/4 bg-orange-100 animate-pulse rounded mx-auto mb-2"></div>
                  <div className="h-3 w-1/2 bg-orange-100 animate-pulse rounded mx-auto mb-6"></div>
                  <div className="h-16 w-full bg-orange-100 animate-pulse rounded-xl mb-6"></div>
                  <div className="h-2 w-full bg-orange-100 animate-pulse rounded mt-auto"></div>
                </div>
              ))
            ) : roommates.length === 0 ? (
              <div className="bg-[#FEFAF4] rounded-3xl border border-orange-50 p-8 w-full text-center">
                <p className="text-[#8A7B6E]">Nessun profilo caricato al momento.</p>
              </div>
            ) : (
              roommates.map(rm => (
                <div key={rm.id} className="shrink-0 w-64 bg-[#FEFAF4] rounded-3xl shadow-sm border border-orange-50 p-6 flex flex-col snap-start transition-all hover:-translate-y-2 hover:shadow-lg cursor-pointer">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner" style={{ background: `linear-gradient(135deg, ${rm.color1}, ${rm.color2})` }}>
                    {rm.emoji}
                  </div>
                  <div className="text-center font-bold text-[#2C1A0E] text-xl">{rm.name}</div>
                  <div className="text-center text-sm text-[#8A7B6E] mb-4 font-medium">{rm.age} anni · {rm.job}</div>
                  <div className="bg-white p-3 rounded-xl text-sm text-[#8A7B6E] italic text-center mb-5 leading-relaxed shadow-sm">"{rm.quote}"</div>
                  <div className="flex flex-wrap justify-center gap-1.5 mb-6">
                    {rm.tags.map(t => <span key={t} className="bg-orange-100/50 text-[#7A4B2A] px-2 py-1 rounded-md text-[10px] font-bold uppercase">{t}</span>)}
                  </div>
                  <div className="mt-auto">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-bold text-[#8A7B6E] uppercase">Compatibilità</span>
                      <span className="text-xs font-bold text-[#C4603A]">{rm.match}%</span>
                    </div>
                    <div className="w-full bg-orange-100/50 rounded-full h-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-[#D4835E] to-[#C4603A] h-full rounded-full transition-all duration-1000" style={{ width: `${rm.match}%` }}></div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS (Pulito e Diretto) --- */}
      <section className="bg-[#FEFAF4] py-20 px-6 animate-fade-in-up" style={{animationDelay: '0.6s'}}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-5xl text-[#2C1A0E] mb-4">Come funziona</h2>
            <p className="text-[#8A7B6E] text-lg max-w-2xl mx-auto">Abbiamo rimosso tutti gli ostacoli. Trovare casa o coinquilini ora richiede solo quattro semplici passaggi.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100 transition-all hover:-translate-y-1 hover:shadow-md text-center">
              <div className="w-16 h-16 mx-auto bg-orange-50 rounded-2xl flex items-center justify-center text-3xl mb-6">📝</div>
              <h3 className="text-[#2C1A0E] font-bold text-lg mb-3">1. Profilo</h3>
              <p className="text-[#8A7B6E] text-sm leading-relaxed">Raccontaci chi sei e cosa cerchi. Più dettagli fornisci, migliori saranno i tuoi match.</p>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100 transition-all hover:-translate-y-1 hover:shadow-md text-center">
              <div className="w-16 h-16 mx-auto bg-orange-50 rounded-2xl flex items-center justify-center text-3xl mb-6">🔍</div>
              <h3 className="text-[#2C1A0E] font-bold text-lg mb-3">2. Ricerca</h3>
              <p className="text-[#8A7B6E] text-sm leading-relaxed">Filtra per città, budget e compatibilità. Trova esattamente quello di cui hai bisogno.</p>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100 transition-all hover:-translate-y-1 hover:shadow-md text-center">
              <div className="w-16 h-16 mx-auto bg-orange-50 rounded-2xl flex items-center justify-center text-3xl mb-6">💬</div>
              <h3 className="text-[#2C1A0E] font-bold text-lg mb-3">3. Chat</h3>
              <p className="text-[#8A7B6E] text-sm leading-relaxed">Scrivi direttamente in app ai proprietari o ai futuri coinquilini. Istantaneo e sicuro.</p>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100 transition-all hover:-translate-y-1 hover:shadow-md text-center">
              <div className="w-16 h-16 mx-auto bg-orange-50 rounded-2xl flex items-center justify-center text-3xl mb-6">🏠</div>
              <h3 className="text-[#2C1A0E] font-bold text-lg mb-3">4. Match</h3>
              <p className="text-[#8A7B6E] text-sm leading-relaxed">Trovate un accordo, scambiatevi i contatti e preparatevi per la nuova convivenza.</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOOTER COMPLETO --- */}
      <Footer />

    </div>
  );
}