import { useEffect, useRef } from 'react';
import Button from '../ui/Button';

interface Props {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  fetchNextPage: () => unknown;
  label: string;
}

/**
 * Caricamento continuo: la pagina successiva arriva quando ci si avvicina alla fine dell'elenco.
 * Il pulsante resta, per la tastiera e per chi ha fermato il caricamento automatico con un errore.
 */
export default function LoadMore({ hasNextPage, isFetchingNextPage, isError, fetchNextPage, label }: Props) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinel.current;
    // Dopo un errore niente tentativi automatici a ripetizione: si riprova con il pulsante
    if (!node || !hasNextPage || isError || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: '800px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  if (!hasNextPage) return null;
  return (
    <div ref={sentinel} className="flex flex-col items-center gap-3 py-8">
      {isError && <p role="alert" className="text-sm font-bold text-danger">Non è stato possibile caricare altri risultati.</p>}
      <Button variant="secondary" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
        {isError ? 'Riprova' : label}
      </Button>
    </div>
  );
}
