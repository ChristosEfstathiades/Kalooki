import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { type AccessToken, DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'

export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  static accessTokens = DbAccessTokensProvider.forModel(User)
  declare currentAccessToken?: AccessToken

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
