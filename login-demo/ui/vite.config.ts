import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 只保留构建所需插件（原 .figma 插件依赖 .figma/make/site.json，本项目不需要）
// 产物由 login-demo/server.js 在 /ui 下提供；dev 时 /api 代理到 18787
export default defineConfig({
  base: '/ui/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  server: {
    host: '127.0.0.1',
    port: 18790,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:18787', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
})
