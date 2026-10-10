import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Flag, MapPin, MessageCircle, Pencil, SearchX, ShieldCheck } from 'lucide-react';
import { ApiError } from '../api/client';
import { useListing, useMyProfile, useStartChat } from '../api/hooks';
import { formatAvailability, formatBills } from '../api/listings';
import type { ListingDetail } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import type { AuthLocationState } from '../auth/authLocation';
import BackLink from '../components/layout/BackLink';
import ContactBar from '../components/layout/ContactBar';
import AmenityList from '../components/listings/AmenityList';
import Gallery from '../components/listings/Gallery';
import ListingFit from '../components/listings/ListingFit';
import SaveButton from '../components/listings/SaveButton';
import PageMeta from '../components/PageMeta';
import ReportDialog from '../components/ReportDialog';
import Alert from '../components/ui/Alert';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import { cn, focusRing } from '../components/ui/cn';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';

function Price({ listing, compact = false }: { listing: ListingDetail; compact?: boolean }) {
  const bills = formatBills(listing.billsIncluded);
  return (
    <p className="text-foreground">
      <span className={cn('font-extrabold', compact ? 'text-xl' : 'text-3xl')}>{listing.price} €</span>
      <span className="text-sm font-bold text-foreground-muted"> al mese</span>
      {bills && <span className={cn('text-sm text-foreground-muted', compact ? 'block' : 'mt-1 block')}>{bills}</span>}
    </p>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6" aria-busy="true">
      <span className="sr-only" role="status">Caricamento dell&apos;annuncio…</span>
      <Skeleton className="aspect-[4/3] w-full rounded-card md:aspect-[21/8]" />
      <Skeleton className="mt-8 h-10 w-2/3" />
      <Skeleton className="mt-3 h-5 w-1/3" />
    </div>
  );
}

