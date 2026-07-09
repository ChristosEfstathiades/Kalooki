import vine from '@vinejs/vine'

/**
 * Validator for the match-history list filters, passed as query
 * parameters. Every field is optional; the defaults (all kinds,
 * newest first, wins and losses alike) apply when omitted.
 */
export const matchHistoryFilterValidator = vine.create({
  kind: vine.enum(['public', 'private']).optional(),
  sort: vine.enum(['newest', 'oldest']).optional(),
  wonOnly: vine.boolean().optional(),
})
