import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; 

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
    navigate('/');
  };

  useEffect(() => {
    // CHIAMATA AL DB (Simulata o reale)
    fetch(`/api/get_roommates`) // In futuro farai /api/get_roommate?id=${id}
      .then(res => res.json())
      .then(data => {
        const found = data.find(r => r.id.toString() === id);
        if (found) setRoommate(found);
        setLoading(false);
      })
      .catch(err => {
        console.error("Errore nel caricamento del profilo:", err);
        setLoading(false);
      });
  }, [id]);

  const handleContact = async () => {
    if (!user) {
      alert("Devi accedere per contattare questo utente!");
      navigate('/accedi');
      return;
    }

    try {
      const res = await fetch('/api/start_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: parseInt(id),
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
        <div className="text-6xl mb-4">🏜️</div>
        <h2 className="font-serif text-3xl font-bold text-[#2C1A0E] mb-4">Profilo non trovato</h2>
        <button onClick={() => navigate('/ricerca?intent=coinquilino')} className="bg-[#C4603A] text-white px-6 py-3 rounded-full font-bold">Torna alla Ricerca</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF4] pb-20 md:pb-0 font-sans">
      
      {/* TOP NAV SEMPLIFICATA */}
      <nav className="sticky top-0 z-50 bg-[#2C1A0E] text-white px-6 py-4 flex justify-between items-center shadow-md border-b-2 border-[#C4603A]">
        <Link to="/" className="font-serif text-2xl font-bold tracking-tight text-white decoration-none">
          Room<span className="text-[#D4835E]">Date</span>
        </Link>
        <button className="md:hidden flex flex-col gap-1.5 z-[1001]" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <div className="w-7 h-0.5 bg-white"></div><div className="w-7 h-0.5 bg-white"></div><div className="w-7 h-0.5 bg-white"></div>
        </button>
      </nav>

      {/* HERO PROFILO */}
      <section className="bg-gradient-to-br from-[#2C1A0E] to-[#5A2C1A] px-6 py-12 md:py-16 relative overflow-hidden text-white">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
        
        <div className="max-w-4xl mx-auto relative z-10 flex flex-col items-center text-center gap-6">
          <button onClick={() => navigate(-1)} className="self-start bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 mb-4">
            ← Torna indietro
          </button>

          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full flex items-center justify-center text-6xl shadow-2xl border-4 border-[#C4603A]" style={{ background: `linear-gradient(135deg, ${roommate.color1}, ${roommate.color2})` }}>
            {roommate.emoji}
          </div>
          
          <div>
            <h1 className="font-serif text-4xl md:text-5xl font-bold mb-2">{roommate.name}</h1>
            <p className="text-[#F5E3CC] text-lg md:text-xl font-medium">
              {roommate.age} anni · {roommate.job}
            </p>
          </div>
        </div>
      </section>

      {/* CONTENUTO PROFILO */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12 flex flex-col gap-8 animate-fade-in-up">
        
        {/* INFO CARD */}
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-orange-50 -mt-20 relative z-20">
          
          <div className="flex flex-col md:flex-row justify-between gap-8 mb-10">
            <div className="flex-1">
              <h2 className="font-serif text-2xl font-bold text-[#2C1A0E] mb-4">Su di me</h2>
              <p className="text-[#8A7B6E] leading-relaxed text-lg italic bg-[#FEFAF4] p-6 rounded-2xl border border-orange-100">
                "{roommate.quote}"
              </p>
            </div>
            
            <div className="w-full md:w-1/3 bg-[#FFF5F5] p-6 rounded-2xl border border-red-100 flex flex-col items-center justify-center text-center">
              <div className="text-sm font-bold text-[#8A7B6E] uppercase tracking-widest mb-2">Compatibilità</div>
              <div className="font-serif text-5xl font-bold text-[#C4603A] mb-3">{roommate.match}%</div>
              <div className="w-full bg-white rounded-full h-2 overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-[#D4835E] to-[#C4603A] h-full rounded-full" style={{ width: `${roommate.match}%` }}></div>
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-8 mb-10">
            <h3 className="font-serif text-xl font-bold text-[#2C1A0E] mb-4">Stile di vita e Preferenze</h3>
            <div className="flex flex-wrap gap-3">
              {roommate.tags.map(t => (
                <span key={t} className="bg-orange-50 border border-orange-100 text-[#7A4B2A] px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button onClick={handleContact} className="flex-1 bg-[#C4603A] hover:bg-[#9A4628] text-white py-4 rounded-2xl font-bold transition-all shadow-md flex justify-center items-center gap-2 text-lg">
              <span>💬</span> Invia un messaggio
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}