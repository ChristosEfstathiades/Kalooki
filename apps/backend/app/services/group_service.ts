import GroupMember from '#models/group_member'

/**
 * Groups are limited to 50 members (docs/features.md).
 */
export const MAX_GROUP_MEMBERS = 50

/**
 * Checks whether a user belongs to a group.
 */
export async function isGroupMember(groupId: number, userId: number): Promise<boolean> {
  const membership = await GroupMember.query()
    .where('groupId', groupId)
    .where('userId', userId)
    .first()
  return membership !== null
}

/**
 * Counts a group's current members.
 */
export async function groupMemberCount(groupId: number): Promise<number> {
  const memberships = await GroupMember.query()
    .where('groupId', groupId)
    .count('* as total')
    .first()
  return memberships ? Number(memberships.$extras.total) : 0
}

/**
 * Ids of every group the user belongs to.
 */
export async function groupIdsOf(userId: number): Promise<number[]> {
  const memberships = await GroupMember.query().where('userId', userId)
  return memberships.map((membership) => membership.groupId)
}
