import Group from '#models/group'
import GroupMember from '#models/group_member'
import { createGroupValidator, transferOwnershipValidator } from '#validators/group'
import { groupIdsOf, isGroupMember } from '#services/group_service'
import GroupTransformer from '#transformers/group_transformer'
import GroupDetailTransformer from '#transformers/group_detail_transformer'
import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

export default class GroupsController {
  /**
   * Lists the groups the user belongs to.
   */
  async index({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const groupIds = await groupIdsOf(user.id)

    if (groupIds.length === 0) {
      return serialize({ groups: GroupTransformer.transform([]) })
    }

    const groups = await Group.query().whereIn('id', groupIds).withCount('members').orderBy('name')
    return serialize({ groups: GroupTransformer.transform(groups) })
  }

  /**
   * Creates a private group with the user as owner and first member.
   */
  async store({ auth, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const { name } = await request.validateUsing(createGroupValidator)

    const group = await db.transaction(async (trx) => {
      const created = await Group.create({ name, ownerId: user.id }, { client: trx })
      await GroupMember.create({ groupId: created.id, userId: user.id }, { client: trx })
      return created
    })

    await group.load('owner')
    await group.load('members')
    return serialize({ group: GroupDetailTransformer.transform(group) })
  }

  /**
   * Shows a group with its member list. Members only.
   */
  async show({ auth, params, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const groupId = Number(params.id)

    if (!(await isGroupMember(groupId, user.id))) {
      throw new Exception('Group not found', { status: 404, code: 'E_GROUP_NOT_FOUND' })
    }

    const group = await Group.query()
      .where('id', groupId)
      .preload('owner')
      .preload('members', (query) => {
        query.orderBy('username')
      })
      .firstOrFail()

    return serialize({ group: GroupDetailTransformer.transform(group) })
  }

  /**
   * Transfers ownership to another member. Owner only.
   */
  async transfer({ auth, params, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const { userId } = await request.validateUsing(transferOwnershipValidator)

    const group = await this.getOwnedGroup(Number(params.id), user.id)
    if (userId === user.id) {
      throw new Exception('You already own this group', { status: 400, code: 'E_ALREADY_OWNER' })
    }
    if (!(await isGroupMember(group.id, userId))) {
      throw new Exception('Ownership can only be transferred to a group member', {
        status: 400,
        code: 'E_NOT_A_MEMBER',
      })
    }

    group.ownerId = userId
    await group.save()

    return serialize({ message: 'Ownership transferred' })
  }

  /**
   * Deletes the group, disbanding it for everyone. Owner only.
   */
  async destroy({ auth, params, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const group = await this.getOwnedGroup(Number(params.id), user.id)

    await group.delete()
    return serialize({ message: 'Group deleted' })
  }

  /**
   * Loads a group the user owns, or fails with 404/403.
   */
  private async getOwnedGroup(groupId: number, userId: number): Promise<Group> {
    const group = await Group.find(groupId)
    if (!group || !(await isGroupMember(groupId, userId))) {
      throw new Exception('Group not found', { status: 404, code: 'E_GROUP_NOT_FOUND' })
    }
    if (group.ownerId !== userId) {
      throw new Exception('Only the group owner can do this', {
        status: 403,
        code: 'E_NOT_GROUP_OWNER',
      })
    }
    return group
  }
}
