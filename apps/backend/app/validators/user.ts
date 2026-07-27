import vine from '@vinejs/vine'
import type { FieldContext } from '@vinejs/vine/types'
import { CHAT_USERNAME_COLORS } from '#services/chat_service'
import { findBlockedWordInUsername, isReservedUsername } from '#services/username_filter'

/**
 * Shared rule for email fields. Trims surrounding whitespace (mobile
 * keyboards often append a space) and lowercases so emails are stored
 * in a canonical form and compared case-insensitively everywhere.
 */
const email = () => vine.string().trim().email().toLowerCase().maxLength(254)

/**
 * Shared rule for passwords: at least 8 characters including at least
 * one capital letter and one symbol (see docs/features.md).
 */
const password = () =>
  vine
    .string()
    .minLength(8)
    .maxLength(128)
    .regex(/^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).*$/)

/**
 * Rejects names that impersonate the site or its staff, then names
 * carrying profanity or a slur (see `#services/username_filter`). The
 * two are reported separately because they are different mistakes:
 * someone typing "admin" should be told the name is taken by the site,
 * not that it is offensive.
 *
 * Neither message names what matched. For profanity that is deliberate:
 * describing the rule to whoever tripped it is how you get a name that
 * evades it on the next attempt.
 */
const allowedUsername = vine.createRule(
  (value: unknown, _options: undefined, field: FieldContext) => {
    if (!field.isValid || typeof value !== 'string') {
      return
    }

    if (isReservedUsername(value)) {
      field.report('This username is reserved. Please choose another', 'reservedUsername', field)
      return
    }

    if (findBlockedWordInUsername(value) !== null) {
      field.report('This username is not allowed. Please choose another', 'blockedUsername', field)
    }
  }
)

/**
 * Shared rule for usernames: 3-20 characters, letters/digits/underscores,
 * no profanity, and not reserved. Applying the filter here covers renames
 * through the profile as well as signup, so it cannot be sidestepped by
 * signing up clean and changing the name afterwards.
 */
const username = () =>
  vine
    .string()
    .minLength(3)
    .maxLength(20)
    .regex(/^[A-Za-z0-9_]+$/)
    .use(allowedUsername())

/**
 * Validator to use when performing self-signup
 */
export const signupValidator = vine.create({
  username: username().unique({ table: 'users', column: 'username', caseInsensitive: true }),
  email: email().unique({ table: 'users', column: 'email', caseInsensitive: true }),
  password: password(),
  passwordConfirmation: vine.string().sameAs('password'),
})

/**
 * Validator for profile updates: every field is optional so a user can
 * change their username, their chat colour, or both in one request.
 * The uniqueness check excludes the requesting user (passed through
 * validation metadata) so keeping the current username is allowed.
 */
export const updateProfileValidator = vine.create({
  username: username()
    .unique({
      table: 'users',
      column: 'username',
      caseInsensitive: true,
      filter: (db, _value, field) => {
        const { userId } = field.meta as { userId: number }
        db.whereNot('id', userId)
      },
    })
    .optional(),
  chatColor: vine.enum(CHAT_USERNAME_COLORS).optional(),
})

/**
 * Validator to use before validating user credentials during login.
 * `identifier` accepts either the account's email address or its
 * username (see uids config on the User model).
 */
export const loginValidator = vine.create({
  identifier: vine.string().trim().minLength(1).maxLength(254),
  password: vine.string(),
  rememberMe: vine.boolean().optional(),
})
