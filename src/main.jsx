import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
// 1. Importa il provider per la gestione dei meta tag
import { HelmetProvider } from 'react-helmet-async'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 2. Avvolgi l'app così il modulo è attivo ovunque */}
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>,
)