// Chiavi della cache di TanStack Query, in un unico posto per evitare errori di battitura.
export const queryKeys = {
  session: ['session'] as const,
  myProfile: ['me'] as const,
  publicProfile: (id: string) => ['users', id] as const,
  roommates: ['roommates'] as const,
  listings: ['listings'] as const,
  latestListings: ['listings', 'latest'] as const,
  listing: (id: string) => ['listings', 'detail', id] as const,
  myListings: ['listings', 'mine'] as const,
  conversations: ['conversations'] as const,
};
