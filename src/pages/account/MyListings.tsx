import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, ImageOff, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeleteListing, useMyListings, useSetListingActive } from '../../api/hooks';
import type { ListingSummary } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import PageMeta from '../../components/PageMeta';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import { buttonClasses } from '../../components/ui/buttonClasses';
import { cn, focusRing } from '../../components/ui/cn';
import { useConfirm } from '../../components/ui/confirm';
import EmptyState from '../../components/ui/EmptyState';
import Skeleton from '../../components/ui/Skeleton';

/** Stato dell'annuncio come lo vedono gli altri. */
function status(listing: ListingSummary): { label: string; tone: string } {
  if (listing.removed) return { label: 'Rimosso dalla moderazione', tone: 'bg-danger-soft text-danger-soft-foreground' };
  if (listing.isActive) return { label: 'Pubblicato', tone: 'bg-success-soft text-success-soft-foreground' };
  return { label: 'Non pubblicato', tone: 'bg-surface-muted text-foreground-muted' };
}

function MyListingCard({ listing }: { listing: ListingSummary }) {
  const confirm = useConfirm();
  const setActive = useSetListingActive();
  const remove = useDeleteListing();
  const { label, tone } = status(listing);
  const place = listing.zone ? `${listing.zone}, ${listing.city}` : listing.city;

  const toggle = async () => {
    try {
      await setActive.mutateAsync({ id: listing.id, active: !listing.isActive });
      toast.success(listing.isActive ? 'Annuncio ritirato: non compare più nelle ricerche.' : 'Annuncio pubblicato.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operazione non riuscita.');
    }
  };

  const destroy = async () => {
    const ok = await confirm({
      title: `Eliminare «${listing.title}»?`,
      description: 'Verranno cancellate anche le foto. Le conversazioni con chi ti ha scritto restano.',
      confirmLabel: 'Elimina annuncio',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(listing.id);
      toast.success('Annuncio eliminato.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  };

  return (
    <li className="flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card sm:flex-row" data-testid="my-listing">
      <div className="relative aspect-[4/3] shrink-0 bg-surface-muted sm:aspect-auto sm:w-48">
        {listing.coverUrl
          ? <img src={listing.coverUrl} alt="" className="size-full object-cover" loading="lazy" />
          : (
            <div className="flex size-full min-h-32 flex-col items-center justify-center gap-1.5 text-sm font-bold text-foreground-subtle">
              <ImageOff className="size-6" aria-hidden="true" /> Nessuna foto
            </div>
          )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', tone)} data-testid="listing-status">{label}</span>
          <span className="text-sm font-bold text-foreground">{listing.price} € al mese</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">
            <Link to={`/dettagli/${listing.id}`} className={cn('rounded-sm hover:underline', focusRing)}>{listing.title}</Link>
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground-muted">
            <MapPin className="size-4 shrink-0" aria-hidden="true" /> {place}
          </p>
        </div>
        {listing.removed ? (
          <p className="text-sm text-danger">Viola i Termini di utilizzo: non è più visibile agli altri e puoi solo eliminarlo.</p>
        ) : !listing.isActive && (
          <p className="text-sm text-foreground-muted">
            Lo vedi solo tu. {listing.coverUrl ? 'Pubblicalo quando è pronto.' : 'Aggiungi qualche foto e pubblicalo.'}
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {!listing.removed && (
            <>
              <Link to={`/annunci/${listing.id}/modifica`} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                <Pencil aria-hidden="true" /> Modifica
              </Link>
              <Button variant={listing.isActive ? 'secondary' : 'primary'} size="sm" onClick={toggle} loading={setActive.isPending}>
                {listing.isActive ? <><EyeOff aria-hidden="true" /> Ritira</> : <><Eye aria-hidden="true" /> Pubblica</>}
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={destroy} loading={remove.isPending} className="text-danger hover:bg-danger-soft">
            <Trash2 aria-hidden="true" /> Elimina
          </Button>
        </div>
      </div>
    </li>
  );
}

/** Gli annunci di chi affitta (modulo M2.7): stato, modifica, pubblicazione ed eliminazione. */
export default function MyListings() {
  const { user } = useAuth();
  const query = useMyListings();
  const landlord = user?.userType === 'affitta';
  const listings = query.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title="I miei annunci | RoomDate" noindex />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">I miei annunci</h1>
          <p className="mt-2 text-foreground-muted">Pubblica, modifica o ritira le tue stanze.</p>
        </div>
        {landlord && listings.length > 0 && (
          <Link to="/annunci/nuovo" className={buttonClasses()}><Plus aria-hidden="true" /> Pubblica un annuncio</Link>
        )}
      </div>

      {!landlord && listings.length > 0 && (
        <Alert>
          Nel profilo hai scelto «Cerco una stanza»: puoi gestire questi annunci, ma per pubblicarne di nuovi scegli
          «Offro una stanza» nel <Link to="/profilo" className={cn('rounded-sm font-bold underline', focusRing)}>profilo</Link>.
        </Alert>
      )}

      {query.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <span className="sr-only" role="status">Caricamento degli annunci…</span>
          {[1, 2].map((n) => <Skeleton key={n} className="h-44 rounded-card" />)}
        </div>
      ) : query.isError ? (
        <EmptyState
          headingLevel="h2"
          title="Impossibile caricare i tuoi annunci"
          description={query.error.message}
          action={<Button onClick={() => query.refetch()}>Riprova</Button>}
          className="rounded-card border border-danger/30 bg-surface"
        />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={<Plus />}
          headingLevel="h2"
          title={landlord ? 'Ancora nessun annuncio' : 'Per pubblicare un annuncio'}
          description={landlord
            ? 'Ti guidiamo passo per passo: la stanza, la descrizione e le foto. Lo pubblichi quando è pronto.'
            : 'Scegli «Offro una stanza» nel tuo profilo: potrai pubblicare le tue stanze da qui.'}
          action={landlord
            ? <Link to="/annunci/nuovo" className={buttonClasses()}><Plus aria-hidden="true" /> Pubblica il primo annuncio</Link>
            : <Link to="/profilo" className={buttonClasses({ variant: 'secondary' })}>Vai al profilo</Link>}
          className="rounded-card border border-dashed border-line bg-surface"
        />
      ) : (
        <ul className="flex flex-col gap-4" aria-label="I tuoi annunci">
          {listings.map((listing) => <MyListingCard key={listing.id} listing={listing} />)}
        </ul>
      )}
    </div>
  );
}
