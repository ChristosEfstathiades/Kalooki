import type FriendRequest from '#models/friend_request'
import PublicUserTransformer from '#transformers/public_user_transformer'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * A pending friend request with both parties as public profiles.
 * Expects sender and recipient to be preloaded.
 */
export default class FriendRequestTransformer extends BaseTransformer<FriendRequest> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'createdAt']),
      sender: PublicUserTransformer.transform(this.resource.sender),
      recipient: PublicUserTransformer.transform(this.resource.recipient),
    }
  }
}
