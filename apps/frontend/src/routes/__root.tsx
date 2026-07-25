import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'

import { themeInitScript } from '#/lib/theme'
import { apiBaseUrl } from '#/lib/api'
import { SITE_NAME, jsonLdScript, siteStructuredData } from '#/lib/seo'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

/*
 * Site-wide head tags. Everything here is a default: each route builds
 * its own title, description, canonical and social tags with `seo()`,
 * and a matching name/property on a child route wins over the root.
 */
export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: `Play Kalooki online free | ${SITE_NAME}`,
      },
      {
        name: 'description',
        content:
          'Play Kalooki online, the classic Rummy card game. Public matches against other players or private games with friends, in real time.',
      },
      {
        name: 'application-name',
        content: SITE_NAME,
      },
      {
        name: 'apple-mobile-web-app-title',
        content: SITE_NAME,
      },
      // The dark card room is the default theme (see styles.css)
      {
        name: 'theme-color',
        content: '#141616',
      },
      {
        name: 'color-scheme',
        content: 'dark light',
      },
      {
        property: 'og:site_name',
        content: SITE_NAME,
      },
      {
        property: 'og:locale',
        content: 'en_GB',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
        sizes: '48x48',
      },
      {
        rel: 'icon',
        type: 'image/png',
        href: '/icon-192.png',
        sizes: '192x192',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
        sizes: '180x180',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      /*
       * The first render fetches from the API immediately, so opening
       * the connection alongside the HTML saves a DNS + TLS round trip.
       * `crossOrigin` marks it anonymous to match the CORS fetches the
       * app makes; without it the warmed connection goes unused.
       */
      {
        rel: 'preconnect',
        href: apiBaseUrl,
        crossOrigin: '',
      },
      {
        rel: 'dns-prefetch',
        href: apiBaseUrl,
      },
    ],
    scripts: [
      {
        // Strips the default dark class before first paint for users
        // who opted into the light theme (see lib/theme.ts)
        children: themeInitScript,
      },
      // Names the site and its owner for search engines, so results can
      // carry the brand rather than whatever they infer from the page
      ...siteStructuredData().map(jsonLdScript),
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // The theme init script and settings toggle manage the dark class
    // outside React, so hydration must not "fix" it back
    <html lang="en-GB" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
