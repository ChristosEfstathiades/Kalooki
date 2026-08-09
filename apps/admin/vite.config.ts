import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * The admin app is a plain SPA served from admin.{domain}. It is kept
 * out of apps/frontend so no admin code ever ships in the player
 * bundle (Docs/Deployment.md).
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), viteReact()],
  server: { port: 3001 },
})
