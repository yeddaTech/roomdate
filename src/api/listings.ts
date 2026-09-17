import { ApiError, request } from './client';
import { prepareImage } from './photos';
import type { ListingDetail, ListingImage, ListingInput, ListingSummary, PendingUpload } from './types';

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

export function listLatestListings(): Promise<ListingSummary[]> {
  return request<ListingSummary[]>('/api/v1/listings');
}

export function listMyListings(): Promise<ListingSummary[]> {
  return request<ListingSummary[]>('/api/v1/me/listings');
}

export function getListing(id: string | number): Promise<ListingDetail> {
  return request<ListingDetail>(`/api/v1/listings/${encodeURIComponent(String(id))}`);
}

export function createListing(input: ListingInput): Promise<ListingDetail> {
  return request<ListingDetail>('/api/v1/listings', { method: 'POST', body: input });
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

/**
 * Carica una foto: la ridimensiona nel browser (togliendo anche i metadati, come la posizione GPS),
 * chiede al server un indirizzo firmato, invia il file direttamente allo storage e chiede al server
 * di aggiungerlo all'annuncio dopo averlo verificato.
 */
export async function uploadListingPhoto(listingId: number, file: File): Promise<ListingImage> {
  const image = await prepareImage(file);
  const pending = await request<PendingUpload>(`/api/v1/listings/${listingId}/images/uploads`, {
    method: 'POST',
    body: { contentType: image.type },
  });
  if (image.size > pending.maxBytes) {
    throw new ApiError(413, 'image_too_large', 'La foto è troppo grande anche dopo il ridimensionamento.');
  }

  let response: Response;
  try {
    // Nessun cookie verso lo storage: l'autorizzazione è nella firma dell'indirizzo
    response = await fetch(pending.url, { method: 'PUT', headers: pending.headers, body: image, credentials: 'omit' });
  } catch {
    throw new ApiError(0, 'upload_failed', 'Caricamento della foto non riuscito: controlla la connessione.');
  }
  if (!response.ok) {
    throw new ApiError(response.status, 'upload_failed', 'Caricamento della foto non riuscito. Riprova.');
  }

  return request<ListingImage>(`/api/v1/listings/${listingId}/images`, { method: 'POST', body: { key: pending.key } });
}

export function deleteListingImage(listingId: number, imageId: number): Promise<void> {
  return request<void>(`/api/v1/listings/${listingId}/images/${imageId}`, { method: 'DELETE' });
}
