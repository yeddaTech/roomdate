import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
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
import { CITIES, OCCUPATIONS, isCity } from '../api/options';
import { latestAdultBirthdate } from '../api/users';
import PageLoader from '../components/PageLoader';
import { useConfirm } from '../components/ui/confirm';
import { toast } from 'sonner';
import ListingForm from '../components/listings/ListingForm';
import ListingPhotos from '../components/listings/ListingPhotos';
import LifestyleTagsPicker from '../components/profile/LifestyleTagsPicker';

export default function Dashboard() {
  const confirm = useConfirm();
  const location = useLocation();

  // Da "Modifica annuncio" nella pagina di dettaglio si arriva direttamente alla modifica
  const [editingId, setEditingId] = useState(location.state?.editListingId ?? null);
  const [activeView, setActiveView] = useState(editingId ? 'editListing' : 'editProfile');
  const [notice, setNotice] = useState('');

  // Profilo salvato sul server e sua copia modificabile nel form
  const profileQuery = useMyProfile();
  const [form, setForm] = useState(null);
  useEffect(() => {
    const profile = profileQuery.data;
    // Una città salvata prima degli elenchi condivisi, e non riconosciuta, va scelta di nuovo
    if (profile) setForm({ ...profile, city: isCity(profile.city) ? profile.city : '' });
  }, [profileQuery.data]);
  // 🔴 FIX: Se l'utente cerca stanza, mostriamo 2 colonne col budget. Se affitta, 1 colonna sola senza budget
  // Solo chi affitta pubblica annunci (conta il ruolo salvato, non quello in modifica).
  // Chi ne ha già pubblicati può sempre gestirli, anche dopo aver cambiato ruolo.
  const isLandlord = profileQuery.data?.userType === 'affitta';
  const { data: myListings = [] } = useMyListings();
  const canManageListings = isLandlord || myListings.length > 0;

  let view = activeView;
  if ((view === 'myListings' || view === 'editListing') && !canManageListings) view = 'editProfile';
  if (view === 'createListing' && !isLandlord) view = 'editProfile';

  const editing = useListing(editingId ?? 0, { enabled: editingId !== null });
  const conversationsQuery = useConversations();
  const conversations = conversationsQuery.data?.pages.flatMap(page => page.items);
  const hasMoreConversations = Boolean(conversationsQuery.hasNextPage);
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


  const handleDeleteListing = async (id) => {
    const ok = await confirm({
      title: 'Eliminare questo annuncio?',
      description: 'Verranno cancellate anche le foto. Le conversazioni con chi ti ha scritto resteranno.',
      confirmLabel: 'Elimina annuncio',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteListing.mutateAsync(id);
      toast.success('Annuncio eliminato.');
      showView('myListings');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggleActive = async (listing) => {
    try {
      await setListingActive.mutateAsync({ id: listing.id, active: !listing.isActive });
      toast.success(listing.isActive ? 'Annuncio disattivato: non compare più nelle ricerche.' : 'Annuncio di nuovo pubblicato.');
    } catch (err) {
      toast.error(err.message);
    }
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
      toast.success('Profilo aggiornato.');
    } catch (err) {
      toast.error(err.message);
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
      ? <div className="flex min-h-[50vh] items-center justify-center p-6 text-center font-sans text-foreground-muted">{profileQuery.error.message}</div>
      : <PageLoader />;
  }

  // 🔴 Variabile per capire se dobbiamo mostrare o no il budget dinamicamente
  const isCerca = form.userType === 'cerca';

  return (
    <div className="bg-background pb-12 font-sans selection:bg-primary/25">
      <PageMeta title="Area Privata | RoomDate" noindex />


      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        
        {/* HEADER PROFILO */}
        <div className="bg-surface rounded-3xl p-8 md:p-12 text-center relative shadow-xs border border-line mb-8 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-orange-400/10 blur-[80px] rounded-full pointer-events-none"></div>
          
          <div className="relative z-10 w-28 h-28 rounded-full mx-auto mb-6 flex justify-center items-center text-5xl border-4 border-white shadow-lg bg-linear-to-br from-orange-400 to-rose-500 text-white font-bold">
            {(form.firstName || 'U').charAt(0).toUpperCase()}
          </div>
          <h1 className="font-serif text-3xl font-extrabold mb-2 text-foreground tracking-tight">
            {form.firstName} {form.lastName}
          </h1>
          <p className="text-foreground-subtle text-lg font-medium">
            {isLandlord ? '🏠 Offro una stanza' : '🔍 Cerco una stanza'}{profileQuery.data.city ? ` · ${profileQuery.data.city}` : ''}
          </p>
        </div>

        {/* STATS: solo conteggi reali (i preferiti non esistono ancora) */}
        <div className={`grid ${canManageListings ? 'grid-cols-2' : 'grid-cols-1'} gap-4 md:gap-6 mb-10`}>
          {canManageListings && (
            <div className="bg-surface p-6 rounded-3xl shadow-xs border border-line text-center flex flex-col justify-center transition-transform hover:scale-[1.02]">
              <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-orange-500 to-rose-500">{myListings.length}</div>
              <div className="text-[11px] md:text-xs text-foreground-subtle font-bold mt-2 uppercase tracking-wider">Annunci</div>
            </div>
          )}
          <div className="bg-surface p-6 rounded-3xl shadow-xs border border-line text-center flex flex-col justify-center transition-transform hover:scale-[1.02]">
            <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-orange-500 to-rose-500">{conversations ? `${conversations.length}${hasMoreConversations ? '+' : ''}` : '–'}</div>
            <div className="text-[11px] md:text-xs text-foreground-subtle font-bold mt-2 uppercase tracking-wider">Chat</div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {canManageListings && (
            <button className={`px-6 py-3 rounded-full font-bold text-sm transition-all cursor-pointer ${view === 'myListings' || view === 'editListing' ? 'bg-foreground text-background shadow-md' : 'bg-surface border border-line text-foreground-muted hover:bg-background'}`} onClick={() => showView('myListings')}>
              📄 I Miei Annunci
            </button>
          )}
          <button className={`px-6 py-3 rounded-full font-bold text-sm transition-all cursor-pointer ${view === 'editProfile' ? 'bg-foreground text-background shadow-md' : 'bg-surface border border-line text-foreground-muted hover:bg-background'}`} onClick={() => showView('editProfile')}>
            ⚙️ Modifica Profilo
          </button>
          {isLandlord && (
            <button className={`px-6 py-3 rounded-full font-bold text-sm transition-all cursor-pointer ${view === 'createListing' ? 'bg-foreground text-background shadow-md' : 'bg-surface border border-line text-foreground-muted hover:bg-background'}`} onClick={() => showView('createListing')}>
              ➕ Pubblica Annuncio
            </button>
          )}
        </div>

        <div className="animate-fade-in-up">

          {/* TAB 1: I MIEI ANNUNCI */}
          {view === 'myListings' && (
            <div className="bg-surface p-6 md:p-10 rounded-3xl shadow-xs border border-line">
              <h2 className="text-2xl font-extrabold text-foreground mb-6 tracking-tight">I miei annunci</h2>
              {myListings.length === 0 ? (
                <div className="text-center py-16 px-4 bg-background rounded-3xl border border-dashed border-line">
                  <div className="text-5xl mb-4 opacity-50">📭</div>
                  <p className="text-foreground-subtle font-medium mb-6">Non hai ancora pubblicato nessun annuncio.</p>
                  {isLandlord && <button onClick={() => showView('createListing')} className="bg-surface border border-line hover:border-primary/50 text-foreground px-6 py-3 rounded-full font-bold shadow-xs transition-all cursor-pointer">Crea il primo</button>}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myListings.map(l => {
                    const details = [formatBills(l.billsIncluded), formatAvailability(l.availableFrom)].filter(Boolean).join(' · ');
                    return (
                      <div key={l.id} className="flex flex-col bg-surface rounded-3xl border border-line shadow-xs hover:shadow-md transition-shadow overflow-hidden" data-testid="my-listing">
                        <div className="relative h-40 bg-surface-muted flex items-center justify-center">
                          {l.coverUrl
                            ? <img src={l.coverUrl} alt="" className="w-full h-full object-cover" />
                            : <span className="text-sm font-bold text-foreground-subtle">📷 Nessuna foto</span>}
                          <span className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-bold shadow-xs ${l.removed ? 'bg-danger text-danger-foreground' : l.isActive ? 'bg-surface/90 text-success-soft-foreground' : 'bg-neutral-900/80 text-white'}`}>
                            {l.removed ? 'Rimosso dalla moderazione' : l.isActive ? 'Pubblicato' : 'Disattivato'}
                          </span>
                        </div>
                        <div className="p-6 flex flex-col gap-4 grow">
                          <div>
                            <Link to={`/dettagli/${l.id}`} className="font-bold text-foreground text-lg mb-1 hover:text-primary transition-colors">{l.title}</Link>
                            <div className="text-sm text-foreground-subtle font-medium">📍 {l.city} · 🏠 {l.roomType}</div>
                            {details && <div className="text-sm text-foreground-subtle font-medium">{details}</div>}
                            <div className="text-lg font-extrabold text-primary mt-2">€{l.price}/mese</div>
                          </div>
                          {l.removed && (
                            <p className="text-sm font-medium text-danger">Viola i Termini di utilizzo: non è più visibile agli altri e puoi solo eliminarlo.</p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-auto">
                            {!l.removed && (<>
                            <button onClick={() => showView('editListing', l.id)} className="bg-foreground text-background hover:bg-foreground/85 font-bold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer">Modifica</button>
                            <button onClick={() => handleToggleActive(l)} disabled={setListingActive.isPending} className="bg-surface-muted text-foreground-muted hover:bg-line font-bold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer disabled:opacity-50">
                              {l.isActive ? 'Disattiva' : 'Riattiva'}
                            </button>
                            </>)}
                            <button onClick={() => handleDeleteListing(l.id)} disabled={deleteListing.isPending} className="bg-danger-soft text-danger hover:bg-danger-soft font-bold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer disabled:opacity-50">Elimina</button>
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
            <div className="bg-surface p-6 md:p-10 rounded-3xl shadow-xs border border-line flex flex-col gap-8">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <h2 className="text-2xl font-extrabold text-foreground tracking-tight">Modifica annuncio</h2>
                <div className="flex gap-3">
                  <Link to={`/dettagli/${editingId}`} className="text-sm font-bold text-primary hover:text-primary transition-colors">Vedi l&apos;annuncio →</Link>
                  <button onClick={() => showView('myListings')} className="text-sm font-bold text-foreground-subtle hover:text-foreground transition-colors cursor-pointer">← I miei annunci</button>
                </div>
              </div>
              {notice && <div className="p-4 rounded-2xl font-bold bg-success-soft text-success-soft-foreground border border-success-soft-foreground/20">{notice}</div>}
              {!editing.data ? (
                editing.isError
                  ? <p className="text-foreground-muted font-medium">{editing.error.message}</p>
                  : <p className="text-foreground-subtle font-medium">Caricamento annuncio...</p>
              ) : (
                <>
                  {!editing.data.isActive && (
                    <div className="p-4 rounded-2xl font-medium bg-background text-foreground-muted border border-line text-sm">Questo annuncio è disattivato: non compare nelle ricerche e non può essere contattato.</div>
                  )}
                  <ListingPhotos listing={editing.data} />
                  <div className="pt-8 border-t border-line">
                    <ListingForm key={editing.data.id} listing={editing.data} submitLabel="Salva modifiche" onSubmit={handleUpdateListing} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: MODIFICA PROFILO */}
          {view === 'editProfile' && (
            <div className="bg-surface p-6 md:p-10 rounded-3xl shadow-xs border border-line">
              <h2 className="text-2xl font-extrabold text-foreground mb-8 tracking-tight">Informazioni Personali</h2>
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
                
                {/* 🔴 FIX: Se l'utente cerca stanza, mostriamo 2 colonne col budget. Se affitta, 1 colonna sola senza budget */}
                <div className={`grid grid-cols-1 ${isCerca ? 'md:grid-cols-2' : ''} gap-6 pb-8 border-b border-line`}>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-foreground">Il tuo obiettivo</label>
                    <select 
                      name="userType" 
                      value={form.userType}
                      onChange={e => setForm({...form, userType: e.target.value})}
                      className="w-full bg-background border border-line text-foreground rounded-2xl px-4 py-3.5 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-hidden transition-all"
                    >
                      <option value="cerca">🔍 Cerco una stanza</option>
                      <option value="affitta">🏠 Offro una stanza</option>
                    </select>
                  </div>

                  {isCerca && (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-foreground">Budget Max (€/mese)</label>
                      <input 
                        name="budgetMax" 
                        type="number" 
                        value={form.budgetMax || ''}
                        onChange={e => setForm({...form, budgetMax: e.target.value})}
                        className="w-full bg-background border border-line text-foreground rounded-2xl px-4 py-3.5 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-hidden transition-all" 
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-foreground">Occupazione</label>
                    <select 
                      name="occupation" 
                      value={form.occupation}
                      onChange={e => setForm({...form, occupation: e.target.value})}
                      className="w-full bg-background border border-line text-foreground rounded-2xl px-4 py-3.5 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-hidden transition-all"
                    >
                      <option value="">Non indicata</option>
                      {OCCUPATIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-foreground">Città di interesse</label>
                    <select 
                      name="city" 
                      value={form.city}
                      onChange={e => setForm({...form, city: e.target.value})}
                      className="w-full bg-background border border-line text-foreground rounded-2xl px-4 py-3.5 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-hidden transition-all" 
                    >
                      <option value="">Non indicata</option>
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-foreground">Data di Nascita</label>
                    <input 
                      name="birthdate" 
                      type="date" 
                      min="1900-01-01"
                      max={latestAdultBirthdate()}
                      title="Per usare RoomDate devi avere almeno 18 anni"
                      value={form.birthdate}
                      onChange={e => setForm({...form, birthdate: e.target.value})}
                      className="w-full bg-background border border-line text-foreground rounded-2xl px-4 py-3.5 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-hidden transition-all" 
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-sm font-bold text-foreground">Bio</label>
                  <textarea 
                    name="bio" 
                    value={form.bio}
                    onChange={e => setForm({...form, bio: e.target.value})}
                    rows="4" 
                    className="w-full bg-background border border-line text-foreground rounded-3xl px-5 py-4 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-hidden transition-all resize-none"
                    placeholder="Racconta qualcosa di te..."
                  ></textarea>
                </div>

                <div className="flex flex-col gap-4 mt-4">
                  <span className="text-sm font-bold text-foreground">Stile di vita</span>
                  <LifestyleTagsPicker value={form.lifestyleTags} onChange={lifestyleTags => setForm({...form, lifestyleTags})} />
                </div>

                <div className="flex flex-col gap-3 mt-6 pt-8 border-t border-line">
                  <label className="text-sm font-bold text-foreground">Privacy e Visibilità</label>
                  <label className="flex items-start gap-3 cursor-pointer group bg-background p-4 rounded-2xl border border-line transition-colors hover:border-primary/30">
                    <input 
                      type="checkbox" 
                      name="isPublic" 
                      checked={form.isPublic}
                      onChange={e => setForm({...form, isPublic: e.target.checked})}
                      className="mt-0.5 w-5 h-5 text-primary bg-surface border-control rounded-sm focus:ring-focus accent-primary cursor-pointer" 
                    />
                    <span className="text-sm text-foreground-muted leading-relaxed font-medium">
                      Rendi il mio profilo pubblico. Acconsento alla visibilità sulla piattaforma e all'indicizzazione sui motori di ricerca ai fini del matching.
                    </span>
                  </label>
                </div>

                <div className="mt-8 pt-8 border-t border-line flex justify-end">
                  <button type="submit" className="w-full md:w-auto bg-linear-to-r from-orange-500 to-rose-500 hover:scale-[1.02] text-white px-10 py-4 rounded-full font-bold shadow-lg hover:shadow-orange-500/25 transition-all cursor-pointer">
                    Salva Modifiche
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: CREA ANNUNCIO */}
          {view === 'createListing' && (
            <div className="bg-surface p-6 md:p-10 rounded-3xl shadow-xs border border-line">
              <h2 className="text-2xl font-extrabold text-foreground mb-2 tracking-tight">Inserisci una Stanza</h2>
              <p className="text-foreground-subtle font-medium mb-8">Dopo la pubblicazione potrai aggiungere le foto.</p>
              <ListingForm submitLabel="Pubblica Annuncio" onSubmit={handleCreateListing} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}