import vine from '@vinejs/vine'

/**
 * Validator for creating a private group. Names only need to be unique
 * among groups the requesting user already owns (passed through
 * validation metadata), not globally.
 */
export const createGroupValidator = vine.create({
  name: vine
    .string()
    .trim()
    .minLength(3)
    .maxLength(50)
    .unique({
      table: 'groups',
      column: 'name',
      caseInsensitive: true,
      filter: (db, _value, field) => {
        const { ownerId } = field.meta as { ownerId: number }
        db.where('owner_id', ownerId)
      },
    }),
})

/**
 * Validator for inviting a friend to a group by exact username.
 */
export const inviteToGroupValidator = vine.create({
  username: vine.string().trim().minLength(1).maxLength(32),
})

/**
 * Validator for transferring group ownership to another member.
 */
export const transferOwnershipValidator = vine.create({
  userId: vine.number().positive(),
})