export default function ListingDetails() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const query = useListing(id);
  const me = useMyProfile({ enabled: Boolean(user) });
  const startChat = useStartChat();
  const [reporting, setReporting] = useState(false);

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <PageMeta title="Annuncio non disponibile | RoomDate" noindex />
        <EmptyState
          icon={<SearchX />}
          headingLevel="h1"
          title={missing ? 'Annuncio non trovato' : "Impossibile caricare l'annuncio"}
          description={missing ? "Potrebbe essere stato rimosso o non essere più disponibile." : query.error.message}
          action={missing
            ? <Button onClick={() => navigate('/ricerca')}>Cerca altre stanze</Button>
            : <Button onClick={() => query.refetch()}>Riprova</Button>}
        />
      </div>
    );
  }

  const listing = query.data;
  const place = listing.zone ? `${listing.zone}, ${listing.city}` : listing.city;
  const facts = [
    listing.roomType === 'doppia' ? 'Stanza doppia' : 'Stanza singola',
    formatBills(listing.billsIncluded),
    formatAvailability(listing.availableFrom),
  ].filter((fact): fact is string => Boolean(fact));
  const ownerName = listing.owner.firstName || 'Utente';

  const contact = async () => {
    if (!user) {
      toast.info("Accedi o registrati per scrivere a chi pubblica l'annuncio.");
      navigate('/accedi', { state: { from: location.pathname } satisfies AuthLocationState });
      return;
    }
    try {
      const conversationId = await startChat.mutateAsync({ listingId: listing.id });
      navigate(`/chat/${conversationId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Non è stato possibile aprire la chat.');
    }
  };
  const edit = () => navigate(`/annunci/${listing.id}/modifica`);
  const canEdit = listing.isOwner && !listing.removed;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 pb-28 md:px-6 md:pt-6 md:pb-12">
      <PageMeta
        title={`${listing.title} a ${listing.city} | RoomDate`}
        description={`Stanza ${listing.roomType} in affitto a ${place}: ${listing.price} € al mese.`}
      />
      <BackLink fallback="/ricerca" />
      <div className="mt-3">
        <Gallery photos={listing.images} title={listing.title} />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <header className="flex flex-col gap-3">
            <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">{listing.title}</h1>
            <p className="flex items-center gap-1.5 text-foreground-muted">
              <MapPin className="size-5 shrink-0" aria-hidden="true" /> {place}
            </p>
            <ul className="flex flex-wrap gap-2" aria-label="Caratteristiche">
              {facts.map((fact) => <li key={fact} className="rounded-full bg-surface-muted px-3 py-1 text-sm font-bold text-foreground-muted">{fact}</li>)}
            </ul>
          </header>

          {listing.isOwner && listing.removed && (
            <Alert tone="danger" data-testid="listing-removed">
              Questo annuncio è stato rimosso dalla moderazione perché viola i Termini di utilizzo: lo vedi solo tu e puoi solo eliminarlo dalla tua area personale.
            </Alert>
          )}
          {listing.isOwner && !listing.removed && !listing.isActive && (
            <Alert>Questo annuncio è disattivato: lo vedi solo tu.</Alert>
          )}

          <section aria-labelledby="descrizione" className="flex flex-col gap-3">
            <h2 id="descrizione" className="text-xl font-bold text-foreground">La stanza</h2>
            <p className="whitespace-pre-line leading-relaxed text-foreground-muted">{listing.description || 'Nessuna descrizione.'}</p>
          </section>

          {listing.amenities.length > 0 && (
            <section aria-labelledby="servizi" className="flex flex-col gap-4">
              <h2 id="servizi" className="text-xl font-bold text-foreground">Servizi</h2>
              <AmenityList amenities={listing.amenities} />
            </section>
          )}

          {user && !listing.isOwner && me.data && <ListingFit listing={listing} me={me.data} />}

          <section aria-labelledby="sicurezza" className="flex gap-3 rounded-card bg-surface-muted p-5">
            <ShieldCheck className="size-6 shrink-0 text-foreground-muted" aria-hidden="true" />
            <div>
              <h2 id="sicurezza" className="font-bold text-foreground">Consigli di sicurezza</h2>
              <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
                Le chat sono cifrate end-to-end. Non inviare denaro prima di aver visitato la stanza e incontrato chi la affitta.
              </p>
            </div>
          </section>
        </div>

        {/* Su desktop prezzo e contatto restano in vista scorrendo; sul telefono stanno nella barra in fondo */}
        <aside aria-label="Prezzo e contatto" className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-5 rounded-card border border-line bg-surface p-6 shadow-card">
            <Price listing={listing} />
            <div className="flex items-center gap-3 border-t border-line pt-5">
              <Avatar name={ownerName} decorative />
              <p className="text-sm text-foreground-muted">
                Pubblicato da <span className="block font-bold text-foreground">{ownerName}</span>
              </p>
            </div>
            {listing.isOwner ? (
              canEdit && <Button size="lg" variant="secondary" onClick={edit}><Pencil /> Modifica l&apos;annuncio</Button>
            ) : (
              <>
                <Button size="lg" onClick={contact} loading={startChat.isPending}><MessageCircle /> Contatta in chat</Button>
                <SaveButton listing={listing} variant="full" />
                {user && (
                  <button type="button" onClick={() => setReporting(true)} className={cn('inline-flex items-center justify-center gap-1.5 self-center rounded-sm text-sm font-bold text-foreground-muted hover:text-danger', focusRing)}>
                    <Flag className="size-4" aria-hidden="true" /> Segnala l&apos;annuncio
                  </button>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Sul telefono: il report resta raggiungibile anche senza la colonna laterale */}
      {user && !listing.isOwner && (
        <button type="button" onClick={() => setReporting(true)} className={cn('mt-8 inline-flex items-center gap-1.5 rounded-sm text-sm font-bold text-foreground-muted hover:text-danger lg:hidden', focusRing)}>
          <Flag className="size-4" aria-hidden="true" /> Segnala l&apos;annuncio
        </button>
      )}

      {(canEdit || !listing.isOwner) && (
        <ContactBar>
          <div className="min-w-0 flex-1"><Price listing={listing} compact /></div>
          {listing.isOwner ? (
            <Button onClick={edit}><Pencil /> Modifica</Button>
          ) : (
            <>
              <SaveButton listing={listing} className="bg-surface-muted shadow-none" />
              <Button onClick={contact} loading={startChat.isPending}><MessageCircle /> Contatta</Button>
            </>
          )}
        </ContactBar>
      )}

      {reporting && <ReportDialog target={{ listingId: listing.id }} title="Segnala annuncio" onClose={() => setReporting(false)} />}
    </div>
  );
}
