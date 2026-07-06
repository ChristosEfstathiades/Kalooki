/*
|--------------------------------------------------------------------------
| Validator file
|--------------------------------------------------------------------------
|
| The validator file is used for configuring global transforms for VineJS.
| The transform below converts all VineJS date outputs from JavaScript
| Date objects to Luxon DateTime instances, so that validated dates are
| ready to use with Lucid models and other parts of the app that expect
| Luxon DateTime.
|
*/

import { DateTime } from 'luxon'
import vine, { VineDate, SimpleMessagesProvider } from '@vinejs/vine'

declare module '@vinejs/vine/types' {
  interface VineGlobalTransforms {
    date: DateTime
  }
}

VineDate.transform((value) => DateTime.fromJSDate(value))

/**
 * Human-readable messages for rules whose defaults are too vague
 * (see docs/Coding-Conventions.md on descriptive error messages).
 */
vine.messagesProvider = new SimpleMessagesProvider({
  'password.regex': 'Password must include at least one capital letter and one symbol',
  'username.regex': 'Username can only contain letters, numbers, and underscores',
  'passwordConfirmation.sameAs': 'Password confirmation does not match the password',
  'database.unique': 'This {{ field }} is already taken',
})
