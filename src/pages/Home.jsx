import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { fetchAPI } from '../utils/api';

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [roommates, setRoommates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('roomdate_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (typeof parsedUser === 'object' && parsedUser !== null && parsedUser.id) {
          setUser(parsedUser);
        } else {
          localStorage.removeItem('roomdate_user');
        }
      }
    } catch (e) {
      console.error("Local storage parse error");
      localStorage.removeItem('roomdate_user');
    }

    const loadData = async () => {
      try {
        const [listingsRes, roommatesRes] = await Promise.all([
          fetchAPI('/api/get_listings'),
          fetchAPI('/api/get_roommates')
        ]);
        
        if (listingsRes.ok) {
          const lData = await listingsRes.json();
          if (Array.isArray(lData)) setListings(lData);
        }
        
        if (roommatesRes.ok) {
          const rData = await roommatesRes.json();
          if (Array.isArray(rData)) setRoommates(rData);
        }
      } catch (error) {
        console.error("Errore nel caricamento dati", error);
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
    } catch (e) {
      console.error("Errore durante il logout");
    }
    setUser(null);
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-orange-200">
      <Navbar user={user} handleLogout={handleLogout} />

      <section className="relative pt-40 pb-24 px-6 overflow-hidden flex flex-col items-center justify-center min-h-[85vh]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-orange-400/20 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-rose-400/10 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 border border-orange-100 text-orange-600 text-sm font-semibold mb-8 shadow-sm">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            La nuova era dell'affitto
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-neutral-900 mb-6 leading-[1.1]">
            Trova la tua stanza <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">
              senza stress.
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-neutral-500 mb-10 max-w-2xl mx-auto font-medium">
            Esplora gli annunci, chatta in tempo reale e trova la tua sistemazione ideale o il tuo prossimo coinquilino in pochi click.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/ricerca?intent=stanza" className="px-8 py-4 rounded-full bg-neutral-900 text-white text-lg font-bold shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:bg-neutral-800 hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:-translate-y-1 transition-all">
               Cerca Stanza
            </Link>
            <Link to="/ricerca?intent=coinquilino" className="px-8 py-4 rounded-full bg-white text-neutral-800 text-lg font-bold border border-neutral-200 shadow-sm hover:border-neutral-300 hover:bg-neutral-50 hover:-translate-y-1 transition-all">
              Cerca Coinquilini
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-neutral-900 tracking-tight">Le ultime aggiunte</h2>
            <p className="text-neutral-500 mt-2 font-medium">Spazi appena pubblicati nella tua zona</p>
          </div>
          <Link to="/ricerca" className="hidden md:block text-orange-500 font-bold hover:text-orange-600 transition-colors">Vedi tutte &rarr;</Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            <p className="text-neutral-500 col-span-full text-center">Caricamento in corso...</p>
          ) : listings.length === 0 ? (
            <p className="text-neutral-500 col-span-full text-center">Nessuna stanza disponibile al momento.</p>
          ) : (
            listings.map(l => (
              <div key={l.id} className="group bg-white rounded-3xl p-3 shadow-[0_2px_20px_rgb(0,0,0,0.04)] border border-neutral-100 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-2 transition-all duration-300 cursor-pointer">
                <div className="h-56 rounded-2xl relative overflow-hidden flex items-center justify-center text-6xl" style={{ background: `linear-gradient(135deg, ${l.color}, ${l.color}88)` }}>
                  <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors"></div>
                  <span className="transform group-hover:scale-110 transition-transform duration-300" role="img" aria-label="Icona stanza">{l.emoji}</span>
                  
                  <span className={`absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm backdrop-blur-md ${l.avail ? 'bg-white/90 text-green-700' : 'bg-black/70 text-white'}`}>
                    {l.avail ? 'Disponibile' : 'Occupata'}
                  </span>
                </div>
                
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-xl text-neutral-900 truncate pr-2">{String(l.title).replace(/[<>]/g, '')}</h3>
                    <div className="text-right">
                      <span className="font-extrabold text-lg text-orange-500">&euro;{Number(l.price)}</span>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-500 mb-4 flex items-center gap-1.5 font-medium">
                    <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    {String(l.zone).replace(/[<>]/g, '')}, {String(l.city).replace(/[<>]/g, '')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(l.tags) && l.tags.map(t => (
                      <span key={t} className="bg-neutral-100 text-neutral-600 px-2.5 py-1 rounded-lg text-xs font-semibold">
                        {String(t).replace(/[<>]/g, '')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}