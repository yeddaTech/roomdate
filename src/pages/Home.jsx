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
    <div className="min-h-screen bg-neutral-50 pb-20 md:pb-0">
      
      {/* --- TOP NAV --- */}
      <nav className="sticky top-0 z-50 bg-[#2C1A0E] text-white px-6 py-4 flex justify-between items-center shadow-md border-b-2 border-orange-600">
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
          
          <div className="mt-8 flex flex-col gap-3">
            {user ? (
              <button onClick={handleLogout} className="bg-[#C4603A] w-full py-3 rounded-full font-bold">Esci</button>
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
      <section className="bg-[#C4603A] text-white py-20 px-6 text-center animate-fade-in-up">
        <div className="max-w-3xl mx-auto">
          <div className="inline-block bg-white/20 border border-white/30 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            🏡 Oltre 12.000 annunci attivi in Italia
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-bold leading-tight mb-6">
            Trova la tua stanza,<br/><em className="text-[#F5E3CC] font-light">trova casa.</em>
          </h1>
          <p className="text-white/80 text-lg mb-8 max-w-lg mx-auto">
            Migliaia di stanze e coinquilini selezionati nelle città italiane. Senza agenzie, senza commissioni.
          </p>
          <Link to="/ricerca" className="inline-block bg-[#2C1A0E] text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-neutral-900 transition-all hover:scale-105 shadow-lg">
            Inizia la ricerca →
          </Link>
        </div>
      </section>

      {/* --- STANZE --- */}
      <section className="py-16 px-6 max-w-7xl mx-auto animate-fade-in-up" style={{animationDelay: '0.2s'}}>
        <div className="text-[#C4603A] text-xs font-bold uppercase tracking-widest mb-2">Annunci in evidenza</div>
        <h2 className="font-serif text-3xl md:text-4xl text-neutral-900 mb-8">Stanze selezionate per te</h2>
        
        <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-8">
          {isLoadingListings ? (
            [1, 2, 3, 4].map((n) => (
              <div key={n} className="shrink-0 w-72 bg-white rounded-2xl shadow-sm border border-neutral-100 flex flex-col snap-start">
                <div className="h-48 w-full bg-neutral-200 animate-pulse rounded-t-2xl"></div>
                <div className="p-6 flex flex-col gap-4">
                  <div className="h-6 w-3/4 bg-neutral-200 animate-pulse rounded"></div>
                  <div className="h-4 w-1/2 bg-neutral-200 animate-pulse rounded"></div>
                  <div className="h-10 w-full bg-neutral-200 animate-pulse rounded-full mt-4"></div>
                </div>
              </div>
            ))
          ) : listings.length === 0 ? (
            <p className="text-neutral-500">Nessuna stanza caricata al momento.</p>
          ) : (
            listings.map(l => (
              <div key={l.id} className="shrink-0 w-72 bg-white rounded-2xl shadow-md border border-neutral-100 flex flex-col snap-start transition-all hover:-translate-y-2 hover:shadow-xl cursor-pointer overflow-hidden">
                <div className="h-48 flex items-center justify-center text-5xl relative" style={{ background: `linear-gradient(135deg, ${l.color}, ${l.color}88)` }}>
                  {l.emoji}
                  <span className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold ${l.avail ? 'bg-white/90 text-green-700' : 'bg-black/40 text-white'}`}>✅ Disponibile</span>
                  <div className="absolute bottom-3 right-3 bg-white px-3 py-1 rounded-lg shadow-sm">
                    <span className="font-serif font-bold text-[#C4603A]">€{l.price}</span><span className="text-xs text-neutral-500">/mese</span>
                  </div>
                </div>
                <div className="p-5 flex flex-col grow">
                  <h3 className="font-serif font-bold text-lg text-neutral-900">{l.title}</h3>
                  <p className="text-sm text-neutral-500 mt-1 mb-4">📍 {l.zone}, {l.city}</p>
                  <Link to={`/dettagli/${l.id}`} className="mt-auto block text-center border-2 border-[#C4603A] text-[#C4603A] py-2 rounded-xl font-bold transition-colors hover:bg-orange-50">
                    Vedi dettagli
                  </Link>                
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* --- FOOTER SEMPLICE --- */}
      <footer className="bg-[#1A0E07] text-neutral-400 py-8 text-center text-sm">
        <p>© 2026 RoomDate. Tutti i diritti riservati.</p>
      </footer>
      
      {/* --- MOBILE BOTTOM NAV --- */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-neutral-200 z-[990] pb-safe">
        <div className="flex justify-around items-center h-16">
          <Link to="/" className="flex flex-col items-center gap-1 text-[#C4603A]">
            <span className="text-xl">🏠</span>
            <span className="text-[10px] font-bold uppercase">Home</span>
          </Link>
          <Link to="/ricerca" className="flex flex-col items-center gap-1 text-neutral-400 hover:text-[#C4603A]">
            <span className="text-xl">🔍</span>
            <span className="text-[10px] font-bold uppercase">Cerca</span>
          </Link>
          <Link to="/chat" className="flex flex-col items-center gap-1 text-neutral-400 hover:text-[#C4603A]">
            <span className="text-xl">💬</span>
            <span className="text-[10px] font-bold uppercase">Chat</span>
          </Link>
          <Link to="/dashboard" className="flex flex-col items-center gap-1 text-neutral-400 hover:text-[#C4603A]">
            <span className="text-xl">👤</span>
            <span className="text-[10px] font-bold uppercase">Profilo</span>
          </Link>
        </div>
      </nav>

    </div>
  );
}