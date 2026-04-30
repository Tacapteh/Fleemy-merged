import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function firebaseSwPlugin(): Plugin {
  const swContent = (env: Record<string, string>) => `importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "${env.VITE_FIREBASE_API_KEY || ''}",
  authDomain: "${env.VITE_FIREBASE_AUTH_DOMAIN || ''}",
  projectId: "${env.VITE_FIREBASE_PROJECT_ID || ''}",
  storageBucket: "${env.VITE_FIREBASE_STORAGE_BUCKET || ''}",
  messagingSenderId: "${env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''}",
  appId: "${env.VITE_FIREBASE_APP_ID || ''}",
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Fleemy'
  const body = payload.notification?.body || ''
  self.registration.showNotification(title, {
    body,
    icon: '/vite.svg',
    badge: '/vite.svg',
    data: payload.data,
  })
})
`

  return {
    name: 'firebase-messaging-sw',
    configureServer(server) {
      server.middlewares.use('/firebase-messaging-sw.js', (_req, res) => {
        const env = server.config.env as Record<string, string>
        res.setHeader('Content-Type', 'application/javascript')
        res.end(swContent(env))
      })
    },
    writeBundle(options) {
      const outDir = options.dir || 'dist'
      const env = process.env as Record<string, string>
      fs.writeFileSync(path.resolve(outDir, 'firebase-messaging-sw.js'), swContent(env))
    },
  }
}

export default defineConfig({
  plugins: [react(), firebaseSwPlugin()],
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-charts': ['recharts'],
          'vendor-motion': ['framer-motion'],
          'vendor-ui': ['lucide-react', 'date-fns'],
        },
      },
    },
  },
})
