import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { fetchAPI } from '../utils/api'; 

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [activeView, setActiveView] = useState('editProfile');
  const [myListings, setMyListings] = useState([]);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('roomdate_user');
      if (!savedUser) {
        navigate('/accedi');
      } else {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        fetchFreshProfile();
      }
    } catch {
      navigate('/accedi');
    }
  }, [navigate]);

  const fetchFreshProfile = async () => {
    try {
      const res = await fetchAPI(`/api/profile`);
      if (res.ok) {
        const freshData = await res.json();
        setUser(prev => ({ ...prev, ...freshData })); 
        localStorage.setItem('roomdate_user', JSON.stringify(freshData)); 
      }
    } catch (err) {
      console.error("Errore fetch profilo:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('roomdate_user');
    sessionStorage.clear();
    setIsMenuOpen(false);
    navigate('/');
  };

  const fetchMyListings = async () => {
    if (!user) return;
    try {
      const res = await fetchAPI(`/api/get_my_listings`);
      if (res.ok) {
        const data = await res.json();
        if (data) setMyListings(data);
      }
    } catch (err) {
      console.error("Errore caricamento annunci", err);
    }
  };

  useEffect(() => {
    if (user?.id) fetchMyListings();
  }, [user?.id]);

  const handleDeleteListing = async (id) => {
    if (window.confirm("Sei sicuro di voler eliminare questo annuncio?")) {
      try {
        const res = await fetchAPI(`/api/delete_listing?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          alert("✅ Annuncio eliminato.");
          fetchMyListings();
        }
      } catch (err) {
        alert("Errore di connessione.");
      }
    }
  };

  const handleToggleTag = (tagText) => {
    const rawTag = tagText.split(' ')[1] || tagText;
    const currentTagsStr = user.lifestyle_tags || user.tags || '';
    let currentTags = currentTagsStr ? currentTagsStr.split(', ') : [];

    if (currentTags.includes(rawTag)) {
      currentTags = currentTags.filter(t => t !== rawTag);
    } else {
      currentTags.push(rawTag);
    }
    
    const updatedTagsStr = currentTags.join(', ');
    setUser({ ...user, lifestyle_tags: updatedTagsStr, tags: updatedTagsStr });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const tags = user.lifestyle_tags || user.tags || '';

    const payload = {
      userType: formData.get('userType'),
      citta: formData.get('citta'),
      budgetMax: parseInt(formData.get('budgetMax'), 10) || 0,
      occupation: formData.get('occupation'),
      birthdate: formData.get('birthdate'),
      bio: formData.get('bio'),
      tags: tags,
      isPublic: formData.get('isPublic') === 'on' 
    };

    try {
      const res = await fetchAPI('/api/profile', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("✅ Profilo aggiornato con successo!");
        fetchFreshProfile(); 
        setActiveView('myListings');
      } else {
        const errorMsg = await res.text();
        alert("❌ Errore dal server: " + errorMsg);
      }
    } catch (err) {
      alert("Errore di connessione.");
    }
  };

  const handleSaveListing = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      title: formData.get('title'),
      city: formData.get('city'),
      zone: formData.get('zone'),
      roomType: formData.get('roomType'),
      price: parseInt(formData.get('price'), 10) || 0,
      description: formData.get('description')
    };

    try {
      const res = await fetchAPI('/api/create_listing', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (res.ok) {
        alert("🎉 Annuncio pubblicato!");
        fetchMyListings(); 
        setActiveView('myListings');
      }
    } catch (err) {
      alert("Errore.");
    }
  };

  if (!user) return null;

  // Helper per ripulire la data ISO proveniente da Go
  const getBirthdateValue = () => {
    const dateStr = user.nascita || user.birthdate || '';
    if (!dateStr) return '';
    return dateStr.split('T')[0];
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-20 md:pb-12 font-sans selection:bg-orange-200">
      <Helmet>
        <title>Area Privata | RoomDate</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* --- TOP NAV --- */}
      <nav className="shrink-0 z-50 bg-white/80 backdrop-blur-md px-6 py-4 flex justify-between items-center shadow-sm border-b border-neutral-100 sticky top-0">
        <Link to="/" className="font-serif text-2xl font-bold tracking-tight text-neutral-900 decoration-none">
          Room<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">Date</span>
        </Link>
        <div className="hidden md:flex gap-8 items-center text-sm font-medium text-neutral-500">
          <Link to="/" className="hover:text-neutral-900 transition-colors">Home</Link>
          <Link to="/ricerca" className="hover:text-neutral-900 transition-colors">Cerca Stanza</Link>
          <Link to="/chat" className="hover:text-neutral-900 transition-colors">Chat</Link>
          <Link to="/dashboard" className="text-orange-500 font-bold transition-colors">Profilo</Link>
          <Link to="/impostazioni" className="hover:text-neutral-900 transition-colors">Impostazioni</Link>
        </div>
        <div className="hidden md:flex gap-4 items-center">
          <span className="text-sm text-neutral-500">Ciao, <strong className="text-neutral-900">{user.nome || user.first_name}</strong>!</span>
          <button onClick={handleLogout} className="border border-neutral-200 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer">Esci</button>
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
          <Link to="/" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">🏠 Home</Link>
          <Link to="/ricerca" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">🔍 Cerca Stanza</Link>
          <Link to="/chat" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">💬 Chat</Link>
          <Link to="/dashboard" onClick={() => setIsMenuOpen(false)} className="text-orange-500 font-bold">👤 Il mio Profilo</Link>
          <button onClick={handleLogout} className="bg-neutral-900 text-white w-full py-3 rounded-2xl font-bold mt-4 hover:bg-neutral-800 transition-colors cursor-pointer">Esci</button>
        </div>
      </div>
      {isMenuOpen && <div className="fixed inset-0 bg-neutral-900/20 backdrop-blur-sm z-[999] md:hidden transition-opacity" onClick={() => setIsMenuOpen(false)}></div>}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        
        {/* HEADER PROFILO */}
        <div className="bg-white rounded-3xl p-8 md:p-12 text-center relative shadow-sm border border-neutral-100 mb-8 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-orange-400/10 blur-[80px] rounded-full pointer-events-none"></div>
          
          <div className="relative z-10 w-28 h-28 rounded-full mx-auto mb-6 flex justify-center items-center text-5xl border-4 border-white shadow-lg bg-gradient-to-br from-orange-400 to-rose-500 text-white font-bold">
            {(user.nome || user.first_name || 'U').charAt(0).toUpperCase()}
          </div>
          <h1 className="font-serif text-3xl font-extrabold mb-2 text-neutral-900 tracking-tight">
            {user.nome || user.first_name} {user.cognome || user.last_name}
          </h1>
          <p className="text-neutral-500 text-lg font-medium">
            @{(user.nome || user.first_name || 'user').toLowerCase()}{user.id?.toString().substring(0,4)}
          </p>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-4 md:gap-6 mb-10">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100 text-center flex flex-col justify-center transition-transform hover:scale-[1.02]">
            <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">{myListings.length}</div>
            <div className="text-[11px] md:text-xs text-neutral-500 font-bold mt-2 uppercase tracking-wider">Annunci</div>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100 text-center flex flex-col justify-center transition-transform hover:scale-[1.02]">
            <div className="text-4xl font-extrabold text-neutral-300">0</div>
            <div className="text-[11px] md:text-xs text-neutral-500 font-bold mt-2 uppercase tracking-wider">Salvati</div>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100 text-center flex flex-col justify-center transition-transform hover:scale-[1.02]">
            <div className="text-4xl font-extrabold text-neutral-300">0</div>
            <div className="text-[11px] md:text-xs text-neutral-500 font-bold mt-2 uppercase tracking-wider">Chat</div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          <button className={`px-6 py-3 rounded-full font-bold text-sm transition-all cursor-pointer ${activeView === 'myListings' ? 'bg-neutral-900 text-white shadow-md' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`} onClick={() => setActiveView('myListings')}>
            📄 I Miei Annunci
          </button>
          <button className={`px-6 py-3 rounded-full font-bold text-sm transition-all cursor-pointer ${activeView === 'editProfile' ? 'bg-neutral-900 text-white shadow-md' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`} onClick={() => setActiveView('editProfile')}>
            ⚙️ Modifica Profilo
          </button>
          <button className={`px-6 py-3 rounded-full font-bold text-sm transition-all cursor-pointer ${activeView === 'createListing' ? 'bg-neutral-900 text-white shadow-md' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`} onClick={() => setActiveView('createListing')}>
            ➕ Pubblica Annuncio
          </button>
        </div>

        <div className="animate-fade-in-up">
          
          {/* TAB 1: I MIEI ANNUNCI */}
          {activeView === 'myListings' && (
            <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-neutral-100">
              <h2 className="text-2xl font-extrabold text-neutral-900 mb-6 tracking-tight">Annunci Attivi</h2>
              {myListings.length === 0 ? (
                <div className="text-center py-16 px-4 bg-neutral-50 rounded-3xl border border-dashed border-neutral-200">
                  <div className="text-5xl mb-4 opacity-50">📭</div>
                  <p className="text-neutral-500 font-medium mb-6">Non hai ancora nessun annuncio attivo.</p>
                  <button onClick={() => setActiveView('createListing')} className="bg-white border border-neutral-200 hover:border-orange-300 text-neutral-900 px-6 py-3 rounded-full font-bold shadow-sm transition-all cursor-pointer">Crea il primo</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myListings.map(l => (
                    <div key={l.id} className="flex flex-col justify-between p-6 bg-white rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="mb-4">
                        <div className="font-bold text-neutral-900 text-lg mb-1">{l.title}</div>
                        <div className="text-sm text-neutral-500 font-medium">📍 {l.city} · 🏠 {l.roomType}</div>
                        <div className="text-lg font-extrabold text-orange-500 mt-2">€{l.price}/mese</div>
                      </div>
                      <button onClick={() => handleDeleteListing(l.id)} className="bg-red-50 text-red-600 hover:bg-red-100 font-bold px-4 py-2.5 rounded-xl w-max transition-colors text-sm cursor-pointer">Elimina Annuncio</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MODIFICA PROFILO */}
          {activeView === 'editProfile' && (
            <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-neutral-100">
              <h2 className="text-2xl font-extrabold text-neutral-900 mb-8 tracking-tight">Informazioni Personali</h2>
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8 border-b border-neutral-100">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-neutral-900">Il tuo obiettivo</label>
                    <select 
                      name="userType" 
                      value={user.user_type || user.userType || 'cerca'} 
                      onChange={e => setUser({...user, user_type: e.target.value, userType: e.target.value})} 
                      className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3.5 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all"
                    >
                      <option value="cerca">🔍 Cerco una stanza</option>
                      <option value="affitta">🏠 Offro una stanza</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-neutral-900">Budget Max / Prezzo (€)</label>
                    <input 
                      name="budgetMax" 
                      type="number" 
                      value={user.budget_max || user.budgetMax || ''} 
                      onChange={e => setUser({...user, budget_max: e.target.value, budgetMax: e.target.value})}
                      className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3.5 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-neutral-900">Occupazione</label>
                    <select 
                      name="occupation" 
                      value={user.occupation || ''} 
                      onChange={e => setUser({...user, occupation: e.target.value})} 
                      className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3.5 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all"
                    >
                      <option value="">Seleziona...</option>
                      <option value="studente">Studente</option>
                      <option value="lavoratore">Lavoratore</option>
                      <option value="misto">Studente/Lavoratore</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-neutral-900">Città di interesse</label>
                    <input 
                      name="citta" 
                      type="text" 
                      value={user.citta || user.city || ''} 
                      onChange={e => setUser({...user, citta: e.target.value})}
                      className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3.5 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all" 
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-neutral-900">Data di Nascita</label>
                    <input 
                      name="birthdate" 
                      type="date" 
                      value={getBirthdateValue()} 
                      onChange={e => setUser({...user, nascita: e.target.value, birthdate: e.target.value})}
                      className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3.5 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all" 
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-sm font-bold text-neutral-900">Bio</label>
                  <textarea 
                    name="bio" 
                    value={user.bio || ''} 
                    onChange={e => setUser({...user, bio: e.target.value})}
                    rows="4" 
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-3xl px-5 py-4 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all resize-none"
                    placeholder="Racconta qualcosa di te..."
                  ></textarea>
                </div>

                <div className="flex flex-col gap-4 mt-4">
                  <label className="text-sm font-bold text-neutral-900">Stile di Vita (Tags)</label>
                  <div className="flex flex-wrap gap-3">
                    {['🚬 Fumatore', '🚭 Non Fumatore', '🐶 Ho animali', '🧹 Ordinato/a', '🎉 Socievole', '🥦 Vegano/Vegetariano'].map(tag => {
                      const tagValue = tag.split(' ')[1] || tag;
                      const isChecked = (user.lifestyle_tags || user.tags || '').includes(tagValue);
                      
                      return (
                        <label key={tag} className="relative cursor-pointer group">
                          <input 
                            type="checkbox" 
                            name="tags_visual"
                            checked={isChecked} 
                            onChange={() => handleToggleTag(tag)}
                            className="peer sr-only" 
                          />
                          <span className="block px-5 py-2.5 bg-white border border-neutral-200 rounded-full text-sm font-semibold text-neutral-500 peer-checked:bg-neutral-900 peer-checked:text-white peer-checked:border-neutral-900 transition-all shadow-sm group-hover:border-neutral-300">
                            {tag}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-6 pt-8 border-t border-neutral-100">
                  <label className="text-sm font-bold text-neutral-900">Privacy e Visibilità</label>
                  <label className="flex items-start gap-3 cursor-pointer group bg-neutral-50 p-4 rounded-2xl border border-neutral-200 transition-colors hover:border-orange-200">
                    <input 
                      type="checkbox" 
                      name="isPublic" 
                      checked={user.is_public !== false && user.isPublic !== false} 
                      onChange={e => setUser({...user, is_public: e.target.checked, isPublic: e.target.checked})}
                      className="mt-0.5 w-5 h-5 text-orange-500 bg-white border-neutral-300 rounded focus:ring-orange-500 accent-orange-500 cursor-pointer" 
                    />
                    <span className="text-sm text-neutral-600 leading-relaxed font-medium">
                      Rendi il mio profilo pubblico. Acconsento alla visibilità sulla piattaforma e all'indicizzazione sui motori di ricerca ai fini del matching.
                    </span>
                  </label>
                </div>

                <div className="mt-8 pt-8 border-t border-neutral-100 flex justify-end">
                  <button type="submit" className="w-full md:w-auto bg-gradient-to-r from-orange-500 to-rose-500 hover:scale-[1.02] text-white px-10 py-4 rounded-full font-bold shadow-lg hover:shadow-orange-500/25 transition-all cursor-pointer">
                    Salva Modifiche
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: CREA ANNUNCIO */}
          {activeView === 'createListing' && (
            <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-neutral-100">
              <h2 className="text-2xl font-extrabold text-neutral-900 mb-8 tracking-tight">Inserisci una Stanza</h2>
              <form onSubmit={handleSaveListing} className="flex flex-col gap-6">
                <input 
                  name="title" 
                  type="text" 
                  placeholder="Titolo (Es: Camera Singola Navigli)" 
                  required 
                  className="w-full bg-neutral-50 border border-neutral-200 px-5 py-4 rounded-2xl text-neutral-900 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all" 
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <input 
                    name="city" 
                    type="text" 
                    placeholder="Città" 
                    required 
                    className="w-full bg-neutral-50 border border-neutral-200 px-5 py-4 rounded-2xl text-neutral-900 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all" 
                  />
                  <input 
                    name="zone" 
                    type="text" 
                    placeholder="Zona" 
                    required 
                    className="w-full bg-neutral-50 border border-neutral-200 px-5 py-4 rounded-2xl text-neutral-900 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all" 
                  />
                  <select 
                    name="roomType" 
                    required 
                    className="w-full bg-neutral-50 border border-neutral-200 px-5 py-4 rounded-2xl text-neutral-900 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all"
                  >
                    <option value="singola">Singola</option>
                    <option value="doppia">Doppia</option>
                  </select>
                  <input 
                    name="price" 
                    type="number" 
                    placeholder="Prezzo (€)" 
                    required 
                    className="w-full bg-neutral-50 border border-neutral-200 px-5 py-4 rounded-2xl text-neutral-900 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all" 
                  />
                </div>
                <textarea 
                  name="description" 
                  placeholder="Descrizione dettagliata..." 
                  rows="5" 
                  required 
                  className="w-full bg-neutral-50 border border-neutral-200 px-5 py-4 rounded-3xl text-neutral-900 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all resize-none"
                ></textarea>
                
                <div className="mt-4 pt-8 border-t border-neutral-100 flex justify-end">
                  <button type="submit" className="w-full md:w-auto bg-neutral-900 text-white px-10 py-4 rounded-full font-bold hover:bg-neutral-800 transition-all shadow-md cursor-pointer">
                    Pubblica Annuncio
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}