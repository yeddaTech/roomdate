import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; 
import { Helmet } from 'react-helmet-async';
import { fetchAPI } from '../utils/api'; 

export default function RoommateDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [roommate, setRoommate] = useState(null);
  const [loading, setLoading] = useState(true);
  
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
    // Recupera i dettagli del profilo pubblico dell'utente
    fetchAPI(`/api/profile?userId=${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Utente non trovato');
        return res.json();
      })
      .then(data => {
        setRoommate(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Errore nel caricamento del profilo:", err);
        setLoading(false);
      });
  }, [id]);

  // 🛡️ ZERO-TRUST: Invia solo il targetId
  const handleContact = async () => {
    if (!user) {
      alert("Devi accedere o registrarti per contattare questo utente!");
      navigate('/accedi');
      return;
    }

    try {
      const res = await fetchAPI('/api/start_chat', {
        method: 'POST',
        body: JSON.stringify({
          targetId: id
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
        <div className="font-serif text-2xl font-bold text-[#C4603A] animate-pulse">Caricamento profilo...</div>
      </div>
    );
  }

  if (!roommate) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex flex-col justify-center items-center font-sans p-6 text-center">
        <div className="text-6xl mb-4">👤</div>
        <h2 className="font-serif text-3xl font-bold text-[#2C1A0E] mb-4">Profilo non trovato</h2>
        <button onClick={() => navigate('/ricerca')} className="bg-[#C4603A] text-white px-6 py-3 rounded-full font-bold">Torna alla Ricerca</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF4] pb-20 md:pb-0 font-sans">
      <Helmet>
        <title>{roommate.first_name || roommate.nome} | RoomDate</title>
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

      {/* HERO PROFILO */}
      <section className="bg-[#2C1A0E] px-6 py-12 relative overflow-hidden text-white">
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-4 relative z-10">
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl shadow-xl bg-gradient-to-br from-[#F5C29A] to-[#C4603A] border-4 border-[#1A0E07]">
            {(roommate.first_name || roommate.nome || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="font-serif text-4xl font-bold mb-2">
              {roommate.first_name || roommate.nome}
            </h1>
            <p className="text-[#D4835E] text-lg font-medium">
              {roommate.user_type === 'affitta' ? '🏠 Offre una stanza' : '🔍 Cerca una stanza'} a {roommate.citta || 'Milano'}
            </p>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* COLONNA SINISTRA: BIO E DETTAGLI */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-orange-50">
            <h2 className="font-serif text-2xl font-bold text-[#2C1A0E] mb-4">Chi sono</h2>
            <p className="text-[#8A7B6E] leading-relaxed text-lg whitespace-pre-line">
              {roommate.bio || "Questo utente non ha ancora inserito una descrizione."}
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-orange-50">
            <h2 className="font-serif text-xl font-bold text-[#2C1A0E] mb-6">Stile di vita</h2>
            <div className="flex flex-wrap gap-3">
              {roommate.lifestyle_tags ? (
                roommate.lifestyle_tags.split(',').map((tag, idx) => (
                  <span key={idx} className="bg-orange-50 border border-orange-100 text-[#C4603A] px-4 py-2 rounded-full font-medium">
                    {tag.trim()}
                  </span>
                ))
              ) : (
                <span className="text-[#8A7B6E] italic">Nessun tag specificato.</span>
              )}
            </div>
          </div>
        </div>

        {/* COLONNA DESTRA: INFORMAZIONI E CONTATTO */}
        <aside className="w-full lg:w-1/3">
          <div className="sticky top-28 flex flex-col gap-6">
            <div className="bg-white p-8 rounded-3xl shadow-md border border-orange-100">
              
              <div className="flex flex-col gap-4 mb-8">
                <div className="flex justify-between border-b border-neutral-100 pb-3">
                  <span className="text-[#8A7B6E] font-medium">Budget / Prezzo</span>
                  <span className="font-bold text-[#2C1A0E]">{roommate.budget_max ? `€${roommate.budget_max}` : 'Da concordare'}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-100 pb-3">
                  <span className="text-[#8A7B6E] font-medium">Occupazione</span>
                  <span className="font-bold text-[#2C1A0E] capitalize">{roommate.occupation || 'Non specificata'}</span>
                </div>
              </div>

              <button onClick={handleContact} className="w-full bg-[#C4603A] text-white py-4 rounded-2xl font-bold shadow-md text-lg hover:-translate-y-0.5 transition-all">
                💬 Invia Messaggio
              </button>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}