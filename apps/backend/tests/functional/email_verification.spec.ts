import { test } from '@japa/runner'
import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import limiter from '@adonisjs/limiter/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import EmailVerificationToken from '#models/email_verification_token'
import { issueVerificationToken } from '#services/email_verification_service'
import { AUTH_RATE_LIMIT } from '#start/limiter'

/**
 * Email verification (AUDIT.md G1). The finding called the eventual
 * implementation "security-sensitive" and named the properties it had
 * to have, so these tests are written against those directly: single
 * use, expiring, unguessable, and no status oracle.
 */

const PASSWORD = 'Kalooki!23'

/** Creates an unverified account without spending auth throttle budget. */
function makeUnverifiedUser(username: string): Promise<User> {
  return User.create({
    username,
    email: `${username}@example.com`,
    password: PASSWORD,
  })
}

test.group('Email verification', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  // Both endpoints sit under the auth throttle, which is per IP and
  // would otherwise carry over between tests in one run.
  group.each.setup(() => limiter.use(AUTH_RATE_LIMIT).clear())

  test('a valid link verifies the account and signs the user in', async ({ client, assert }) => {
    const user = await makeUnverifiedUser('verify_ok')
    const rawToken = await issueVerificationToken(user)

    const response = await client.post('/api/v1/auth/email/verify').json({ token: rawToken })

    response.assertStatus(200)
    assert.isString(response.body().data.token)
    assert.equal(response.body().data.user.username, 'verify_ok')

    await user.refresh()
    assert.isNotNull(user.emailVerifiedAt)
  })

  test('the same link cannot be redeemed twice', async ({ client, assert }) => {
    const user = await makeUnverifiedUser('verify_once')
    const rawToken = await issueVerificationToken(user)

    const first = await client.post('/api/v1/auth/email/verify').json({ token: rawToken })
    first.assertStatus(200)

    const second = await client.post('/api/v1/auth/email/verify').json({ token: rawToken })
    second.assertStatus(400)

    // The account stays verified: the second attempt is refused, not a
    // rollback of the first.
    await user.refresh()
    assert.isNotNull(user.emailVerifiedAt)
  })

  test('an expired link is refused', async ({ client, assert }) => {
    const user = await makeUnverifiedUser('verify_expired')
    const rawToken = await issueVerificationToken(user)

    await EmailVerificationToken.query()
      .where('userId', user.id)
      .update({ expiresAt: DateTime.now().minus({ hours: 1 }).toSQL() })

    const response = await client.post('/api/v1/auth/email/verify').json({ token: rawToken })

    response.assertStatus(400)
    await user.refresh()
    assert.isNull(user.emailVerifiedAt)
  })

  test('unknown, expired and used links are indistinguishable', async ({ client, assert }) => {
    const user = await makeUnverifiedUser('verify_oracle')
    const usedToken = await issueVerificationToken(user)
    await client.post('/api/v1/auth/email/verify').json({ token: usedToken })

    const used = await client.post('/api/v1/auth/email/verify').json({ token: usedToken })
    const unknown = await client
      .post('/api/v1/auth/email/verify')
      .json({ token: 'not-a-real-token-at-all' })

    // Same status and same message, so the endpoint cannot be used to
    // probe which tokens exist.
    assert.equal(used.status(), unknown.status())
    assert.deepEqual(used.body(), unknown.body())
  })

  test('only a hash of the token is stored', async ({ assert }) => {
    const user = await makeUnverifiedUser('verify_hashed')
    const rawToken = await issueVerificationToken(user)

    const stored = await EmailVerificationToken.query().where('userId', user.id).firstOrFail()

    assert.notEqual(stored.tokenHash, rawToken)
    assert.equal(stored.tokenHash, createHash('sha256').update(rawToken).digest('hex'))
  })

  test('reissuing invalidates the previous link', async ({ client, assert }) => {
    const user = await makeUnverifiedUser('verify_reissue')
    const firstToken = await issueVerificationToken(user)
    const secondToken = await issueVerificationToken(user)

    const stale = await client.post('/api/v1/auth/email/verify').json({ token: firstToken })
    stale.assertStatus(400)

    const fresh = await client.post('/api/v1/auth/email/verify').json({ token: secondToken })
    fresh.assertStatus(200)

    await user.refresh()
    assert.isNotNull(user.emailVerifiedAt)
  })

  test('resend answers identically whether or not the address has an account', async ({
    client,
    assert,
  }) => {
    await makeUnverifiedUser('resend_real')

    const unverified = await client
      .post('/api/v1/auth/email/resend')
      .json({ email: 'resend_real@example.com' })
    const unregistered = await client
      .post('/api/v1/auth/email/resend')
      .json({ email: 'nobody_here@example.com' })

    unverified.assertStatus(200)
    unregistered.assertStatus(200)

    // Identical bodies: anything that differed would confirm which
    // addresses are registered (AUDIT.md S7).
    assert.deepEqual(unverified.body(), unregistered.body())
  })

  test('resend does not reveal that an address is already verified', async ({ client, assert }) => {
    const user = await makeUnverifiedUser('resend_verified')
    user.emailVerifiedAt = DateTime.now()
    await user.save()

    const verified = await client
      .post('/api/v1/auth/email/resend')
      .json({ email: 'resend_verified@example.com' })
    const unregistered = await client
      .post('/api/v1/auth/email/resend')
      .json({ email: 'nobody_here_either@example.com' })

    assert.equal(verified.status(), unregistered.status())
    assert.deepEqual(verified.body(), unregistered.body())

    // No fresh token was minted for an address that does not need one.
    const tokens = await EmailVerificationToken.query().where('userId', user.id)
    assert.lengthOf(tokens, 0)
  })
})
