import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createApi } from './server/api.js'

const wishlistApi = () => ({
  name: 'wishlist-api',
  configureServer(server) { server.middlewares.use(createApi()) },
  configurePreviewServer(server) { server.middlewares.use(createApi()) },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), wishlistApi()],
})
