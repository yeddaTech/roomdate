import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; 
import { Helmet } from 'react-helmet-async';
import { fetchAPI } from '../utils/api'; 

export default function ListingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('roomdate_user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('roomdate_user');
    sessionStorage.clear();
    setUser(null);
    setIsMenuOpen(false);
    navigate('/');
  };

  useEffect(() => {
    fetchAPI(`/api/get_listing?id=${id}`)
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

  // 🛡️ ZERO-TRUST: Invia solo l'ID dell'annuncio
  const handleContact = async () => {
    if (!user) {
      alert("Devi accedere o registrarti per contattare il proprietario!");
      navigate('/accedi');
      return;
    }

    try {
      const res = await fetchAPI('/api/start_chat', {
        method: 'POST',
        body: JSON.stringify({
          listingId: parseInt(id)
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
      <div className="min-h-[100dvh] bg-[#FAFAFA] flex justify-center items-center font-sans">
        <div className="font-serif text-2xl font-bold text-orange-500 animate-pulse tracking-tight">Caricamento annuncio...</div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-[100dvh] bg-[#FAFAFA] flex flex-col justify-center items-center font-sans p-6 text-center">
        <div className="text-6xl mb-4 opacity-50">🏜️</div>
        <h2 className="font-serif text-3xl font-extrabold text-neutral-900 mb-4 tracking-tight">Annuncio non trovato</h2>
        <p className="text-neutral-500 mb-8 font-medium">L'annuncio che stai cercando potrebbe essere stato rimosso o non è più disponibile.</p>
        <button onClick={() => navigate('/ricerca')} className="bg-neutral-900 hover:bg-neutral-800 text-white px-8 py-3.5 rounded-full font-bold shadow-md transition-all cursor-pointer">Torna alla Ricerca</button>
      </div>
    );
  }

  const hasImages = listing.images && listing.images.length > 0;

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] pb-20 md:pb-12 font-sans selection:bg-orange-200">
      <Helmet>
        <title>{listing.title} a {listing.city} | RoomDate</title>
        <meta name="description" content={`Stanza in affitto (${listing.type}) a ${listing.city}, zona ${listing.zone}.`} />
      </Helmet>

      {/* --- TOP NAV (GLASSMORPHISM) --- */}
      <nav className="shrink-0 z-50 bg-white/80 backdrop-blur-md px-6 py-4 flex justify-between items-center shadow-sm border-b border-neutral-100 sticky top-0">
        <Link to="/" className="font-serif text-2xl font-bold tracking-tight text-neutral-900 decoration-none">
          Room<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">Date</span>
        </Link>
        <div className="hidden md:flex gap-8 items-center text-sm font-medium text-neutral-500">
          <Link to="/" className="hover:text-neutral-900 transition-colors">Home</Link>
          <Link to="/ricerca" className="text-orange-500 font-bold transition-colors">Cerca Stanza</Link>
          <Link to="/chat" className="hover:text-neutral-900 transition-colors">Chat</Link>
          <Link to="/dashboard" className="hover:text-neutral-900 transition-colors">Profilo</Link>
        </div>
        <div className="hidden md:flex gap-4 items-center">
          {user ? (
            <>
              <span className="text-sm text-neutral-500">Ciao, <strong className="text-neutral-900">{user.nome}</strong>!</span>
              <button onClick={handleLogout} className="border border-neutral-200 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer">Esci</button>
            </>
          ) : (
            <>
              <Link to="/accedi" className="text-neutral-600 hover:text-neutral-900 px-4 py-2 text-sm font-medium transition-colors">Accedi</Link>
              <Link to="/registrati" className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-2 rounded-full text-sm font-bold transition-colors shadow-sm">Registrati Gratis</Link>
            </>
          )}
        </div>
        <button className="md:hidden flex flex-col gap-1.5 z-[1001] cursor-pointer" onClick={() => setIsMenuOpen(!isMenuOpen)}>          
          <div className={`w-6 h-0.5 bg-neutral-900 transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
          <div className={`w-6 h-0.5 bg-neutral-900 transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></div>
          <div className={`w-6 h-0.5 bg-neutral-900 transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
        </button>
      </nav>

      {/* --- MOBILE SIDEBAR APP MENU --- */}
      <div className={`fixed inset-y-0 right-0 w-72 bg-white shadow-2xl z-[1000] p-8 pt-24 transform transition-transform duration-300 ease-in-out border-l border-neutral-100 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col gap-6 text-lg font-medium text-neutral-600">
          <Link to="/" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">🏠 Home</Link>
          <Link to="/ricerca" onClick={() => setIsMenuOpen(false)} className="text-orange-500 font-bold">🔍 Cerca</Link>
          <Link to="/chat" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">💬 Chat</Link>
          <Link to="/dashboard" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">👤 Profilo</Link>
          {user ? (
            <button onClick={handleLogout} className="bg-neutral-900 text-white w-full py-3 rounded-2xl font-bold mt-4 hover:bg-neutral-800 transition-colors cursor-pointer">Esci</button>
          ) : (
            <Link to="/accedi" className="bg-neutral-900 text-white text-center py-3 rounded-2xl font-bold mt-4 shadow-sm" onClick={() => setIsMenuOpen(false)}>Accedi</Link>
          )}
        </div>
      </div>
      {isMenuOpen && <div className="fixed inset-0 bg-neutral-900/20 backdrop-blur-sm z-[999] md:hidden transition-opacity" onClick={() => setIsMenuOpen(false)}></div>}

      {/* --- HERO (GRADIENTE VIBRANTE) --- */}
      <section className="bg-gradient-to-br from-orange-500 to-rose-500 px-6 py-12 md:py-16 relative overflow-hidden text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/20 blur-[80px] rounded-full pointer-events-none"></div>

        <div className="max-w-6xl mx-auto relative z-10 flex flex-col gap-6 animate-fade-in-up">
          <button onClick={() => navigate(-1)} className="w-max bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 px-5 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer">
            ← Torna indietro
          </button>
          <div>
            <h1 className="font-serif text-4xl md:text-5xl font-extrabold mb-3 tracking-tight">{listing.title}</h1>
            <p className="text-white/90 text-lg md:text-xl font-medium flex items-center gap-2">📍 {listing.zone}, {listing.city}</p>
          </div>
        </div>
      </section>

      {/* --- MAIN CONTENT --- */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12 flex flex-col lg:flex-row gap-8 lg:gap-12 -mt-8 relative z-20">
        
        {/* COLONNA SINISTRA (Immagini e Descrizione) */}
        <div className="w-full lg:w-2/3 flex flex-col gap-8">
          
          {/* Galleria Immagini */}
          {hasImages ? (
            <div className="relative w-full h-[300px] md:h-[450px] rounded-3xl overflow-hidden shadow-lg group bg-neutral-100 border border-neutral-200">
              {listing.images.length > 1 && (
                <>
                  <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 backdrop-blur-md hover:bg-white text-neutral-900 rounded-full shadow-lg font-bold transition-all opacity-0 group-hover:opacity-100 cursor-pointer flex items-center justify-center text-lg z-10">❮</button>
                  <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 backdrop-blur-md hover:bg-white text-neutral-900 rounded-full shadow-lg font-bold transition-all opacity-0 group-hover:opacity-100 cursor-pointer flex items-center justify-center text-lg z-10">❯</button>
                  
                  {/* Contatore immagini */}
                  <div className="absolute bottom-4 right-4 bg-neutral-900/70 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full z-10">
                    {currentIndex + 1} / {listing.images.length}
                  </div>
                </>
              )}
              <img src={listing.images[currentIndex]} alt="Stanza" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
            </div>
          ) : (
            <div className="w-full h-[300px] md:h-[400px] rounded-3xl bg-neutral-100 flex items-center justify-center text-6xl shadow-sm border border-neutral-200">📸</div>
          )}

          {/* Dettagli Immobile */}
          <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-neutral-100">
            <h2 className="font-serif text-2xl md:text-3xl font-extrabold text-neutral-900 mb-6 tracking-tight">Descrizione immobile</h2>
            <p className="text-neutral-600 leading-relaxed text-lg whitespace-pre-line font-medium">{listing.description}</p>
            
            {listing.features && (
              <div className="border-t border-neutral-100 pt-8 mt-8">
                <h3 className="font-serif text-2xl font-extrabold text-neutral-900 mb-6 tracking-tight">Cosa offre</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {listing.features.map(f => (
                    <div key={f} className="flex items-center gap-3 text-neutral-700 font-bold bg-neutral-50 border border-neutral-100 px-5 py-3.5 rounded-2xl">
                      <span className="text-orange-500 text-lg">✦</span> {f}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLONNA DESTRA (Sidebar Host) */}
        <aside className="w-full lg:w-1/3">
          <div className="sticky top-28 flex flex-col gap-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-neutral-100 text-center relative overflow-hidden">
              {/* Orb decorativo interno */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-400/10 blur-[50px] rounded-full pointer-events-none"></div>

              {/* Box Prezzo */}
              <div className="bg-orange-50/50 p-6 rounded-3xl mb-8 border border-orange-100 shadow-sm relative z-10">
                <div className="font-serif text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500 tracking-tight">
                  €{listing.price}
                </div>
                <div className="text-sm font-bold text-neutral-500 mt-2 uppercase tracking-wider">al mese (spese incluse)</div>
              </div>
              
              {/* Profilo Host */}
              <div className="relative z-10">
                <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-5xl mb-5 shadow-md bg-gradient-to-br from-orange-300 to-rose-400 transform transition-transform hover:scale-105 cursor-default">
                  <span className="drop-shadow-sm">{listing.landlord?.emoji || '👤'}</span>
                </div>
                <h3 className="font-serif text-2xl font-extrabold text-neutral-900 mb-1">{listing.landlord?.name || 'Utente'}</h3>
                <p className="text-sm font-bold text-neutral-400 mb-8 uppercase tracking-wider">Host su RoomDate</p>
                
                {/* Bottone Contatto */}
                <button onClick={handleContact} className="w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white py-4.5 rounded-2xl font-bold shadow-lg hover:shadow-orange-500/25 hover:scale-[1.02] transition-all duration-300 text-lg flex items-center justify-center gap-2 cursor-pointer">
                  <span className="text-xl">💬</span> Contatta in Chat
                </button>
              </div>
            </div>

            {/* Banner Sicurezza */}
            <div className="bg-neutral-50 border border-neutral-100 p-6 rounded-3xl text-center shadow-sm">
              <div className="text-2xl mb-2">🛡️</div>
              <h4 className="font-bold text-neutral-900 mb-2">Protezione RoomDate</h4>
              <p className="text-xs text-neutral-500 font-medium leading-relaxed">Le tue chat sono protette da crittografia End-to-End. Non inviare mai denaro fuori dalla piattaforma prima di aver visitato l'immobile.</p>
            </div>

          </div>
        </aside>
      </div>
    </div>
  );
}