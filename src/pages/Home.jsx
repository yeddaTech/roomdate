import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { useLatestListings } from '../api/hooks';

export default function Home() {
  const { data: listings = [], isPending: isLoading, isError } = useLatestListings();
  const error = isError ? "Impossibile caricare le stanze al momento." : null;

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-orange-200 flex flex-col">
      <Navbar />

      {/* HERO SECTION */}
      <section className="relative pt-32 md:pt-40 pb-20 px-6 overflow-hidden flex flex-col items-center justify-center min-h-[80vh]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-orange-400/20 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center mt-12 md:mt-0">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 border border-orange-100 text-orange-600 text-sm font-bold mb-8 shadow-xs">
             Trova casa a Milano e nel resto d'Italia
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-neutral-900 mb-6 leading-tight md:leading-none">
            Trova la tua stanza <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-500 to-rose-500">senza stress.</span>
          </h1>
          <p className="text-lg text-neutral-500 mb-10 max-w-xl mx-auto font-medium">
            Esplora annunci reali e chatta subito per trovare la tua sistemazione o il tuo prossimo coinquilino.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 w-full px-4 sm:px-0">
            <Link to="/ricerca?intent=stanza" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-neutral-900 text-white text-lg font-bold shadow-lg hover:bg-neutral-800 hover:scale-[1.02] transition-all text-center">
               Cerca Stanza
            </Link>
            <Link to="/ricerca?intent=coinquilino" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white text-neutral-900 text-lg font-bold border border-neutral-200 shadow-xs hover:bg-neutral-50 hover:scale-[1.02] transition-all text-center">
              Cerca Coinquilini
            </Link>
          </div>
        </div>
      </section>

      {/* STANZE */}
      <section className="py-16 px-6 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Le ultime stanze</h2>
          </div>
          <Link to="/ricerca" className="hidden md:block text-orange-500 font-bold hover:text-orange-600 transition-colors">Vedi tutte &rarr;</Link>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            /* 🚀 SKELETON LOADING */
            [1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-white rounded-3xl shadow-xs border border-neutral-100 flex flex-col h-full min-h-[300px]">
                <div className="h-48 w-full bg-neutral-100 animate-pulse rounded-t-3xl"></div>
                <div className="p-4 flex flex-col gap-3 grow">
                  <div className="h-5 w-3/4 bg-neutral-100 animate-pulse rounded-md"></div>
                  <div className="h-4 w-1/2 bg-neutral-100 animate-pulse rounded-md"></div>
                </div>
              </div>
            ))
          ) : error ? (
            <div className="col-span-full text-center py-10 bg-red-50 rounded-2xl text-red-600 font-medium border border-red-100">
              {error}
            </div>
          ) : listings.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-white rounded-3xl border border-dashed border-neutral-200 shadow-xs">
              <span className="text-5xl block mb-4 opacity-50">📭</span>
              <p className="text-neutral-500 font-medium">Nessuna stanza disponibile al momento.</p>
            </div>
          ) : (
            listings.slice(0, 8).map(l => ( // Mostriamo al massimo 8 stanze nella home
              /* 🔴 FIX: Trasformato il div in un vero Link cliccabile, allineato allo stile di Search.jsx */
              <Link 
                to={`/dettagli/${l.id}`} 
                key={l.id} 
                className="w-full bg-white rounded-3xl shadow-xs border border-neutral-100 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-orange-100 cursor-pointer overflow-hidden group decoration-none"
              >
                <div className="h-48 flex items-center justify-center relative overflow-hidden bg-neutral-100">
                  {l.coverUrl
                    ? <img src={l.coverUrl} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    : <span className="text-sm font-bold text-neutral-400">📷 Nessuna foto</span>}
                  <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-md px-4 py-1.5 rounded-2xl shadow-xs">
                    <span className="font-extrabold text-lg text-orange-500">€{Number(l.price) || 0}</span><span className="text-[11px] text-neutral-500 font-bold">/mese</span>
                  </div>
                </div>
                <div className="p-5 flex flex-col grow bg-white relative z-10">
                  <h3 className="font-bold text-lg text-neutral-900 leading-tight mb-2 truncate" title={l.title}>
                    {l.title}
                  </h3>
                  <p className="text-sm text-neutral-500 font-medium truncate">
                    📍 {l.zone ? `${l.zone}, ${l.city}` : l.city}
                  </p>
                  {l.billsIncluded && <p className="text-xs text-green-700 font-bold mt-2">Spese incluse</p>}
                </div>
              </Link>
            ))
          )}
        </div>
        
        <div className="mt-8 md:hidden">
            <Link to="/ricerca" className="block text-center bg-white border border-neutral-200 text-neutral-900 font-bold py-4 rounded-2xl hover:bg-neutral-50 transition-colors shadow-xs">Vedi tutti gli annunci</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}