import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError, isSessionExpired } from './client';
import { queryKeys } from './queryKeys';

export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error) => handleSessionExpiry(client, error) }),
    mutationCache: new MutationCache({ onError: (error) => handleSessionExpiry(client, error) }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => failureCount < 2 && isTemporary(error),
      },
      mutations: { retry: false },
    },
  });
  return client;
}

// Si ritentano solo i problemi di rete e gli errori temporanei del server, non i 4xx.
function isTemporary(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
}

// Una sessione scaduta durante una chiamata riporta l'app allo stato "non autenticato":
// le pagine protette reindirizzano all'accesso.
function handleSessionExpiry(client: QueryClient, error: unknown): void {
  if (isSessionExpired(error)) {
    client.setQueryData(queryKeys.session, null);
  }
}
