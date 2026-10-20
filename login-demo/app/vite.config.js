import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 产物由 login-demo/server.js 在 /app 下提供，所以 base 固定 /app/
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: {
    port: 18790,
    proxy: {
      // dev 时把 /api 转到现有后端
      '/api': { target: 'http://127.0.0.1:18787', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
})
