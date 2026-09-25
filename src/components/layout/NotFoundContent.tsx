import { Link } from 'react-router-dom';
import { Compass, Search } from 'lucide-react';
import PageMeta from '../PageMeta';
import { buttonClasses } from '../ui/buttonClasses';
import EmptyState from '../ui/EmptyState';

/** Pagina inesistente: dentro il layout, così da qui si può andare ovunque. */
export default function NotFoundContent() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16" data-testid="not-found">
      <PageMeta title="Pagina non trovata | RoomDate" noindex />
      <EmptyState
        headingLevel="h1"
        icon={<Compass />}
        title="Pagina non trovata"
        description="L'indirizzo che hai aperto non esiste o non è più disponibile."
        action={(
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/" className={buttonClasses()}>Torna alla home</Link>
            <Link to="/ricerca" className={buttonClasses({ variant: 'secondary' })}><Search /> Cerca una stanza</Link>
          </div>
        )}
      />
    </div>
  );
}
