import type Group from '#models/group'
import { publicUserShape } from '#transformers/public_user_transformer'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * Full group view for members: owner, member list, and pending invites
 * as public profiles. Expects owner, members, and invites (with their
 * users) to be preloaded.
 */
export default class GroupDetailTransformer extends BaseTransformer<Group> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'name', 'ownerId', 'createdAt']),
      owner: publicUserShape(this.resource.owner),
      members: [...this.resource.members]
        .sort(
          (a, b) => Number(b.id === this.resource.ownerId) - Number(a.id === this.resource.ownerId)
        )
        .map(publicUserShape),
      pendingInvites: this.resource.invites.map((invite) => ({
        id: invite.id,
        createdAt: invite.createdAt.toISO(),
        user: publicUserShape(invite.user),
      })),
    }
  }
}
