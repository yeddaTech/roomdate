import { request } from './client';
import type { ListingDetail, ListingInput, ListingSummary, MyListing } from './types';

// --- API legacy (diventano /api/v1 nel modulo M1.4) ---

interface LegacyListing {
  id: number;
  title: string;
  city: string;
  zone: string;
  price: number;
  color: string;
  emoji: string;
  tags: string[] | null;
}

export async function listLatestListings(): Promise<ListingSummary[]> {
  const rows = await request<LegacyListing[] | null>('/api/get_listings');
  return (rows ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    city: l.city,
    zone: l.zone,
    price: l.price,
    color: l.color,
    emoji: l.emoji,
    tags: l.tags ?? [],
  }));
}

interface LegacyListingDetail extends Omit<ListingDetail, 'roomType' | 'features' | 'images'> {
  type: string;
  // Non ancora restituiti dal server (modulo M1.4)
  features?: string[] | null;
  images?: string[] | null;
}

export async function getListing(id: string): Promise<ListingDetail> {
  const l = await request<LegacyListingDetail>(`/api/get_listing?id=${encodeURIComponent(id)}`);
  return {
    id: l.id,
    title: l.title,
    city: l.city,
    zone: l.zone,
    price: l.price,
    roomType: l.type,
    description: l.description,
    features: l.features ?? [],
    images: l.images ?? [],
    landlord: l.landlord,
  };
}

export async function listMyListings(): Promise<MyListing[]> {
  return (await request<MyListing[] | null>('/api/get_my_listings')) ?? [];
}

export async function createListing(input: ListingInput): Promise<void> {
  await request<unknown>('/api/create_listing', { method: 'POST', body: input });
}

export async function deleteListing(id: number): Promise<void> {
  await request<unknown>(`/api/delete_listing?id=${id}`, { method: 'DELETE' });
}
