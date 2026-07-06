import User from '#models/user'

/**
 * Finds a user by their exact username, case-insensitively. Typing
 * never reveals similar names — only an exact match is accepted
 * (docs/features.md), so this must not use pattern matching.
 */
export async function findByExactUsername(username: string): Promise<User | null> {
  return User.query().whereRaw('LOWER(username) = ?', [username.toLowerCase()]).first()
}
