import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Target backend URL: use BACKEND_URL (set by docker-compose) or default to local 127.0.0.1:8000
const backendTarget = process.env.BACKEND_URL || process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
