import { useQuery, useQueryClient, type Query } from '@tanstack/react-query';
import { useCallback, useMemo, type ReactNode } from 'react';
import { getSession, login as apiLogin, logout as apiLogout } from '../api/auth';
import { queryKeys } from '../api/queryKeys';
import { AuthContext, type AuthContextValue, type AuthStatus } from './AuthContext';
import { clearLocalSession, storeKeysAtLogin } from './keyStorage';

// Tutte le query tranne quella della sessione: vanno scartate quando cambia l'utente
const notSession = (query: Query) => query.queryKey[0] !== queryKeys.session[0];

/**
 * Unica fonte dello stato di accesso: la sessione verificata dal server (GET /api/v1/auth/session).
 * Nessuna copia dell'utente in localStorage.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: queryKeys.session, queryFn: getSession, staleTime: Infinity });

  const endLocalSession = useCallback(() => {
    clearLocalSession();
    queryClient.removeQueries({ predicate: notSession });
    queryClient.setQueryData(queryKeys.session, null);
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiLogin(email, password);
      const keysUnlocked = await storeKeysAtLogin(result.keys, password);
      queryClient.removeQueries({ predicate: notSession });
      queryClient.setQueryData(queryKeys.session, result.user);
      return { keysUnlocked };
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // anche se il server non risponde, i dati locali vanno puliti
    }
    endLocalSession();
  }, [endLocalSession]);

  const { refetch } = session;
  const retry = useCallback(() => {
    refetch();
  }, [refetch]);

  const value = useMemo<AuthContextValue>(() => {
    let status: AuthStatus;
    if (session.isPending) status = 'loading';
    else if (session.isError) status = 'error';
    else status = session.data ? 'authenticated' : 'anonymous';

    return { user: session.data ?? null, status, login, logout, endLocalSession, retry };
  }, [session.isPending, session.isError, session.data, login, logout, endLocalSession, retry]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
