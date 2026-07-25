import { describe, expect, it } from 'vitest'
import { publicPages, renderSitemap } from './sitemap'

const SITE = 'https://kalookionline.example'
const LASTMOD = '2026-07-25'

describe('renderSitemap', () => {
  it('lists every public page against the configured host', () => {
    const xml = renderSitemap(SITE, LASTMOD)

    for (const page of publicPages) {
      const expected = page.path === '/' ? `${SITE}/` : `${SITE}${page.path}`
      expect(xml).toContain(`<loc>${expected}</loc>`)
    }
    expect(xml.match(/<url>/g)).toHaveLength(publicPages.length)
  })

  it('does not list the signed-in pages, which redirect to signin', () => {
    const xml = renderSitemap(SITE, LASTMOD)

    for (const path of ['/play', '/settings', '/history', '/leaderboard']) {
      expect(xml).not.toContain(`${SITE}${path}`)
    }
    // The signin page itself is noindex, so it stays out too
    expect(xml).not.toContain(`${SITE}/signin`)
  })

  it('keeps a trailing slash on the home page only, matching its canonical', () => {
    const xml = renderSitemap(SITE, LASTMOD)

    expect(xml).toContain(`<loc>${SITE}/</loc>`)
    expect(xml).toContain(`<loc>${SITE}/rules</loc>`)
    expect(xml).not.toContain(`<loc>${SITE}/rules/</loc>`)
  })

  it('tolerates a host given with a trailing slash', () => {
    expect(renderSitemap(`${SITE}/`, LASTMOD)).toContain(
      `<loc>${SITE}/rules</loc>`,
    )
  })

  it('stamps every entry with the build date and its crawl hints', () => {
    const xml = renderSitemap(SITE, LASTMOD, [
      { path: '/rules', priority: 0.9, changefreq: 'monthly' },
    ])

    expect(xml).toContain(`<lastmod>${LASTMOD}</lastmod>`)
    expect(xml).toContain('<changefreq>monthly</changefreq>')
    expect(xml).toContain('<priority>0.9</priority>')
  })

  it('escapes characters XML would otherwise choke on', () => {
    const xml = renderSitemap('https://example.test', LASTMOD, [
      { path: '/a?b=1&c=2', priority: 0.5, changefreq: 'yearly' },
    ])

    expect(xml).toContain('<loc>https://example.test/a?b=1&amp;c=2</loc>')
  })

  it('opens with the XML declaration and the sitemap namespace', () => {
    const xml = renderSitemap(SITE, LASTMOD)

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    )
  })
})
