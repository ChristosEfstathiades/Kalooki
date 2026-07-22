import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

import { securityHeaders } from './security-headers'

const DEFAULT_API_URL = 'http://localhost:3333'

const config = defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiBaseUrl = env.VITE_API_URL || DEFAULT_API_URL

  /*
   * Applied to builds only. The dev server's HMR channel, devtools and
   * on-the-fly module rewriting do not fit a policy this tight, and dev
   * is not the artefact the policy exists to protect (AUDIT.md S5).
   */
  const routeRules =
    command === 'build'
      ? { '/**': { headers: securityHeaders(apiBaseUrl) } }
      : undefined

  return {
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools(),
      nitro({ rollupConfig: { external: [/^@sentry\//] }, routeRules }),
      tailwindcss(),
      /*
       * SPA mode: auth tokens live in web storage, which a server render
       * can't read (docs/Frontend-design.md treats the frontend as a SPA).
       */
      tanstackStart({ spa: { enabled: true } }),
      viteReact(),
    ],
  }
})

export default config
