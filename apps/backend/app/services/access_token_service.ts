import User from '#models/user'

/**
 * Token lifetimes for the two signin modes. "Remember me" keeps the
 * user signed in for longer; the frontend pairs it with persistent
 * (localStorage) instead of per-tab (sessionStorage) token storage.
 */
const REMEMBERED_TOKEN_EXPIRY = '30 days'
const DEFAULT_TOKEN_EXPIRY = '1 day'

/**
 * Mints an opaque API access token for the user and returns its
 * releasable secret value.
 *
 * @throws Error when the freshly created token carries no secret,
 *   which would indicate a token-provider misconfiguration.
 */
export async function mintAccessToken(
  user: User,
  options: { rememberMe?: boolean } = {}
): Promise<string> {
  const token = await User.accessTokens.create(user, ['*'], {
    expiresIn: options.rememberMe ? REMEMBERED_TOKEN_EXPIRY : DEFAULT_TOKEN_EXPIRY,
  })

  if (!token.value) {
    throw new Error('Newly created access token is missing its secret value')
  }

  return token.value.release()
}
