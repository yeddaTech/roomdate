// Richieste anticipate (modulo M2.8). Il codice dell'app è grande e su un telefono lento arriva dopo
// più di un secondo; solo allora partirebbe la richiesta dei dati, e solo dopo ancora la foto
// principale, l'elemento più grande della pagina (LCP). src/boot.ts è minuscolo e si esegue subito:
// chiede i dati della pagina d'ingresso e, appena arrivano, la sua foto, mentre l'app si scarica
// ancora. L'app poi usa la risposta già chiesta (takeEarly in client.ts) invece di ripeterla.
// Questo modulo finisce anche in boot: importa solo moduli piccoli e senza React.
import { CARD_SIZES, MOSAIC_QUERY, STRIP_SIZES, mosaicTile } from '../components/listings/photoSizes';
import { listingFilters, readSearch } from '../components/search/searchUrl';
import type { ListingDetail, ListingFilters, ListingsPage } from './types';

/** L'indirizzo di una pagina dell'elenco pubblico. I filtri vuoti non vengono inviati. */
export function listingsPath(filters: ListingFilters, { cursor = '', limit = '' } = {}): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries({ ...filters, cursor, limit })) {
    if (value) params.set(name, String(value));
  }
  const query = params.toString();
  return `/api/v1/listings${query ? `?${query}` : ''}`;
}

export function listingPath(id: string | number): string {
  return `/api/v1/listings/${encodeURIComponent(String(id))}`;
}

const preloaded = new Set<string>();

/**
 * Fa partire lo scaricamento di una foto prima che la pagina sia pronta. Con gli stessi srcset e
 * sizes dell'<img> il browser sceglie la stessa versione e poi la trova già scaricata; media limita
 * la richiesta alla forma della pagina che si vedrà.
 */
function preloadImage(url: string, srcset: string | null, sizes: string, media = '') {
  const key = `${url} ${media}`;
  if (preloaded.has(key)) return;
  preloaded.add(key);
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = url;
  if (srcset) {
    link.imageSrcset = srcset;
    link.imageSizes = sizes;
  }
  if (media) link.media = media;
  link.fetchPriority = 'high';
  document.head.append(link);
}

/** La foto della prima scheda dei risultati, quella in vista. */
export function preloadFirstCard(page: ListingsPage) {
  const first = page.items[0];
  if (first?.coverUrl) preloadImage(first.coverUrl, first.coverSrcset, CARD_SIZES);
}

/** La prima foto della galleria: striscia da bordo a bordo sul telefono, mosaico dal tablet (al massimo 5 foto). */
export function preloadGallery(listing: ListingDetail) {
  const first = listing.images[0];
  if (!first) return;
  preloadImage(first.url, first.srcset, STRIP_SIZES, `not all and ${MOSAIC_QUERY}`);
  preloadImage(first.url, first.srcset, mosaicTile(Math.min(listing.images.length, 5), 0).sizes, MOSAIC_QUERY);
}

// Una risposta anticipata vale solo per la prima richiesta dell'app, nei primi secondi
const EARLY_MAX_AGE = 10_000;
const early = new Map<string, { response: Promise<Response>; at: number }>();
let appStarted = false;

/**
 * L'app è partita (main.jsx): da qui le richieste le fa lei. Con i file già in cache l'app può
 * eseguirsi prima di boot, che allora non deve ripetere le sue richieste.
 */
export function markAppStarted() {
  appStarted = true;
}

/** La risposta già chiesta per questo indirizzo, se c'è (una volta sola). */
export function takeEarly(path: string): Promise<Response> | undefined {
  const entry = early.get(path);
  if (!entry) return undefined;
  early.delete(path);
  return Date.now() - entry.at < EARLY_MAX_AGE ? entry.response : undefined;
}

function startEarly<T>(path: string, onData: (data: T) => void) {
  const response = fetch(path, { credentials: 'include' });
  early.set(path, { response, at: Date.now() });
  // Una copia per la foto: il corpo originale lo legge l'app
  response
    .then((r) => (r.ok ? (r.clone().json() as Promise<T>) : null))
    .then((data) => { if (data) onData(data); })
    .catch(() => {
      // L'app ripete la richiesta e mostra l'eventuale errore
    });
}

/** Le richieste della pagina d'ingresso: il dettaglio di un annuncio o la ricerca delle stanze. */
export function startPageRequests({ pathname, search }: Location) {
  if (appStarted) return;
  const detail = /^\/dettagli\/(\d+)\/?$/.exec(pathname);
  if (detail) {
    startEarly(listingPath(detail[1]), preloadGallery);
    return;
  }
  if (/^\/ricerca\/?$/.test(pathname)) {
    const state = readSearch(new URLSearchParams(search));
    if (state.intent === 'stanza') startEarly(listingsPath(listingFilters(state)), preloadFirstCard);
  }
}
