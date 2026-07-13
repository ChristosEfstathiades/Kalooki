import vine from '@vinejs/vine'
import { CHAT_USERNAME_COLORS } from '#services/chat_service'

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
 * Shared rule for usernames: 3-20 characters, letters/digits/underscores.
 */
const username = () =>
  vine
    .string()
    .minLength(3)
    .maxLength(20)
    .regex(/^[A-Za-z0-9_]+$/)

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
