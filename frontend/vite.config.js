import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Catch any request starting with "/api"
      '/api': {
        target: 'http://127.0.0.1:5000', // Forward to Flask Backend
        changeOrigin: true,
        secure: false,
        // Remove "/api" from the URL before sending to Flask
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})