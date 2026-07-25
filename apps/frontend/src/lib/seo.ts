import type {
  LinkHTMLAttributes,
  MetaHTMLAttributes,
  ScriptHTMLAttributes,
} from 'react'

/**
 * Site-wide SEO metadata.
 *
 * Every route builds its head tags through `seo()` so titles,
 * descriptions, canonical URLs, and the social previews all keep the
 * same shape. Pages behind the signin guard pass `noindex`: a crawler
 * only ever sees the redirect to signin, so an indexed /settings or
 * /game URL would be a dead result.
 */

export const SITE_NAME = 'KalookiOnline'

/** Appended to every page title, e.g. "How to play Kalooki | KalookiOnline". */
const TITLE_SUFFIX = ` | ${SITE_NAME}`

/**
 * Resolves the absolute origin the site is served from, used for
 * canonical URLs, Open Graph URLs, and the sitemap.
 *
 * Configurable per environment via VITE_SITE_URL. The fallback is
 * repeated in vite.config.ts, which needs the same value at build time
 * to stamp the sitemap host.
 */
function resolveSiteUrl(): string {
  const configured: unknown = import.meta.env.VITE_SITE_URL
  const resolved =
    typeof configured === 'string' && configured !== ''
      ? configured
      : 'https://kalookionline.com'
  return resolved.replace(/\/+$/, '')
}

export const siteUrl: string = resolveSiteUrl()

/** 1200x630 social preview used by every page without its own image. */
const DEFAULT_SHARE_IMAGE = '/og-image.png'

/** Terms the whole site competes on, merged into every page's keywords. */
const BASE_KEYWORDS = [
  'kalooki',
  'kaluki',
  'kalooki online',
  'online card game',
  'multiplayer card game',
  'rummy',
]

/**
 * Tells crawlers a page is fair game, and lets them use a full-size
 * image and an untruncated snippet in the result.
 */
const INDEXABLE =
  'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'

/**
 * Turns a route path into the absolute URL used as its canonical.
 */
export function absoluteUrl(path: string): string {
  return path === '/' ? `${siteUrl}/` : `${siteUrl}${path.replace(/\/+$/, '')}`
}

export interface SeoOptions {
  /** Page-specific part of the title; the site name is appended. */
  title: string
  /** Search-result snippet, best kept under about 160 characters. */
  description: string
  /** Page-specific keywords, merged with the site-wide ones. */
  keywords?: Array<string>
  /**
   * Route path, used for the canonical and Open Graph URLs. Omitted by
   * routes with a dynamic path, which have no single URL to point at.
   */
  path?: string
  /** Keeps the page out of search results; also omits the canonical. */
  noindex?: boolean
  /** Overrides the default social preview image path. */
  image?: string
  /** Open Graph object type: the content pages are articles. */
  type?: 'website' | 'article'
  /** JSON-LD for the page, emitted as an application/ld+json script. */
  structuredData?: Array<Record<string, unknown>>
}

export interface SeoHead {
  meta: Array<MetaHTMLAttributes<HTMLMetaElement>>
  links: Array<LinkHTMLAttributes<HTMLLinkElement>>
  scripts: Array<ScriptHTMLAttributes<HTMLScriptElement>>
}

/**
 * Wraps a structured-data object in an inline JSON-LD script tag.
 *
 * The router writes script contents with `dangerouslySetInnerHTML`, so
 * `<` is escaped to its JSON form: a literal `</script>` appearing in
 * any future data would otherwise close the tag early.
 */
export function jsonLdScript(
  data: Record<string, unknown>,
): ScriptHTMLAttributes<HTMLScriptElement> {
  return {
    type: 'application/ld+json',
    children: JSON.stringify(data).replace(/</g, '\\u003c'),
  }
}

/**
 * Builds the head tags for a route: the title and description, the
 * keywords and robots directives, the canonical URL, and the Open Graph
 * and Twitter cards that drive link previews on social sites and chat
 * apps.
 */
export function seo({
  title,
  description,
  keywords = [],
  path,
  noindex = false,
  image = DEFAULT_SHARE_IMAGE,
  type = 'website',
  structuredData = [],
}: SeoOptions): SeoHead {
  const fullTitle = `${title}${TITLE_SUFFIX}`
  const canonical = path === undefined ? undefined : absoluteUrl(path)
  const imageUrl = absoluteUrl(image)

  const meta: Array<MetaHTMLAttributes<HTMLMetaElement>> = [
    { title: fullTitle },
    { name: 'description', content: description },
    {
      name: 'keywords',
      content: [...new Set([...keywords, ...BASE_KEYWORDS])].join(', '),
    },
    { name: 'robots', content: noindex ? 'noindex, nofollow' : INDEXABLE },

    { property: 'og:title', content: fullTitle },
    { property: 'og:description', content: description },
    { property: 'og:type', content: type },
    { property: 'og:image', content: imageUrl },
    { property: 'og:image:alt', content: `${SITE_NAME}: play Kalooki online` },

    { name: 'twitter:title', content: fullTitle },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: imageUrl },
  ]

  if (canonical !== undefined) {
    meta.push({ property: 'og:url', content: canonical })
  }

  // A canonical pointing at a page we asked not to be indexed only
  // muddies the signal, so noindex pages go without one
  const links =
    noindex || canonical === undefined
      ? []
      : [{ rel: 'canonical', href: canonical }]

  return { meta, links, scripts: structuredData.map(jsonLdScript) }
}

/**
 * The site as an entity, so search engines can attach the name, logo,
 * and description to results rather than guessing them from the page.
 * Emitted once, from the root route.
 */
export function siteStructuredData(): Array<Record<string, unknown>> {
  const organisationId = `${siteUrl}/#organisation`

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': organisationId,
      name: SITE_NAME,
      url: `${siteUrl}/`,
      logo: absoluteUrl('/icon-512.png'),
      email: 'support@kalookionline.com',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      name: SITE_NAME,
      url: `${siteUrl}/`,
      inLanguage: 'en-GB',
      publisher: { '@id': organisationId },
    },
  ]
}

/**
 * The game itself, which is what a search for "kalooki online" is
 * actually looking for: a free, browser-based, multiplayer card game.
 */
export function gameStructuredData(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: 'Kalooki Online',
    alternateName: ['Kaluki', 'Kalooki 40'],
    url: `${siteUrl}/`,
    description:
      'A free multiplayer version of Kalooki, the Rummy-family card game played with two decks and two jokers.',
    genre: ['Card game', 'Rummy'],
    gamePlatform: 'Web browser',
    playMode: 'MultiPlayer',
    numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 6 },
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any',
    inLanguage: 'en-GB',
    publisher: { '@id': `${siteUrl}/#organisation` },
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
    },
  }
}

/**
 * The trail from the home page to the current page, which search
 * engines show in place of the raw URL under a result.
 */
export function breadcrumbStructuredData(
  trail: Array<{ name: string; path: string }>,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '/' }, ...trail].map(
      (crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: absoluteUrl(crumb.path),
      }),
    ),
  }
}
