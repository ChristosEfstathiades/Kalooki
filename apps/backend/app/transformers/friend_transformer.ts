import { publicUserShape } from '#transformers/public_user_transformer'
import { isOnline } from '#services/presence_service'
import type User from '#models/user'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * A friend as shown in the friends list: the public user shape plus
 * whether they currently have a live connection. Presence only ever
 * goes out to a user's own friends (docs/features.md).
 */
export default class FriendTransformer extends BaseTransformer<User> {
  toObject() {
    return {
      ...publicUserShape(this.resource),
      online: isOnline(this.resource.id),
    }
  }
}
