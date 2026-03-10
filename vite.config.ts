import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallback: '/index.html',
      },
      manifest: {
        name: 'malambi',
        short_name: 'malambi',
        description: 'malambi — Fiches d\'installation et d\'intervention GPS pour techniciens',
        start_url: '/',
        display: 'standalone',
        background_color: '#020617',
        theme_color: '#0f172a',
      },
    }),
  ],
})

