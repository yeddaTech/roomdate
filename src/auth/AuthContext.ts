import { createContext, useContext } from 'react';
import type { SessionUser } from '../api/types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error';

export interface AuthContextValue {
  user: SessionUser | null;
  status: AuthStatus;
  /**
   * Pagina da cui l'utente è appena uscito volontariamente (logout o account eliminato), o null.
   * Quella pagina, se protetta, rimanda alla home invece che all'accesso.
   */
  signedOutFrom: string | null;
  /** Accede e prepara le chiavi E2EE. keysUnlocked è false se la chiave privata non si è aperta. */
  login(email: string, password: string): Promise<{ keysUnlocked: boolean }>;
  /** Chiude la sessione sul server e pulisce i dati locali. */
  logout(): Promise<void>;
  /**
   * Pulisce i dati locali senza chiamare il server, quando la sessione è già chiusa sul server:
   * reason "signed_out" dopo l'eliminazione dell'account, "expired" se la sessione è scaduta.
   */
  endLocalSession(reason: 'signed_out' | 'expired'): void;
  /** Riprova a verificare la sessione dopo un errore di rete. */
  retry(): void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth va usato dentro <AuthProvider>');
  return value;
}
