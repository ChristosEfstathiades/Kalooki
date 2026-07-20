import type User from '#models/user'
import { isMuted } from '#services/role_service'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class UserTransformer extends BaseTransformer<User> {
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'username',
        'email',
        'chatColor',
        'role',
        'createdAt',
        'updatedAt',
      ]),
      // The signed-in user's own moderation state, so the UI can show
      // moderator controls and explain a blocked chat input. Null
      // mutedUntil while muted means the mute is permanent.
      isMuted: isMuted(this.resource),
      mutedUntil: this.resource.mutedUntil?.toISO() ?? null,
      muteReason: this.resource.muteReason,
    }
  }
}
