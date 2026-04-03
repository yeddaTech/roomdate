import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Importiamo le pagine
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Search from './pages/Search';
import Chatpage from './pages/Chatpage';
import ListingDetails from './pages/ListingDetails';
import Impostazioni from './pages/Impostazioni';
import RoommateDetails from './pages/RoommateDetails';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home Page */}
        <Route path="/" element={<Home />} />
        
        {/* Pagine di Autenticazione */}
        <Route path="/accedi" element={<Login />} />
        <Route path="/registrati" element={<Register />} />
        <Route path="/register" element={<Register />} />

        {/* Pagine dell'App */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ricerca" element={<Search />} />
        <Route path="/chat" element={<Chatpage />} />
        <Route path="/coinquilino/:id" element={<RoommateDetails />} />

        
        {/* --- ROTTA IMPOSTAZIONI AGGIUNTA QUI --- */}
        <Route path="/impostazioni" element={<Impostazioni />} />
        
        {/* ECCO LA ROTTA CORRETTA: deve essere "dettagli", come nel Link! */}
        <Route path="/dettagli/:id" element={<ListingDetails />} />

        {/* Rotta di emergenza (Catch-all): DEVE STARE SEMPRE IN FONDO ALLA LISTA */}
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;