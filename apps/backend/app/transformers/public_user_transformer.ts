import type User from '#models/user'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * The public shape of a user, safe to show to other players: no email
 * or other private fields. Exported so other transformers can embed a
 * user without nesting transformer instances (nested instances are not
 * carried through the generated client's response types).
 */
export function publicUserShape(user: User) {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    initials: user.initials,
    chatColor: user.chatColor,
  }
}

export default class PublicUserTransformer extends BaseTransformer<User> {
  toObject() {
    return publicUserShape(this.resource)
  }
}
