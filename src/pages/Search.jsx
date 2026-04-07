import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';

export default function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 1. INIZIALIZZAZIONE UTENTE SICURA (Anti-Crash)
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('roomdate_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  // Normalizziamo il ruolo per coprire i vari formati del database
  const ruoloUtente = user ? (user.user_type || user.userType || user.type) : null;

  // 2. LETTURA URL 
  const urlIntent = searchParams.get('intent'); 
  const currentCity = searchParams.get('citta') || '';
  const currentBudget = searchParams.get('budget') || '';

  // 3. LA LOGICA DI FERRO (Niente Loop di re-render)
  let currentIntent = 'stanza'; 
  if (ruoloUtente === 'cerca') {
    currentIntent = 'stanza';
  } else if (ruoloUtente === 'affitta') {
    currentIntent = 'coinquilino';
  } else {
    // Visitatori o admin possono scegliere, di default stanze
    currentIntent = urlIntent === 'coinquilino' ? 'coinquilino' : 'stanza';
  }

  // 4. AGGIORNAMENTO URL (Solo su interazione manuale dell'utente)
  const handleTopSearch = (newIntent, newCity, newBudget) => {
    const params = new URLSearchParams();
    params.append('intent', newIntent);
    if (newCity) params.append('citta', newCity);
    
    // Il budget ha senso solo se stiamo cercando stanze
    if (newIntent === 'stanza' && newBudget) {
      params.append('budget', newBudget);
    }
    setSearchParams(params);
  };

  // 5. FETCH API PULITA (Parte una volta sola quando l'intento effettivo cambia)
  useEffect(() => {
    setLoading(true);
    const apiEndpoint = currentIntent === 'coinquilino' ? '/api/get_roommates' : '/api/get_listings';

    fetch(apiEndpoint)
      .then(res => {
        if (!res.ok) throw new Error('Errore di rete');
        return res.json();
      })
      .then(data => {
        setResults(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Errore fetch:", err);
        setResults([]);
        setLoading(false);
      });
  }, [currentIntent]); 

  // --- AZIONI UTENTE ---
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
        body: JSON.stringify({ tenantId: user.id, targetId: targetUserId })
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

  // --- 6. FILTRO BLINDATO ---
  const filteredResults = results.filter(item => {
    let match = true;
    
    // A. Filtro Città
    if (currentCity) {
      const itemCity = item.citta || item.city || '';
      if (itemCity.toLowerCase() !== currentCity.toLowerCase()) {
        match = false;
      }
    }
    
    // B. Filtro specifico per Stanza (Budget)
    if (currentIntent === 'stanza') {
      const itemPrice = item.price || item.prezzo || 0;
      if (currentBudget && itemPrice > parseInt(currentBudget)) {
        match = false;
      }
    }
    
    // C. Filtro specifico per Coinquilini (Solo chi "cerca")
    if (currentIntent === 'coinquilino') {
      const tipoProfilo = item.user_type || item.userType || item.type;
      if (tipoProfilo && tipoProfilo !== 'cerca') {
        match = false;
      }
    }

    return match;
  });

  return (
    <div className="min-h-[100dvh] bg-[#FEFAF4] pb-20 md:pb-0 font-sans">
      
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
          <Link to="/impostazioni" className="hover:text-[#D4835E] transition-colors">Impostazioni</Link>
        </div>

        <div className="hidden md:flex gap-4 items-center">
          {user ? (
            <>
              <span className="text-sm text-neutral-300">Ciao, <strong className="text-white">{user.nome || user.first_name || user.username || 'admin'}</strong>!</span>
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
               <h3 className="text-xl">👤 Ciao, {user.nome || user.first_name || user.username || 'admin'}!</h3>
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
      <div className="bg-gradient-to-br from-[#2C1A0E] to-[#C4603A] px-6 py-12 flex justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
        
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-2xl w-full max-w-3xl relative z-10 border border-white/20">
          
          {/* I BOTTONI INTELLIGENTI */}
          {!user || (ruoloUtente !== 'cerca' && ruoloUtente !== 'affitta') ? (
            <div className="flex gap-2 bg-neutral-100 p-1.5 rounded-2xl mb-6">
              <button 
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${currentIntent === 'stanza' ? 'bg-[#C4603A] text-white shadow-md' : 'text-[#8A7B6E] hover:bg-white hover:text-[#2C1A0E]'}`} 
                onClick={() => handleTopSearch('stanza', currentCity, currentBudget)}
              >
                🔍 Cerca Stanza
              </button>
              <button 
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${currentIntent === 'coinquilino' ? 'bg-[#C4603A] text-white shadow-md' : 'text-[#8A7B6E] hover:bg-white hover:text-[#2C1A0E]'}`} 
                onClick={() => handleTopSearch('coinquilino', currentCity, '')}
              >
                👥 Cerco Coinquilini
              </button>
            </div>
          ) : (
            <div className="mb-6 flex justify-center">
              <div className="bg-white/80 border border-[#C4603A]/30 text-[#2C1A0E] px-6 py-2.5 rounded-full text-sm font-bold shadow-sm inline-flex items-center gap-2">
                {ruoloUtente === 'cerca' ? '🔍 Stai cercando: Stanze in affitto' : '👥 Stai cercando: Coinquilini per la tua stanza'}
              </div>
            </div>
          )}

          <div className={`grid grid-cols-1 ${currentIntent === 'stanza' ? 'md:grid-cols-2' : ''} gap-4`}>
            <select 
              className="w-full bg-white border border-neutral-200 text-[#2C1A0E] text-sm rounded-2xl px-5 py-4 focus:outline-none focus:border-[#C4603A] focus:ring-2 focus:ring-orange-100 transition-all font-medium"
              value={currentCity} 
              onChange={(e) => handleTopSearch(currentIntent, e.target.value, currentBudget)}
            >
              <option value="">📍 Tutte le Città</option>
              <option value="Milano">Milano</option>
              <option value="Roma">Roma</option>
              <option value="Bologna">Bologna</option>
              <option value="Torino">Torino</option>
            </select>
            
            {/* Il budget appare SOLO se stiamo cercando una stanza */}
            {currentIntent === 'stanza' && (
              <input 
                type="number" 
                placeholder="💶 Budget max (€/mese)" 
                className="w-full bg-white border border-neutral-200 text-[#2C1A0E] text-sm rounded-2xl px-5 py-4 focus:outline-none focus:border-[#C4603A] focus:ring-2 focus:ring-orange-100 transition-all font-medium"
                value={currentBudget}
                onChange={(e) => handleTopSearch(currentIntent, currentCity, e.target.value)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 animate-fade-in-up">
        <main>
          <h1 className="font-serif text-3xl md:text-5xl text-[#2C1A0E] mb-3">
            {currentIntent === 'coinquilino' ? 'Coinquilini disponibili' : 'Stanze in affitto'}
          </h1>
          <p className="text-[#8A7B6E] mb-10 font-medium text-lg">
            Trovati <span className="font-bold text-[#C4603A]">{filteredResults.length}</span> risultati {currentCity && `a ${currentCity}`}
          </p>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="bg-white rounded-3xl shadow-sm border border-neutral-100 flex flex-col h-full min-h-[380px]">
                  <div className="h-48 w-full bg-neutral-200 animate-pulse rounded-t-3xl"></div>
                  <div className="p-6 flex flex-col gap-4 grow">
                    <div className="h-6 w-3/4 bg-neutral-200 animate-pulse rounded"></div>
                    <div className="h-4 w-1/2 bg-neutral-200 animate-pulse rounded"></div>
                    <div className="h-12 w-full bg-neutral-200 animate-pulse rounded-2xl mt-auto"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="bg-white rounded-3xl border-2 border-dashed border-[#D4835E] p-16 text-center shadow-sm">
              <span className="text-6xl block mb-6">🏜️</span>
              <h3 className="font-serif text-3xl text-[#2C1A0E] mb-3 font-bold">Nessun risultato trovato</h3>
              <p className="text-[#8A7B6E] mb-8 text-lg">Non ci sono {currentIntent === 'coinquilino' ? 'profili in cerca' : 'stanze'} che corrispondono ai tuoi criteri.</p>
              <button 
                className="bg-transparent border-2 border-[#C4603A] text-[#C4603A] px-8 py-3 rounded-full font-bold hover:bg-orange-50 transition-colors"
                onClick={() => handleTopSearch(currentIntent, '', '')}
              >
                Azzera Filtri
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              
              {filteredResults.map(item => {
                if (currentIntent === 'stanza') {
                  return (
                    <div key={item.id} className="w-full bg-white rounded-3xl shadow-md border border-neutral-100 flex flex-col transition-all hover:-translate-y-2 hover:shadow-xl cursor-pointer overflow-hidden group">
                      <div className="h-56 flex items-center justify-center text-6xl relative" style={{ background: `linear-gradient(135deg, ${item.color || '#C4603A'}, ${item.color || '#D4835E'}88)` }}>
                        {item.emoji || '🏠'}
                        <span className={`absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${item.avail !== false ? 'bg-white text-green-700' : 'bg-black/60 text-white backdrop-blur-sm'}`}>
                          {item.avail !== false ? '✅ Disponibile' : 'Occupata'}
                        </span>
                        <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm px-4 py-1.5 rounded-xl shadow-sm">
                          <span className="font-serif font-bold text-xl text-[#C4603A]">€{item.price || item.prezzo}</span><span className="text-xs text-[#8A7B6E] font-medium">/mese</span>
                        </div>
                      </div>
                      <div className="p-6 flex flex-col grow">
                        <h3 className="font-serif font-bold text-xl text-[#2C1A0E] leading-tight mb-2">{item.title}</h3>
                        <p className="text-sm text-[#8A7B6E] mb-5 flex items-center gap-1">
                          <span className="text-[#C4603A]">📍</span> {item.zone || item.zona || item.citta}, {item.city || item.citta}
                        </p>
                        <div className="flex flex-wrap gap-2 mb-6">
                          {(item.tags || []).map(t => <span key={t} className="bg-neutral-100 text-[#7A4B2A] px-3 py-1.5 rounded-lg text-xs font-semibold">{t}</span>)}
                        </div>
                        <Link 
                            to={`/dettagli/${item.id}`} 
                            className="mt-auto block text-center bg-neutral-50 text-[#C4603A] py-3.5 rounded-2xl font-bold transition-colors group-hover:bg-[#C4603A] group-hover:text-white"
                          >
                          Vedi dettagli
                        </Link>                      
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={item.id} className="w-full bg-[#FEFAF4] rounded-3xl shadow-sm border border-orange-50 p-6 flex flex-col transition-all hover:-translate-y-2 hover:shadow-lg group relative overflow-hidden">
                      <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-100/50 rounded-full blur-2xl"></div>
                      
                      <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner relative z-10" style={{ background: `linear-gradient(135deg, ${item.color1 || '#F5C29A'}, ${item.color2 || '#C4603A'})` }}>
                        {item.emoji || '👤'}
                      </div>
                      <div className="text-center font-bold text-[#2C1A0E] text-xl relative z-10">{item.name || item.first_name}</div>
                      <div className="text-center text-sm text-[#8A7B6E] mb-4 font-medium relative z-10">{item.age ? `${item.age} anni · ` : ''}{item.job || item.occupation || 'Studente'}</div>
                      
                      <div className="bg-white p-4 rounded-2xl text-sm text-[#8A7B6E] italic text-center mb-5 leading-relaxed shadow-sm relative z-10">"{item.quote || item.bio || 'Cerco una stanza accogliente!'}"</div>
                      
                      <div className="flex flex-wrap justify-center gap-1.5 mb-6 relative z-10">
                        {(item.tags || (item.lifestyle_tags ? item.lifestyle_tags.split(',') : [])).map(t => <span key={t} className="bg-orange-100/50 text-[#7A4B2A] px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider">{t.trim()}</span>)}
                      </div>
                      
                      <div className="mt-auto mb-5 relative z-10">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[10px] font-bold text-[#8A7B6E] uppercase">Compatibilità stimata</span>
                          <span className="text-xs font-bold text-[#C4603A]">{item.match || 85}%</span>
                        </div>
                        <div className="w-full bg-orange-100/50 rounded-full h-2 overflow-hidden">
                          <div className="bg-gradient-to-r from-[#D4835E] to-[#C4603A] h-full rounded-full transition-all duration-1000" style={{ width: `${item.match || 85}%` }}></div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 relative z-10 mt-auto">
                        <Link 
                          to={`/coinquilino/${item.id}`} 
                          className="w-full block text-center bg-white border-2 border-[#C4603A] text-[#C4603A] py-3 rounded-2xl font-bold transition-all hover:bg-orange-50 shadow-sm"
                        >
                          Vedi dettagli profilo
                        </Link>
                        <button 
                          onClick={() => handleDirectContact(item.id)} 
                          className="w-full bg-[#C4603A] text-white py-3 rounded-2xl font-bold transition-all hover:bg-[#9A4628] shadow-md flex items-center justify-center gap-2"
                        >
                          <span className="text-lg">💬</span> Contatta
                        </button>   
                      </div>              
                    </div>
                  );
                }
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}