import Spinner from './ui/Spinner';

/** Attesa mentre si scarica il codice della pagina o si verifica la sessione. */
export default function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-3 text-foreground-muted" role="status">
      <Spinner className="size-5" />
      <span>Caricamento…</span>
    </div>
  );
}
