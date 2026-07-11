import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { type AccessToken, DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import type { LucidModel } from '@adonisjs/lucid/types/model'

export default class User extends compose(
  UserSchema,
  withAuthFinder(hash, { uids: ['email', 'username'] })
) {
  static accessTokens = DbAccessTokensProvider.forModel(User)
  declare currentAccessToken?: AccessToken

  /**
   * Finds the user during login. Overrides the withAuthFinder lookup so
   * the identifier matches the email case-insensitively while the
   * username must match exactly. At most one user can ever match: emails
   * are unique case-insensitively, usernames are unique and can never
   * contain "@" (see the username rule in #validators/user), so an
   * identifier can never hit both branches. Emails are stored lowercased
   * since signup normalizes them; lower(email) also covers rows created
   * before that normalization. The generic signature mirrors the mixin's
   * so the static override stays type-compatible.
   */
  static findForAuth<T extends LucidModel>(
    this: T,
    _uids: string[],
    value: string
  ): Promise<InstanceType<T> | null> {
    return this.query()
      .where((query) => {
        query.whereRaw('lower(email) = ?', [value.toLowerCase()]).orWhere('username', value)
      })
      .first()
  }

  /**
   * Two-letter monogram derived from the username, used as the
   * avatar fallback in the UI.
   */
  get initials(): string {
    return this.username.slice(0, 2).toUpperCase()
  }

  /**
   * Backend-relative URL the avatar image is served from, or null
   * when the user has not uploaded one.
   */
  get avatarUrl(): string | null {
    return this.avatarPath ? `/uploads/avatars/${this.avatarPath}` : null
  }
}
