import { request } from './client';
import type { CryptoKeys, RegisterInput, SessionUser, WrappedPrivateKey } from './types';

/** Utente in sessione, o null se non c'è una sessione valida. */
export async function getSession(): Promise<SessionUser | null> {
  const { user } = await request<{ user: SessionUser | null }>('/api/v1/auth/session');
  return user;
}

export interface LoginResult {
  user: SessionUser;
  /** null per gli account senza chiavi di cifratura. */
  keys: CryptoKeys | null;
}

export function login(email: string, password: string): Promise<LoginResult> {
  return request<LoginResult>('/api/v1/auth/login', { method: 'POST', body: { email, password } });
}

export function logout(): Promise<void> {
  return request<void>('/api/v1/auth/logout', { method: 'POST' });
}

export function register(input: RegisterInput): Promise<{ id: string }> {
  return request<{ id: string }>('/api/v1/auth/register', { method: 'POST', body: input });
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  /** Obbligatoria se l'account ha chiavi di cifratura. */
  keys: WrappedPrivateKey | null;
}

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return request<void>('/api/v1/auth/password', { method: 'POST', body: input });
}
