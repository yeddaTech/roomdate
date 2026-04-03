import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';

export default function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const currentIntent = searchParams.get('intent') || 'stanza'; 
  const currentCity = searchParams.get('citta') || '';
  const currentBudget = searchParams.get('budget') || '';

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // Aggiunto per il menu mobile

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

  const handleDirectContact = async (targetUserId) => {
    if (!user) {
      alert("Devi accedere o registrarti per chattare!");
      navigate('/accedi');
      return;
    }
    try {
      const res = await fetch('/api/start_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: user.id,
          targetId: targetUserId
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

  useEffect(() => {
    setLoading(true);
    const apiEndpoint = currentIntent === 'coinquilino' ? '/api/get_roommates' : '/api/get_listings';

    fetch(apiEndpoint)
      .then(res => res.json())
      .then(data => {
        if (data) setResults(data);
        setLoading(false);
      })
      .catch(() => {
        setResults([]);
        setLoading(false);
      });
  }, [currentIntent]);

  const handleTopSearch = (newIntent, newCity, newBudget) => {
    const params = new URLSearchParams();
    params.append('intent', newIntent);
    if (newCity) params.append('citta', newCity);
    if (newBudget) params.append('budget', newBudget);
    setSearchParams(params);
  };

  const filteredResults = results.filter(item => {
    let match = true;
    if (currentCity && item.city && item.city.toLowerCase() !== currentCity.toLowerCase()) match = false;
    if (currentIntent === 'stanza' && currentBudget && item.price > parseInt(currentBudget)) match = false;
    return match;
  });

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

      {/* --- HERO SEARCH BOX --- */}
      <div className="bg-[#C4603A] px-6 py-12 flex justify-center">
         <div className="bg-white rounded-3xl p-6 shadow-xl w-full max-w-3xl border border-orange-100">
            <div className="flex gap-2 bg-neutral-100 p-1.5 rounded-full mb-6">
              <button 
                className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${currentIntent === 'stanza' ? 'bg-[#C4603A] text-white shadow-md' : 'text-[#8A7B6E] hover:text-[#2C1A0E]'}`} 
                onClick={() => handleTopSearch('stanza', currentCity, currentBudget)}
              >
                🔍 Cerca Stanza
              </button>
              <button 
                className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${currentIntent === 'coinquilino' ? 'bg-[#C4603A] text-white shadow-md' : 'text-[#8A7B6E] hover:text-[#2C1A0E]'}`} 
                onClick={() => handleTopSearch('coinquilino', currentCity, currentBudget)}
              >
                👥 Cerco Coinquilino
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select 
                className="w-full bg-neutral-50 border-2 border-neutral-100 text-[#2C1A0E] text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[#C4603A] transition-colors"
                value={currentCity} 
                onChange={(e) => handleTopSearch(currentIntent, e.target.value, currentBudget)}
              >
                <option value="">📍 Città (Tutte)</option>
                <option value="Milano">Milano</option>
                <option value="Roma">Roma</option>
                <option value="Bologna">Bologna</option>
                <option value="Torino">Torino</option>
              </select>
              <input 
                type="number" 
                placeholder="💶 Budget max €" 
                className={`w-full bg-neutral-50 border-2 border-neutral-100 text-[#2C1A0E] text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[#C4603A] transition-colors ${currentIntent === 'coinquilino' ? 'opacity-50 cursor-not-allowed' : ''}`}
                value={currentBudget}
                onChange={(e) => handleTopSearch(currentIntent, currentCity, e.target.value)}
                disabled={currentIntent === 'coinquilino'}
              />
            </div>
          </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 animate-fade-in-up">
        
        {/* GRIGLIA RISULTATI */}
        <main>
          <h1 className="font-serif text-3xl md:text-4xl text-[#2C1A0E] mb-2">
            {currentIntent === 'coinquilino' ? 'Coinquilini disponibili' : 'Stanze disponibili'}
          </h1>
          <p className="text-[#8A7B6E] mb-8 font-medium">
            Trovati {filteredResults.length} risultati {currentCity && `a ${currentCity}`}
          </p>

          {loading ? (
            /* GRIGLIA SKELETON */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="bg-white rounded-2xl shadow-sm border border-neutral-100 flex flex-col h-full min-h-[360px]">
                  <div className="h-48 w-full bg-neutral-200 animate-pulse rounded-t-2xl"></div>
                  <div className="p-5 flex flex-col gap-4 grow">
                    <div className="h-6 w-3/4 bg-neutral-200 animate-pulse rounded"></div>
                    <div className="h-4 w-1/2 bg-neutral-200 animate-pulse rounded"></div>
                    <div className="h-10 w-full bg-neutral-200 animate-pulse rounded-full mt-auto"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="bg-white rounded-3xl border-2 border-dashed border-orange-200 p-12 text-center shadow-sm">
              <span className="text-6xl block mb-4">🏜️</span>
              <h3 className="font-serif text-2xl text-[#2C1A0E] mb-2 font-bold">Nessun risultato trovato</h3>
              <p className="text-[#8A7B6E] mb-6">Prova ad ampliare i filtri di ricerca nel box in alto.</p>
              <button 
                className="bg-transparent border-2 border-[#C4603A] text-[#C4603A] px-6 py-2 rounded-full font-bold hover:bg-orange-50 transition-colors"
                onClick={() => handleTopSearch(currentIntent, '', '')}
              >
                Azzera Filtri
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              
              {/* RENDER DINAMICO: Stanze o Coinquilini? */}
              {filteredResults.map(item => {
                
                if (currentIntent === 'stanza') {
                  return (
                    <div key={item.id} className="bg-white rounded-2xl shadow-md border border-neutral-100 flex flex-col transition-all hover:-translate-y-2 hover:shadow-xl cursor-pointer overflow-hidden group">
                      <div className="h-48 flex items-center justify-center text-5xl relative" style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}88)` }}>
                        {item.emoji}
                        <div className="absolute bottom-3 right-3 bg-white px-3 py-1 rounded-lg shadow-sm">
                          <span className="font-serif font-bold text-[#C4603A]">€{item.price}</span><span className="text-xs text-[#8A7B6E]">/mese</span>
                        </div>
                      </div>
                      <div className="p-5 flex flex-col grow">
                        <h3 className="font-serif font-bold text-lg text-[#2C1A0E] mb-1">{item.title}</h3>
                        <p className="text-sm text-[#8A7B6E] mb-4">📍 {item.zone}, {item.city}</p>
                        <Link 
                            to={`/dettagli/${item.id}`} 
                            className="mt-auto block text-center border-2 border-[#F5E3CC] text-[#C4603A] py-2.5 rounded-xl font-bold transition-colors group-hover:border-[#C4603A] group-hover:bg-[#FBF3E8]"
                          >
                        Vedi dettagli
                        </Link>                      
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 flex flex-col transition-all hover:-translate-y-2 hover:shadow-xl group">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4" style={{ background: `linear-gradient(135deg, ${item.color1}, ${item.color2})` }}>
                        {item.emoji}
                      </div>
                      <div className="text-center font-bold text-[#2C1A0E] text-lg mb-1">{item.name}</div>
                      <div className="text-center text-xs text-[#8A7B6E] mb-4 font-medium">{item.age} anni · {item.job}</div>
                      
                      <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                        {item.tags.map(t => <span key={t} className="bg-[#FBF3E8] text-[#7A4B2A] px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase">{t}</span>)}
                      </div>
                      <div className="text-sm text-[#8A7B6E] italic text-center mb-6 leading-relaxed grow">"{item.quote}"</div>

                      <button 
                        onClick={() => handleDirectContact(item.id)} 
                        className="w-full bg-[#C4603A] text-white py-3 rounded-xl font-bold transition-colors hover:bg-[#9A4628] shadow-md group-hover:shadow-lg"
                      >
                        Contatta
                      </button>                 
                    </div>
                  );
                }

              })}
            </div>
          )}
        </main>
      </div>
      
      {/* --- MOBILE BOTTOM NAV --- */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-neutral-200 z-[990] pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-16">
          <Link to="/" className="flex flex-col items-center gap-1 text-[#8A7B6E] hover:text-[#C4603A] transition-colors">
            <span className="text-xl">🏠</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
          </Link>
          <Link to="/ricerca" className="flex flex-col items-center gap-1 text-[#C4603A]">
            <span className="text-xl">🔍</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Cerca</span>
          </Link>
          <Link to="/chat" className="flex flex-col items-center gap-1 text-[#8A7B6E] hover:text-[#C4603A] transition-colors">
            <span className="text-xl">💬</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Chat</span>
          </Link>
          <Link to="/dashboard" className="flex flex-col items-center gap-1 text-[#8A7B6E] hover:text-[#C4603A] transition-colors">
            <span className="text-xl">👤</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Profilo</span>
          </Link>
        </div>
      </nav>

    </div>
  );
}