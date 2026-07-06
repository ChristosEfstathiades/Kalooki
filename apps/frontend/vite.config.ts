import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    /*
     * SPA mode: auth tokens live in web storage, which a server render
     * can't read (docs/Frontend-design.md treats the frontend as a SPA).
     */
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
  ],
})

export default config
