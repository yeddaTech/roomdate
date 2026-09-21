import { request } from './client';
import type { Profile, ProfileInput, PublicProfile, RoommatesPage, UserSession } from './types';

export function getMyProfile(): Promise<Profile> {
  return request<Profile>('/api/v1/me');
}

export function updateMyProfile(input: ProfileInput): Promise<Profile> {
  return request<Profile>('/api/v1/me', { method: 'PUT', body: input });
}

/** L'eliminazione è definitiva: il server chiede di nuovo la password. */
export function deleteMyAccount(password: string): Promise<void> {
  return request<void>('/api/v1/me', { method: 'DELETE', body: { password } });
}

/** Dispositivi con l'accesso aperto. */
export async function listSessions(): Promise<UserSession[]> {
  const { items } = await request<{ items: UserSession[] }>('/api/v1/me/sessions');
  return items;
}

export function revokeSession(id: string): Promise<void> {
  return request<void>(`/api/v1/me/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Chiude gli accessi su tutti gli altri dispositivi e restituisce quanti ne ha chiusi. */
export async function revokeOtherSessions(): Promise<number> {
  const { closed } = await request<{ closed: number }>('/api/v1/me/sessions', { method: 'DELETE' });
  return closed;
}

export function getPublicProfile(id: string): Promise<PublicProfile> {
  return request<PublicProfile>(`/api/v1/users/${encodeURIComponent(id)}`);
}

/**
 * Una pagina dei coinquilini. I filtri vuoti non vengono inviati: city vuota significa tutte le città,
 * minBudget tiene solo chi può spendere almeno quella cifra.
 */
export function listRoommates(
  { city = '', minBudget = '', cursor = '' }: { city?: string; minBudget?: string; cursor?: string } = {},
): Promise<RoommatesPage> {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries({ city, minBudget, cursor })) {
    if (value) params.set(name, value);
  }
  const query = params.toString();
  return request<RoommatesPage>(`/api/v1/roommates${query ? `?${query}` : ''}`);
}

/** "25 anni", oppure null se l'età non è indicata. */
export function formatAge(age: number | null): string | null {
  return age === null ? null : `${age} anni`;
}

/** Età minima per usare RoomDate, la stessa che controlla il server. */
export const MIN_AGE = 18;

/** Data di nascita più recente ammessa (AAAA-MM-GG): chi compie 18 anni oggi. */
export function latestAdultBirthdate(today = new Date()): string {
  const year = today.getFullYear() - MIN_AGE;
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  // Il 29 febbraio di un anno non bisestile non esiste: chi è nato quel giorno compie gli anni il 1° marzo
  return month === '02' && day === '29' && new Date(year, 1, 29).getMonth() !== 1 ? `${year}-02-28` : `${year}-${month}-${day}`;
}
