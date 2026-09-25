/** Primo elemento raggiungibile con Tab: porta al contenuto saltando la navigazione. */
export default function SkipLink() {
  return (
    <a
      href="#contenuto"
      className="sr-only z-[2000] rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      Salta al contenuto
    </a>
  );
}
