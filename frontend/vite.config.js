import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const clerkPublishableKey = String(
    env.VITE_CLERK_PUBLISHABLE_KEY || env.CLERK_PUBLISHABLE_KEY || '',
  ).trim()

  return {
    plugins: [react()],
    define: {
      __CLERK_PUBLISHABLE_KEY__: JSON.stringify(clerkPublishableKey),
    },
    server: {
      proxy: {
        '/api': 'http://localhost:3000',
      },
    },
  }
})
