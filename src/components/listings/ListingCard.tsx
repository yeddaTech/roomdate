import { ImageOff, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatAvailability, formatBills } from '../../api/listings';
import type { ListingSummary } from '../../api/types';
import { cn } from '../ui/cn';
import SaveButton from './SaveButton';

interface Props {
  listing: ListingSummary;
  /** Le prime schede della pagina: la foto si scarica subito, le altre quando si avvicinano. */
  eager?: boolean;
  /** Livello del titolo, secondo la pagina (h2 se le schede sono il contenuto principale). */
  headingLevel?: 'h2' | 'h3';
  onSaved?: (saved: boolean) => void;
}

const roomTypeLabel: Record<string, string> = { singola: 'Singola', doppia: 'Doppia' };

/**
 * Scheda di un annuncio: foto, prezzo, luogo e caratteristiche. Tutta la scheda porta al dettaglio
 * (il link è sul titolo e si estende alla scheda), il cuore resta un pulsante a parte.
 */
export default function ListingCard({ listing, eager = false, headingLevel: Heading = 'h3', onSaved }: Props) {
  const place = listing.zone ? `${listing.zone}, ${listing.city}` : listing.city;
  const facts = [roomTypeLabel[listing.roomType] ?? listing.roomType, formatBills(listing.billsIncluded), formatAvailability(listing.availableFrom)]
    .filter((fact): fact is string => Boolean(fact));

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-shadow duration-200 hover:shadow-overlay',
        'has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-focus has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-background',
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-muted">
        {listing.coverUrl ? (
          <img
            src={listing.coverUrl}
            alt=""
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-sm font-bold text-foreground-subtle">
            <ImageOff className="size-7" aria-hidden="true" />
            Nessuna foto
          </div>
        )}
        <p className="absolute bottom-3 left-3 rounded-full bg-surface/95 px-3 py-1 text-foreground shadow-card backdrop-blur-sm">
          <span className="text-lg font-extrabold">{listing.price} €</span>
          <span className="text-xs font-bold text-foreground-muted"> al mese</span>
        </p>
        <SaveButton listing={listing} onSaved={onSaved} className="absolute right-3 top-3 z-10" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Heading className="line-clamp-1 font-bold text-foreground">
          <Link to={`/dettagli/${listing.id}`} className="outline-none after:absolute after:inset-0 after:content-['']" title={listing.title}>
            {listing.title}
          </Link>
        </Heading>
        <p className="flex items-center gap-1.5 text-sm text-foreground-muted">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{place}</span>
        </p>
        {facts.length > 0 && (
          <ul className="mt-auto flex flex-wrap gap-1.5 pt-1" aria-label="Caratteristiche">
            {facts.map((fact) => (
              <li key={fact} className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-bold text-foreground-muted">{fact}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
