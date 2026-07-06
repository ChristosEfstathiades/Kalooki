import vine from '@vinejs/vine'

/**
 * Validator for creating a private group.
 */
export const createGroupValidator = vine.create({
  name: vine.string().trim().minLength(3).maxLength(50),
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
