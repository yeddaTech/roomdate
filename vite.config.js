import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// src/boot.ts è un ingresso a parte, minuscolo, caricato con async prima dell'app: si esegue appena
// arriva e chiede i dati della pagina mentre l'app si scarica ancora (src/api/early.ts). Vite unirebbe
// in un solo file tutti gli script di index.html, quindi il tag lo aggiunge questo plugin, con il
// nome del file generato dalla build.
function boot() {
  return {
    name: 'roomdate-boot',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        let src = '/src/boot.ts'
        if (ctx.bundle) {
          const chunk = Object.values(ctx.bundle).find((c) => c.type === 'chunk' && c.isEntry && c.name === 'boot')
          if (!chunk) throw new Error('boot: ingresso src/boot.ts mancante nella build')
          src = `/${chunk.fileName}`
        }
        return [{ tag: 'script', attrs: { type: 'module', async: true, crossorigin: true, src }, injectTo: 'head' }]
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), boot()],
  build: {
    rollupOptions: {
      input: { index: 'index.html', boot: 'src/boot.ts' },
    },
  },
  server: {
    host: '127.0.0.1', // Forza IPv4 invece di localhost
    port: 5173,
    // Inoltra le API al server Go locale (npm run dev:api): stessa origine, come su Vercel.
    // changeOrigin: false mantiene l'header Host del browser, usato dalla protezione cross-origin del server.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8080', changeOrigin: false },
      // La mappa del sito la genera il server Go (su Vercel con una rewrite in vercel.json)
      '/sitemap.xml': { target: 'http://127.0.0.1:8080', changeOrigin: false },
    },
    hmr: {
      overlay: false, // Disattiva la schermata di errore che corrompe il contenuto
    },
  },
})
