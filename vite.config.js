import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', // Forza IPv4 invece di localhost
    port: 5173,
    hmr: {
      overlay: false, // Disattiva la schermata di errore che corrompe il contenuto
    },
  },
})