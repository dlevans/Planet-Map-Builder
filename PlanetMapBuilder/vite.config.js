import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    cors: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    rollupOptions: {
    output: {
    manualChunks(id) {
      if (id.includes('node_modules')) {
        if (id.includes('react')) {
          return 'vendor';
        }
      }
    },
  },
},
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
