import Group from '#models/group'
import GroupMember from '#models/group_member'
import { isGroupMember } from '#services/group_service'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

export default class GroupMembersController {
  /**
   * Removes a member from a group: either the user leaving on their
   * own, or the owner removing someone. The owner must transfer
   * ownership before leaving.
   */
  async destroy({ auth, params, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const groupId = Number(params.groupId)
    const targetUserId = Number(params.userId)

    const group = await Group.find(groupId)
    if (!group || !(await isGroupMember(groupId, user.id))) {
      throw new Exception('Group not found', { status: 404, code: 'E_GROUP_NOT_FOUND' })
    }

    const isSelf = targetUserId === user.id
    if (!isSelf && group.ownerId !== user.id) {
      throw new Exception('Only the group owner can remove members', {
        status: 403,
        code: 'E_NOT_GROUP_OWNER',
      })
    }
    if (targetUserId === group.ownerId) {
      throw new Exception(
        'The owner cannot leave or be removed, transfer ownership or delete the group instead',
        { status: 400, code: 'E_OWNER_CANNOT_LEAVE' }
      )
    }

    const membership = await GroupMember.query()
      .where('groupId', groupId)
      .where('userId', targetUserId)
      .first()
    if (!membership) {
      throw new Exception('This player is not a member of the group', {
        status: 404,
        code: 'E_MEMBER_NOT_FOUND',
      })
    }

    await membership.delete()
    return serialize({ message: isSelf ? 'You left the group' : 'Member removed' })
  }
}
