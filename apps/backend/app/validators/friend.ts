import vine from '@vinejs/vine'

/**
 * Validator for sending a friend request: the exact username of the
 * player to befriend.
 */
export const sendFriendRequestValidator = vine.create({
  username: vine.string().trim().minLength(1).maxLength(32),
})
