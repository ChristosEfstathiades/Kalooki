import app from '@adonisjs/core/services/app'
import env from '#start/env'

/**
 * Link detection for chat, following the allowlist approach described in
 * Developer/Chat-Moderation.md: a message may link to our own site and
 * nothing else. Everything not on the allowlist is reported back so the
 * caller can decide what to do with it (chat_service only blocks it for
 * accounts that are not trusted yet).
 *
 * Detection is deliberately generous. A missed link defeats the whole
 * rule, while a false positive only costs a new account one message, and
 * the error explains itself. Email addresses match too, which is
 * intentional: "add me on foo@bar.com" is the same spam shape as a link.
 */

/**
 * TLDs that make a scheme-less token a link. A domain typed in full
 * ("https://…", "www.…") is caught without this list; the list only
 * decides whether a bare "something.tld" counts. It mixes the common
 * TLDs with the free-registration ones that dominate spam (.tk, .ml,
 * .ga, .cf, .gq) and the ones link shorteners live on (.ly, .gg, .to,
 * .me, .cc).
 *
 * A few entries are also English words, so "call.me" typed without a
 * space reads as a link. That trade is deliberate — see above.
 */
const KNOWN_TLDS = [
  'com',
  'net',
  'org',
  'edu',
  'gov',
  'mil',
  'int',
  'info',
  'biz',
  'io',
  'co',
  'uk',
  'us',
  'ca',
  'au',
  'nz',
  'de',
  'fr',
  'es',
  'it',
  'nl',
  'be',
  'ch',
  'at',
  'ie',
  'pt',
  'pl',
  'se',
  'no',
  'dk',
  'fi',
  'ru',
  'ua',
  'jp',
  'cn',
  'kr',
  'in',
  'br',
  'mx',
  'ar',
  'za',
  'ng',
  'ke',
  'jm',
  'cy',
  'gr',
  'tr',
  'me',
  'tv',
  'cc',
  'gg',
  'ly',
  'to',
  'sh',
  'st',
  'am',
  'fm',
  'im',
  'ws',
  'xyz',
  'top',
  'site',
  'online',
  'club',
  'shop',
  'store',
  'live',
  'link',
  'click',
  'fun',
  'icu',
  'app',
  'dev',
  'page',
  'wiki',
  'blog',
  'news',
  'chat',
  'games',
  'casino',
  'bet',
  'win',
  'vip',
  'pro',
  'cash',
  'gift',
  'download',
  'stream',
  'tk',
  'ml',
  'ga',
  'cf',
  'gq',
]

/** Any "scheme://" prefix, not just http(s), so ftp:// is caught too. */
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * A scheme-less domain: an optional userinfo prefix, labels, a known
 * TLD, then optionally a port, path, query or fragment. The userinfo
 * part covers both email addresses and the "kalooki.example@evil.tk"
 * disguise, which resolves to evil.tk.
 */
const BARE_DOMAIN = new RegExp(
  `^(?:[^\\s/@]*@)?(?:[a-z0-9-]+\\.)+(?:${KNOWN_TLDS.join('|')})(?:[:/?#@].*)?$`,
  'i'
)

/** A dotted-quad address, which no TLD list would ever catch. */
const BARE_IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}(?:[:/?#@].*)?$/

/**
 * Zero-width and soft-hyphen characters, stripped before scanning so
 * "evil<ZWSP>.tk" cannot slip past. This is a narrow version of the
 * normalization pass in Developer/Chat-Moderation.md item 3; it applies
 * to link detection only and does not change the stored message.
 */
const INVISIBLE_CHARACTERS = /[\u00AD\u200B-\u200F\u2060\uFEFF]/g

/** Wrapping punctuation a link is commonly pasted inside or before. */
const LEADING_PUNCTUATION = /^[("'<[{]+/
const TRAILING_PUNCTUATION = /[)"'>\]},.!?;:]+$/

/**
 * Reduces a hostname to the form the allowlist is compared in:
 * lowercase, no "www." prefix, no trailing dot.
 */
function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^www\./, '')
}

/**
 * The hostname of a URL string, or an empty string when it will not
 * parse.
 */
function hostOfUrl(url: string): string {
  try {
    return normalizeHost(new URL(url).hostname)
  } catch {
    return ''
  }
}

/**
 * Hosts a chat link may point at. Set CHAT_LINK_ALLOWED_HOSTS (comma
 * separated) in production; otherwise we fall back to the host the API
 * is served from, plus the local dev hosts outside production, so match
 * history and replay links keep working without configuration.
 */
function buildAllowedHosts(): string[] {
  const configured = (env.get('CHAT_LINK_ALLOWED_HOSTS') ?? '')
    .split(',')
    .map((entry) => normalizeHost(entry.includes('//') ? hostOfUrl(entry) : entry))
    .filter((entry) => entry !== '')

  if (configured.length > 0) {
    return configured
  }

  const hosts = [hostOfUrl(env.get('APP_URL'))]
  if (!app.inProduction) {
    hosts.push('localhost', '127.0.0.1')
  }
  return hosts.filter((host) => host !== '')
}

const ALLOWED_HOSTS = buildAllowedHosts()

/**
 * Whether a host is ours. A listed host also covers its subdomains, and
 * the check is on the parsed hostname rather than the raw text, so
 * neither "kalooki.example.evil.tk" nor "evil.tk/kalooki.example" gets
 * through.
 */
export function isAllowedLinkHost(host: string): boolean {
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
}

/**
 * Whether a whitespace-delimited token is worth parsing as a link.
 */
function looksLikeLink(token: string): boolean {
  return (
    SCHEME.test(token) || /^www\./i.test(token) || BARE_DOMAIN.test(token) || BARE_IPV4.test(token)
  )
}

/**
 * The host a link token points at, resolved with the URL parser rather
 * than by regex so userinfo ("@"), ports and paths cannot be used to
 * disguise it. Returns an empty string when the token will not parse.
 */
function hostOfToken(token: string): string {
  return hostOfUrl(SCHEME.test(token) ? token : `http://${token}`)
}

/**
 * Every host the message links to that is not on the allowlist, in the
 * order they appear and without duplicates. An empty array means the
 * message is clean.
 *
 * Call this after the message length cap: it scans the whole string.
 */
export function findDisallowedLinks(message: string): string[] {
  const disallowed: string[] = []

  for (const rawToken of message.replace(INVISIBLE_CHARACTERS, '').split(/\s+/)) {
    const token = rawToken
      .replace(LEADING_PUNCTUATION, '')
      .replace(TRAILING_PUNCTUATION, '')
      .replace(/^\/\//, '')
    if (token === '' || !looksLikeLink(token)) {
      continue
    }

    const host = hostOfToken(token)
    if (host === '' || isAllowedLinkHost(host) || disallowed.includes(host)) {
      continue
    }
    disallowed.push(host)
  }

  return disallowed
}
