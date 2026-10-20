import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 产物由 login-demo/server.js 直接托管，用相对路径更省心
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    // 开发模式下把 /api 转发到本地验证台
    proxy: {
      '/api': { target: 'http://127.0.0.1:18787', changeOrigin: true },
    },
  },
})
