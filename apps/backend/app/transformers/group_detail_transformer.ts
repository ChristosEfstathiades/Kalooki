import type Group from '#models/group'
import PublicUserTransformer from '#transformers/public_user_transformer'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * Full group view for members: owner and member list as public
 * profiles. Expects owner and members to be preloaded.
 */
export default class GroupDetailTransformer extends BaseTransformer<Group> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'name', 'ownerId', 'createdAt']),
      owner: PublicUserTransformer.transform(this.resource.owner),
      members: PublicUserTransformer.transform(this.resource.members),
    }
  }
}
