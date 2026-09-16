import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
// 1. Importa il provider per la gestione dei meta tag
import { HelmetProvider } from 'react-helmet-async'
import { createQueryClient } from './api/queryClient'

// Cache condivisa dei dati letti dalle API
const queryClient = createQueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* 2. Avvolgi l'app così il modulo è attivo ovunque */}
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
