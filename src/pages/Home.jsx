import { Link } from 'react-router-dom';
import { useLatestListings } from '../api/hooks';

export default function Home() {
  const { data: listings = [], isPending: isLoading, isError } = useLatestListings();
  const error = isError ? "Impossibile caricare le stanze al momento." : null;

  return (
    <div className="bg-background font-sans selection:bg-primary/25 flex flex-col">

      {/* HERO SECTION */}
      <section className="relative pt-16 md:pt-24 pb-20 px-6 overflow-hidden flex flex-col items-center justify-center min-h-[80vh]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-orange-400/20 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center mt-12 md:mt-0">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-soft border border-primary/20 text-primary text-sm font-bold mb-8 shadow-xs">
             Trova casa a Milano e nel resto d'Italia
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6 leading-tight md:leading-none">
            Trova la tua stanza <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-500 to-rose-500">senza stress.</span>
          </h1>
          <p className="text-lg text-foreground-subtle mb-10 max-w-xl mx-auto font-medium">
            Esplora annunci reali e chatta subito per trovare la tua sistemazione o il tuo prossimo coinquilino.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 w-full px-4 sm:px-0">
            <Link to="/ricerca?intent=stanza" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-foreground text-background text-lg font-bold shadow-lg hover:bg-foreground/85 hover:scale-[1.02] transition-all text-center">
               Cerca Stanza
            </Link>
            <Link to="/ricerca?intent=coinquilino" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-surface text-foreground text-lg font-bold border border-line shadow-xs hover:bg-background hover:scale-[1.02] transition-all text-center">
              Cerca Coinquilini
            </Link>
          </div>
        </div>
      </section>

      {/* STANZE */}
      <section className="py-16 px-6 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-foreground tracking-tight">Le ultime stanze</h2>
          </div>
          <Link to="/ricerca" className="hidden md:block text-primary font-bold hover:text-primary transition-colors">Vedi tutte &rarr;</Link>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            /* 🚀 SKELETON LOADING */
            [1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-surface rounded-3xl shadow-xs border border-line flex flex-col h-full min-h-[300px]">
                <div className="h-48 w-full bg-surface-muted animate-pulse rounded-t-3xl"></div>
                <div className="p-4 flex flex-col gap-3 grow">
                  <div className="h-5 w-3/4 bg-surface-muted animate-pulse rounded-md"></div>
                  <div className="h-4 w-1/2 bg-surface-muted animate-pulse rounded-md"></div>
                </div>
              </div>
            ))
          ) : error ? (
            <div className="col-span-full text-center py-10 bg-danger-soft rounded-2xl text-danger font-medium border border-danger/20">
              {error}
            </div>
          ) : listings.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-surface rounded-3xl border border-dashed border-line shadow-xs">
              <span className="text-5xl block mb-4 opacity-50">📭</span>
              <p className="text-foreground-subtle font-medium">Nessuna stanza disponibile al momento.</p>
            </div>
          ) : (
            listings.slice(0, 8).map(l => ( // Mostriamo al massimo 8 stanze nella home
              /* 🔴 FIX: Trasformato il div in un vero Link cliccabile, allineato allo stile di Search.jsx */
              <Link 
                to={`/dettagli/${l.id}`} 
                key={l.id} 
                className="w-full bg-surface rounded-3xl shadow-xs border border-line flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/20 cursor-pointer overflow-hidden group decoration-none"
              >
                <div className="h-48 flex items-center justify-center relative overflow-hidden bg-surface-muted">
                  {l.coverUrl
                    ? <img src={l.coverUrl} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    : <span className="text-sm font-bold text-foreground-subtle">📷 Nessuna foto</span>}
                  <div className="absolute bottom-4 right-4 bg-surface/95 backdrop-blur-md px-4 py-1.5 rounded-2xl shadow-xs">
                    <span className="font-extrabold text-lg text-primary">€{Number(l.price) || 0}</span><span className="text-[11px] text-foreground-subtle font-bold">/mese</span>
                  </div>
                </div>
                <div className="p-5 flex flex-col grow bg-surface relative z-10">
                  <h3 className="font-bold text-lg text-foreground leading-tight mb-2 truncate" title={l.title}>
                    {l.title}
                  </h3>
                  <p className="text-sm text-foreground-subtle font-medium truncate">
                    📍 {l.zone ? `${l.zone}, ${l.city}` : l.city}
                  </p>
                  {l.billsIncluded && <p className="text-xs text-success-soft-foreground font-bold mt-2">Spese incluse</p>}
                </div>
              </Link>
            ))
          )}
        </div>
        
        <div className="mt-8 md:hidden">
            <Link to="/ricerca" className="block text-center bg-surface border border-line text-foreground font-bold py-4 rounded-2xl hover:bg-background transition-colors shadow-xs">Vedi tutti gli annunci</Link>
        </div>
      </section>

    </div>
  );
}