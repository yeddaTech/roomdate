import { Link } from 'react-router-dom';
import { ChevronRight, House } from 'lucide-react';
import type { ConversationListing as Listing } from '../../api/types';
import { cn, focusRing } from '../ui/cn';

/** Foto piccola dell'annuncio, o la casetta se non ne ha. */
function Thumbnail({ url }: { url: string | null }) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-muted text-foreground-subtle [&_svg]:size-5">
      {url ? <img src={url} alt="" className="size-full object-cover" loading="lazy" /> : <House aria-hidden="true" />}
    </span>
  );
}

/**
 * L'annuncio di cui si parla, in cima alla conversazione: foto, titolo, prezzo e città, con il
 * collegamento alla pagina. Se l'altro non lo vede più (disattivato, rimosso, eliminato) lo dice,
 * invece di portare a una pagina che non esiste.
 */
export default function ConversationListing({ listing, deleted }: { listing: Listing | null; deleted: boolean }) {
  if (!listing) {
    if (!deleted) return null;
    return (
      <p data-testid="conversation-listing" className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5 text-sm text-foreground-muted md:px-6">
        <House className="size-4 shrink-0" aria-hidden="true" />
        L'annuncio di questa conversazione è stato eliminato.
      </p>
    );
  }

  const facts = `${listing.price} € al mese${listing.city ? ` · ${listing.city}` : ''}`;
  const note = listing.mine
    ? listing.available ? 'Il tuo annuncio' : 'Il tuo annuncio · non visibile agli altri'
    : listing.available ? null : 'Non più disponibile';
  const content = (
    <>
      <Thumbnail url={listing.coverUrl} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-bold text-foreground">{listing.title}</span>
        <span className="truncate text-sm text-foreground-muted">
          {facts}
          {note && <span className={cn('font-bold', listing.available ? 'text-primary-soft-foreground' : 'text-foreground-muted')}> · {note}</span>}
        </span>
      </span>
    </>
  );

  // L'annuncio di chi guarda si apre sempre (per gestirlo); quello dell'altro solo se c'è ancora
  const linkable = listing.mine || listing.available;
  const box = 'flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5 md:px-6';
  if (!linkable) {
    return <div data-testid="conversation-listing" className={box}>{content}</div>;
  }
  return (
    <Link
      to={`/dettagli/${listing.id}`}
      data-testid="conversation-listing"
      className={cn(box, 'transition-colors hover:bg-surface-muted', focusRing, 'focus-visible:ring-inset focus-visible:ring-offset-0')}
    >
      {content}
      <span className="sr-only">: apri l'annuncio</span>
      <ChevronRight className="size-5 shrink-0 text-foreground-subtle" aria-hidden="true" />
    </Link>
  );
}
