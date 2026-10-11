import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { SearchX, SlidersHorizontal, X } from 'lucide-react';
import { useListings, useRoommates, useStartChat } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';
import type { AuthLocationState } from '../auth/authLocation';
import ListingCard from '../components/listings/ListingCard';
import { useLeadImage } from '../components/listings/useLeadImage';
import PageMeta from '../components/PageMeta';
import RoommateCard from '../components/profile/RoommateCard';
import LoadMore from '../components/search/LoadMore';
import SearchFilters, { type FilterValues, type Intent } from '../components/search/SearchFilters';
import { SORTS, budgetFromUrl, listingFilters, readSearch } from '../components/search/searchUrl';
import Button from '../components/ui/Button';
import { cn, focusRing } from '../components/ui/cn';
import EmptyState from '../components/ui/EmptyState';
import { useLazyComponent } from '../components/ui/useLazyComponent';
import { Select } from '../components/ui/Field';
import Skeleton from '../components/ui/Skeleton';

const importFiltersSheet = () => import('../components/search/FiltersSheet');

/** Parametri dell'URL per ciascun filtro. */
const PARAM: Record<keyof FilterValues | 'budget', string> = { city: 'citta', budget: 'budget', roomType: 'tipo', bills: 'spese' };

function SkeletonGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className="overflow-hidden rounded-card border border-line bg-surface">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Search() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { Component: FiltersSheet, load: loadFiltersSheet } = useLazyComponent(importFiltersSheet);
  const openFilters = () => {
    setFiltersOpen(true);
    loadFiltersSheet();
  };

  // L'URL è l'unica fonte dei filtri: le query seguono i parametri, non il contrario
  const search = readSearch(searchParams);
  const { intent, city, budget, roomType, bills, sort } = search;

  const setParams = (changes: Record<string, string>, { replace = false } = {}) => {
    const params = new URLSearchParams(searchParams);
    for (const [name, value] of Object.entries(changes)) {
      if (value) params.set(name, value);
      else params.delete(name);
    }
    // Cambiare un filtro aggiorna l'elenco sotto gli occhi: la pagina non deve saltare in cima
    setSearchParams(params, { replace, preventScrollReset: true });
  };
  const setFilters = (changes: Partial<FilterValues>) =>
    setParams(Object.fromEntries(Object.entries(changes).map(([key, value]) => [PARAM[key as keyof FilterValues], value ?? ''])));
  const resetFilters = () => {
    setBudgetInput('');
    setParams({ citta: '', budget: '', tipo: '', spese: '' });
  };

  // Il budget si digita: si aspetta la fine della digitazione e si sostituisce la voce nella cronologia,
  // così il tasto "indietro" non ripercorre ogni tasto premuto (anomalia F17).
  const [budgetInput, setBudgetInput] = useState(budget);
  useEffect(() => setBudgetInput(budget), [budget]);
  useEffect(() => {
    const cleaned = budgetFromUrl(budgetInput);
    if (cleaned === budget) return undefined;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (cleaned) params.set('budget', cleaned);
      else params.delete('budget');
      setSearchParams(params, { replace: true, preventScrollReset: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [budgetInput, budget, searchParams, setSearchParams]);

  // Si carica solo l'elenco della modalità attiva; i dati restano in cache passando da una all'altra.
  // Filtri, ordinamento e pagine li applica il server.
  const roommatesQuery = useRoommates({ city, minBudget: budget, enabled: intent === 'coinquilino' });
  const listingsQuery = useListings(listingFilters(search), { enabled: intent === 'stanza' });
  const query = intent === 'coinquilino' ? roommatesQuery : listingsQuery;
  const listings = listingsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const roommates = roommatesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const count = intent === 'stanza' ? listings.length : roommates.length;
  // La foto della prima stanza (in vista) arriva prima delle altre
  const lead = useLeadImage(listings[0]?.coverUrl);

  const startChat = useStartChat();
  const [contacting, setContacting] = useState<string | null>(null);
  const contact = async (targetId: string) => {
    if (!user) {
      toast.info('Accedi o registrati per scrivere a questa persona.');
      navigate('/accedi', { state: { from: location.pathname + location.search } satisfies AuthLocationState });
      return;
    }
    setContacting(targetId);
    try {
      const conversationId = await startChat.mutateAsync({ targetId });
      navigate(`/chat/${conversationId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Non è stato possibile aprire la chat.');
    } finally {
      setContacting(null);
    }
  };

  // Filtri attivi, anche come chip da togliere con un tocco (sul telefono la colonna non c'è)
  const active = [
    city && { key: 'citta', label: city },
    budget && { key: 'budget', label: intent === 'stanza' ? `Fino a ${budget} €` : `Budget da ${budget} €` },
    roomType && { key: 'tipo', label: roomType === 'singola' ? 'Singola' : 'Doppia' },
    bills && { key: 'spese', label: bills === 'true' ? 'Spese incluse' : 'Spese escluse' },
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip));

  const title = intent === 'stanza' ? 'Stanze in affitto' : 'Coinquilini';
  const noun = intent === 'stanza' ? (count === 1 ? 'stanza' : 'stanze') : (count === 1 ? 'profilo' : 'profili');
  const filters = (
    <SearchFilters
      intent={intent}
      values={{ city, roomType, bills }}
      budget={budgetInput}
      onBudgetChange={setBudgetInput}
      onChange={setFilters}
      onReset={resetFilters}
      hasFilters={active.length > 0}
    />
  );
  // Passando da stanze a coinquilini restano città e budget; tipo, spese e ordinamento valgono solo per le stanze
  const intentSearch = (value: Intent) => {
    const params = new URLSearchParams();
    if (value === 'coinquilino') params.set('intent', 'coinquilino');
    if (city) params.set('citta', city);
    if (budget) params.set('budget', budget);
    return `?${params}`;
  };
  const intentLink = (value: Intent, label: string) => (
    <Link
      to={{ search: intentSearch(value) }}
      aria-current={intent === value ? 'page' : undefined}
      className={cn(
        'rounded-full px-4 py-2 text-sm font-bold transition-colors duration-150',
        intent === value ? 'bg-surface text-foreground shadow-card' : 'text-foreground-muted hover:text-foreground',
        focusRing,
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10">
      {/* Le stanze si indicizzano (la città fa parte dell'indirizzo canonico, gli altri filtri no); i
          coinquilini sono persone: per riservatezza no */}
      <PageMeta
        title={`${title}${city ? ` a ${city}` : ''} | RoomDate`}
        description={intent === 'stanza'
          ? `Stanze in affitto${city ? ` a ${city}` : ''} con foto, prezzi e contatto diretto con chi affitta.`
          : 'Persone che cercano casa e coinquilini, con cosa avete in comune.'}
        noindex={intent === 'coinquilino'}
        canonical={city ? `/ricerca?${new URLSearchParams({ citta: city })}` : '/ricerca'}
      />

      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground md:text-5xl">{title}{city && <span className="text-foreground-muted"> a {city}</span>}</h1>
        </div>
        <nav aria-label="Cosa cerchi" className="flex self-start rounded-full bg-surface-muted p-1 md:self-auto">
          {intentLink('stanza', 'Stanze')}
          {intentLink('coinquilino', 'Coinquilini')}
        </nav>
      </div>

      <div className="lg:grid lg:grid-cols-[17rem_1fr] lg:gap-10">
        <aside aria-label="Filtri" className="hidden lg:block">
          <div className="sticky top-24">{filters}</div>
        </aside>

        <section aria-label="Risultati">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-foreground-muted" aria-live="polite">
              {query.isPending ? 'Ricerca in corso…' : query.isError && !query.data ? '' : `${count}${query.hasNextPage ? '+' : ''} ${noun}`}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="lg:hidden" onClick={openFilters} aria-haspopup="dialog">
                <SlidersHorizontal /> Filtri{active.length > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{active.length}</span>}
              </Button>
              {intent === 'stanza' && (
                <Select aria-label="Ordina" value={sort} onChange={(e) => setParams({ ordina: e.target.value === 'recenti' ? '' : e.target.value })} className="h-11 w-auto text-sm">
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              )}
            </div>
          </div>

          {active.length > 0 && (
            <ul className="mb-5 flex flex-wrap gap-2 lg:hidden" aria-label="Filtri attivi">
              {active.map((chip) => (
                <li key={chip.key}>
                  <button
                    type="button"
                    onClick={() => { if (chip.key === 'budget') setBudgetInput(''); setParams({ [chip.key]: '' }); }}
                    aria-label={`Togli il filtro ${chip.label}`}
                    className={cn('inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-muted pl-3 pr-2 text-sm font-bold text-foreground', focusRing)}
                  >
                    {chip.label} <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Solo se non c'è ancora niente: un errore sulla pagina successiva non cancella i risultati già a schermo */}
          {query.isError && !query.data ? (
            <EmptyState
              icon={<SearchX />}
              title="Impossibile caricare i risultati"
              description={query.error.message}
              action={<Button onClick={() => query.refetch()}>Riprova</Button>}
              className="rounded-card border border-danger/30 bg-surface"
            />
          ) : query.isPending ? (
            <SkeletonGrid />
          ) : count === 0 ? (
            <EmptyState
              icon={<SearchX />}
              headingLevel="h2"
              title={intent === 'stanza' ? 'Nessuna stanza con questi filtri' : 'Nessun profilo con questi filtri'}
              description="Prova con un'altra città o un budget diverso."
              action={active.length > 0 ? <Button variant="secondary" onClick={resetFilters}>Azzera i filtri</Button> : undefined}
              className="rounded-card border border-dashed border-line bg-surface"
            />
          ) : intent === 'stanza' ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((listing, i) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  eager={i === 0}
                  deferImage={i > 0 && lead.waiting}
                  onImageSettled={i === 0 ? lead.settle : undefined}
                  headingLevel="h2"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {roommates.map((roommate) => (
                <RoommateCard key={roommate.id} roommate={roommate} onContact={contact} contacting={contacting === roommate.id} />
              ))}
            </div>
          )}

          <LoadMore
            hasNextPage={Boolean(query.hasNextPage)}
            isFetchingNextPage={query.isFetchingNextPage}
            isError={query.isFetchNextPageError}
            fetchNextPage={query.fetchNextPage}
            label={intent === 'stanza' ? 'Carica altre stanze' : 'Carica altri profili'}
          />
        </section>
      </div>

      {/* Sul telefono i filtri stanno in un pannello dal basso: si applicano subito, sotto si vede quanti risultati ci sono */}
      {FiltersSheet && (
        <FiltersSheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          {filters}
          <Button size="lg" className="w-full" onClick={() => setFiltersOpen(false)}>
            {query.isPending ? 'Mostra i risultati' : `Mostra ${count}${query.hasNextPage ? '+' : ''} ${noun}`}
          </Button>
        </FiltersSheet>
      )}
    </div>
  );
}
