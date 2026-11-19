import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Base-URL normalisieren: immer mit führendem und abschließendem Slash. */
function normalizeBase(raw: string | undefined): string {
  let b = (raw ?? '/').trim()
  if (!b.startsWith('/')) b = '/' + b
  if (!b.endsWith('/')) b += '/'
  return b
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Lokal "/", auf GitHub Pages "/<repo-name>/" (wird im Workflow gesetzt).
  const base = normalizeBase(env.VITE_BASE)

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: base,
          name: 'Habit Tracker',
          short_name: 'Habits',
          description: 'Privater Habit Tracker – offline nutzbar, geräteübergreifend synchronisiert.',
          lang: 'de',
          dir: 'ltr',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f4f5f7',
          theme_color: '#f4f5f7',
          categories: ['lifestyle', 'productivity', 'health'],
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
        },
      }),
    ],
    build: { target: 'es2022', sourcemap: false },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'widget/**/*.test.ts'],
    },
  }
})
