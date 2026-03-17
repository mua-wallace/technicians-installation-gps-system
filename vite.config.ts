import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command }) => {
  // Note: `vite-plugin-pwa`/workbox SW generation currently errors on build in this repo.
  // We keep it enabled for dev, and skip it for production builds until it's resolved.
  const enablePwa = command === 'serve'

  return {
    plugins: [
      react(),
      ...(enablePwa
        ? [
            VitePWA({
              registerType: 'autoUpdate',
              workbox: {
                navigateFallback: '/index.html',
              },
              manifest: {
                name: 'malambi',
                short_name: 'malambi',
                description: "malambi — Fiches d'installation et d'intervention GPS pour techniciens",
                start_url: '/',
                display: 'standalone',
                background_color: '#020617',
                theme_color: '#0f172a',
              },
            }),
          ]
        : []),
    ],
  }
})

