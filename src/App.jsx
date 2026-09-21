import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import PageLoader from './components/PageLoader';

// Importa normalmente solo le pagine essenziali (es. la Home)
import Home from './pages/Home';

// Usa lazy e Suspense per caricare le altre pagine solo quando servono
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

function App() {
  return (
    <BrowserRouter>
      {/* La sessione viene verificata dal server una volta all'avvio (AuthProvider) */}
      <AuthProvider>
        {/* Aggiunto il tag <main> per definire il punto di riferimento principale */}
        <main className="flex flex-col min-h-screen">
          {/* Suspense mostra un caricamento mentre React scarica il file JS della pagina */}
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/accedi" element={<Login />} />
              <Route path="/registrati" element={<Register />} />
              <Route path="/register" element={<Register />} />
              <Route path="/recupero" element={<RecoverAccount />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/ricerca" element={<Search />} />
              <Route path="/chat" element={<ProtectedRoute><Chatpage /></ProtectedRoute>} />
              <Route path="/coinquilino/:id" element={<RoommateDetails />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/termini" element={<Terms />} />
              <Route path="/guida" element={<Guide />} />
              <Route path="/impostazioni" element={<ProtectedRoute><Impostazioni /></ProtectedRoute>} />
              <Route path="/moderazione" element={<ProtectedRoute><Moderation /></ProtectedRoute>} />
              <Route path="/dettagli/:id" element={<ListingDetails />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          {/* Nessun banner cookie: l'app usa solo cookie e memoria locale tecnici (sessione e chiavi della chat) */}
        </main>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
