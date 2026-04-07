import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [activeView, setActiveView] = useState('editProfile'); // Apriamo subito il profilo per comodità
  const [myListings, setMyListings] = useState([]);

  // 1. CARICAMENTO BASE DA LOCALSTORAGE
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('roomdate_user');
      if (!savedUser) {
        navigate('/accedi');
      } else {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        // SCARICA DATI FRESCHI DAL DB
        fetchFreshProfile(parsedUser.id);
      }
    } catch {
      navigate('/accedi');
    }
  }, [navigate]);

  // 2. FUNZIONE PER SINCRONIZZARE REACT CON IL DATABASE
  const fetchFreshProfile = async (userId) => {
    try {
      const res = await fetch(`/api/profile?userId=${userId}`);
      if (res.ok) {
        const freshData = await res.json();
        setUser(prev => ({ ...prev, ...freshData })); // Aggiorna i campi a schermo
        localStorage.setItem('roomdate_user', JSON.stringify(freshData)); // Ripara la memoria vecchia!
      }
    } catch (err) {
      console.error("Errore fetch profilo:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('roomdate_user');
    setIsMenuOpen(false);
    navigate('/');
  };

  const fetchMyListings = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/get_my_listings?userId=${user.id}`);
      const data = await res.json();
      if (data) setMyListings(data);
    } catch (err) {
      console.error("Errore caricamento annunci", err);
    }
  };

  useEffect(() => {
    if (user) fetchMyListings();
  }, [user?.id]);

  const handleDeleteListing = async (id) => {
    if (window.confirm("Sei sicuro di voler eliminare questo annuncio?")) {
      try {
        const res = await fetch(`/api/delete_listing?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          alert("✅ Annuncio eliminato.");
          fetchMyListings();
        }
      } catch (err) {
        alert("Errore di connessione.");
      }
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const tags = Array.from(e.target.querySelectorAll('.tag-checkbox:checked'))
      .map(cb => cb.dataset.tagname)
      .join(', ');

    const payload = {
      userId: user.id.toString(),
      userType: formData.get('userType'),
      citta: formData.get('citta'),
      budgetMax: formData.get('budgetMax'),
      occupation: formData.get('occupation'),
      birthdate: formData.get('birthdate'),
      bio: formData.get('bio'),
      tags: tags
    };

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("✅ Profilo aggiornato con successo!");
        fetchFreshProfile(user.id); // Ricarica istantaneamente dal DB
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
      userId: user.id,
      title: formData.get('title'),
      city: formData.get('city'),
      zone: formData.get('zone'),
      roomType: formData.get('roomType'),
      price: formData.get('price'),
      description: formData.get('description')
    };

    try {
      const res = await fetch('/api/create_listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="min-h-screen bg-[#FEFAF4] pb-20 md:pb-0 font-sans">
      
      <nav className="sticky top-0 z-50 bg-[#2C1A0E] text-white px-6 py-4 flex justify-between items-center shadow-md border-b-2 border-[#C4603A]">
        <Link to="/" className="font-serif text-2xl font-bold tracking-tight text-white decoration-none">
          Room<span className="text-[#D4835E]">Date</span>
        </Link>
        <div className="hidden md:flex gap-8 items-center text-sm font-medium text-neutral-300">
          <Link to="/" className="hover:text-[#D4835E] transition-colors">Home</Link>
          <Link to="/ricerca" className="hover:text-[#D4835E] transition-colors">Cerca Stanza</Link>
          <Link to="/chat" className="hover:text-[#D4835E] transition-colors">Chat</Link>
          <Link to="/dashboard" className="text-[#D4835E] transition-colors">Profilo</Link>
          <Link to="/impostazioni" className="hover:text-[#D4835E] transition-colors">Impostazioni</Link>
        </div>
        <div className="hidden md:flex gap-4 items-center">
          <span className="text-sm text-neutral-300">Ciao, <strong className="text-white">{user.nome || user.first_name}</strong>!</span>
          <button onClick={handleLogout} className="border border-neutral-500 hover:border-[#D4835E] hover:text-[#D4835E] px-4 py-2 rounded-full text-sm transition-colors">Esci</button>
        </div>
        <button className="md:hidden flex flex-col gap-1.5 z-[1001]" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <div className={`w-7 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
          <div className={`w-7 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></div>
          <div className={`w-7 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
        </button>
      </nav>

      {/* MOBILE MENU */}
      <div className={`fixed inset-y-0 right-0 w-72 bg-[#2C1A0E] shadow-2xl z-[1000] p-8 pt-24 transform transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col gap-6 text-lg font-medium text-white">
          <Link to="/" onClick={() => setIsMenuOpen(false)}>🏠 Home</Link>
          <Link to="/ricerca" onClick={() => setIsMenuOpen(false)}>🔍 Cerca</Link>
          <button onClick={handleLogout} className="bg-[#C4603A] w-full py-3 rounded-full font-bold mt-4">Esci</button>
        </div>
      </div>
      {isMenuOpen && <div className="fixed inset-0 bg-black/60 z-[999] md:hidden" onClick={() => setIsMenuOpen(false)}></div>}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        
        {/* HEADER PROFILO */}
        <div className="bg-[#2C1A0E] rounded-3xl p-8 md:p-12 text-center text-white relative shadow-lg">
          <div className="w-28 h-28 rounded-full mx-auto mb-6 flex justify-center items-center text-5xl border-4 border-[#1A0E07] shadow-xl bg-gradient-to-br from-[#F5C29A] to-[#C4603A]">
            {(user.nome || user.first_name || 'U').charAt(0).toUpperCase()}
          </div>
          <h1 className="font-serif text-3xl font-bold mb-2">
            {user.nome || user.first_name} {user.cognome || user.last_name}
          </h1>
          <p className="text-[#D4835E] text-lg mb-6">
            @{(user.nome || user.first_name || 'user').toLowerCase()}{user.id?.toString().substring(0,4)}
          </p>
        </div>

        {/* STATS */}
        <div className="flex flex-col md:flex-row justify-around bg-white p-6 rounded-2xl -mt-8 mx-4 md:mx-8 shadow-md relative z-10 border border-orange-50 gap-4 md:gap-0">
          <div className="text-center flex-1 md:border-r border-orange-50">
            <div className="text-3xl font-bold text-[#C4603A]">{myListings.length}</div>
            <div className="text-xs text-[#8A7B6E] font-bold mt-1">ANNUNCI PUBBLICATI</div>
          </div>
          <div className="text-center flex-1 md:border-r border-orange-50">
            <div className="text-3xl font-bold text-[#C4603A]">0</div>
            <div className="text-xs text-[#8A7B6E] font-bold mt-1">STANZE SALVATE</div>
          </div>
          <div className="text-center flex-1">
            <div className="text-3xl font-bold text-[#C4603A]">0</div>
            <div className="text-xs text-[#8A7B6E] font-bold mt-1">CHAT ATTIVE</div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex flex-wrap justify-center gap-3 mt-12 mb-8">
          <button className={`px-6 py-3 rounded-full font-bold text-sm shadow-sm ${activeView === 'myListings' ? 'bg-[#C4603A] text-white' : 'bg-orange-50 text-[#7A4B2A]'}`} onClick={() => setActiveView('myListings')}>
            📄 I Miei Annunci
          </button>
          <button className={`px-6 py-3 rounded-full font-bold text-sm shadow-sm ${activeView === 'editProfile' ? 'bg-[#C4603A] text-white' : 'bg-orange-50 text-[#7A4B2A]'}`} onClick={() => setActiveView('editProfile')}>
            ⚙️ Modifica Profilo
          </button>
          <button className={`px-6 py-3 rounded-full font-bold text-sm shadow-sm ${activeView === 'createListing' ? 'bg-[#C4603A] text-white' : 'bg-orange-50 text-[#7A4B2A]'}`} onClick={() => setActiveView('createListing')}>
            ➕ Pubblica Annuncio
          </button>
        </div>

        <div className="animate-fade-in-up">
          
          {/* TAB 1: I MIEI ANNUNCI */}
          {activeView === 'myListings' && (
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-orange-50">
              <h2 className="font-serif text-2xl font-bold text-[#2C1A0E] mb-6">Annunci Attivi</h2>
              {myListings.length === 0 ? (
                <div className="text-center py-16 px-4 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200">
                  <p className="text-[#8A7B6E] font-medium mb-6">Non hai ancora nessun annuncio attivo.</p>
                  <button onClick={() => setActiveView('createListing')} className="bg-transparent border-2 border-[#C4603A] text-[#C4603A] px-6 py-2.5 rounded-full font-bold">Crea il primo</button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {myListings.map(l => (
                    <div key={l.id} className="flex justify-between p-5 bg-[#FEFAF4] rounded-2xl border border-orange-100">
                      <div>
                        <div className="font-bold text-[#2C1A0E] text-lg">{l.title}</div>
                        <div className="text-sm text-[#8A7B6E]">📍 {l.city} · 🏠 {l.roomType} · €{l.price}/mese</div>
                      </div>
                      <button onClick={() => handleDeleteListing(l.id)} className="text-red-600 font-bold px-4">Elimina</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MODIFICA PROFILO */}
          {activeView === 'editProfile' && (
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-orange-50">
              <h2 className="font-serif text-2xl font-bold text-[#2C1A0E] mb-8">Informazioni Personali</h2>
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-neutral-100">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#2C1A0E]">Il tuo obiettivo</label>
                    <select name="userType" value={user.user_type || user.userType || 'cerca'} onChange={e => setUser({...user, user_type: e.target.value})} className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3.5 focus:border-[#C4603A] focus:outline-none">
                      <option value="cerca">🔍 Cerco una stanza</option>
                      <option value="affitta">🏠 Offro una stanza</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#2C1A0E]">Budget Max / Prezzo (€)</label>
                    <input name="budgetMax" type="number" defaultValue={user.budget_max || ''} className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3.5 focus:border-[#C4603A] focus:outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#2C1A0E]">Occupazione</label>
                    <select name="occupation" value={user.occupation || ''} onChange={e => setUser({...user, occupation: e.target.value})} className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3.5 focus:border-[#C4603A] focus:outline-none">
                      <option value="">Seleziona...</option>
                      <option value="studente">Studente</option>
                      <option value="lavoratore">Lavoratore</option>
                      <option value="misto">Studente/Lavoratore</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#2C1A0E]">Città di interesse</label>
                    <input name="citta" type="text" defaultValue={user.citta || ''} className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3.5 focus:border-[#C4603A] focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#2C1A0E]">Data di Nascita</label>
                    <input name="birthdate" type="date" defaultValue={user.nascita ? user.nascita.split('T')[0] : ''} className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3.5 focus:border-[#C4603A] focus:outline-none" />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-[#2C1A0E]">Bio</label>
                  <textarea name="bio" defaultValue={user.bio || ''} rows="4" className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3 focus:border-[#C4603A] focus:outline-none resize-none"></textarea>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-sm font-bold text-[#2C1A0E]">Stile di Vita</label>
                  <div className="flex flex-wrap gap-3">
                    {['🚬 Fumatore', '🚭 Non Fumatore', '🐶 Ho animali', '🧹 Ordinato/a', '🎉 Socievole', '🥦 Vegano/Vegetariano'].map(tag => {
                      const isChecked = user.lifestyle_tags && user.lifestyle_tags.includes(tag.split(' ')[1] || tag);
                      return (
                        <label key={tag} className="relative cursor-pointer group">
                          <input type="checkbox" data-tagname={tag} defaultChecked={isChecked} className="tag-checkbox peer sr-only" />
                          <span className="block px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-full text-sm font-medium text-[#8A7B6E] peer-checked:bg-[#C4603A] peer-checked:text-white transition-all">
                            {tag}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-neutral-100">
                  <button type="submit" className="w-full md:w-auto bg-[#C4603A] hover:bg-[#9A4628] text-white px-8 py-4 rounded-full font-bold shadow-md hover:-translate-y-0.5">
                    Salva Modifiche
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: CREA ANNUNCIO */}
          {activeView === 'createListing' && (
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-orange-50">
              <h2 className="font-serif text-2xl font-bold text-[#2C1A0E] mb-8">Inserisci una Stanza</h2>
              <form onSubmit={handleSaveListing} className="flex flex-col gap-6">
                <input name="title" type="text" placeholder="Titolo (Es: Camera Singola Navigli)" required className="w-full bg-neutral-50 border border-neutral-200 p-4 rounded-2xl" />
                <div className="grid grid-cols-2 gap-6">
                  <input name="city" type="text" placeholder="Città" required className="w-full bg-neutral-50 border border-neutral-200 p-4 rounded-2xl" />
                  <input name="zone" type="text" placeholder="Zona" required className="w-full bg-neutral-50 border border-neutral-200 p-4 rounded-2xl" />
                  <select name="roomType" required className="w-full bg-neutral-50 border border-neutral-200 p-4 rounded-2xl">
                    <option value="singola">Singola</option><option value="doppia">Doppia</option>
                  </select>
                  <input name="price" type="number" placeholder="Prezzo (€)" required className="w-full bg-neutral-50 border border-neutral-200 p-4 rounded-2xl" />
                </div>
                <textarea name="description" placeholder="Descrizione..." rows="4" required className="w-full bg-neutral-50 border border-neutral-200 p-4 rounded-2xl resize-none"></textarea>
                <button type="submit" className="bg-[#4CAF50] text-white px-8 py-4 rounded-full font-bold w-max">Pubblica</button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}