import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/tcgdex': {
        target: 'https://api.tcgdex.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tcgdex/, '/v2'),
      },
    },
  },
})
