import { request } from './client';
import type { Profile, ProfileInput, PublicProfile, Roommate, UserType } from './types';

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

// --- API legacy (diventano /api/v1 nel modulo M1.5) ---

interface LegacyRoommate {
  id: string;
  name: string;
  job: string;
  quote: string;
  age: number;
  city: string;
  match: number;
  color1: string;
  color2: string;
  emoji: string;
  tags: string[] | null;
  user_type: UserType;
  budget_max: number;
}

export async function listRoommates(): Promise<Roommate[]> {
  const rows = await request<LegacyRoommate[] | null>('/api/get_roommates');
  return (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    occupation: r.job,
    bio: r.quote,
    age: r.age,
    city: r.city,
    match: r.match,
    color1: r.color1,
    color2: r.color2,
    emoji: r.emoji,
    tags: r.tags ?? [],
    userType: r.user_type,
    budgetMax: r.budget_max,
  }));
}
