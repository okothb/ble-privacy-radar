import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Configure the Progressive Web App integration layer
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.png', 'robots.txt', 'assets/icons/*.png', 'assets/alerts/*.mp3'],
      manifest: {
        short_name: 'PrivacyRadar',
        name: 'BLE Privacy Radar & Anomaly Engine',
        description: 'Counter-surveillance motion-correlated tracking anomaly engine for BLE emissions.',
        start_url: '/',
        display: 'standalone', // Transforms browser viewport into a standalone mobile window app
        orientation: 'any',
        background_color: '#0d1117',
        theme_color: '#ff3333', // Matches high-priority danger alarm states
        icons: [
          {
            src: 'assets/icons/icon-192.png',
            type: 'image/png',
            sizes: '192x192',
            purpose: 'any maskable' // Scales within privacy OS frameworks gracefully
          },
          {
            src: 'assets/icons/icon-512.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Enforces offline caching so the counter-surveillance app operates without a cell connection
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,mp3}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 Year cache safety window
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    host: true, // Exposes the server to the local network for testing on mobile devices
    strictPort: true,
    // Proxy configurations for WebSocket telemetry loop security
    proxy: {
      '/ws': {
        target: 'ws://localhost:8765',
        ws: true, // Mandatory flag to switch protocols cleanly from HTTP to WebSocket loops
        changeOrigin: true
      }
    }
  }
});