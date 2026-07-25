import type { Plugin } from 'vite'

/**
 * The sitemap listing the site's public pages.
 *
 * TanStack Start can emit a sitemap of its own, but it does so after
 * Nitro has baked its manifest of public assets, so the file lands in
 * .output/public without the server knowing to serve it and every
 * request for /sitemap.xml 404s. Emitting it as a client build asset
 * instead puts it in place before Nitro takes stock.
 */

export interface PublicPage {
  /** Route path, which is also the canonical URL the route renders. */
  path: string
  /** Relative weight within the site, 0 to 1. */
  priority: number
  /** How often the content is expected to change. */
  changefreq: 'weekly' | 'monthly' | 'yearly'
}

/**
 * Pages a search engine should know about, in descending importance.
 *
 * Each one is also prerendered to static HTML at build time (see
 * vite.config.ts), which is what lets a crawler that does not run
 * JavaScript read the page and its meta tags. The signed-in pages are
 * left out deliberately: they redirect to signin without a token, so
 * there is nothing to render and nothing worth indexing.
 */
export const publicPages: Array<PublicPage> = [
  { path: '/', priority: 1, changefreq: 'weekly' },
  { path: '/rules', priority: 0.9, changefreq: 'monthly' },
  { path: '/tips', priority: 0.8, changefreq: 'monthly' },
  { path: '/signup', priority: 0.7, changefreq: 'monthly' },
  { path: '/contact', priority: 0.4, changefreq: 'yearly' },
  { path: '/privacy', priority: 0.3, changefreq: 'yearly' },
]

/** Escapes the five characters XML will not take literally. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Builds the absolute URL for a page, keeping the trailing slash on the
 * home page only so it matches the canonical the route renders.
 */
function pageUrl(siteUrl: string, path: string): string {
  const origin = siteUrl.replace(/\/+$/, '')
  return path === '/' ? `${origin}/` : `${origin}${path}`
}

/**
 * Renders the sitemap XML.
 *
 * @param siteUrl Absolute origin the site is served from.
 * @param lastmod Date to stamp every entry with, as YYYY-MM-DD.
 */
export function renderSitemap(
  siteUrl: string,
  lastmod: string,
  pages: Array<PublicPage> = publicPages,
): string {
  const urls = pages
    .map((page) =>
      [
        '  <url>',
        `    <loc>${escapeXml(pageUrl(siteUrl, page.path))}</loc>`,
        `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
        `    <changefreq>${page.changefreq}</changefreq>`,
        `    <priority>${page.priority}</priority>`,
        '  </url>',
      ].join('\n'),
    )
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n')
}

/**
 * Emits sitemap.xml into the client build output.
 *
 * @param siteUrl Absolute origin the site is served from.
 */
export function sitemapPlugin(siteUrl: string): Plugin {
  return {
    name: 'kalooki:sitemap',
    apply: 'build',
    generateBundle() {
      // The build runs for the client, ssr and nitro environments; only
      // the client one writes to the directory Nitro serves from
      if (this.environment.name !== 'client') {
        return
      }
      const lastmod = new Date().toISOString().slice(0, 10)
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: renderSitemap(siteUrl, lastmod),
      })
    },
  }
}
