import { test } from '@japa/runner'
import User from '#models/user'
import limiter from '@adonisjs/limiter/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import { API_RATE_LIMIT, AUTH_RATE_LIMIT, FAILED_LOGIN_RATE_LIMIT } from '#start/limiter'

const PASSWORD = 'Kalooki!23'
const WRONG_PASSWORD = 'WrongPassword!1'

/**
 * Creates an account directly in the database so tests spend none of
 * the auth endpoints' rate-limit budget on setup.
 */
function makeUser(username: string): Promise<User> {
  return User.create({ username, email: `${username}@example.com`, password: PASSWORD })
}

/**
 * Resets the auth endpoints' per-IP throttle, simulating the start of a
 * new rate-limit window without waiting out a minute of wall time. The
 * failed-login lockout counter lives in a separate limiter instance and
 * is unaffected.
 */
function resetAuthThrottle(): Promise<void> {
  return limiter.use(AUTH_RATE_LIMIT).clear()
}

test.group('Rate limiting', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('throttles login attempts beyond the per-IP limit', async ({ client }) => {
    await makeUser('rate_user')

    for (let attempt = 0; attempt < AUTH_RATE_LIMIT.requests; attempt++) {
      const response = await client
        .post('/api/v1/auth/login')
        .json({ identifier: 'rate_user@example.com', password: WRONG_PASSWORD })
      response.assertStatus(400)
    }

    // Even a correct password is refused once the window is exhausted.
    const blocked = await client
      .post('/api/v1/auth/login')
      .json({ identifier: 'rate_user@example.com', password: PASSWORD })
    blocked.assertStatus(429)
  })

  test('throttles signups beyond the per-IP limit', async ({ client }) => {
    for (let attempt = 0; attempt < AUTH_RATE_LIMIT.requests; attempt++) {
      const response = await client.post('/api/v1/auth/signup').json({
        username: `signup_user_${attempt}`,
        email: `signup.user.${attempt}@example.com`,
        password: PASSWORD,
        passwordConfirmation: PASSWORD,
      })
      response.assertStatus(200)
    }

    const blocked = await client.post('/api/v1/auth/signup').json({
      username: 'signup_user_over',
      email: 'signup.user.over@example.com',
      password: PASSWORD,
      passwordConfirmation: PASSWORD,
    })
    blocked.assertStatus(429)
  })

  test('locks an account after repeated failed logins across throttle windows', async ({
    client,
  }) => {
    await makeUser('lockout_user')

    // Spread the failures across simulated rate-limit windows so the
    // per-IP throttle never masks the lockout counter.
    for (let attempt = 0; attempt < FAILED_LOGIN_RATE_LIMIT.requests; attempt++) {
      if (attempt % AUTH_RATE_LIMIT.requests === 0) {
        await resetAuthThrottle()
      }
      const response = await client
        .post('/api/v1/auth/login')
        .json({ identifier: 'lockout_user@example.com', password: WRONG_PASSWORD })
      response.assertStatus(400)
    }

    await resetAuthThrottle()
    const blocked = await client
      .post('/api/v1/auth/login')
      .json({ identifier: 'lockout_user@example.com', password: PASSWORD })
    blocked.assertStatus(429)
  })

  test('a successful login resets the failed-attempt counter', async ({ client }) => {
    await makeUser('reset_user')

    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await client
        .post('/api/v1/auth/login')
        .json({ identifier: 'reset_user@example.com', password: WRONG_PASSWORD })
      response.assertStatus(400)
    }

    const success = await client
      .post('/api/v1/auth/login')
      .json({ identifier: 'reset_user@example.com', password: PASSWORD })
    success.assertStatus(200)

    // One failure short of the lockout: the final login only succeeds
    // if the successful login above reset the counter (3 + 9 failures
    // would have tripped it otherwise).
    const failuresToRetry = FAILED_LOGIN_RATE_LIMIT.requests - 1
    for (let attempt = 0; attempt < failuresToRetry; attempt++) {
      if (attempt % AUTH_RATE_LIMIT.requests === 0) {
        await resetAuthThrottle()
      }
      const response = await client
        .post('/api/v1/auth/login')
        .json({ identifier: 'reset_user@example.com', password: WRONG_PASSWORD })
      response.assertStatus(400)
    }

    await resetAuthThrottle()
    const secondSuccess = await client
      .post('/api/v1/auth/login')
      .json({ identifier: 'reset_user@example.com', password: PASSWORD })
    secondSuccess.assertStatus(200)
  })

  test('caps authenticated API requests per user', async ({ client }) => {
    const user = await makeUser('api_user')

    const allowed = await client.get('/api/v1/account/profile').loginAs(user)
    allowed.assertStatus(200)

    // Fill the user's window directly instead of issuing 60 requests.
    await limiter
      .use(API_RATE_LIMIT)
      .set(`api_user_${user.id}`, API_RATE_LIMIT.requests, API_RATE_LIMIT.duration)

    const blocked = await client.get('/api/v1/account/profile').loginAs(user)
    blocked.assertStatus(429)
  })
})
