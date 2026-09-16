import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../auth/AuthContext';
import { useLatestListings, useRoommates, useStartChat } from '../api/hooks';
import { formatAvailability, formatBills } from '../api/listings';

export default function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const urlIntent = searchParams.get('intent');
  const currentCity = searchParams.get('citta') || '';
  const currentBudget = searchParams.get('budget') || '';

  // 🔴 LOGICA SISTEMATA: L'URL comanda sempre e il default è 'stanza'. Addio conflitti con il ruolo utente.
  const currentIntent = urlIntent === 'coinquilino' ? 'coinquilino' : 'stanza';

  const handleTopSearch = (newIntent, newCity, newBudget) => {
    const params = new URLSearchParams();
    params.append('intent', newIntent);
    if (newCity) params.append('citta', newCity);
    if (newBudget) params.append('budget', newBudget);
    setSearchParams(params);
  };

  // Si carica solo l'elenco della modalità attiva; i dati restano in cache passando da una all'altra
  const roommatesQuery = useRoommates({ enabled: currentIntent === 'coinquilino' });
  const listingsQuery = useLatestListings({ enabled: currentIntent === 'stanza' });
  const activeQuery = currentIntent === 'coinquilino' ? roommatesQuery : listingsQuery;
  const results = activeQuery.data ?? [];
  const loading = activeQuery.isPending;

  const startChat = useStartChat();

  const handleLogout = async () => {
    setIsMenuOpen(false);
    navigate('/');
    await logout();
  };

  const handleDirectContact = async (targetUserId) => {
    if (!user) {
      alert("Devi accedere o registrarti per chattare!");
      navigate('/accedi');
      return;
    }
    try {
      const conversationId = await startChat.mutateAsync({ targetId: targetUserId });
      navigate('/chat', { state: { openChatId: conversationId } });
    } catch (err) {
      alert("Errore nell'avvio della chat: " + err.message);
    }
  };

  // 🔴 LOGICA FILTRI BLINDATA E TOLLERANTE
  const filteredResults = results.filter(item => {
    // Escludi l'utente stesso dalla visualizzazione dei coinquilini
    if (user && String(item.id) === String(user.id) && currentIntent === 'coinquilino') {
      return false;
    }
    
    let match = true;
    
    // Filtro Città tollerante
    if (currentCity) {
      const itemCity = item.city.toLowerCase().trim();
      if (itemCity && itemCity !== currentCity.toLowerCase().trim()) {
        match = false;
      }
    }
    
    // Filtro Budget tollerante per le stanze
    if (currentIntent === 'stanza' && currentBudget) {
      const itemPrice = item.price;
      const targetBudget = Number(currentBudget);
      if (targetBudget > 0 && itemPrice > 0 && itemPrice > targetBudget) {
        match = false;
      }
    }
    
    // Filtro Budget tollerante per i coinquilini
    if (currentIntent === 'coinquilino' && currentBudget) {
      const budgetCoinquilino = item.budgetMax;
      const targetBudget = Number(currentBudget);
      
      // 🔴 FIX: Segno invertito (da < a >)
      // Se il budget del coinquilino è MAGGIORE del budget cercato, nascondiamo il profilo.
      if (targetBudget > 0 && budgetCoinquilino > 0 && budgetCoinquilino > targetBudget) {
        match = false;
      }
    }

    return match;
  });

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] pb-20 md:pb-0 font-sans selection:bg-orange-200">
      <Helmet>
        <title>Ricerca | RoomDate</title>
      </Helmet>
      
      {/* --- TOP NAV --- */}
      <nav className="shrink-0 z-50 bg-white/80 backdrop-blur-md px-6 py-4 flex justify-between items-center shadow-sm border-b border-neutral-100 sticky top-0">
        <Link to="/" className="font-serif text-2xl font-bold tracking-tight text-neutral-900 decoration-none">
          Room<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">Date</span>
        </Link>
        
        <div className="hidden md:flex gap-8 items-center text-sm font-medium text-neutral-500">
          <Link to="/" className="hover:text-neutral-900 transition-colors">Home</Link>
          <Link to="/ricerca" className="text-orange-500 font-bold transition-colors">Cerca Stanza</Link>
          <Link to="/chat" className="hover:text-neutral-900 transition-colors">Chat</Link>
          <Link to="/dashboard" className="hover:text-neutral-900 transition-colors">Profilo</Link>
          <Link to="/impostazioni" className="hover:text-neutral-900 transition-colors">Impostazioni</Link>
        </div>

        <div className="hidden md:flex gap-4 items-center">
          {user ? (
            <>
              <span className="text-sm text-neutral-500">Ciao, <strong className="text-neutral-900">{user.firstName}</strong>!</span>
              <button onClick={handleLogout} className="border border-neutral-200 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer">Esci</button>
            </>
          ) : (
            <>
              <Link to="/accedi" className="text-neutral-600 hover:text-neutral-900 px-4 py-2 text-sm font-medium transition-colors">Accedi</Link>
              <Link to="/registrati" className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-2 rounded-full text-sm font-bold transition-colors shadow-sm">Registrati</Link>
            </>
          )}
        </div>

        <button className="md:hidden flex flex-col gap-1.5 z-[1001] cursor-pointer" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Menu">
          <div className={`w-6 h-0.5 bg-neutral-900 transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
          <div className={`w-6 h-0.5 bg-neutral-900 transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></div>
          <div className={`w-6 h-0.5 bg-neutral-900 transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
        </button>
      </nav>

      {/* MOBILE MENU */}
      <div className={`fixed inset-y-0 right-0 w-72 bg-white shadow-2xl z-[1000] p-8 pt-24 transform transition-transform duration-300 ease-in-out border-l border-neutral-100 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col gap-6 text-lg font-medium text-neutral-600">
          {user && (
             <div className="border-b border-neutral-100 pb-4 mb-2">
               <h3 className="text-xl text-neutral-900 font-bold">👤 Ciao, {user.firstName}!</h3>
             </div>
          )}
          <Link to="/" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">🏠 Home</Link>
          <Link to="/ricerca" onClick={() => setIsMenuOpen(false)} className="text-orange-500 font-bold">🔍 Cerca Stanza</Link>
          <Link to="/chat" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">💬 Chat</Link>
          <Link to="/dashboard" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">👤 Il mio Profilo</Link>
          
          <div className="mt-8 flex flex-col gap-3">
            {user ? (
              <button onClick={handleLogout} className="bg-neutral-900 text-white w-full py-3 rounded-2xl font-bold hover:bg-neutral-800 transition-colors cursor-pointer">Esci</button>
            ) : (
              <>
                <Link to="/accedi" className="border border-neutral-200 text-center py-3 rounded-2xl hover:bg-neutral-50 transition-colors" onClick={() => setIsMenuOpen(false)}>Accedi</Link>
                <Link to="/registrati" className="bg-neutral-900 text-white text-center py-3 rounded-2xl font-bold shadow-sm" onClick={() => setIsMenuOpen(false)}>Registrati</Link>
              </>
            )}
          </div>
        </div>
      </div>
      {isMenuOpen && <div className="fixed inset-0 bg-neutral-900/20 backdrop-blur-sm z-[999] md:hidden transition-opacity" onClick={() => setIsMenuOpen(false)}></div>}

      {/* --- HERO / FILTRI --- */}
      <div className="bg-white border-b border-neutral-100 px-6 py-12 flex justify-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-orange-400/10 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="w-full max-w-3xl relative z-10 text-center">
          
          <div className="flex gap-2 bg-neutral-100 p-1.5 rounded-2xl mb-8 max-w-md mx-auto shadow-inner">
            <button 
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${currentIntent === 'stanza' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`} 
              onClick={() => handleTopSearch('stanza', currentCity, currentBudget)}
            >
              🔍 Cerca Stanza
            </button>
            <button 
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${currentIntent === 'coinquilino' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`} 
              onClick={() => handleTopSearch('coinquilino', currentCity, '')}
            >
              👥 Cerca Coinquilini
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select 
              className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-base rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all font-medium cursor-pointer"
              value={currentCity} 
              onChange={(e) => handleTopSearch(currentIntent, e.target.value, currentBudget)}
            >
              <option value="">📍 Tutte le Città</option>
              <option value="Milano">Milano</option>
              <option value="Roma">Roma</option>
              <option value="Bologna">Bologna</option>
              <option value="Torino">Torino</option>
            </select>
            
            <input 
              type="number" 
              placeholder={currentIntent === 'stanza' ? "💶 Budget max (€/mese)" : "💶 Costo della tua stanza (€)"} 
              className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-base rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all font-medium placeholder:text-neutral-400"
              value={currentBudget}
              onChange={(e) => handleTopSearch(currentIntent, currentCity, e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* --- RISULTATI --- */}
      <div className="max-w-7xl mx-auto px-6 py-12 animate-fade-in-up">
        <main>
          <h1 className="font-serif text-3xl md:text-5xl text-neutral-900 mb-3 tracking-tight font-extrabold">
            {currentIntent === 'coinquilino' ? 'Coinquilini disponibili' : 'Stanze in affitto'}
          </h1>
          <p className="text-neutral-500 mb-10 font-medium text-lg">
            Trovati <span className="font-bold text-orange-500">{filteredResults.length}</span> risultati {currentCity && `a ${currentCity}`}
          </p>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="bg-white rounded-3xl shadow-sm border border-neutral-100 flex flex-col h-full min-h-[380px]">
                  <div className="h-48 w-full bg-neutral-100 animate-pulse rounded-t-3xl"></div>
                  <div className="p-6 flex flex-col gap-4 grow">
                    <div className="h-6 w-3/4 bg-neutral-100 animate-pulse rounded-md"></div>
                    <div className="h-4 w-1/2 bg-neutral-100 animate-pulse rounded-md"></div>
                    <div className="h-12 w-full bg-neutral-100 animate-pulse rounded-2xl mt-auto"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-neutral-200 p-16 text-center shadow-sm">
              <span className="text-6xl block mb-6 opacity-50">🏜️</span>
              <h3 className="font-serif text-2xl text-neutral-900 mb-3 font-extrabold">Nessun risultato trovato</h3>
              <p className="text-neutral-500 mb-8 font-medium">Non ci sono {currentIntent === 'coinquilino' ? 'profili in cerca' : 'stanze'} che corrispondono ai tuoi criteri.</p>
              <button 
                className="bg-white border border-neutral-200 hover:border-orange-300 text-neutral-900 px-8 py-3.5 rounded-full font-bold transition-all shadow-sm cursor-pointer"
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
                    <div key={item.id} className="w-full bg-white rounded-3xl shadow-sm border border-neutral-100 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-orange-100 cursor-pointer overflow-hidden group">
                      <div className="h-52 flex items-center justify-center relative overflow-hidden bg-neutral-100">
                        {item.coverUrl
                          ? <img src={item.coverUrl} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          : <span className="text-sm font-bold text-neutral-400">📷 Nessuna foto</span>}
                        <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-md px-4 py-1.5 rounded-2xl shadow-sm">
                          <span className="font-extrabold text-lg text-orange-500">€{item.price}</span><span className="text-[11px] text-neutral-500 font-bold">/mese</span>
                        </div>
                      </div>
                      <div className="p-6 flex flex-col grow bg-white relative z-10">
                        <h3 className="font-bold text-lg text-neutral-900 leading-tight mb-2 truncate" title={item.title}>{item.title}</h3>
                        <p className="text-sm text-neutral-500 mb-5 font-medium truncate">
                          📍 {item.zone ? `${item.zone}, ${item.city}` : item.city}
                        </p>
                        <div className="flex flex-wrap gap-2 mb-6">
                          {[item.roomType, formatBills(item.billsIncluded), formatAvailability(item.availableFrom)].filter(Boolean).map(t => <span key={t} className="bg-neutral-50 border border-neutral-100 text-neutral-600 px-2.5 py-1 rounded-lg text-[11px] font-bold">{t}</span>)}
                        </div>
                        <Link 
                            to={`/dettagli/${item.id}`} 
                            className="mt-auto block text-center bg-white border border-neutral-200 text-neutral-600 py-3 rounded-2xl font-bold transition-colors group-hover:bg-neutral-900 group-hover:border-neutral-900 group-hover:text-white"
                          >
                          Vedi dettagli
                        </Link>                      
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={item.id} className="w-full bg-white rounded-3xl shadow-sm border border-neutral-100 p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-orange-100 group relative overflow-hidden">
                      <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-400/10 rounded-full blur-2xl"></div>
                      
                      <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-sm relative z-10 transition-transform duration-500 group-hover:scale-110" style={{ background: `linear-gradient(135deg, ${item.color1 || '#fb923c'}, ${item.color2 || '#e11d48'})` }}>
                        <span className="drop-shadow-sm">{item.emoji || '👤'}</span>
                      </div>
                      <div className="text-center font-bold text-neutral-900 text-lg relative z-10 truncate">{item.name}</div>
                      <div className="text-center text-xs text-neutral-500 mb-4 font-bold uppercase tracking-wider relative z-10">{item.occupation || 'Occupazione non indicata'}</div>
                      
                      <div className="bg-neutral-50 p-4 rounded-2xl text-sm text-neutral-600 italic text-center mb-5 leading-relaxed relative z-10 border border-neutral-100 line-clamp-3">{item.bio ? `"${item.bio}"` : 'Nessuna presentazione'}</div>
                      
                      <div className="flex flex-wrap justify-center gap-1.5 mb-5 relative z-10">
                        {item.tags.slice(0, 4).map(t => <span key={t} className="bg-orange-50 text-orange-600 border border-orange-100 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">{t.trim()}</span>)}
                      </div>

                      {item.budgetMax > 0 && (
                        <div className="text-center text-sm font-extrabold text-orange-500 mb-5 relative z-10 bg-white border border-neutral-100 py-2 rounded-xl shadow-sm">
                           Budget max: €{item.budgetMax}
                        </div>
                      )}
                      
                      <div className="flex flex-col gap-2 relative z-10 mt-auto">
                        <Link 
                          to={`/coinquilino/${item.id}`} 
                          className="w-full block text-center bg-white border border-neutral-200 text-neutral-600 py-3 rounded-2xl font-bold transition-all hover:bg-neutral-50"
                        >
                          Profilo completo
                        </Link>
                        <button 
                          onClick={() => handleDirectContact(item.id)} 
                          className="w-full bg-neutral-900 text-white py-3 rounded-2xl font-bold transition-all hover:bg-neutral-800 shadow-md flex items-center justify-center gap-2 cursor-pointer"
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