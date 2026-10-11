import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { createAppRouter } from './App'
// Font ospitati sul sito: la CSP li accetta e l'indirizzo IP di chi visita non arriva a Google
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/playfair-display'
import '@fontsource-variable/playfair-display/wght-italic.css'
import './index.css'
import { createQueryClient } from './api/queryClient'
import { markAppStarted } from './api/early'
import { listenForInstallPrompt } from './pwa/installPrompt'
import { registerServiceWorker } from './pwa/registerServiceWorker'

// Prima del router: se src/boot.ts non è ancora partito, le richieste della pagina le fa l'app
markAppStarted()

// Cache condivisa dei dati letti dalle API; il router la riempie in anticipo per le pagine pubbliche
const queryClient = createQueryClient()
const router = createAppRouter(queryClient)

// App installabile e apribile senza rete (modulo M2.8)
listenForInstallPrompt()
registerServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
