import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, securityHeaders } from './security-headers'

/**
 * Reads one directive out of a policy string.
 */
function directive(policy: string, name: string): string | undefined {
  return policy
    .split('; ')
    .find((entry) => entry === name || entry.startsWith(`${name} `))
}

describe('contentSecurityPolicy', () => {
  it('allows the API origin and its WebSocket origin to be contacted', () => {
    const connect = directive(
      contentSecurityPolicy('https://api.kalooki.example'),
      'connect-src',
    )

    expect(connect).toBe(
      "connect-src 'self' https://api.kalooki.example wss://api.kalooki.example",
    )
  })

  it('uses ws: for a plain-http API', () => {
    const connect = directive(
      contentSecurityPolicy('http://192.168.1.181:3333'),
      'connect-src',
    )

    expect(connect).toBe(
      "connect-src 'self' http://192.168.1.181:3333 ws://192.168.1.181:3333",
    )
  })

  it('does not contact any other origin by default', () => {
    const policy = contentSecurityPolicy('https://api.kalooki.example')

    expect(directive(policy, 'default-src')).toBe("default-src 'self'")
    expect(directive(policy, 'object-src')).toBe("object-src 'none'")
    expect(directive(policy, 'base-uri')).toBe("base-uri 'self'")
    expect(directive(policy, 'form-action')).toBe("form-action 'self'")
    expect(directive(policy, 'frame-ancestors')).toBe("frame-ancestors 'none'")
  })

  it('upgrades insecure requests only when the API is served over TLS', () => {
    expect(
      directive(
        contentSecurityPolicy('https://api.kalooki.example'),
        'upgrade-insecure-requests',
      ),
    ).toBe('upgrade-insecure-requests')

    // Would otherwise rewrite the API and WebSocket calls to https
    expect(
      directive(
        contentSecurityPolicy('http://192.168.1.181:3333'),
        'upgrade-insecure-requests',
      ),
    ).toBeUndefined()
  })

  it('rejects a malformed API URL rather than shipping a broken policy', () => {
    expect(() => contentSecurityPolicy('not-a-url')).toThrow(/VITE_API_URL/)
  })
})

describe('securityHeaders', () => {
  it('ships the policy alongside the other hardening headers', () => {
    const headers = securityHeaders('https://api.kalooki.example')

    expect(headers['content-security-policy']).toContain("default-src 'self'")
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })
})
