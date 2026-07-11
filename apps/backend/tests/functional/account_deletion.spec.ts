import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import User from '#models/user'
import { avatarDirectory } from '#services/avatar_storage'
import { ACCOUNT_RETENTION_DAYS, purgeExpiredAccounts } from '#services/account_deletion_service'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * Narrows a signup response's token to a string. Signup only returns a
 * null token in production, which never applies inside the test suite.
 */
function tokenFrom(body: { data: { token: string | null } }): string {
  if (typeof body.data.token !== 'string') {
    throw new Error('Expected signup to return an access token in the test environment')
  }
  return body.data.token
}

/**
 * Extracts a response's data payload. The generated client types the
 * response shapes of routes that share a pattern across HTTP methods
 * (e.g. GET and POST /friend-requests), so member access needs a cast.
 */
function dataOf<T>(response: { body: () => unknown }): T {
  return (response.body() as { data: T }).data
}

/**
 * A valid signup payload; tests override the username/email to create
 * additional users.
 */
function signupPayload(username = 'player_one', email = 'player.one@example.com') {
  return {
    username,
    email,
    password: 'Kalooki!23',
    passwordConfirmation: 'Kalooki!23',
  }
}

/**
 * Backdates a user's soft-delete timestamp so the grace period has
 * already passed.
 */
async function softDeleteDaysAgo(email: string, days: number): Promise<void> {
  const user = await User.findByOrFail('email', email)
  user.deletedAt = DateTime.now().minus({ days })
  await user.save()
}

test.group('Account deletion', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  const avatarFixture = fileURLToPath(new URL('../fixtures/avatar.png', import.meta.url))

  test('requires authentication', async ({ client }) => {
    const response = await client.delete('/api/v1/account')

    response.assertStatus(401)
  })

  test('soft-deletes the account and revokes every session', async ({ client, assert }) => {
    const signup = await client.post('/api/v1/auth/signup').json(signupPayload())
    const token = tokenFrom(signup.body())

    const response = await client.delete('/api/v1/account').bearerToken(token)
    response.assertStatus(200)

    // The row is kept for the grace period, but the token no longer works
    const user = await User.findByOrFail('email', 'player.one@example.com')
    assert.isNotNull(user.deletedAt)
    const profile = await client.get('/api/v1/account/profile').bearerToken(token)
    profile.assertStatus(401)
  })

  test('signing in during the grace period restores the account', async ({ client, assert }) => {
    const signup = await client.post('/api/v1/auth/signup').json(signupPayload())
    await client.delete('/api/v1/account').bearerToken(tokenFrom(signup.body()))

    const login = await client.post('/api/v1/auth/login').json({
      identifier: 'player.one@example.com',
      password: 'Kalooki!23',
    })

    login.assertStatus(200)
    const user = await User.findByOrFail('email', 'player.one@example.com')
    assert.isNull(user.deletedAt)
  })

  test('rejects signin once the grace period has passed', async ({ client }) => {
    await client.post('/api/v1/auth/signup').json(signupPayload())
    await softDeleteDaysAgo('player.one@example.com', ACCOUNT_RETENTION_DAYS + 1)

    const login = await client.post('/api/v1/auth/login').json({
      identifier: 'player.one@example.com',
      password: 'Kalooki!23',
    })

    login.assertStatus(400)
  })

  test('purge permanently deletes only accounts past the grace period', async ({
    client,
    assert,
  }) => {
    await client.post('/api/v1/auth/signup').json(signupPayload())
    await client
      .post('/api/v1/auth/signup')
      .json(signupPayload('player_two', 'player.two@example.com'))
    await softDeleteDaysAgo('player.one@example.com', ACCOUNT_RETENTION_DAYS + 1)
    await softDeleteDaysAgo('player.two@example.com', 1)

    const purged = await purgeExpiredAccounts()

    assert.equal(purged, 1)
    assert.isNull(await User.findBy('email', 'player.one@example.com'))
    assert.isNotNull(await User.findBy('email', 'player.two@example.com'))
  })

  test('purge removes the avatar file and cascades to related rows', async ({ client, assert }) => {
    const signup = await client.post('/api/v1/auth/signup').json(signupPayload())
    const token = tokenFrom(signup.body())
    const other = await client
      .post('/api/v1/auth/signup')
      .json(signupPayload('player_two', 'player.two@example.com'))
    const otherToken = tokenFrom(other.body())

    // Give the doomed account an avatar and a friendship
    const withAvatar = await client
      .patch('/api/v1/account/profile')
      .bearerToken(token)
      .file('avatar', avatarFixture)
    const avatarUrl: string | null = withAvatar.body().data.avatarUrl
    if (!avatarUrl) {
      throw new Error('Expected the profile update to return an avatar URL')
    }
    const avatarFile = join(avatarDirectory(), avatarUrl.split('/').at(-1) ?? '')
    await access(avatarFile)

    await client.post('/api/v1/friend-requests').bearerToken(token).json({ username: 'player_two' })
    const requests = await client.get('/api/v1/friend-requests').bearerToken(otherToken)
    const requestId = dataOf<{ incoming: { id: number }[] }>(requests).incoming[0].id
    await client.post(`/api/v1/friend-requests/${requestId}/accept`).bearerToken(otherToken)

    await softDeleteDaysAgo('player.one@example.com', ACCOUNT_RETENTION_DAYS + 1)
    await purgeExpiredAccounts()

    assert.isNull(await User.findBy('email', 'player.one@example.com'))
    await assert.rejects(() => access(avatarFile), /ENOENT/)
    const friends = await client.get('/api/v1/friends').bearerToken(otherToken)
    assert.lengthOf(friends.body().data.friends, 0)
  })
})
