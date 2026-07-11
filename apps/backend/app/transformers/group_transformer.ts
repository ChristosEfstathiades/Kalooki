import type Group from '#models/group'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * Group summary for list views. Expects the query to have used
 * withCount('members') so the member total is available.
 */
export default class GroupTransformer extends BaseTransformer<Group> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'name', 'ownerId', 'createdAt']),
      memberCount: Number(this.resource.$extras.members_count ?? 0),
      memberIds: this.resource.members.map((member) => member.id),
    }
  }
}
