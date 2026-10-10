import { lazy } from 'react';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';

import AccountLayout from './components/layout/AccountLayout';
import AppLayout from './components/layout/AppLayout';
import AuthLayout from './components/layout/AuthLayout';
import PublicLayout from './components/layout/PublicLayout';
import RootLayout from './components/layout/RootLayout';
import RouteError from './components/layout/RouteError';

// La home si carica subito; le altre pagine solo quando servono
import Home from './pages/Home';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const RecoverAccount = lazy(() => import('./pages/RecoverAccount'));
const Search = lazy(() => import('./pages/Search'));
const Chat = lazy(() => import('./pages/Chat'));
const ListingDetails = lazy(() => import('./pages/ListingDetails'));
const RoommateDetails = lazy(() => import('./pages/RoommateDetails'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Guide = lazy(() => import('./pages/Guide'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Moderation = lazy(() => import('./pages/Moderation'));
const Favorites = lazy(() => import('./pages/Favorites'));
const ProfilePage = lazy(() => import('./pages/account/ProfilePage'));
const MyListings = lazy(() => import('./pages/account/MyListings'));
const NewListing = lazy(() => import('./pages/account/NewListing'));
const EditListing = lazy(() => import('./pages/account/EditListing'));
const Settings = lazy(() => import('./pages/account/Settings'));
// Vetrina dei componenti del design system: solo in sviluppo, non finisce nel sito pubblicato
const DesignSystem = import.meta.env.DEV ? lazy(() => import('./pages/DesignSystem')) : null;

// Ogni gruppo di pagine ha il suo layout; il livello intermedio senza percorso raccoglie gli errori
// delle pagine, così il messaggio compare dentro il layout e la navigazione resta utilizzabile.
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      {
        // Pagine pubbliche e informative (anche Privacy e Termini: servono la stessa navigazione)
        element: <PublicLayout />,
        children: [{
          errorElement: <RouteError />,
          children: [
            { index: true, element: <Home /> },
            { path: 'ricerca', element: <Search /> },
            { path: 'dettagli/:id', element: <ListingDetails /> },
            { path: 'coinquilino/:id', element: <RoommateDetails /> },
            { path: 'guida', element: <Guide /> },
            { path: 'privacy', element: <Privacy /> },
            { path: 'termini', element: <Terms /> },
            ...(DesignSystem ? [{ path: 'design-system', element: <DesignSystem /> }] : []),
            { path: '*', element: <NotFound /> },
          ],
        }],
      },
      {
        // Area personale: serve una sessione (AppLayout rimanda all'accesso)
        element: <AppLayout />,
        children: [{
          errorElement: <RouteError />,
          children: [
            // Area personale: profilo, annunci, preferiti e impostazioni, ognuno con il suo indirizzo
            {
              element: <AccountLayout />,
              children: [
                { path: 'profilo', element: <ProfilePage /> },
                { path: 'annunci', element: <MyListings /> },
                { path: 'annunci/nuovo', element: <NewListing /> },
                { path: 'annunci/:id/modifica', element: <EditListing /> },
                { path: 'preferiti', element: <Favorites /> },
                { path: 'impostazioni', element: <Settings /> },
              ],
            },
            // Il vecchio indirizzo dell'area personale
            { path: 'dashboard', element: <Navigate to="/profilo" replace /> },
            // Ogni conversazione ha il suo indirizzo: /chat è l'elenco, /chat/7 la conversazione aperta
            { path: 'chat/:conversationId?', element: <Chat />, handle: { fullHeight: true } },
            { path: 'moderazione', element: <Moderation /> },
          ],
        }],
      },
      {
        element: <AuthLayout />,
        children: [{
          errorElement: <RouteError />,
          children: [
            { path: 'accedi', element: <Login />, handle: { authSwitch: { text: 'Non hai un account?', label: 'Registrati', to: '/registrati' } } },
            { path: 'registrati', element: <Register />, handle: { authSwitch: { text: 'Hai già un account?', label: 'Accedi', to: '/accedi' } } },
            { path: 'register', element: <Navigate to="/registrati" replace /> },
            { path: 'recupero', element: <RecoverAccount />, handle: { authSwitch: { text: 'Ricordi la password?', label: 'Accedi', to: '/accedi' } } },
          ],
        }],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
