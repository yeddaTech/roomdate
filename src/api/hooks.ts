// Hook per leggere e modificare i dati: le pagine usano questi, non le chiamate API dirette.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listConversations, listMessages, markConversationRead, sendMessage, startChat } from './chat';
import {
  createListing,
  deleteListing,
  deleteListingImage,
  getListing,
  listListings,
  listMyListings,
  setListingActive,
  updateListing,
  uploadListingPhoto,
} from './listings';
import { queryKeys } from './queryKeys';
import type { OutgoingMessage } from './chat';
import type { ListingFilters, ListingInput, SessionUser } from './types';
import { getMyProfile, getPublicProfile, listRoommates, listSessions, revokeOtherSessions, revokeSession, updateMyProfile } from './users';

export function useMyProfile() {
  return useQuery({ queryKey: queryKeys.myProfile, queryFn: getMyProfile });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.myProfile, profile);
      // Nome e ruolo fanno parte anche della sessione (es. per le tab della dashboard)
      queryClient.setQueryData<SessionUser | null>(queryKeys.session, (current) =>
        current
          ? { ...current, firstName: profile.firstName, lastName: profile.lastName, userType: profile.userType }
          : current,
      );
      // Elenco e profili pubblici mostrano cosa si ha in comune, che dipende dal proprio profilo
      queryClient.invalidateQueries({ queryKey: queryKeys.roommates });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

/** Dispositivi collegati all'account. */
export function useSessions() {
  return useQuery({ queryKey: queryKeys.sessions, queryFn: listSessions });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
  });
}

export function usePublicProfile(id: string) {
  return useQuery({ queryKey: queryKeys.publicProfile(id), queryFn: () => getPublicProfile(id) });
}

/** Coinquilini a pagine: fetchNextPage carica i successivi finché hasNextPage è true. */
export function useRoommates({ city = '', minBudget = '', enabled = true } = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.roommatesList(`${city}|${minBudget}`),
    queryFn: ({ pageParam }) => listRoommates({ city, minBudget, cursor: pageParam }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}

/** Gli annunci più recenti per la home (una pagina sola). */
export function useLatestListings({ limit = 8 } = {}) {
  return useQuery({
    queryKey: queryKeys.latestListings,
    queryFn: () => listListings({}, { limit: String(limit) }),
    select: (page) => page.items,
  });
}

/** Annunci a pagine, filtrati e ordinati dal server. */
export function useListings(filters: ListingFilters, { enabled = true } = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.listingsSearch(JSON.stringify(filters)),
    queryFn: ({ pageParam }) => listListings(filters, { cursor: pageParam }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}

export function useListing(id: string | number, { enabled = true } = {}) {
  return useQuery({ queryKey: queryKeys.listing(String(id)), queryFn: () => getListing(id), enabled });
}

export function useMyListings({ enabled = true } = {}) {
  return useQuery({ queryKey: queryKeys.myListings, queryFn: listMyListings, enabled });
}

// Ogni modifica a un annuncio aggiorna elenchi e dettagli (hanno tutti la chiave "listings")
function useInvalidateListings() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.listings });
}

export function useCreateListing() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateListings();
  return useMutation({
    mutationFn: createListing,
    onSuccess: (listing) => {
      queryClient.setQueryData(queryKeys.listing(String(listing.id)), listing);
      invalidate();
    },
  });
}

export function useUpdateListing() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateListings();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ListingInput }) => updateListing(id, input),
    onSuccess: (listing) => {
      queryClient.setQueryData(queryKeys.listing(String(listing.id)), listing);
      invalidate();
    },
  });
}

export function useSetListingActive() {
  const invalidate = useInvalidateListings();
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => setListingActive(id, active),
    onSuccess: invalidate,
  });
}

export function useDeleteListing() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateListings();
  return useMutation({
    mutationFn: deleteListing,
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.listing(String(id)) });
      invalidate();
      // Le chat sull'annuncio restano, ma non ne mostrano più il titolo
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}

export function useUploadListingPhoto() {
  const invalidate = useInvalidateListings();
  return useMutation({
    mutationFn: ({ listingId, file }: { listingId: number; file: File }) => uploadListingPhoto(listingId, file),
    onSettled: invalidate,
  });
}

export function useDeleteListingImage() {
  const invalidate = useInvalidateListings();
  return useMutation({
    mutationFn: ({ listingId, imageId }: { listingId: number; imageId: number }) => deleteListingImage(listingId, imageId),
    onSuccess: invalidate,
  });
}

/**
 * Conversazioni a pagine, con ultimo messaggio e non letti. I testi restano cifrati:
 * li apre la pagina Chat con la chiave dell'utente.
 */
export function useConversations({ enabled = true } = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.conversations,
    queryFn: ({ pageParam }) => listConversations({ cursor: pageParam }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}

/** Messaggi di una conversazione, dal più recente: fetchNextPage carica quelli più vecchi. */
export function useMessages(conversationId: number | null) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages(conversationId ?? 0),
    queryFn: ({ pageParam }) => listMessages(conversationId as number, { cursor: pageParam }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: conversationId !== null,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, message }: { conversationId: number; message: OutgoingMessage }) =>
      sendMessage(conversationId, message),
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(conversationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}

/** Segna letta la conversazione aperta, così il contatore dei non letti torna a zero. */
export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markConversationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.conversations }),
  });
}

export function useStartChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startChat,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.conversations }),
  });
}
