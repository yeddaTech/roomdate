import { isCity } from '../../api/options';
import type { ListingFilters, ListingSort, RoomType } from '../../api/types';
import type { Intent } from './SearchFilters';

// La ricerca come la descrive l'URL (/ricerca?citta=Milano&budget=500…): la leggono la pagina e il
// caricamento anticipato dei dati (src/api/prefetch.ts), che devono ottenere gli stessi filtri.

export const ROOM_TYPES = ['singola', 'doppia'];
export const SORTS: { value: ListingSort; label: string }[] = [
  { value: 'recenti', label: 'Più recenti' },
  { value: 'prezzo', label: 'Prezzo più basso' },
  { value: 'prezzo-desc', label: 'Prezzo più alto' },
];
const MAX_BUDGET = 20000;

/** Valore ammesso, oppure stringa vuota. */
function oneOf(value: string | null, allowed: string[]): string {
  return value && allowed.includes(value) ? value : '';
}

/** Budget come lo accetta il server: solo cifre, al massimo 20.000 €. */
export function budgetFromUrl(value: string | null): string {
  const digits = (value ?? '').replace(/\D/g, '').slice(0, 6);
  if (!digits || Number(digits) === 0) return '';
  return String(Math.min(Number(digits), MAX_BUDGET));
}

export interface SearchState {
  intent: Intent;
  city: string;
  budget: string;
  roomType: RoomType | '';
  bills: 'true' | 'false' | '';
  sort: ListingSort;
}

/**
 * L'URL è l'unica fonte dei filtri. Valori non ammessi (vecchi link, modifiche a mano) valgono come
 * "nessun filtro"; tipo, spese e ordinamento valgono solo per le stanze.
 */
export function readSearch(params: URLSearchParams): SearchState {
  const intent: Intent = params.get('intent') === 'coinquilino' ? 'coinquilino' : 'stanza';
  const rooms = intent === 'stanza';
  return {
    intent,
    city: isCity(params.get('citta') ?? '') ? params.get('citta') ?? '' : '',
    budget: budgetFromUrl(params.get('budget')),
    roomType: rooms ? oneOf(params.get('tipo'), ROOM_TYPES) as RoomType | '' : '',
    bills: rooms ? oneOf(params.get('spese'), ['true', 'false']) as 'true' | 'false' | '' : '',
    sort: (oneOf(params.get('ordina'), SORTS.map((s) => s.value)) || 'recenti') as ListingSort,
  };
}

/** I filtri degli annunci per l'API, sempre nello stesso ordine: sono anche la chiave della cache. */
export function listingFilters({ city, budget, roomType, bills, sort }: SearchState): ListingFilters {
  return { city, maxPrice: budget, roomType, billsIncluded: bills, sort };
}
