import { lazy } from 'react';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';

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
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Search = lazy(() => import('./pages/Search'));
const Chatpage = lazy(() => import('./pages/Chatpage'));
const ListingDetails = lazy(() => import('./pages/ListingDetails'));
const Impostazioni = lazy(() => import('./pages/Impostazioni'));
const RoommateDetails = lazy(() => import('./pages/RoommateDetails'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Guide = lazy(() => import('./pages/Guide'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Moderation = lazy(() => import('./pages/Moderation'));
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
            { path: 'dashboard', element: <Dashboard /> },
            { path: 'chat', element: <Chatpage />, handle: { fullHeight: true } },
            { path: 'impostazioni', element: <Impostazioni /> },
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
