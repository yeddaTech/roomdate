import { useEffect } from 'react';
import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import Button from '../ui/Button';
import { buttonClasses } from '../ui/buttonClasses';
import EmptyState from '../ui/EmptyState';
import NotFoundContent from './NotFoundContent';

// Quando una pagina va in errore mentre si disegna, al suo posto compare questo messaggio: la
// navigazione resta visibile e si può andare altrove. Il caso più comune dopo un aggiornamento del
// sito è il codice di una pagina che non esiste più sul server (i nomi dei file cambiano a ogni
// pubblicazione): lì basta ricaricare, e lo facciamo da soli una volta.

const RELOAD_KEY = 'roomdate-reloaded-after-update';

function isChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch dynamically/i.test(message);
}

function reloadedRecently(): boolean {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    return Date.now() - at < 30_000;
  } catch {
    return true; // senza sessionStorage non si rischia un ciclo di ricaricamenti
  }
}

export default function RouteError() {
  const error = useRouteError();
  const chunk = isChunkError(error);

  useEffect(() => {
    console.error(error);
    if (chunk && !reloadedRecently()) {
      try {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      } catch {
        return;
      }
      window.location.reload();
    }
  }, [error, chunk]);

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundContent />;

  return (
    <div className="mx-auto max-w-xl px-4 py-16" data-testid="route-error">
      <EmptyState
        headingLevel="h1"
        icon={<TriangleAlert />}
        title={chunk ? 'È disponibile una nuova versione del sito' : 'Questa pagina ha avuto un problema'}
        description={chunk
          ? 'Ricarica la pagina per usare la versione aggiornata.'
          : 'Non dipende da te. Riprova tra un attimo; se il problema continua, torna alla home.'}
        action={(
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => window.location.reload()}><RefreshCw /> Ricarica la pagina</Button>
            <Link to="/" className={buttonClasses({ variant: 'secondary' })}>Torna alla home</Link>
          </div>
        )}
      />
    </div>
  );
}
