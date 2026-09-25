import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import PageMeta from '../components/PageMeta';
import { useAuth } from '../auth/AuthContext';
import { useListing, useStartChat } from '../api/hooks';
import { formatAvailability, formatBills } from '../api/listings';
import { amenityLabel } from '../api/options';
import ReportDialog from '../components/ReportDialog';

export default function ListingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const { data: listing, isPending: loading } = useListing(id);
  const imageCount = listing?.images.length ?? 0;
  const startChat = useStartChat();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reporting, setReporting] = useState(false);


  const nextImage = () => {
    setCurrentIndex((prev) => (prev >= imageCount - 1 ? 0 : prev + 1));
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev === 0 ? imageCount - 1 : prev - 1));
  };

  // 🛡️ ZERO-TRUST: Invia solo l'ID dell'annuncio
  const handleContact = async () => {
    if (!user) {
      toast.info('Accedi o registrati per scrivere a chi pubblica l\'annuncio.');
      navigate('/accedi', { state: { from: location.pathname } });
      return;
    }

    try {
      const conversationId = await startChat.mutateAsync({ listingId: listing.id });
      navigate('/chat', { state: { openChatId: conversationId } });
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex justify-center items-center font-sans">
        <div className="font-serif text-2xl font-bold text-orange-500 animate-pulse tracking-tight">Caricamento annuncio...</div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-[50vh] flex flex-col justify-center items-center font-sans p-6 text-center">
        <div className="text-6xl mb-4 opacity-50">🏜️</div>
        <h2 className="font-serif text-3xl font-extrabold text-neutral-900 mb-4 tracking-tight">Annuncio non trovato</h2>
        <p className="text-neutral-500 mb-8 font-medium">L'annuncio che stai cercando potrebbe essere stato rimosso o non è più disponibile.</p>
        <button onClick={() => navigate('/ricerca')} className="bg-neutral-900 hover:bg-neutral-800 text-white px-8 py-3.5 rounded-full font-bold shadow-md transition-all cursor-pointer">Torna alla Ricerca</button>
      </div>
    );
  }

  const hasImages = imageCount > 0;
  // Dopo l'eliminazione di una foto l'indice potrebbe superare il numero di foto
  const shownIndex = Math.min(currentIndex, Math.max(imageCount - 1, 0));
  const facts = [
    listing.roomType === 'doppia' ? 'Stanza doppia' : 'Stanza singola',
    formatBills(listing.billsIncluded),
    formatAvailability(listing.availableFrom),
  ].filter(Boolean);

  return (
    <div className="bg-[#FAFAFA] pb-12 font-sans selection:bg-orange-200">
      <PageMeta title={`${listing.title} a ${listing.city} | RoomDate`} description={`Stanza ${listing.roomType} in affitto a ${listing.city}${listing.zone ? `, zona ${listing.zone}` : ''}.`} />


      {/* --- HERO (GRADIENTE VIBRANTE) --- */}
      <section className="bg-linear-to-br from-orange-500 to-rose-500 px-6 py-12 md:py-16 relative overflow-hidden text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/20 blur-[80px] rounded-full pointer-events-none"></div>

        <div className="max-w-6xl mx-auto relative z-10 flex flex-col gap-6 animate-fade-in-up">
          <button onClick={() => navigate(-1)} className="w-max bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 px-5 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer">
            ← Torna indietro
          </button>
          <div>
            <h1 className="font-serif text-4xl md:text-5xl font-extrabold mb-3 tracking-tight">{listing.title}</h1>
            <p className="text-white/90 text-lg md:text-xl font-medium flex items-center gap-2">📍 {listing.zone ? `${listing.zone}, ${listing.city}` : listing.city}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {facts.map((fact) => (
                <span key={fact} className="bg-white/20 backdrop-blur-md border border-white/30 px-4 py-1.5 rounded-full text-sm font-bold">{fact}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* --- MAIN CONTENT --- */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12 flex flex-col lg:flex-row gap-8 lg:gap-12 -mt-8 relative z-20">
        
        {/* COLONNA SINISTRA (Immagini e Descrizione) */}
        <div className="w-full lg:w-2/3 flex flex-col gap-8">
          
          {/* Galleria Immagini */}
          {hasImages ? (
            <div className="relative w-full h-[300px] md:h-[450px] rounded-3xl overflow-hidden shadow-lg group bg-neutral-100 border border-neutral-200">
              {listing.images.length > 1 && (
                <>
                  <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 backdrop-blur-md hover:bg-white text-neutral-900 rounded-full shadow-lg font-bold transition-all opacity-0 group-hover:opacity-100 cursor-pointer flex items-center justify-center text-lg z-10">❮</button>
                  <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 backdrop-blur-md hover:bg-white text-neutral-900 rounded-full shadow-lg font-bold transition-all opacity-0 group-hover:opacity-100 cursor-pointer flex items-center justify-center text-lg z-10">❯</button>
                  
                  {/* Contatore immagini */}
                  <div className="absolute bottom-4 right-4 bg-neutral-900/70 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full z-10">
                    {shownIndex + 1} / {imageCount}
                  </div>
                </>
              )}
              <img src={listing.images[shownIndex].url} alt={`Foto ${shownIndex + 1} di ${imageCount}: ${listing.title}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
            </div>
          ) : (
            <div className="w-full h-[240px] md:h-[300px] rounded-3xl bg-neutral-100 flex flex-col items-center justify-center gap-2 shadow-xs border border-neutral-200 text-neutral-400">
              <span className="text-5xl">📷</span>
              <span className="font-bold text-sm">Nessuna foto caricata per questo annuncio</span>
            </div>
          )}

          {/* Dettagli Immobile */}
          <div className="bg-white p-6 md:p-10 rounded-3xl shadow-xs border border-neutral-100">
            <h2 className="font-serif text-2xl md:text-3xl font-extrabold text-neutral-900 mb-6 tracking-tight">Descrizione immobile</h2>
            <p className="text-neutral-600 leading-relaxed text-lg whitespace-pre-line font-medium">{listing.description}</p>
            
            {listing.amenities.length > 0 && (
              <div className="border-t border-neutral-100 pt-8 mt-8">
                <h3 className="font-serif text-2xl font-extrabold text-neutral-900 mb-6 tracking-tight">Cosa offre</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {listing.amenities.map(a => (
                    <div key={a} className="flex items-center gap-3 text-neutral-700 font-bold bg-neutral-50 border border-neutral-100 px-5 py-3.5 rounded-2xl">
                      <span className="text-orange-500 text-lg">✦</span> {amenityLabel(a)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLONNA DESTRA (Sidebar Host) */}
        <aside className="w-full lg:w-1/3">
          <div className="sticky top-28 flex flex-col gap-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-neutral-100 text-center relative overflow-hidden">
              {/* Orb decorativo interno */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-400/10 blur-[50px] rounded-full pointer-events-none"></div>

              {/* Box Prezzo */}
              <div className="bg-orange-50/50 p-6 rounded-3xl mb-8 border border-orange-100 shadow-xs relative z-10">
                <div className="font-serif text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-orange-500 to-rose-500 tracking-tight">
                  €{listing.price}
                </div>
                <div className="text-sm font-bold text-neutral-500 mt-2 uppercase tracking-wider">al mese{listing.billsIncluded !== null && (listing.billsIncluded ? ', spese incluse' : ', spese escluse')}</div>
              </div>
              
              {/* Profilo Host */}
              <div className="relative z-10">
                <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-5xl mb-5 shadow-md bg-linear-to-br from-orange-300 to-rose-400 transform transition-transform hover:scale-105 cursor-default">
                  <span className="drop-shadow-xs text-white font-bold">{(listing.owner.firstName || '?').charAt(0).toUpperCase()}</span>
                </div>
                <h3 className="font-serif text-2xl font-extrabold text-neutral-900 mb-1">{listing.owner.firstName}</h3>
                <p className="text-sm font-bold text-neutral-400 mb-8 uppercase tracking-wider">Host su RoomDate</p>
                
                {listing.isOwner && listing.removed ? (
                  <p className="text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl p-3" data-testid="listing-removed">
                    Questo annuncio è stato rimosso dalla moderazione perché viola i Termini di utilizzo: lo vedi solo tu e puoi solo eliminarlo dalla tua area personale.
                  </p>
                ) : listing.isOwner ? (
                  <>
                    {!listing.isActive && (
                      <p className="mb-4 text-sm font-medium text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-2xl p-3">Questo annuncio è disattivato: lo vedi solo tu.</p>
                    )}
                    <button onClick={() => navigate('/dashboard', { state: { editListingId: listing.id } })} className="w-full bg-neutral-900 text-white py-4.5 rounded-2xl font-bold shadow-lg hover:bg-neutral-800 transition-all duration-300 text-lg flex items-center justify-center gap-2 cursor-pointer">
                      ✏️ Modifica annuncio
                    </button>
                  </>
                ) : (
                  <>
                    {/* Bottone Contatto */}
                    <button onClick={handleContact} className="w-full bg-linear-to-r from-orange-500 to-rose-500 text-white py-4.5 rounded-2xl font-bold shadow-lg hover:shadow-orange-500/25 hover:scale-[1.02] transition-all duration-300 text-lg flex items-center justify-center gap-2 cursor-pointer">
                      <span className="text-xl">💬</span> Contatta in Chat
                    </button>
                    {user && (
                      <button type="button" onClick={() => setReporting(true)} className="mt-5 text-sm font-bold text-neutral-500 hover:text-rose-600 transition-colors cursor-pointer">
                        🚩 Segnala annuncio
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Banner Sicurezza */}
            <div className="bg-neutral-50 border border-neutral-100 p-6 rounded-3xl text-center shadow-xs">
              <div className="text-2xl mb-2">🛡️</div>
              <h4 className="font-bold text-neutral-900 mb-2">Consigli di sicurezza</h4>
              <p className="text-xs text-neutral-500 font-medium leading-relaxed">Le chat sono cifrate end-to-end. Non inviare denaro prima di aver visitato la stanza e incontrato chi la affitta.</p>
            </div>

          </div>
        </aside>
      </div>
      {reporting && (
        <ReportDialog target={{ listingId: listing.id }} title="Segnala annuncio" onClose={() => setReporting(false)} />
      )}
    </div>
  );
}