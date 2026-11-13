import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync } from 'fs'

const tauriConf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf-8'))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(tauriConf.version),
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:9848',
    },
  },
  build: {
    outDir: '../core/static',
    emptyOutDir: true,
  },
})
