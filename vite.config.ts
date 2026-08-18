import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(() => ({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Stable vendor chunks: framer-motion and Supabase change rarely, so
          // splitting them out lets browsers cache them across deploys and
          // keeps them OUT of every route's own chunk.
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion-dom') || id.includes('node_modules/motion-utils')) {
            return 'vendor-motion'
          }
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase'
          }
          return undefined
        },
      },
    },
  },
}))
