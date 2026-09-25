// Chiavi della cache di TanStack Query, in un unico posto per evitare errori di battitura.
export const queryKeys = {
  session: ['session'] as const,
  myProfile: ['me'] as const,
  sessions: ['me', 'sessions'] as const,
  blocks: ['me', 'blocks'] as const,
  adminReports: (status: string) => ['admin', 'reports', status] as const,
  publicProfile: (id: string) => ['users', id] as const,
  roommates: ['roommates'] as const,
  roommatesList: (city: string) => ['roommates', 'list', city] as const,
  listings: ['listings'] as const,
  latestListings: ['listings', 'latest'] as const,
  listingsSearch: (filters: string) => ['listings', 'search', filters] as const,
  listing: (id: string) => ['listings', 'detail', id] as const,
  myListings: ['listings', 'mine'] as const,
  conversations: ['conversations'] as const,
  // Sotto "conversations": ogni aggiornamento delle conversazioni aggiorna anche il badge
  unread: ['conversations', 'unread'] as const,
  messages: (conversationId: number) => ['conversations', conversationId, 'messages'] as const,
};
