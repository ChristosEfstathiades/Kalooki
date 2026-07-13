import { test } from '@japa/runner'
import User from '#models/user'
import { CHAT_USERNAME_COLORS } from '#services/chat_service'
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
 * A signup payload that satisfies every validation rule; individual
 * tests override fields to probe specific rules.
 */
function validSignupPayload() {
  return {
    username: 'player_one',
    email: 'player.one@example.com',
    password: 'Kalooki!23',
    passwordConfirmation: 'Kalooki!23',
  }
}

test.group('Auth signup', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates an account and returns a token in development', async ({ client, assert }) => {
    const response = await client.post('/api/v1/auth/signup').json(validSignupPayload())

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.data.user.username, 'player_one')
    assert.equal(body.data.user.email, 'player.one@example.com')
    assert.isString(body.data.token)
    assert.isFalse(body.data.requiresEmailVerification)
    assert.notProperty(body.data.user, 'password')
  })

  test('rejects passwords missing a capital letter or symbol or length')
    .with([
      { password: 'kalooki!23' }, // no capital
      { password: 'Kalooki123' }, // no symbol
      { password: 'Ka!2' }, // too short
    ])
    .run(async ({ client }, row) => {
      const response = await client.post('/api/v1/auth/signup').json({
        ...validSignupPayload(),
        password: row.password,
        passwordConfirmation: row.password,
      })

      response.assertStatus(422)
    })

  test('rejects a mismatched password confirmation', async ({ client }) => {
    const response = await client.post('/api/v1/auth/signup').json({
      ...validSignupPayload(),
      passwordConfirmation: 'Different!23',
    })

    response.assertStatus(422)
  })

  test('rejects duplicate usernames case-insensitively', async ({ client }) => {
    await client.post('/api/v1/auth/signup').json(validSignupPayload())

    const response = await client.post('/api/v1/auth/signup').json({
      ...validSignupPayload(),
      username: 'PLAYER_ONE',
      email: 'someone.else@example.com',
    })

    response.assertStatus(422)
  })

  test('rejects usernames with invalid characters')
    .with([
      { username: 'not allowed!' },
      // "@" must stay banned: login relies on usernames never looking
      // like email addresses (see User.findForAuth).
      { username: 'chris@x' },
    ])
    .run(async ({ client }, row) => {
      const response = await client.post('/api/v1/auth/signup').json({
        ...validSignupPayload(),
        username: row.username,
      })

      response.assertStatus(422)
    })

  test('stores the email trimmed and lowercased', async ({ client, assert }) => {
    const response = await client.post('/api/v1/auth/signup').json({
      ...validSignupPayload(),
      email: '  Player.One@EXAMPLE.com ',
    })

    response.assertStatus(200)
    assert.equal(response.body().data.user.email, 'player.one@example.com')
  })

  test('rejects duplicate emails case-insensitively', async ({ client }) => {
    await client.post('/api/v1/auth/signup').json(validSignupPayload())

    const response = await client.post('/api/v1/auth/signup').json({
      ...validSignupPayload(),
      username: 'someone_else',
      email: 'PLAYER.ONE@example.com',
    })

    response.assertStatus(422)
  })
})

test.group('Auth login', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('returns a token for valid credentials using email', async ({ client, assert }) => {
    await client.post('/api/v1/auth/signup').json(validSignupPayload())

    const response = await client.post('/api/v1/auth/login').json({
      identifier: 'player.one@example.com',
      password: 'Kalooki!23',
    })

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.data.user.username, 'player_one')
    assert.isString(body.data.token)
  })

  test('matches the email case-insensitively', async ({ client, assert }) => {
    await client.post('/api/v1/auth/signup').json(validSignupPayload())

    const response = await client.post('/api/v1/auth/login').json({
      identifier: 'PLAYER.ONE@EXAMPLE.COM',
      password: 'Kalooki!23',
    })

    response.assertStatus(200)
    assert.equal(response.body().data.user.username, 'player_one')
  })

  test('ignores surrounding whitespace in the identifier', async ({ client }) => {
    await client.post('/api/v1/auth/signup').json(validSignupPayload())

    const response = await client.post('/api/v1/auth/login').json({
      identifier: ' player.one@example.com ',
      password: 'Kalooki!23',
    })

    response.assertStatus(200)
  })

  test('returns a token for valid credentials using username', async ({ client, assert }) => {
    await client.post('/api/v1/auth/signup').json(validSignupPayload())

    const response = await client.post('/api/v1/auth/login').json({
      identifier: 'player_one',
      password: 'Kalooki!23',
    })

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.data.user.username, 'player_one')
    assert.isString(body.data.token)
  })

  test('requires the username to match exactly, including case', async ({ client }) => {
    await client.post('/api/v1/auth/signup').json(validSignupPayload())

    const response = await client.post('/api/v1/auth/login').json({
      identifier: 'PLAYER_ONE',
      password: 'Kalooki!23',
    })

    response.assertStatus(400)
  })

  test('rejects invalid credentials', async ({ client }) => {
    await client.post('/api/v1/auth/signup').json(validSignupPayload())

    const response = await client.post('/api/v1/auth/login').json({
      identifier: 'player.one@example.com',
      password: 'WrongPassword!1',
    })

    response.assertStatus(400)
  })

  test('remember me extends the token lifetime', async ({ client, assert }) => {
    await client.post('/api/v1/auth/signup').json(validSignupPayload())

    await client.post('/api/v1/auth/login').json({
      identifier: 'player.one@example.com',
      password: 'Kalooki!23',
      rememberMe: true,
    })

    const user = await User.findByOrFail('email', 'player.one@example.com')
    const tokens = await User.accessTokens.all(user)
    const rememberedToken = tokens[0]

    if (!rememberedToken.expiresAt) {
      throw new Error('Expected the remembered token to carry an expiry date')
    }
    const lifetimeMs = rememberedToken.expiresAt.getTime() - Date.now()
    assert.isAbove(lifetimeMs, 1000 * 60 * 60 * 24 * 20, 'expected a ~30 day token')
  })
})

