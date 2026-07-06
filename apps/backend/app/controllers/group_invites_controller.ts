import Group from '#models/group'
import GroupInvite from '#models/group_invite'
import GroupMember from '#models/group_member'
import { inviteToGroupValidator } from '#validators/group'
import { areFriends } from '#services/friendship_service'
import { findByExactUsername } from '#services/user_lookup'
import { MAX_GROUP_MEMBERS, groupMemberCount, isGroupMember } from '#services/group_service'
import GroupInviteTransformer from '#transformers/group_invite_transformer'
import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

export default class GroupInvitesController {
  /**
   * Lists the user's pending group invitations.
   */
  async index({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()

    const invites = await GroupInvite.query()
      .where('userId', user.id)
      .preload('user')
      .preload('group', (query) => {
        query.preload('owner')
      })
      .orderBy('createdAt', 'desc')

    return serialize({ invites: GroupInviteTransformer.transform(invites) })
  }

  /**
   * Invites a friend to the group by exact username. Only the owner
   * can invite, and only people they are friends with.
   */
  async store({ auth, params, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const groupId = Number(params.groupId)
    const { username } = await request.validateUsing(inviteToGroupValidator)

    const group = await Group.find(groupId)
    if (!group || !(await isGroupMember(groupId, user.id))) {
      throw new Exception('Group not found', { status: 404, code: 'E_GROUP_NOT_FOUND' })
    }
    if (group.ownerId !== user.id) {
      throw new Exception('Only the group owner can send invites', {
        status: 403,
        code: 'E_NOT_GROUP_OWNER',
      })
    }

    const invitee = await findByExactUsername(username)
    if (!invitee) {
      throw new Exception('No player found with that exact username', {
        status: 404,
        code: 'E_USER_NOT_FOUND',
      })
    }
    if (invitee.id === user.id) {
      throw new Exception('You are already in this group', { status: 400, code: 'E_SELF_INVITE' })
    }
    if (!(await areFriends(user.id, invitee.id))) {
      throw new Exception('You can only invite players you are friends with', {
        status: 403,
        code: 'E_NOT_FRIENDS',
      })
    }
    if (await isGroupMember(groupId, invitee.id)) {
      throw new Exception(`${invitee.username} is already a member of this group`, {
        status: 409,
        code: 'E_ALREADY_MEMBER',
      })
    }

    const existingInvite = await GroupInvite.query()
      .where('groupId', groupId)
      .where('userId', invitee.id)
      .first()
    if (existingInvite) {
      throw new Exception(`${invitee.username} already has a pending invite to this group`, {
        status: 409,
        code: 'E_INVITE_EXISTS',
      })
    }

    if ((await groupMemberCount(groupId)) >= MAX_GROUP_MEMBERS) {
      throw new Exception(`Groups are limited to ${MAX_GROUP_MEMBERS} members`, {
        status: 409,
        code: 'E_GROUP_FULL',
      })
    }

    const invite = await GroupInvite.create({ groupId, userId: invitee.id })
    await invite.load('user')
    await invite.load('group', (query) => {
      query.preload('owner')
    })

    return serialize({ invite: GroupInviteTransformer.transform(invite) })
  }

  /**
   * Accepts an invitation, joining the group. The member cap is
   * re-checked at accept time.
   */
  async accept({ auth, params, serialize }: HttpContext) {
    const user = auth.getUserOrFail()

    const invite = await GroupInvite.query()
      .where('id', Number(params.id))
      .where('userId', user.id)
      .first()
    if (!invite) {
      throw new Exception('Invite not found', { status: 404, code: 'E_INVITE_NOT_FOUND' })
    }

    if ((await groupMemberCount(invite.groupId)) >= MAX_GROUP_MEMBERS) {
      throw new Exception(`Groups are limited to ${MAX_GROUP_MEMBERS} members`, {
        status: 409,
        code: 'E_GROUP_FULL',
      })
    }

    await db.transaction(async (trx) => {
      invite.useTransaction(trx)
      await GroupMember.create({ groupId: invite.groupId, userId: user.id }, { client: trx })
      await invite.delete()
    })

    return serialize({ message: 'Invite accepted', groupId: invite.groupId })
  }

  /**
   * Deletes a pending invite: the invitee declining it, or the group
   * owner revoking it.
   */
  async destroy({ auth, params, serialize }: HttpContext) {
    const user = auth.getUserOrFail()

    const invite = await GroupInvite.query().where('id', Number(params.id)).preload('group').first()
    if (!invite || (invite.userId !== user.id && invite.group.ownerId !== user.id)) {
      throw new Exception('Invite not found', { status: 404, code: 'E_INVITE_NOT_FOUND' })
    }

    await invite.delete()
    return serialize({ message: 'Invite removed' })
  }
}
