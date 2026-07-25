import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

import { securityHeaders } from './security-headers'
import { publicPages, sitemapPlugin } from './sitemap'

const DEFAULT_API_URL = 'http://localhost:3333'

/** Kept in step with the same fallback in src/lib/seo.ts. */
const DEFAULT_SITE_URL = 'https://kalookionline.com'

/**
 * The public pages, rendered to static HTML at build time.
 *
 * Prerendering is what makes the meta tags do any work: the app ships
 * as a SPA, so without it a crawler that does not run JavaScript gets
 * an empty shell carrying only the root route's head.
 */
const prerenderedPages = publicPages.map((page) => ({
  path: page.path,
  prerender: { enabled: true },
}))

const config = defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiBaseUrl = env.VITE_API_URL || DEFAULT_API_URL
  const siteUrl = env.VITE_SITE_URL || DEFAULT_SITE_URL

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
      tanstackStart({
        /*
         * The shell every non-prerendered route falls back to. Pages are
         * keyed by path when they are collected, so the default mask of
         * '/' would let the shell claim the home page and drop it from
         * both the prerender and the sitemap. It has to name a route
         * that returns 200, and /signin is the one page we want neither
         * prerendered nor indexed, so it costs us nothing. Only the root
         * route renders under the mask, so no signin markup ends up in
         * the shell.
         */
        spa: { enabled: true, maskPath: '/signin' },
        pages: prerenderedPages,
        // Only the pages listed above: following links off them pulls in
        // /signin and the signed-in pages, which must not be indexed
        prerender: { crawlLinks: false },
      }),
      sitemapPlugin(siteUrl),
      viteReact(),
    ],
  }
})

export default config
