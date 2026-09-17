import { request } from './client';
import type { Profile, ProfileInput, PublicProfile, RoommatesPage } from './types';

export function getMyProfile(): Promise<Profile> {
  return request<Profile>('/api/v1/me');
}

export function updateMyProfile(input: ProfileInput): Promise<Profile> {
  return request<Profile>('/api/v1/me', { method: 'PUT', body: input });
}

export function deleteMyAccount(): Promise<void> {
  return request<void>('/api/v1/me', { method: 'DELETE' });
}

export function getPublicProfile(id: string): Promise<PublicProfile> {
  return request<PublicProfile>(`/api/v1/users/${encodeURIComponent(id)}`);
}

/** Una pagina dei coinquilini; city vuota significa tutte le città. */
export function listRoommates({ city = '', cursor = '' }: { city?: string; cursor?: string } = {}): Promise<RoommatesPage> {
  const params = new URLSearchParams();
  if (city) params.set('city', city);
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  return request<RoommatesPage>(`/api/v1/roommates${query ? `?${query}` : ''}`);
}

/** "25 anni", oppure null se l'età non è indicata. */
export function formatAge(age: number | null): string | null {
  return age === null ? null : `${age} anni`;
}
