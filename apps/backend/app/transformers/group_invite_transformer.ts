import type GroupInvite from '#models/group_invite'
import PublicUserTransformer from '#transformers/public_user_transformer'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * A pending group invitation with enough context for the invitee to
 * decide. Expects group.owner and user to be preloaded.
 */
export default class GroupInviteTransformer extends BaseTransformer<GroupInvite> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'createdAt']),
      group: {
        id: this.resource.group.id,
        name: this.resource.group.name,
        // Nested plain objects are not walked by the serializer, so the
        // owner's public fields are picked directly instead of using
        // PublicUserTransformer here.
        owner: this.pick(this.resource.group.owner, ['id', 'username', 'avatarUrl', 'initials']),
      },
      user: PublicUserTransformer.transform(this.resource.user),
    }
  }
}
