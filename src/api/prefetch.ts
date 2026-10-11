import type { QueryClient } from '@tanstack/react-query';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { listingFilters, readSearch } from '../components/search/searchUrl';
import { preloadFirstCard, preloadGallery } from './early';
import { listingQuery, listingsSearchQuery, publicProfileQuery, roommatesQuery } from './hooks';

/**
 * Caricamento anticipato delle pagine pubbliche (modulo M2.8). Il loader della rotta parte appena si
 * conosce l'indirizzo, insieme al codice della pagina: la richiesta all'API non aspetta più che la
 * pagina sia scaricata. Il loader non attende la risposta (la pagina si apre subito e trova la
 * richiesta in corso: con la stessa chiave TanStack Query non la ripete) e, quando arrivano i dati,
 * fa partire la foto principale, che è l'elemento più grande della pagina (LCP). Alla prima pagina
 * aperta i dati di solito sono già stati chiesti da src/boot.ts.
 */
export function routeLoaders(queryClient: QueryClient) {
  return {
    search: ({ request }: LoaderFunctionArgs) => {
      const search = readSearch(new URL(request.url).searchParams);
      if (search.intent === 'coinquilino') {
        queryClient.prefetchInfiniteQuery(roommatesQuery(search.city, search.budget));
        return null;
      }
      queryClient.fetchInfiniteQuery(listingsSearchQuery(listingFilters(search)))
        .then((data) => { if (data.pages[0]) preloadFirstCard(data.pages[0]); })
        .catch(() => {
          // La pagina mostra l'errore e permette di riprovare
        });
      return null;
    },
    listing: ({ params }: LoaderFunctionArgs) => {
      queryClient.fetchQuery(listingQuery(params.id ?? '')).then(preloadGallery).catch(() => {});
      return null;
    },
    profile: ({ params }: LoaderFunctionArgs) => {
      queryClient.prefetchQuery(publicProfileQuery(params.id ?? ''));
      return null;
    },
  };
}
