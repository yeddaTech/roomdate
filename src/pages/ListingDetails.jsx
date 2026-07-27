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

  const hasImages = listing.images && listing.images.length > 0;

  return (
    <div className="min-h-screen bg-[#FEFAF4] pb-20 md:pb-0 font-sans">
      <Helmet>
        <title>{listing.title} a {listing.city} | RoomDate</title>
        <meta name="description" content={`Stanza in affitto (${listing.type}) a ${listing.city}, zona ${listing.zone}.`} />
      </Helmet>

      {/* NAVBAR */}
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
              <button onClick={handleLogout} className="border border-neutral-500 hover:text-[#D4835E] px-4 py-2 rounded-full text-sm">Esci</button>
            </>
          ) : (
            <>
              <Link to="/accedi" className="border border-neutral-500 hover:text-[#D4835E] px-4 py-2 rounded-full text-sm">Accedi</Link>
              <Link to="/registrati" className="bg-[#C4603A] hover:bg-[#9A4628] px-5 py-2 rounded-full text-sm font-bold">Registrati Gratis</Link>
            </>
          )}
        </div>
        <button className="md:hidden flex flex-col gap-1.5 z-[1001]" onClick={() => setIsMenuOpen(!isMenuOpen)}>          
          <div className={`w-7 h-0.5 bg-white transition-all ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
          <div className={`w-7 h-0.5 bg-white transition-all ${isMenuOpen ? 'opacity-0' : ''}`}></div>
          <div className={`w-7 h-0.5 bg-white transition-all ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
        </button>
      </nav>

      {/* MOBILE MENU */}
      <div className={`fixed inset-y-0 right-0 w-72 bg-[#2C1A0E] shadow-2xl z-[1000] p-8 pt-24 transform transition-transform ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col gap-6 text-lg font-medium text-white">
          <Link to="/" onClick={() => setIsMenuOpen(false)}>🏠 Home</Link>
          <Link to="/ricerca" onClick={() => setIsMenuOpen(false)}>🔍 Cerca</Link>
          <Link to="/chat" onClick={() => setIsMenuOpen(false)}>💬 Chat</Link>
          <Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>👤 Profilo</Link>
          {user ? (
            <button onClick={handleLogout} className="bg-[#C4603A] w-full py-3 rounded-full font-bold mt-4">Esci</button>
          ) : (
            <Link to="/accedi" className="bg-[#C4603A] text-center py-3 rounded-full font-bold mt-4" onClick={() => setIsMenuOpen(false)}>Accedi</Link>
          )}
        </div>
      </div>
      {isMenuOpen && <div className="fixed inset-0 bg-black/60 z-[999] md:hidden" onClick={() => setIsMenuOpen(false)}></div>}

      {/* HERO */}
      <section className="bg-gradient-to-br from-[#2C1A0E] to-[#C4603A] px-6 py-12 md:py-16 relative overflow-hidden text-white">
        <div className="max-w-6xl mx-auto relative z-10 flex flex-col gap-6">
          <button onClick={() => navigate(-1)} className="w-max bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-full text-sm font-bold">← Torna indietro</button>
          <div>
            <h1 className="font-serif text-3xl md:text-5xl font-bold mb-3">{listing.title}</h1>
            <p className="text-white/80 text-lg md:text-xl font-light flex items-center gap-2">📍 {listing.zone}, {listing.city}</p>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12 flex flex-col lg:flex-row gap-8 lg:gap-12">
        <div className="w-full lg:w-2/3 flex flex-col gap-8">
          {hasImages ? (
            <div className="relative w-full h-[300px] md:h-[450px] rounded-3xl overflow-hidden shadow-md group bg-neutral-100">
              {listing.images.length > 1 && (
                <>
                  <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white text-[#2C1A0E] rounded-full shadow-lg font-bold">❮</button>
                  <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white text-[#2C1A0E] rounded-full shadow-lg font-bold">❯</button>
                </>
              )}
              <img src={listing.images[currentIndex]} alt="Stanza" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-full h-[300px] rounded-3xl bg-orange-50 flex items-center justify-center text-4xl shadow-sm border border-orange-100">📸</div>
          )}

          <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-orange-50">
            <h2 className="font-serif text-2xl font-bold text-[#2C1A0E] mb-4">Descrizione immobile</h2>
            <p className="text-[#8A7B6E] leading-relaxed text-lg whitespace-pre-line">{listing.description}</p>
            
            {listing.features && (
              <div className="border-t border-neutral-100 pt-8 mt-8">
                <h3 className="font-serif text-xl font-bold text-[#2C1A0E] mb-6">Cosa offre</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {listing.features.map(f => (
                    <div key={f} className="flex items-center gap-3 text-[#2C1A0E] font-medium bg-neutral-50 px-4 py-3 rounded-2xl">
                      <span className="text-[#C4603A]">✦</span> {f}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="w-full lg:w-1/3">
          <div className="sticky top-28 flex flex-col gap-6">
            <div className="bg-white p-8 rounded-3xl shadow-md border border-orange-100 text-center">
              <div className="bg-[#FEFAF4] p-4 rounded-2xl mb-8 border border-orange-50">
                <div className="font-serif text-4xl font-bold text-[#C4603A]">€{listing.price}</div>
                <div className="text-sm font-medium text-[#8A7B6E] mt-1">al mese (spese incluse)</div>
              </div>
              <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-5xl mb-4 bg-gradient-to-br from-[#F5C29A] to-[#C4603A] shadow-inner">
                {listing.landlord?.emoji || '👤'}
              </div>
              <h3 className="font-serif text-2xl font-bold text-[#2C1A0E] mb-1">{listing.landlord?.name || 'Utente'}</h3>
              <p className="text-sm font-medium text-[#8A7B6E] mb-8">Host su RoomDate</p>
              
              <button onClick={handleContact} className="w-full bg-[#C4603A] text-white py-4 rounded-2xl font-bold shadow-md text-lg">
                💬 Contatta in Chat
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}