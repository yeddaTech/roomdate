import { request } from './client';
import type { CryptoKeys, KdfParams, RegisterInput, SessionUser, WrappedPrivateKey } from './types';

/**
 * Lunghezza minima della password, come la applica il server (linee guida NIST 800-63B:
 * conta la lunghezza, non i simboli obbligatori).
 */
export const MIN_PASSWORD_LENGTH = 10;

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

/** Parametri per ricavare le chiavi dalla password, da chiedere prima dell'accesso. */
export function prelogin(email: string): Promise<KdfParams> {
  return request<KdfParams>('/api/v1/auth/prelogin', { method: 'POST', body: { email } });
}

/**
 * Accesso. secret è la chiave d'accesso ricavata dalla password (o la password stessa per gli
 * account non ancora aggiornati): con il metodo nuovo la password non lascia mai il browser.
 */
export function login(email: string, secret: string): Promise<LoginResult> {
  return request<LoginResult>('/api/v1/auth/login', { method: 'POST', body: { email, password: secret } });
}

export interface UpgradeKdfInput {
  /** La password, con cui l'account vecchio è ancora registrato. */
  currentPassword: string;
  authKey: string;
  kdf: KdfParams;
  keys: WrappedPrivateKey | null;
}

/** Porta un account vecchio al metodo nuovo, subito dopo l'accesso. */
export function upgradeKdf(input: UpgradeKdfInput): Promise<void> {
  return request<void>('/api/v1/auth/kdf', { method: 'POST', body: input });
}

export function logout(): Promise<void> {
  return request<void>('/api/v1/auth/logout', { method: 'POST' });
}

export function register(input: RegisterInput): Promise<{ id: string }> {
  return request<{ id: string }>('/api/v1/auth/register', { method: 'POST', body: input });
}

export interface ChangePasswordInput {
  /** Chiave d'accesso ricavata dalla password attuale. */
  currentPassword: string;
  /** Chiave d'accesso ricavata dalla nuova password. */
  newPassword: string;
  /** Obbligatoria se l'account ha chiavi di cifratura. */
  keys: WrappedPrivateKey | null;
  kdf: KdfParams;
}

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return request<void>('/api/v1/auth/password', { method: 'POST', body: input });
}
