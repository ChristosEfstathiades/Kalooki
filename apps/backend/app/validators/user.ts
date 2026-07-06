import vine from '@vinejs/vine'

/**
 * Shared rule for email fields.
 */
const email = () => vine.string().email().maxLength(254)

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
  avatar: vine.file({ size: '2mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }).optional(),
})

/**
 * Validator to use before validating user credentials
 * during login
 */
export const loginValidator = vine.create({
  email: email(),
  password: vine.string(),
  rememberMe: vine.boolean().optional(),
})
