import { test } from '@japa/runner'
import { findDisallowedLinks, isAllowedLinkHost } from '#services/link_filter'

/**
 * The allowlist outside production is the APP_URL host plus the local
 * dev hosts, so "localhost" stands in for our own site here.
 */
test.group('Link filter', () => {
  test('our own host and its subdomains are allowed', ({ assert }) => {
    assert.isTrue(isAllowedLinkHost('localhost'))
    assert.isTrue(isAllowedLinkHost('admin.localhost'))
    assert.isEmpty(findDisallowedLinks('replay here: http://localhost:3000/matches/7'))
    assert.isEmpty(findDisallowedLinks('www.localhost/tips'))
  })

  test('external links are reported by host', ({ assert }) => {
    assert.deepEqual(findDisallowedLinks('join us at https://evil.example/free'), ['evil.example'])
    assert.deepEqual(findDisallowedLinks('bit.ly/kalooki'), ['bit.ly'])
    assert.deepEqual(findDisallowedLinks('www.evil.tk'), ['evil.tk'])
  })

  test('a message with no link is clean', ({ assert }) => {
    assert.isEmpty(findDisallowedLinks('good game, well played!'))
    assert.isEmpty(findDisallowedLinks('I went out with 3.5 seconds left'))
    assert.isEmpty(findDisallowedLinks('nice hand...that was close'))
  })

  test('a fake prefix does not make a host ours', ({ assert }) => {
    assert.deepEqual(findDisallowedLinks('http://localhost.evil.tk/'), ['localhost.evil.tk'])
    assert.deepEqual(findDisallowedLinks('http://evil.tk/localhost'), ['evil.tk'])
    assert.deepEqual(findDisallowedLinks('http://localhost@evil.tk/'), ['evil.tk'])
    assert.deepEqual(findDisallowedLinks('localhost.evil.tk'), ['localhost.evil.tk'])
  })

  test('zero-width characters do not hide a domain', ({ assert }) => {
    assert.deepEqual(findDisallowedLinks('ev\u200Bil.t\u200Dk'), ['evil.tk'])
  })

  test('wrapping punctuation is ignored', ({ assert }) => {
    assert.deepEqual(findDisallowedLinks('see (evil.tk), then go'), ['evil.tk'])
    assert.deepEqual(findDisallowedLinks('"https://evil.example/x".'), ['evil.example'])
  })

  test('schemes other than http and raw addresses are caught', ({ assert }) => {
    assert.deepEqual(findDisallowedLinks('ftp://evil.tk/drop'), ['evil.tk'])
    assert.deepEqual(findDisallowedLinks('go to 93.184.216.34:8080/x'), ['93.184.216.34'])
  })

  test('email addresses count as links', ({ assert }) => {
    assert.deepEqual(findDisallowedLinks('add me on spammer@evil.tk'), ['evil.tk'])
  })

  test('each host is reported once, in order', ({ assert }) => {
    assert.deepEqual(findDisallowedLinks('evil.tk then bad.xyz then evil.tk/again'), [
      'evil.tk',
      'bad.xyz',
    ])
  })
})