test.group('Profile update', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('requires authentication', async ({ client }) => {
    const response = await client.patch('/api/v1/account/profile').json({ username: 'renamed' })

    response.assertStatus(401)
  })

  test('changes the username', async ({ client, assert }) => {
    const signup = await client.post('/api/v1/auth/signup').json(validSignupPayload())
    const token = tokenFrom(signup.body())

    const response = await client
      .patch('/api/v1/account/profile')
      .bearerToken(token)
      .json({ username: 'renamed_one' })

    response.assertStatus(200)
    assert.equal(response.body().data.username, 'renamed_one')

    const profile = await client.get('/api/v1/account/profile').bearerToken(token)
    assert.equal(profile.body().data.username, 'renamed_one')
  })

  test('allows keeping the current username', async ({ client, assert }) => {
    const signup = await client.post('/api/v1/auth/signup').json(validSignupPayload())
    const token = tokenFrom(signup.body())

    const response = await client
      .patch('/api/v1/account/profile')
      .bearerToken(token)
      .json({ username: 'player_one' })

    response.assertStatus(200)
    assert.equal(response.body().data.username, 'player_one')
  })

  test('rejects a username taken by another user, case-insensitively', async ({ client }) => {
    await client.post('/api/v1/auth/signup').json({
      ...validSignupPayload(),
      username: 'someone_else',
      email: 'someone.else@example.com',
    })
    const signup = await client.post('/api/v1/auth/signup').json(validSignupPayload())
    const token = tokenFrom(signup.body())

    const response = await client
      .patch('/api/v1/account/profile')
      .bearerToken(token)
      .json({ username: 'SOMEONE_ELSE' })

    response.assertStatus(422)
  })

  test('changes the chat colour', async ({ client, assert }) => {
    const signup = await client.post('/api/v1/auth/signup').json(validSignupPayload())
    const token = tokenFrom(signup.body())
    const color = CHAT_USERNAME_COLORS[0]

    const response = await client
      .patch('/api/v1/account/profile')
      .bearerToken(token)
      .json({ chatColor: color })

    response.assertStatus(200)
    assert.equal(response.body().data.chatColor, color)

    const profile = await client.get('/api/v1/account/profile').bearerToken(token)
    assert.equal(profile.body().data.chatColor, color)
  })

  test('rejects a chat colour outside the fixed palette', async ({ client }) => {
    const signup = await client.post('/api/v1/auth/signup').json(validSignupPayload())
    const token = tokenFrom(signup.body())

    const response = await client
      .patch('/api/v1/account/profile')
      .bearerToken(token)
      .json({ chatColor: '#123456' })

    response.assertStatus(422)
  })
})

test.group('Auth protected routes', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('profile requires authentication', async ({ client }) => {
    const response = await client.get('/api/v1/account/profile')

    response.assertStatus(401)
  })

  test('profile returns the authenticated user', async ({ client, assert }) => {
    const signup = await client.post('/api/v1/auth/signup').json(validSignupPayload())
    const token = tokenFrom(signup.body())

    const response = await client.get('/api/v1/account/profile').bearerToken(token)

    response.assertStatus(200)
    assert.equal(response.body().data.username, 'player_one')
  })

  test('logout revokes the current token', async ({ client }) => {
    const signup = await client.post('/api/v1/auth/signup').json(validSignupPayload())
    const token = tokenFrom(signup.body())

    const logout = await client.post('/api/v1/account/logout').bearerToken(token)
    logout.assertStatus(200)

    const afterLogout = await client.get('/api/v1/account/profile').bearerToken(token)
    afterLogout.assertStatus(401)
  })
})
