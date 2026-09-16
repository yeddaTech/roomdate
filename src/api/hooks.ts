// Hook per leggere e modificare i dati: le pagine usano questi, non le chiamate API dirette.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listConversations, startChat } from './chat';
import { createListing, deleteListing, getListing, listLatestListings, listMyListings } from './listings';
import { queryKeys } from './queryKeys';
import type { SessionUser } from './types';
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
      queryClient.invalidateQueries({ queryKey: queryKeys.roommates });
    },
  });
}

export function usePublicProfile(id: string) {
  return useQuery({ queryKey: queryKeys.publicProfile(id), queryFn: () => getPublicProfile(id) });
}

export function useRoommates({ enabled = true } = {}) {
  return useQuery({ queryKey: queryKeys.roommates, queryFn: listRoommates, enabled });
}

export function useLatestListings({ enabled = true } = {}) {
  return useQuery({ queryKey: queryKeys.latestListings, queryFn: listLatestListings, enabled });
}

export function useListing(id: string) {
  return useQuery({ queryKey: queryKeys.listing(id), queryFn: () => getListing(id) });
}

export function useMyListings({ enabled = true } = {}) {
  return useQuery({ queryKey: queryKeys.myListings, queryFn: listMyListings, enabled });
}

export function useCreateListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createListing,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.listings }),
  });
}

export function useDeleteListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteListing,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.listings }),
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
