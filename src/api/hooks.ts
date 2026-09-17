// Hook per leggere e modificare i dati: le pagine usano questi, non le chiamate API dirette.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listConversations, startChat } from './chat';
import {
  createListing,
  deleteListing,
  deleteListingImage,
  getListing,
  listLatestListings,
  listMyListings,
  setListingActive,
  updateListing,
  uploadListingPhoto,
} from './listings';
import { queryKeys } from './queryKeys';
import type { ListingInput, SessionUser } from './types';
import { getMyProfile, getPublicProfile, listRoommates, updateMyProfile } from './users';

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

export function usePublicProfile(id: string) {
  return useQuery({ queryKey: queryKeys.publicProfile(id), queryFn: () => getPublicProfile(id) });
}

/** Coinquilini a pagine: fetchNextPage carica i successivi finché hasNextPage è true. */
export function useRoommates({ city = '', enabled = true } = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.roommatesList(city),
    queryFn: ({ pageParam }) => listRoommates({ city, cursor: pageParam }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}

export function useLatestListings({ enabled = true } = {}) {
  return useQuery({ queryKey: queryKeys.latestListings, queryFn: listLatestListings, enabled });
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

/** Conversazioni dell'utente (la pagina Chat le carica per conto suo, con la decifratura). */
export function useConversations() {
  return useQuery({ queryKey: queryKeys.conversations, queryFn: listConversations });
}

export function useStartChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startChat,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.conversations }),
  });
}
