import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [activeView, setActiveView] = useState('myListings'); 
  const [myListings, setMyListings] = useState([]);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('roomdate_user');
      if (!savedUser) {
        navigate('/accedi');
      } else {
        setUser(JSON.parse(savedUser));
      }
    } catch {
      navigate('/accedi');
    }
  }, [navigate]);

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
    if (user) {
      fetchMyListings();
    }
  }, [user]);

  const handleDeleteListing = async (id) => {
    if (window.confirm("Sei sicuro di voler eliminare questo annuncio? L'azione è irreversibile!")) {
      try {
        const res = await fetch(`/api/delete_listing?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          alert("✅ Annuncio eliminato con successo.");
          fetchMyListings();
        } else {
          alert("❌ Errore durante l'eliminazione.");
        }
      } catch (err) {
        alert("Errore di connessione.");
      }
    }
  };

  // --- IL SALVATAGGIO CHIAMA LA TUA API: /api/profile ---
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
      budgetMax: formData.get('budgetMax'), // Lo mandiamo come stringa per comodità
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
        
        // Aggiorniamo LocalStorage così vedi subito le modifiche
        const updatedUser = { 
          ...user, 
          user_type: payload.userType,
          citta: payload.citta,
          budget_max: payload.budgetMax ? parseInt(payload.budgetMax) : 0,
          occupation: payload.occupation,
          nascita: payload.birthdate,
          bio: payload.bio,
          lifestyle_tags: payload.tags
        };
        localStorage.setItem('roomdate_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        
        setActiveView('myListings');
      } else {
        const errorMsg = await res.text();
        alert("❌ Errore dal server: " + errorMsg);
      }
    } catch (err) {
      alert("Errore di connessione al server.");
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
        alert("🎉 Annuncio pubblicato! Ora è visibile sulla Home.");
        fetchMyListings(); 
        setActiveView('myListings');
      } else {
        const errorMsg = await res.text();
        alert("❌ Errore: " + errorMsg);
      }
    } catch (err) {
      alert("Errore di connessione al server.");
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

      <div className={`fixed inset-y-0 right-0 w-72 bg-[#2C1A0E] shadow-2xl z-[1000] p-8 pt-24 transform transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col gap-6 text-lg font-medium text-white">
          <div className="border-b border-neutral-700 pb-4 mb-2">
            <h3 className="text-xl">👤 Ciao, {user.nome || user.first_name}!</h3>
          </div>
          <Link to="/" onClick={() => setIsMenuOpen(false)}>🏠 Home</Link>
          <Link to="/ricerca" onClick={() => setIsMenuOpen(false)}>🔍 Cerca Stanza</Link>
          <Link to="/chat" onClick={() => setIsMenuOpen(false)}>💬 Chat</Link>
          <Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>👤 Il mio Profilo</Link>
          <Link to="/impostazioni" onClick={() => setIsMenuOpen(false)}>⚙️ Impostazioni</Link>
          
          <div className="mt-8 flex flex-col gap-3">
            <button onClick={handleLogout} className="bg-[#C4603A] w-full py-3 rounded-full font-bold">Esci</button>
          </div>
        </div>
      </div>
      {isMenuOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] md:hidden" onClick={() => setIsMenuOpen(false)}></div>}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        
        <div className="bg-[#2C1A0E] rounded-3xl p-8 md:p-12 text-center text-white relative shadow-lg">
          <div className="w-28 h-28 md:w-32 md:h-32 rounded-full mx-auto mb-6 flex justify-center items-center text-4xl md:text-5xl text-white border-4 border-[#1A0E07] shadow-xl bg-gradient-to-br from-[#F5C29A] to-[#C4603A]">
            {(user.nome || user.first_name || 'U').charAt(0).toUpperCase()}
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2">
            {user.nome || user.first_name} {user.cognome || user.last_name}
          </h1>
          <p className="text-[#D4835E] text-lg mb-6">
            @{(user.nome || user.first_name || 'user').toLowerCase()}{user.id?.toString().substring(0,4)}
          </p>
          <div className="inline-block bg-white/10 border border-white/20 px-6 py-2 rounded-full text-sm font-medium backdrop-blur-sm">
            🎓 Profilo Base
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-around bg-white p-6 rounded-2xl -mt-8 mx-4 md:mx-8 shadow-md relative z-10 border border-orange-50 gap-4 md:gap-0">
          <div className="text-center flex-1 md:border-r border-orange-50">
            <div className="text-3xl font-bold text-[#C4603A]">{myListings.length}</div>
            <div className="text-xs text-[#8A7B6E] tracking-wider font-bold mt-1">ANNUNCI PUBBLICATI</div>
          </div>
          <div className="text-center flex-1 md:border-r border-orange-50">
            <div className="text-3xl font-bold text-[#C4603A]">0</div>
            <div className="text-xs text-[#8A7B6E] tracking-wider font-bold mt-1">STANZE SALVATE</div>
          </div>
          <div className="text-center flex-1">
            <div className="text-3xl font-bold text-[#C4603A]">0</div>
            <div className="text-xs text-[#8A7B6E] tracking-wider font-bold mt-1">CHAT ATTIVE</div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mt-12 mb-8">
          <button 
            className={`px-6 py-3 rounded-full font-bold text-sm transition-all shadow-sm ${activeView === 'myListings' ? 'bg-[#C4603A] text-white shadow-md' : 'bg-orange-50 text-[#7A4B2A] hover:bg-white hover:shadow'}`}
            onClick={() => setActiveView('myListings')}
          >
            📄 I Miei Annunci
          </button>
          <button 
            className={`px-6 py-3 rounded-full font-bold text-sm transition-all shadow-sm ${activeView === 'editProfile' ? 'bg-[#C4603A] text-white shadow-md' : 'bg-orange-50 text-[#7A4B2A] hover:bg-white hover:shadow'}`}
            onClick={() => setActiveView('editProfile')}
          >
            ⚙️ Modifica Profilo
          </button>
          <button 
            className={`px-6 py-3 rounded-full font-bold text-sm transition-all shadow-sm ${activeView === 'createListing' ? 'bg-[#C4603A] text-white shadow-md' : 'bg-orange-50 text-[#7A4B2A] hover:bg-white hover:shadow'}`}
            onClick={() => setActiveView('createListing')}
          >
            ➕ Pubblica Annuncio
          </button>
        </div>

        <div className="animate-fade-in-up">
          
          {/* TAB: I MIEI ANNUNCI */}
          {activeView === 'myListings' && (
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-orange-50">
              <h2 className="font-serif text-2xl font-bold text-[#2C1A0E] mb-6">Annunci Attivi</h2>
              {myListings.length === 0 ? (
                <div className="text-center py-16 px-4 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200">
                  <div className="text-5xl mb-4">🛋️</div>
                  <p className="text-[#8A7B6E] font-medium mb-6">Non hai ancora nessun annuncio attivo.</p>
                  <button 
                    onClick={() => setActiveView('createListing')} 
                    className="bg-transparent border-2 border-[#C4603A] text-[#C4603A] px-6 py-2.5 rounded-full font-bold hover:bg-orange-50 transition-colors"
                  >
                    Crea il tuo primo annuncio
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {myListings.map(l => (
                    <div key={l.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-5 bg-[#FEFAF4] rounded-2xl border border-orange-100 gap-4 transition-all hover:shadow-md">
                      <div>
                        <div className="font-bold text-[#2C1A0E] text-lg mb-1">{l.title}</div>
                        <div className="text-sm text-[#8A7B6E] font-medium flex flex-wrap gap-x-3 gap-y-1">
                          <span>📍 {l.city}</span> 
                          <span className="hidden sm:inline">·</span>
                          <span>🏠 {l.roomType}</span>
                          <span className="hidden sm:inline">·</span>
                          <strong className="text-[#C4603A]">€{l.price}/mese</strong>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteListing(l.id)}
                        className="bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white px-5 py-2.5 rounded-xl font-bold transition-colors shrink-0"
                      >
                        Elimina
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: MODIFICA PROFILO */}
          {activeView === 'editProfile' && (
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-orange-50">
              <h2 className="font-serif text-2xl font-bold text-[#2C1A0E] mb-8">Informazioni Personali</h2>
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-neutral-100">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#2C1A0E]">Il tuo obiettivo</label>
                    <select name="userType" defaultValue={user.user_type || user.userType || 'cerca'} required className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3.5 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A]">
                      <option value="cerca">🔍 Cerco una stanza</option>
                      <option value="affitta">🏠 Offro una stanza</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#2C1A0E]">Budget Max / Prezzo Richiesto (€)</label>
                    <input name="budgetMax" type="number" defaultValue={user.budget_max || ''} placeholder="Es: 600" className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3.5 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A]" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#2C1A0E]">Occupazione</label>
                    <select name="occupation" defaultValue={user.occupation || ''} required className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3.5 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A]">
                      <option value="">Seleziona...</option>
                      <option value="Studente">Studente</option>
                      <option value="Lavoratore">Lavoratore</option>
                      <option value="Studente e Lavoratore">Studente e Lavoratore</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#2C1A0E]">Città di interesse</label>
                    <input name="citta" type="text" defaultValue={user.citta || ''} required className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3.5 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A]" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#2C1A0E]">Data di Nascita</label>
                    <input name="birthdate" type="date" defaultValue={user.nascita ? user.nascita.split('T')[0] : ''} required className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3.5 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A]" />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-[#2C1A0E]">Bio (Parlaci di te)</label>
                  <textarea name="bio" defaultValue={user.bio || ''} placeholder="Ciao! Mi chiamo..." rows="4" required className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A] resize-none"></textarea>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-sm font-bold text-[#2C1A0E]">Il tuo Stile di Vita</label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { label: '🚬 Fumatore', name: 'Fumatore' },
                      { label: '🚭 Non Fumatore', name: 'Non Fumatore' },
                      { label: '🐶 Ho animali', name: 'Ho animali' },
                      { label: '🧹 Ordinato/a', name: 'Ordinato/a' },
                      { label: '🎉 Socievole', name: 'Socievole' },
                      { label: '🥦 Vegano/Vegetariano', name: 'Vegano/Vegetariano' }
                    ].map(tag => {
                      const isChecked = user.lifestyle_tags && user.lifestyle_tags.includes(tag.name);
                      return (
                        <label key={tag.name} className="relative cursor-pointer group">
                          <input type="checkbox" data-tagname={tag.name} defaultChecked={isChecked} className="tag-checkbox peer sr-only" />
                          <span className="block px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-full text-sm font-medium text-[#8A7B6E] peer-checked:bg-[#C4603A] peer-checked:text-white peer-checked:border-[#C4603A] transition-all group-hover:shadow-sm">
                            {tag.label}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-neutral-100">
                  <button type="submit" className="w-full md:w-auto bg-[#C4603A] hover:bg-[#9A4628] text-white px-8 py-4 rounded-full font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5">
                    Salva Modifiche
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB: CREA ANNUNCIO */}
          {activeView === 'createListing' && (
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-orange-50">
              <h2 className="font-serif text-2xl font-bold text-[#2C1A0E] mb-8">Inserisci una Stanza</h2>
              <form onSubmit={handleSaveListing} className="flex flex-col gap-6">
                
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-[#2C1A0E]">Titolo Annuncio</label>
                  <input name="title" type="text" placeholder="Es: Ampia camera singola in centro..." required className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3.5 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A] transition-colors" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#2C1A0E]">Città</label>
                    <input name="city" type="text" placeholder="Es: Milano" required className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3.5 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A] transition-colors" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#2C1A0E]">Indirizzo o Zona</label>
                    <input name="zone" type="text" placeholder="Es: Navigli" required className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3.5 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A] transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#2C1A0E]">Tipo di Stanza</label>
                    <select name="roomType" required className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3.5 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A] transition-colors">
                      <option value="">Seleziona...</option>
                      <option value="singola">Camera Singola</option>
                      <option value="doppia">Posto in Doppia</option>
                      <option value="intera">Casa intera</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#2C1A0E]">Prezzo Mensile (€)</label>
                    <input name="price" type="number" placeholder="Es: 600" required className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3.5 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A] transition-colors" />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-[#2C1A0E]">Descrizione della casa e dei coinquilini</label>
                  <textarea name="description" placeholder="Descrivi l'ambiente, la casa e chi ci vive..." rows="5" required className="w-full bg-neutral-50 border border-neutral-200 text-[#2C1A0E] rounded-2xl px-4 py-3 focus:outline-none focus:border-[#C4603A] focus:ring-1 focus:ring-[#C4603A] transition-colors resize-none"></textarea>
                </div>

                <div className="mt-6 pt-6 border-t border-neutral-100">
                  <button type="submit" className="w-full md:w-auto bg-[#4CAF50] hover:bg-[#388E3C] text-white px-8 py-4 rounded-full font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5">
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