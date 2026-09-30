import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarCheck, LockKeyhole, MapPin, Search } from 'lucide-react';
import { useLatestListings, useListingCities } from '../api/hooks';
import { CITIES } from '../api/options';
import ListingCard from '../components/listings/ListingCard';
import Button from '../components/ui/Button';
import { buttonClasses } from '../components/ui/buttonClasses';
import { cn, focusRing } from '../components/ui/cn';
import EmptyState from '../components/ui/EmptyState';
import { Select } from '../components/ui/Field';
import Skeleton from '../components/ui/Skeleton';

const steps = [
  { icon: <Search />, title: 'Cerca', text: 'Filtra le stanze per città, prezzo e spese, o cerca chi vuole dividere casa.' },
  { icon: <LockKeyhole />, title: 'Scrivi in chat', text: 'Contatti direttamente chi affitta o cerca casa. I messaggi sono cifrati end-to-end.' },
  { icon: <CalendarCheck />, title: 'Organizza la visita', text: "Vi accordate in chat. Nessun pagamento passa da RoomDate: non inviare denaro prima di aver visto la stanza." },
];

export default function Home() {
  const navigate = useNavigate();
  const [city, setCity] = useState('');
  const latest = useLatestListings();
  const cities = useListingCities();

  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate(city ? `/ricerca?citta=${encodeURIComponent(city)}` : '/ricerca');
  };

  return (
    <div className="flex flex-col">
      {/* In apertura: che cos'è e dove cercare */}
      <section className="relative overflow-hidden px-4 pb-16 pt-14 md:px-6 md:pb-24 md:pt-24">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-orange-400/20 blur-[100px]" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
          <h1 className="font-display text-5xl font-bold leading-tight text-foreground md:text-7xl md:leading-none">
            Trova la tua stanza <span className="bg-brand bg-clip-text text-transparent">senza stress.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-foreground-muted">
            Annunci di stanze e persone che cercano casa, con contatto diretto e chat cifrata.
          </p>
          <form onSubmit={search} role="search" className="mt-10 flex w-full max-w-xl flex-col gap-3 rounded-card border border-line bg-surface p-3 shadow-overlay sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Città</span>
              <MapPin className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-foreground-muted" aria-hidden="true" />
              <Select value={city} onChange={(e) => setCity(e.target.value)} className="border-transparent bg-transparent pl-12 shadow-none">
                <option value="">Tutte le città</option>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </label>
            <Button type="submit" size="lg"><Search /> Cerca stanze</Button>
          </form>
          <Link to="/ricerca?intent=coinquilino" className={cn('mt-5 inline-flex items-center gap-1.5 rounded-sm text-sm font-bold text-primary hover:text-primary-hover', focusRing)}>
            Cerchi qualcuno con cui dividere casa? <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Le città con annunci veri, dalla più ricca */}
      {cities.data && cities.data.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-6 md:px-6" aria-labelledby="citta">
          <h2 id="citta" className="mb-4 text-xl font-bold text-foreground">Dove ci sono stanze</h2>
          <ul className="flex flex-wrap gap-2">
            {cities.data.map(({ city: name, count }) => (
              <li key={name}>
                <Link
                  to={`/ricerca?citta=${encodeURIComponent(name)}`}
                  className={cn('inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-bold text-foreground shadow-card hover:border-control', focusRing)}
                >
                  {name}
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-foreground-muted">
                    {count} {count === 1 ? 'stanza' : 'stanze'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6" aria-labelledby="ultime">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="ultime" className="font-display text-3xl font-bold text-foreground">Le ultime stanze</h2>
          <Link to="/ricerca" className={cn('hidden items-center gap-1.5 rounded-sm font-bold text-primary hover:text-primary-hover sm:inline-flex', focusRing)}>
            Vedi tutte <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        {latest.isPending ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => <Skeleton key={n} className="aspect-[4/5] rounded-card" />)}
          </div>
        ) : latest.isError ? (
          <EmptyState title="Impossibile caricare le stanze" description="Controlla la connessione e riprova." action={<Button onClick={() => latest.refetch()}>Riprova</Button>} className="rounded-card border border-line bg-surface" />
        ) : latest.data.length === 0 ? (
          <EmptyState title="Ancora nessuna stanza pubblicata" description="Hai una stanza libera? Pubblicala dal tuo profilo." className="rounded-card border border-dashed border-line bg-surface" />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {latest.data.map((listing, i) => <ListingCard key={listing.id} listing={listing} eager={i < 4} />)}
          </div>
        )}
        <Link to="/ricerca" className={buttonClasses({ variant: 'secondary', size: 'lg', className: 'mt-6 w-full sm:hidden' })}>
          Vedi tutti gli annunci
        </Link>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 md:px-6" aria-labelledby="come">
        <h2 id="come" className="mb-6 font-display text-3xl font-bold text-foreground">Come funziona</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6 shadow-card">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground [&_svg]:size-5" aria-hidden="true">{step.icon}</span>
              <h3 className="font-bold text-foreground"><span className="text-foreground-muted">{i + 1}.</span> {step.title}</h3>
              <p className="text-sm leading-relaxed text-foreground-muted">{step.text}</p>
            </li>
          ))}
        </ol>
        <Link to="/guida" className={cn('mt-6 inline-flex items-center gap-1.5 rounded-sm font-bold text-primary hover:text-primary-hover', focusRing)}>
          Leggi la guida completa <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
