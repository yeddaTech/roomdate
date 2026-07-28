import React, { useEffect, useState } from 'react';
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
    sessionStorage.clear();
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
      <div className="min-h-[100dvh] bg-[#FAFAFA] flex justify-center items-center font-sans">
        <div className="font-serif text-2xl font-bold text-orange-500 animate-pulse tracking-tight">Caricamento profilo...</div>
      </div>
    );
  }

  if (!roommate) {
    return (
      <div className="min-h-[100dvh] bg-[#FAFAFA] flex flex-col justify-center items-center font-sans p-6 text-center">
        <div className="text-6xl mb-4 opacity-50">👤</div>
        <h2 className="font-serif text-3xl font-extrabold text-neutral-900 mb-4 tracking-tight">Profilo non trovato</h2>
        <p className="text-neutral-500 mb-8 font-medium">L'utente che stai cercando potrebbe aver rimosso il profilo o non è disponibile.</p>
        <button onClick={() => navigate('/ricerca')} className="bg-neutral-900 hover:bg-neutral-800 text-white px-8 py-3.5 rounded-full font-bold shadow-md transition-all cursor-pointer">Torna alla Ricerca</button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] pb-20 md:pb-12 font-sans selection:bg-orange-200">
      <Helmet>
        <title>{roommate.first_name || roommate.nome} | RoomDate</title>
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

      {/* --- HERO PROFILO (GRADIENTE VIBRANTE) --- */}
      <section className="bg-gradient-to-br from-orange-500 to-rose-500 px-6 py-14 relative overflow-hidden text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 blur-[80px] rounded-full pointer-events-none"></div>

        <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-4 relative z-10 animate-fade-in-up">
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl shadow-xl bg-white text-neutral-900 border-4 border-white/20">
            <span className="drop-shadow-sm">{(roommate.first_name || roommate.nome || 'U').charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h1 className="font-serif text-4xl md:text-5xl font-extrabold mb-2 tracking-tight">
              {roommate.first_name || roommate.nome}
            </h1>
            <p className="text-white/90 text-lg font-bold tracking-wide">
              {roommate.user_type === 'affitta' ? '🏠 Offre una stanza' : '🔍 Cerca una stanza'} a {roommate.citta || 'Milano'}
            </p>
          </div>
        </div>
      </section>

      {/* --- MAIN CONTENT --- */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 flex flex-col lg:flex-row gap-8 -mt-8 relative z-20">
        
        {/* COLONNA SINISTRA: BIO E DETTAGLI */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100">
            <h2 className="font-serif text-2xl font-extrabold text-neutral-900 mb-4 tracking-tight">Chi sono</h2>
            <p className="text-neutral-600 leading-relaxed text-lg whitespace-pre-line font-medium">
              {roommate.bio || "Questo utente non ha ancora inserito una descrizione."}
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100">
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-6 tracking-tight">Stile di vita</h2>
            <div className="flex flex-wrap gap-2.5">
              {roommate.lifestyle_tags ? (
                roommate.lifestyle_tags.split(',').map((tag, idx) => (
                  <span key={idx} className="bg-orange-50 border border-orange-100 text-orange-600 px-4 py-2 rounded-full font-bold text-sm shadow-sm">
                    {tag.trim()}
                  </span>
                ))
              ) : (
                <span className="text-neutral-400 font-medium italic">Nessun tag specificato.</span>
              )}
            </div>
          </div>
        </div>

        {/* COLONNA DESTRA: INFORMAZIONI E CONTATTO */}
        <aside className="w-full lg:w-1/3">
          <div className="sticky top-28 flex flex-col gap-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-neutral-100 relative overflow-hidden">
              
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-400/10 blur-[50px] rounded-full pointer-events-none"></div>

              <div className="flex flex-col gap-4 mb-8 relative z-10">
                <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
                  <span className="text-neutral-500 font-bold text-sm uppercase tracking-wider">Budget / Prezzo</span>
                  <span className="font-extrabold text-neutral-900 text-lg">{roommate.budget_max ? `€${roommate.budget_max}` : 'Da concordare'}</span>
                </div>
                <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
                  <span className="text-neutral-500 font-bold text-sm uppercase tracking-wider">Occupazione</span>
                  <span className="font-extrabold text-neutral-900 capitalize">{roommate.occupation || 'Non specificata'}</span>
                </div>
              </div>

              <button onClick={handleContact} className="w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white py-4.5 rounded-2xl font-bold shadow-lg hover:shadow-orange-500/25 hover:scale-[1.02] transition-all duration-300 text-lg flex items-center justify-center gap-2 cursor-pointer relative z-10">
                <span className="text-xl">💬</span> Invia Messaggio
              </button>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}