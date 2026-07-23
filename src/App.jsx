import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Importa normalmente solo le pagine essenziali (es. la Home)
import Home from './pages/Home';

// Usa lazy per caricare le altre pagine solo quando servono
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Search = lazy(() => import('./pages/Search'));
const Chatpage = lazy(() => import('./pages/Chatpage'));
const ListingDetails = lazy(() => import('./pages/ListingDetails'));
const Impostazioni = lazy(() => import('./pages/Impostazioni'));
const RoommateDetails = lazy(() => import('./pages/RoommateDetails'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Guide = lazy(() => import('./pages/Guide'));

function App() {
  return (
    <BrowserRouter>
      {/* Suspense mostra un caricamento mentre React scarica il file JS della pagina */}
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Caricamento...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/accedi" element={<Login />} />
          <Route path="/registrati" element={<Register />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ricerca" element={<Search />} />
          <Route path="/chat" element={<Chatpage />} />
          <Route path="/coinquilino/:id" element={<RoommateDetails />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/guida" element={<Guide />} />
          <Route path="/impostazioni" element={<Impostazioni />} />
          <Route path="/dettagli/:id" element={<ListingDetails />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;