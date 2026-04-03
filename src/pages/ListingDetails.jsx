import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; 

export default function ListingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Aggiunto per gestire la Navbar in modo coerente
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('roomdate_user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('roomdate_user');
    setUser(null);
    setIsMenuOpen(false);
    navigate('/');
  };

  useEffect(() => {
      // CHIAMATA REALE AL DATABASE
      fetch(`/api/get_listing?id=${id}`)
        .then(res => {
          if (!res.ok) throw new Error('Annuncio non trovato');
          return res.json();
        })
        .then(data => {
          setListing(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Errore nel caricamento dei dati:", err);
          setLoading(false);
        });
    }, [id]);

  // Logica navigazione immagini
  const nextImage = () => {
    if (listing?.images) {
      setCurrentIndex((prev) => (prev === listing.images.length - 1 ? 0 : prev + 1));
    }
  };

  const prevImage = () => {
    if (listing?.images) {
      setCurrentIndex((prev) => (prev === 0 ? listing.images.length - 1 : prev - 1));
    }
  };

  // --- FUNZIONE PER INIZIARE LA CHAT ---
  const handleContact = async () => {
    if (!user) {
      alert("Devi accedere o registrarti per contattare il proprietario!");
      navigate('/accedi');
      return;
    }

    try {
      const res = await fetch('/api/start_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: parseInt(id),
          tenantId: user.id
        })
      });
      if (res.ok) {
        const data = await res.json(); 
        navigate('/chat', { state: { openChatId: data.conversationId } });
      } else {
        alert("Errore nell'avvio della chat.");
      }
    } catch (err) {
      console.error(err);
      alert("Errore di connessione.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex justify-center items-center font-sans">
        <div className="font-serif text-2xl font-bold text-[#C4603A] animate-pulse">Caricamento annuncio...</div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex flex-col justify-center items-center font-sans p-6 text-center">
        <div className="text-6xl mb-4">🏜️</div>
        <h2 className="font-serif text-3xl font-bold text-[#2C1A0E] mb-4">Annuncio non trovato</h2>
        <button onClick={() => navigate('/ricerca')} className="bg-[#C4603A] text-white px-6 py-3 rounded-full font-bold">Torna alla Ricerca</button>
      </div>
    );
  }

  // Preveniamo crash se l'array immagini è vuoto o mancante
  const hasImages = listing.images && listing.images.length > 0;

  return (
    <div className="min-h-screen bg-[#FEFAF4] pb-20 md:pb-0 font-sans">
      
      {/* --- TOP NAV --- */}
      <nav className="sticky top-0 z-50 bg-[#2C1A0E] text-white px-6 py-4 flex justify-between items-center shadow-md border-b-2 border-[#C4603A]">
        <Link to="/" className="font-serif text-2xl font-bold tracking-tight text-white decoration-none">
          Room<span className="text-[#D4835E]">Date</span>
        </Link>
        
        <div className="hidden md:flex gap-8 items-center text-sm font-medium text-neutral-300">
          <Link to="/" className="hover:text-[#D4835E] transition-colors">Home</Link>
          <Link to="/ricerca" className="text-[#D4835E] transition-colors">Cerca Stanza</Link>
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

        <button className="md:hidden flex flex-col gap-1.5 z-[1001]" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <div className={`w-7 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
          <div className={`w-7 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></div>
          <div className={`w-7 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
        </button>
      </nav>

      {/* --- MOBILE SIDEBAR APP MENU --- */}
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


      {/* --- TESTATA ANNUNCIO (HERO) --- */}
      <section className="bg-gradient-to-br from-[#2C1A0E] to-[#C4603A] px-6 py-12 md:py-16 relative overflow-hidden text-white">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
        
        <div className="max-w-6xl mx-auto relative z-10 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <button onClick={() => navigate(-1)} className="bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2">
              ← Torna indietro
            </button>
            <div className="hidden md:flex text-sm text-white/60 items-center gap-2 font-medium">
              <Link to="/" className="hover:text-white transition-colors">Home</Link> / 
              <span className="text-white/80">{listing.city}</span> / 
              <span className="text-white">{listing.type}</span>
            </div>
          </div>

          <div>
            <h1 className="font-serif text-3xl md:text-5xl font-bold leading-tight mb-3 md:mb-4">{listing.title}</h1>
            <p className="text-white/80 text-lg md:text-xl font-light flex items-center gap-2">
              <span className="text-[#F5E3CC]">📍</span> {listing.zone}, {listing.city}
            </p>
          </div>
        </div>
      </section>

      {/* --- MAIN CONTENT LAYOUT --- */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12 flex flex-col lg:flex-row gap-8 lg:gap-12 animate-fade-in-up">
        
        {/* COLONNA SINISTRA (Foto + Dettagli) */}
        <div className="w-full lg:w-2/3 flex flex-col gap-8">
          
          {/* SLIDER IMMAGINI */}
          {hasImages ? (
            <div className="relative w-full h-[300px] md:h-[450px] rounded-3xl overflow-hidden shadow-md group bg-neutral-100">
              {listing.images.length > 1 && (
                <>
                  <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white text-[#2C1A0E] rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 font-bold">❮</button>
                  <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white text-[#2C1A0E] rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 font-bold">❯</button>
                </>
              )}
              
              <img 
                src={listing.images[currentIndex]} 
                alt={`Foto ${currentIndex + 1}`} 
                className="w-full h-full object-cover transition-transform duration-500"
              />

              {listing.images.length > 1 && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
                  {listing.images.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all ${currentIndex === idx ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'}`}
                      onClick={() => setCurrentIndex(idx)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-[300px] rounded-3xl bg-orange-50 flex items-center justify-center text-4xl shadow-sm border border-orange-100">
              📸 Immagini non disponibili
            </div>
          )}

          {/* CARD DESCRIZIONE E FEATURE */}
          <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-orange-50 flex flex-col gap-8">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#2C1A0E] mb-4">Descrizione immobile</h2>
              <p className="text-[#8A7B6E] leading-relaxed text-base md:text-lg whitespace-pre-line">
                {listing.description}
              </p>
            </div>
            
            <div className="border-t border-neutral-100 pt-8">
              <h3 className="font-serif text-xl font-bold text-[#2C1A0E] mb-6">Cosa offre la stanza</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {listing.features?.map(f => (
                  <div key={f} className="flex items-center gap-3 text-[#2C1A0E] font-medium bg-neutral-50 px-4 py-3 rounded-2xl">
                    <span className="text-[#C4603A] text-lg">✦</span> {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* COLONNA DESTRA (Sidebar Sticky con Prezzo e Host) */}
        <aside className="w-full lg:w-1/3">
          <div className="sticky top-28 flex flex-col gap-6">
            
            {/* CARD HOST E PREZZO */}
            <div className="bg-white p-8 md:p-10 rounded-3xl shadow-md border border-orange-100 flex flex-col items-center text-center">
              
              <div className="bg-[#FEFAF4] w-full p-4 rounded-2xl mb-8 border border-orange-50">
                <div className="font-serif text-4xl font-bold text-[#C4603A]">€{listing.price}</div>
                <div className="text-sm font-medium text-[#8A7B6E] mt-1">al mese (spese incluse)</div>
              </div>

              <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mb-4 shadow-inner" style={{ background: `linear-gradient(135deg, ${listing.color || '#F5C29A'}, ${listing.color || '#C4603A'}88)` }}>
                {listing.landlord?.emoji || '👤'}
              </div>
              <h3 className="font-serif text-2xl font-bold text-[#2C1A0E] mb-1">{listing.landlord?.name || 'Utente'}</h3>
              <p className="text-sm font-medium text-[#8A7B6E] mb-8">
                {listing.landlord?.role || 'Host'} su RoomDate
              </p>

              <button 
                onClick={handleContact} 
                className="w-full bg-[#C4603A] hover:bg-[#9A4628] text-white py-4 rounded-2xl font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 mb-3 flex justify-center items-center gap-2 text-lg"
              >
                <span>💬</span> Contatta in Chat
              </button>
              
              <button className="w-full bg-white border-2 border-[#C4603A] text-[#C4603A] hover:bg-orange-50 py-3.5 rounded-2xl font-bold transition-all flex justify-center items-center gap-2 text-base">
                <span>❤️</span> Salva nei preferiti
              </button>
            </div>

            {/* TRUST BADGE */}
            <div className="bg-[#FFF5F5] p-6 rounded-3xl border border-red-100 text-center flex flex-col items-center gap-3 shadow-sm">
              <span className="text-3xl">🔒</span>
              <p className="text-sm text-[#8A7B6E] leading-relaxed">
                <strong>Prenota in sicurezza:</strong> non inviare mai denaro a conti privati prima di aver visto la stanza e firmato un accordo.
              </p>
            </div>

          </div>
        </aside>

      </div>

    </div>
  );
}