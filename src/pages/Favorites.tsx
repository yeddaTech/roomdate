import { Heart, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useSavedListings, useSetListingSaved } from '../api/hooks';
import type { ListingSummary } from '../api/types';
import ListingCard from '../components/listings/ListingCard';
import PageMeta from '../components/PageMeta';
import LoadMore from '../components/search/LoadMore';
import Button from '../components/ui/Button';
import { buttonClasses } from '../components/ui/buttonClasses';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';

/** Gli annunci salvati con il cuore, dal più recente. Non compaiono quelli che oggi non sono visibili. */
export default function Favorites() {
  const saved = useSavedListings();
  const setSaved = useSetListingSaved();
  const listings = saved.data?.pages.flatMap((page) => page.items) ?? [];

  // Togliendo un preferito da qui la scheda sparisce: si può rimettere subito con "Annulla"
  const onSaved = (listing: ListingSummary) => (isSaved: boolean) => {
    if (isSaved) return;
    toast('Tolto dai preferiti', {
      description: listing.title,
      action: { label: 'Annulla', onClick: () => setSaved.mutate({ id: listing.id, saved: true }) },
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10">
      <PageMeta title="Preferiti | RoomDate" noindex />
      <h1 className="font-display text-3xl font-bold text-foreground md:text-5xl">I tuoi preferiti</h1>
      <p className="mb-8 mt-2 text-foreground-muted">Le stanze che hai salvato con il cuore, per ritrovarle e confrontarle.</p>

      {saved.isPending ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {[1, 2, 3].map((n) => <Skeleton key={n} className="aspect-[4/5] rounded-card" />)}
        </div>
      ) : saved.isError && !saved.data ? (
        <EmptyState
          headingLevel="h2"
          title="Impossibile caricare i preferiti"
          description={saved.error.message}
          action={<Button onClick={() => saved.refetch()}>Riprova</Button>}
          className="rounded-card border border-danger/30 bg-surface"
        />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={<Heart />}
          headingLevel="h2"
          title="Ancora nessun preferito"
          description="Tocca il cuore su un annuncio per ritrovarlo qui."
          action={<Link to="/ricerca" className={buttonClasses()}><Search /> Cerca una stanza</Link>}
          className="rounded-card border border-dashed border-line bg-surface"
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing, i) => (
            <ListingCard key={listing.id} listing={listing} eager={i < 3} headingLevel="h2" onSaved={onSaved(listing)} />
          ))}
        </div>
      )}

      <LoadMore
        hasNextPage={Boolean(saved.hasNextPage)}
        isFetchingNextPage={saved.isFetchingNextPage}
        isError={saved.isFetchNextPageError}
        fetchNextPage={saved.fetchNextPage}
        label="Carica altri preferiti"
      />
    </div>
  );
}
