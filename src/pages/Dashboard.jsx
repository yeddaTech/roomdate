import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../auth/AuthContext';
import {
  useConversations,
  useCreateListing,
  useDeleteListing,
  useListing,
  useMyListings,
  useMyProfile,
  useSetListingActive,
  useUpdateListing,
  useUpdateMyProfile,
} from '../api/hooks';
import { formatAvailability, formatBills } from '../api/listings';
import PageLoader from '../components/PageLoader';
import ListingForm from '../components/listings/ListingForm';
import ListingPhotos from '../components/listings/ListingPhotos';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Da "Modifica annuncio" nella pagina di dettaglio si arriva direttamente alla modifica
  const [editingId, setEditingId] = useState(location.state?.editListingId ?? null);
  const [activeView, setActiveView] = useState(editingId ? 'editListing' : 'editProfile');
  const [notice, setNotice] = useState('');

  // Profilo salvato sul server e sua copia modificabile nel form
  const profileQuery = useMyProfile();
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (profileQuery.data) setForm(profileQuery.data);
  }, [profileQuery.data]);

  // Solo chi affitta pubblica annunci (conta il ruolo salvato, non quello in modifica).
  // Chi ne ha già pubblicati può sempre gestirli, anche dopo aver cambiato ruolo.
  const isLandlord = profileQuery.data?.userType === 'affitta';
  const { data: myListings = [] } = useMyListings();
  const canManageListings = isLandlord || myListings.length > 0;

  let view = activeView;
  if ((view === 'myListings' || view === 'editListing') && !canManageListings) view = 'editProfile';
  if (view === 'createListing' && !isLandlord) view = 'editProfile';

  const editing = useListing(editingId ?? 0, { enabled: editingId !== null });
  const { data: conversations } = useConversations();
  const updateProfile = useUpdateMyProfile();
  const createListing = useCreateListing();
  const updateListing = useUpdateListing();
  const setListingActive = useSetListingActive();
  const deleteListing = useDeleteListing();

  const showView = (nextView, listingId = null) => {
    setNotice('');
    setEditingId(listingId);
    setActiveView(nextView);
  };

  const handleLogout = async () => {
    setIsMenuOpen(false);
    navigate('/');
    await logout();
  };

  const handleDeleteListing = async (id) => {
    if (window.confirm("Eliminare definitivamente questo annuncio e le sue foto? Le conversazioni con chi ti ha scritto resteranno.")) {
      try {
        await deleteListing.mutateAsync(id);
        showView('myListings');
      } catch (err) {
        alert("❌ " + err.message);
      }
    }
  };

  const handleToggleActive = async (listing) => {
    try {
      await setListingActive.mutateAsync({ id: listing.id, active: !listing.isActive });
    } catch (err) {
      alert("❌ " + err.message);
    }
  };

  const handleToggleTag = (tagText) => {
    const rawTag = tagText.split(' ')[1] || tagText;
    let currentTags = form.lifestyleTags ? form.lifestyleTags.split(', ') : [];

    if (currentTags.includes(rawTag)) {
      currentTags = currentTags.filter(t => t !== rawTag);
    } else {
      currentTags.push(rawTag);
    }

    setForm({ ...form, lifestyleTags: currentTags.join(', ') });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await updateProfile.mutateAsync({
        userType: form.userType,
        city: form.city,
        // 🔴 FIX: Costringiamo a 0 il budget se è un host (Offro una stanza), altrimenti prendiamo il valore
        budgetMax: form.userType === 'cerca' ? (parseInt(form.budgetMax, 10) || 0) : 0,
        occupation: form.occupation,
        birthdate: form.birthdate,
        bio: form.bio,
        lifestyleTags: form.lifestyleTags,
        isPublic: form.isPublic
      });
      alert("✅ Profilo aggiornato con successo!");
    } catch (err) {
      alert("❌ Errore dal server: " + err.message);
    }
  };

  const handleCreateListing = async (input) => {
    const listing = await createListing.mutateAsync(input);
    showView('editListing', listing.id);
    setNotice('🎉 Annuncio pubblicato! Ora puoi aggiungere le foto.');
  };

  const handleUpdateListing = async (input) => {
    await updateListing.mutateAsync({ id: editingId, input });
    setNotice('✅ Annuncio aggiornato.');
  };

  if (!form) {
    return profileQuery.isError
      ? <div className="flex min-h-screen items-center justify-center p-6 text-center font-sans text-neutral-600">{profileQuery.error.message}</div>
      : <PageLoader />;
  }

  // 🔴 Variabile per capire se dobbiamo mostrare o no il budget dinamicamente
  const isCerca = form.userType === 'cerca';

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] pb-20 md:pb-12 font-sans selection:bg-orange-200">
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
          <span className="text-sm text-neutral-500">Ciao, <strong className="text-neutral-900">{form.firstName}</strong>!</span>
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
            {(form.firstName || 'U').charAt(0).toUpperCase()}
          </div>
          <h1 className="font-serif text-3xl font-extrabold mb-2 text-neutral-900 tracking-tight">
            {form.firstName} {form.lastName}
          </h1>
          <p className="text-neutral-500 text-lg font-medium">
            {isLandlord ? '🏠 Offro una stanza' : '🔍 Cerco una stanza'}{profileQuery.data.city ? ` · ${profileQuery.data.city}` : ''}
          </p>
        </div>

        {/* STATS: solo conteggi reali (i preferiti non esistono ancora) */}
        <div className={`grid ${canManageListings ? 'grid-cols-2' : 'grid-cols-1'} gap-4 md:gap-6 mb-10`}>
          {canManageListings && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100 text-center flex flex-col justify-center transition-transform hover:scale-[1.02]">
              <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">{myListings.length}</div>
              <div className="text-[11px] md:text-xs text-neutral-500 font-bold mt-2 uppercase tracking-wider">Annunci</div>
            </div>
          )}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100 text-center flex flex-col justify-center transition-transform hover:scale-[1.02]">
            <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">{conversations ? conversations.length : '–'}</div>
            <div className="text-[11px] md:text-xs text-neutral-500 font-bold mt-2 uppercase tracking-wider">Chat</div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {canManageListings && (
            <button className={`px-6 py-3 rounded-full font-bold text-sm transition-all cursor-pointer ${view === 'myListings' || view === 'editListing' ? 'bg-neutral-900 text-white shadow-md' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`} onClick={() => showView('myListings')}>
              📄 I Miei Annunci
            </button>
          )}
          <button className={`px-6 py-3 rounded-full font-bold text-sm transition-all cursor-pointer ${view === 'editProfile' ? 'bg-neutral-900 text-white shadow-md' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`} onClick={() => showView('editProfile')}>
            ⚙️ Modifica Profilo
          </button>
          {isLandlord && (
            <button className={`px-6 py-3 rounded-full font-bold text-sm transition-all cursor-pointer ${view === 'createListing' ? 'bg-neutral-900 text-white shadow-md' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`} onClick={() => showView('createListing')}>
              ➕ Pubblica Annuncio
            </button>
          )}
        </div>

        <div className="animate-fade-in-up">

          {/* TAB 1: I MIEI ANNUNCI */}
          {view === 'myListings' && (
            <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-neutral-100">
              <h2 className="text-2xl font-extrabold text-neutral-900 mb-6 tracking-tight">I miei annunci</h2>
              {myListings.length === 0 ? (
                <div className="text-center py-16 px-4 bg-neutral-50 rounded-3xl border border-dashed border-neutral-200">
                  <div className="text-5xl mb-4 opacity-50">📭</div>
                  <p className="text-neutral-500 font-medium mb-6">Non hai ancora pubblicato nessun annuncio.</p>
                  {isLandlord && <button onClick={() => showView('createListing')} className="bg-white border border-neutral-200 hover:border-orange-300 text-neutral-900 px-6 py-3 rounded-full font-bold shadow-sm transition-all cursor-pointer">Crea il primo</button>}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myListings.map(l => {
                    const details = [formatBills(l.billsIncluded), formatAvailability(l.availableFrom)].filter(Boolean).join(' · ');
                    return (
                      <div key={l.id} className="flex flex-col bg-white rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden" data-testid="my-listing">
                        <div className="relative h-40 bg-neutral-100 flex items-center justify-center">
                          {l.coverUrl
                            ? <img src={l.coverUrl} alt="" className="w-full h-full object-cover" />
                            : <span className="text-sm font-bold text-neutral-400">📷 Nessuna foto</span>}
                          <span className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-bold shadow-sm ${l.isActive ? 'bg-white/90 text-green-700' : 'bg-neutral-900/80 text-white'}`}>
                            {l.isActive ? 'Pubblicato' : 'Disattivato'}
                          </span>
                        </div>
                        <div className="p-6 flex flex-col gap-4 grow">
                          <div>
                            <Link to={`/dettagli/${l.id}`} className="font-bold text-neutral-900 text-lg mb-1 hover:text-orange-500 transition-colors">{l.title}</Link>
                            <div className="text-sm text-neutral-500 font-medium">📍 {l.city} · 🏠 {l.roomType}</div>
                            {details && <div className="text-sm text-neutral-500 font-medium">{details}</div>}
                            <div className="text-lg font-extrabold text-orange-500 mt-2">€{l.price}/mese</div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-auto">
                            <button onClick={() => showView('editListing', l.id)} className="bg-neutral-900 text-white hover:bg-neutral-800 font-bold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer">Modifica</button>
                            <button onClick={() => handleToggleActive(l)} disabled={setListingActive.isPending} className="bg-neutral-100 text-neutral-700 hover:bg-neutral-200 font-bold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer disabled:opacity-50">
                              {l.isActive ? 'Disattiva' : 'Riattiva'}
                            </button>
                            <button onClick={() => handleDeleteListing(l.id)} disabled={deleteListing.isPending} className="bg-red-50 text-red-600 hover:bg-red-100 font-bold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer disabled:opacity-50">Elimina</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* MODIFICA ANNUNCIO: foto e dati */}
          {view === 'editListing' && (
            <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-neutral-100 flex flex-col gap-8">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Modifica annuncio</h2>
                <div className="flex gap-3">
                  <Link to={`/dettagli/${editingId}`} className="text-sm font-bold text-orange-500 hover:text-orange-600 transition-colors">Vedi l&apos;annuncio →</Link>
                  <button onClick={() => showView('myListings')} className="text-sm font-bold text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer">← I miei annunci</button>
                </div>
              </div>
              {notice && <div className="p-4 rounded-2xl font-bold bg-green-50 text-green-700 border border-green-200">{notice}</div>}
              {!editing.data ? (
                editing.isError
                  ? <p className="text-neutral-600 font-medium">{editing.error.message}</p>
                  : <p className="text-neutral-500 font-medium">Caricamento annuncio...</p>
              ) : (
                <>
                  {!editing.data.isActive && (
                    <div className="p-4 rounded-2xl font-medium bg-neutral-50 text-neutral-700 border border-neutral-200 text-sm">Questo annuncio è disattivato: non compare nelle ricerche e non può essere contattato.</div>
                  )}
                  <ListingPhotos listing={editing.data} />
                  <div className="pt-8 border-t border-neutral-100">
                    <ListingForm key={editing.data.id} listing={editing.data} submitLabel="Salva modifiche" onSubmit={handleUpdateListing} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: MODIFICA PROFILO */}
          {view === 'editProfile' && (
            <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-neutral-100">
              <h2 className="text-2xl font-extrabold text-neutral-900 mb-8 tracking-tight">Informazioni Personali</h2>
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
                
                {/* 🔴 FIX: Se l'utente cerca stanza, mostriamo 2 colonne col budget. Se affitta, 1 colonna sola senza budget */}
                <div className={`grid grid-cols-1 ${isCerca ? 'md:grid-cols-2' : ''} gap-6 pb-8 border-b border-neutral-100`}>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-neutral-900">Il tuo obiettivo</label>
                    <select 
                      name="userType" 
                      value={form.userType}
                      onChange={e => setForm({...form, userType: e.target.value})}
                      className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3.5 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all"
                    >
                      <option value="cerca">🔍 Cerco una stanza</option>
                      <option value="affitta">🏠 Offro una stanza</option>
                    </select>
                  </div>

                  {isCerca && (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-neutral-900">Budget Max (€/mese)</label>
                      <input 
                        name="budgetMax" 
                        type="number" 
                        value={form.budgetMax || ''}
                        onChange={e => setForm({...form, budgetMax: e.target.value})}
                        className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3.5 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all" 
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-neutral-900">Occupazione</label>
                    <select 
                      name="occupation" 
                      value={form.occupation}
                      onChange={e => setForm({...form, occupation: e.target.value})}
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
                      value={form.city}
                      onChange={e => setForm({...form, city: e.target.value})}
                      className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3.5 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all" 
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-neutral-900">Data di Nascita</label>
                    <input 
                      name="birthdate" 
                      type="date" 
                      value={form.birthdate}
                      onChange={e => setForm({...form, birthdate: e.target.value})}
                      className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-2xl px-4 py-3.5 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all" 
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-sm font-bold text-neutral-900">Bio</label>
                  <textarea 
                    name="bio" 
                    value={form.bio}
                    onChange={e => setForm({...form, bio: e.target.value})}
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
                      const isChecked = form.lifestyleTags.includes(tagValue);
                      
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
                      checked={form.isPublic}
                      onChange={e => setForm({...form, isPublic: e.target.checked})}
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
          {view === 'createListing' && (
            <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-neutral-100">
              <h2 className="text-2xl font-extrabold text-neutral-900 mb-2 tracking-tight">Inserisci una Stanza</h2>
              <p className="text-neutral-500 font-medium mb-8">Dopo la pubblicazione potrai aggiungere le foto.</p>
              <ListingForm submitLabel="Pubblica Annuncio" onSubmit={handleCreateListing} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}