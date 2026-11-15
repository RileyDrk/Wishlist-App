import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createApi } from './server/api.js'
import { createLocalStore } from './server/localStore.js'

const wishlistApi = () => ({
  name: 'wishlist-api',
  configureServer(server) {
    if (process.env.MONGODB_URI) server.middlewares.use(createApi())
    else {
      const local = createLocalStore()
      server.middlewares.use(createApi({ store: local.lists, accountStore: local.accounts, preview: true }))
    }
  },
  configurePreviewServer(server) { server.middlewares.use(createApi()) },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), wishlistApi()],
})
