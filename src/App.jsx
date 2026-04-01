import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Importiamo le pagine
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Search from './pages/Search';
import Search from './pages/Chatpage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home Page */}
        <Route path="/" element={<Home />} />
        
        {/* Pagina Accedi */}
        <Route path="/accedi" element={<Login />} />
        
        {/* Pagina Registrazione (gestiamo entrambi i nomi per sicurezza) */}
        <Route path="/registrati" element={<Register />} />
        <Route path="/register" element={<Register />} />

        {/* Rotta di emergenza: se l'utente scrive un URL a caso, torna alla Home */}
        <Route path="*" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ricerca" element={<Search />} />
        <Route path="/chat" element={<Chatpage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;