import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
// Font ospitati sul sito: la CSP li accetta e l'indirizzo IP di chi visita non arriva a Google
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/playfair-display'
import '@fontsource-variable/playfair-display/wght-italic.css'
import './index.css'
import { createQueryClient } from './api/queryClient'

// Cache condivisa dei dati letti dalle API
const queryClient = createQueryClient()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
