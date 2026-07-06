import type GroupInvite from '#models/group_invite'
import { publicUserShape } from '#transformers/public_user_transformer'
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
        owner: publicUserShape(this.resource.group.owner),
      },
      user: publicUserShape(this.resource.user),
    }
  }
}
