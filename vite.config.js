import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', // Forza IPv4 invece di localhost
    port: 5173,
    // Inoltra le API al server Go locale (npm run dev:api): stessa origine, come su Vercel.
    // changeOrigin: false mantiene l'header Host del browser, usato dalla protezione cross-origin del server.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8080', changeOrigin: false },
    },
    hmr: {
      overlay: false, // Disattiva la schermata di errore che corrompe il contenuto
    },
  },
})
