import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command }) => {
  // Keep PWA disabled to avoid service-worker cache/network interference during development.
  // It can be re-enabled later once runtime networking is fully stable.
  const enablePwa = false

  return {
    server: {
      proxy: {
        '/api': {
          target: 'http://149.102.148.201:5400',
          changeOrigin: true,
          secure: false,
        },
      },
    },
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

