import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { fetchAPI } from '../utils/api';

// 🛡️ HELPER SICUREZZA: Previene iniezioni HTML/Script
const sanitizeHTML = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '');
};

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 🛡️ SAFE PARSING: Controllo rigoroso del token utente
    try {
      const savedUser = localStorage.getItem('roomdate_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser && typeof parsedUser === 'object' && parsedUser.id) {
          setUser(parsedUser);
        } else {
          throw new Error("Payload utente non valido");
        }
      }
    } catch (e) {
      localStorage.removeItem('roomdate_user');
    }

    const loadData = async () => {
      try {
        const res = await fetchAPI('/api/get_listings');
        if (res.ok) {
          const lData = await res.json();
          // 🛡️ TYPE CHECK
          if (Array.isArray(lData)) setListings(lData);
        }
      } catch (error) {
        console.error("Errore fetch stanze", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem('roomdate_user');
      sessionStorage.clear();
    } catch(e) {}
    setUser(null);
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-orange-200 flex flex-col">
      <Navbar user={user} handleLogout={handleLogout} />

      {/* HERO SECTION */}
      <section className="relative pt-32 md:pt-40 pb-20 px-6 overflow-hidden flex flex-col items-center justify-center min-h-[80vh]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-orange-400/20 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center mt-12 md:mt-0">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 border border-orange-100 text-orange-600 text-sm font-bold mb-8">
             Trova casa in Italia
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-neutral-900 mb-6 leading-tight">
            Trova la tua stanza <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">senza stress.</span>
          </h1>
          <p className="text-lg text-neutral-500 mb-10 max-w-xl mx-auto font-medium">
            Esplora annunci reali e chatta subito per trovare la tua sistemazione o il tuo prossimo coinquilino.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 w-full px-4 sm:px-0">
            <Link to="/ricerca?intent=stanza" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-neutral-900 text-white text-lg font-bold shadow-lg hover:bg-neutral-800 transition-colors text-center">
               Cerca Stanza
            </Link>
            <Link to="/ricerca?intent=coinquilino" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white text-neutral-900 text-lg font-bold border border-neutral-200 shadow-sm hover:bg-neutral-50 transition-colors text-center">
              Cerca Coinquilini
            </Link>
          </div>
        </div>
      </section>

      {/* STANZE */}
      <section className="py-16 px-6 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Le ultime stanze</h2>
          </div>
          <Link to="/ricerca" className="hidden md:block text-orange-500 font-bold">Vedi tutte &rarr;</Link>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            <p className="text-neutral-500">Caricamento in corso...</p>
          ) : listings.length === 0 ? (
            <p className="text-neutral-500">Nessuna stanza disponibile.</p>
          ) : (
            listings.map(l => (
              <div key={l.id} className="bg-white rounded-3xl p-3 shadow-sm border border-neutral-100">
                <div className="h-48 rounded-2xl flex items-center justify-center text-6xl relative" style={{ background: sanitizeHTML(l.color) || '#eee' }}>
                  <span role="img" aria-label="Icona stanza">{sanitizeHTML(l.emoji)}</span>
                  <span className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold ${l.avail ? 'bg-white/90 text-green-700' : 'bg-black/70 text-white'}`}>
                    {l.avail ? 'Disponibile' : 'Occupata'}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-lg text-neutral-900 truncate">{sanitizeHTML(l.title)}</h3>
                    <span className="font-extrabold text-orange-500">&euro;{Number(l.price) || 0}</span>
                  </div>
                  <p className="text-sm text-neutral-500 mb-3 truncate">{sanitizeHTML(l.zone)}, {sanitizeHTML(l.city)}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="mt-8 md:hidden">
            <Link to="/ricerca" className="block text-center bg-orange-50 text-orange-600 font-bold py-4 rounded-2xl">Vedi tutti gli annunci</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}