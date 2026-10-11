import { ApiError, request } from './client';
import { listingPath, listingsPath } from './early';
import { prepareImage } from './photos';
import type { CityCount, ListingDetail, ListingFilters, ListingImage, ListingInput, ListingsPage, ListingSummary, PendingUpload } from './types';

export const MAX_LISTING_IMAGES = 8;

/** "Disponibile subito" o "Disponibile dal 1 ottobre 2026"; null se la data non è indicata. */
export function formatAvailability(availableFrom: string | null, today = new Date()): string | null {
  if (!availableFrom) return null;
  const [year, month, day] = availableFrom.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (date <= startOfToday) return 'Disponibile subito';
  return `Disponibile dal ${date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

/** "Spese incluse", "Spese escluse", oppure null se il dato non è indicato. */
export function formatBills(billsIncluded: boolean | null): string | null {
  if (billsIncluded === null) return null;
  return billsIncluded ? 'Spese incluse' : 'Spese escluse';
}

/**
 * Una pagina dell'elenco pubblico: il server applica filtri e ordinamento (anomalia F17).
 * I filtri vuoti non vengono inviati.
 */
export function listListings(filters: ListingFilters = {}, { cursor = '', limit = '' } = {}): Promise<ListingsPage> {
  return request<ListingsPage>(listingsPath(filters, { cursor, limit }));
}

/** Le città con annunci, dalla più ricca: le mostra la home. */
export async function listCities(): Promise<CityCount[]> {
  const { items } = await request<{ items: CityCount[] }>('/api/v1/listings/cities');
  return items;
}

/** Una pagina dei preferiti, dal salvato più di recente. */
export function listSavedListings({ cursor = '' } = {}): Promise<ListingsPage> {
  return request<ListingsPage>(`/api/v1/me/saved-listings${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
}

/** Salva o toglie un annuncio dai preferiti (entrambe le operazioni si possono ripetere). */
export function setListingSaved(id: number, saved: boolean): Promise<void> {
  return request<void>(`/api/v1/me/saved-listings/${id}`, { method: saved ? 'PUT' : 'DELETE' });
}

export function listMyListings(): Promise<ListingSummary[]> {
  return request<ListingSummary[]>('/api/v1/me/listings');
}

export function getListing(id: string | number): Promise<ListingDetail> {
  return request<ListingDetail>(listingPath(id));
}

/**
 * Pubblica un annuncio nuovo. Con draft resta una bozza che vede solo il proprietario: la
 * creazione guidata lo pubblica alla fine, dopo le foto.
 */
export function createListing(input: ListingInput, { draft = false } = {}): Promise<ListingDetail> {
  return request<ListingDetail>('/api/v1/listings', { method: 'POST', body: { ...input, draft } });
}

export function updateListing(id: number, input: ListingInput): Promise<ListingDetail> {
  return request<ListingDetail>(`/api/v1/listings/${id}`, { method: 'PUT', body: input });
}

export function setListingActive(id: number, active: boolean): Promise<void> {
  return request<void>(`/api/v1/listings/${id}/active`, { method: 'PUT', body: { active } });
}

export function deleteListing(id: number): Promise<void> {
  return request<void>(`/api/v1/listings/${id}`, { method: 'DELETE' });
}

/** Invia un file allo storage con l'indirizzo firmato dal server. */
async function put(url: string, headers: Record<string, string>, body: Blob): Promise<void> {
  let response: Response;
  try {
    // Nessun cookie verso lo storage: l'autorizzazione è nella firma dell'indirizzo
    response = await fetch(url, { method: 'PUT', headers, body, credentials: 'omit' });
  } catch {
    throw new ApiError(0, 'upload_failed', 'Caricamento della foto non riuscito: controlla la connessione.');
  }
  if (!response.ok) {
    throw new ApiError(response.status, 'upload_failed', 'Caricamento della foto non riuscito. Riprova.');
  }
}

/**
 * Carica una foto: la ridimensiona nel browser (togliendo anche i metadati, come la posizione GPS),
 * chiede al server gli indirizzi firmati, invia l'originale e le versioni ridotte direttamente
 * allo storage e chiede al server di aggiungere la foto all'annuncio dopo averla verificata. Una
 * versione ridotta che non arriva non blocca la foto: le pagine useranno l'originale.
 */
export async function uploadListingPhoto(listingId: number, file: File): Promise<ListingImage> {
  const image = await prepareImage(file);
  const pending = await request<PendingUpload>(`/api/v1/listings/${listingId}/images/uploads`, {
    method: 'POST',
    body: { contentType: image.main.type },
  });
  if (image.main.size > pending.maxBytes) {
    throw new ApiError(413, 'image_too_large', 'La foto è troppo grande anche dopo il ridimensionamento.');
  }

  const variants = image.variants.flatMap(({ width, blob }) => {
    const slot = pending.variants.find((v) => v.width === width);
    return slot && blob.size <= pending.maxBytes ? [put(slot.url, slot.headers, blob).catch(() => undefined)] : [];
  });
  await Promise.all([put(pending.url, pending.headers, image.main), ...variants]);

  return request<ListingImage>(`/api/v1/listings/${listingId}/images`, { method: 'POST', body: { key: pending.key } });
}

export function deleteListingImage(listingId: number, imageId: number): Promise<void> {
  return request<void>(`/api/v1/listings/${listingId}/images/${imageId}`, { method: 'DELETE' });
}
