import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // APP 版(--mode native)不需要 PWA 的 service worker
    // APP 版把新版本提示換成空的替身
    mode === 'native' && {
      name: 'native-pwa-stub',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'virtual:pwa-register/react') return fileURLToPath(new URL('./src/lib/pwaRegisterStub.js', import.meta.url));
      },
    },
    mode !== 'native' && VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'YY手帳 Assistant',
        short_name: 'YY手帳',
        description: '記帳、行事曆、心情日誌的個人助理應用',
        theme_color: '#111827',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Runtime caching left minimal for MVP — expand once we know
        // which API responses are safe to cache offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Excel 套件很大,只在匯出/匯入時才下載,不放進離線快取
        // 首頁人物大圖不預先快取(12 張約 3MB),用到時才下載;縮圖仍預先快取
        globIgnores: ['**/exceljs*', 'home-images/yy-*.png'],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}))
