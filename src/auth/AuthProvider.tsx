import { useQuery, useQueryClient, type Query } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
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
  const [signedOutFrom, setSignedOutFrom] = useState<string | null>(null);

  // Pagina mostrata in questo momento. Con <BrowserRouter> le navigazioni sono transizioni React:
  // un navigate('/') può essere ancora in corso quando la sessione si chiude.
  const { pathname } = useLocation();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
    // Lasciata la pagina da cui si è usciti, le pagine protette tornano a portare all'accesso
    setSignedOutFrom((from) => (from !== null && from !== pathname ? null : from));
  }, [pathname]);

  // La pagina da cui si esce si registra insieme alla sessione chiusa, nello stesso render:
  // così una pagina protetta rimanda alla home e non all'accesso, qualunque sia l'ordine
  // in cui React applica la navigazione.
  const endLocalSession = useCallback((reason: 'signed_out' | 'expired') => {
    clearLocalSession();
    queryClient.removeQueries({ predicate: notSession });
    setSignedOutFrom(reason === 'signed_out' ? pathnameRef.current : null);
    queryClient.setQueryData(queryKeys.session, null);
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiLogin(email, password);
      const keysUnlocked = await storeKeysAtLogin(result.keys, password);
      queryClient.removeQueries({ predicate: notSession });
      setSignedOutFrom(null);
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
    endLocalSession('signed_out');
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

    return { user: session.data ?? null, status, signedOutFrom, login, logout, endLocalSession, retry };
  }, [session.isPending, session.isError, session.data, signedOutFrom, login, logout, endLocalSession, retry]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
