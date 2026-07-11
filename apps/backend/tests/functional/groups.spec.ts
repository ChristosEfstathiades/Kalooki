import { test } from '@japa/runner'
import User from '#models/user'
import Group from '#models/group'
import GroupMember from '#models/group_member'
import { createFriendship } from '#services/friendship_service'
import { MAX_GROUP_MEMBERS } from '#services/group_service'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * Creates a user with a valid password for auth-client logins.
 */
async function makeUser(username: string): Promise<User> {
  return User.create({
    username,
    email: `${username}@example.com`,
    password: 'Kalooki!23',
  })
}

/**
 * Creates a group owned by the user (with their membership row), the
 * same way the store endpoint does.
 */
async function makeGroup(owner: User, name: string): Promise<Group> {
  const group = await Group.create({ name, ownerId: owner.id })
  await GroupMember.create({ groupId: group.id, userId: owner.id })
  return group
}

/**
 * Narrows a response body's data. The typed test client unions the
 * response shapes of routes that share a pattern across HTTP methods
 * (e.g. GET and POST /groups), so member access needs a cast.
 */
function dataOf<T>(response: { body: () => unknown }): T {
  return (response.body() as { data: T }).data
}

test.group('Groups', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creating a group makes the creator owner and first member', async ({ client, assert }) => {
    const alice = await makeUser('alice')

    const response = await client
      .post('/api/v1/groups')
      .json({ name: 'Friday Kalooki' })
      .loginAs(alice)
    response.assertStatus(200)
    const created = dataOf<{
      group: { name: string; ownerId: number; members: { username: string }[] }
    }>(response).group
    assert.equal(created.name, 'Friday Kalooki')
    assert.equal(created.ownerId, alice.id)
    assert.lengthOf(created.members, 1)

    const list = await client.get('/api/v1/groups').loginAs(alice)
    assert.equal(dataOf<{ groups: { memberCount: number }[] }>(list).groups[0].memberCount, 1)
  })

  test('only members can view a group', async ({ client }) => {
    const alice = await makeUser('alice')
    const mallory = await makeUser('mallory')
    const kalookiGroup = await makeGroup(alice, 'Secret Club')

    const asMember = await client.get(`/api/v1/groups/${kalookiGroup.id}`).loginAs(alice)
    asMember.assertStatus(200)

    const asStranger = await client.get(`/api/v1/groups/${kalookiGroup.id}`).loginAs(mallory)
    asStranger.assertStatus(404)
  })

  test('a user cannot own two groups with the same name, but different owners can', async ({
    client,
  }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    await makeGroup(alice, 'Friday Kalooki')

    const duplicate = await client
      .post('/api/v1/groups')
      .json({ name: 'Friday Kalooki' })
      .loginAs(alice)
    duplicate.assertStatus(422)

    const caseInsensitiveDuplicate = await client
      .post('/api/v1/groups')
      .json({ name: 'friday kalooki' })
      .loginAs(alice)
    caseInsensitiveDuplicate.assertStatus(422)

    const sameNameOtherOwner = await client
      .post('/api/v1/groups')
      .json({ name: 'Friday Kalooki' })
      .loginAs(bobby)
    sameNameOtherOwner.assertStatus(200)
  })

  test('the owner is always listed first among the group members', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const zach = await makeUser('zach')
    const kalookiGroup = await makeGroup(alice, 'Card Sharks')
    await GroupMember.create({ groupId: kalookiGroup.id, userId: zach.id })

    const detail = await client.get(`/api/v1/groups/${kalookiGroup.id}`).loginAs(alice)
    const members = dataOf<{ group: { members: { username: string }[] } }>(detail).group.members
    assert.equal(members[0].username, 'alice')
    assert.equal(members[1].username, 'zach')
  })

  test('owner deleting the group disbands it for everyone', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const kalookiGroup = await makeGroup(alice, 'Doomed Group')
    await GroupMember.create({ groupId: kalookiGroup.id, userId: bobby.id })

    const byMember = await client.delete(`/api/v1/groups/${kalookiGroup.id}`).loginAs(bobby)
    byMember.assertStatus(403)

    const byOwner = await client.delete(`/api/v1/groups/${kalookiGroup.id}`).loginAs(alice)
    byOwner.assertStatus(200)

    const bobbysGroups = await client.get('/api/v1/groups').loginAs(bobby)
    assert.lengthOf(dataOf<{ groups: unknown[] }>(bobbysGroups).groups, 0)
  })
})

test.group('Group invites', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('owner can invite a friend, who can accept and join', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    await createFriendship(alice.id, bobby.id)
    const kalookiGroup = await makeGroup(alice, 'Card Sharks')

    const invite = await client
      .post(`/api/v1/groups/${kalookiGroup.id}/invites`)
      .json({ username: 'bobby' })
      .loginAs(alice)
    invite.assertStatus(200)

    const invites = await client.get('/api/v1/group-invites').loginAs(bobby)
    const pending = invites.body().data.invites
    assert.lengthOf(pending, 1)
    assert.equal(pending[0].group.name, 'Card Sharks')
    assert.equal(pending[0].group.owner.username, 'alice')

    const accept = await client.post(`/api/v1/group-invites/${pending[0].id}/accept`).loginAs(bobby)
    accept.assertStatus(200)

    const detail = await client.get(`/api/v1/groups/${kalookiGroup.id}`).loginAs(bobby)
    detail.assertStatus(200)
    assert.lengthOf(detail.body().data.group.members, 2)
  })

  test('only the owner can invite, and only their friends', async ({ client }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const carol = await makeUser('carol')
    await createFriendship(alice.id, bobby.id)
    await createFriendship(bobby.id, carol.id)
    const kalookiGroup = await makeGroup(alice, 'Card Sharks')
    await GroupMember.create({ groupId: kalookiGroup.id, userId: bobby.id })

    // Bobby is a member but not the owner
    const byMember = await client
      .post(`/api/v1/groups/${kalookiGroup.id}/invites`)
      .json({ username: 'carol' })
      .loginAs(bobby)
    byMember.assertStatus(403)

    // Carol is not Alice's friend
    const notFriend = await client
      .post(`/api/v1/groups/${kalookiGroup.id}/invites`)
      .json({ username: 'carol' })
      .loginAs(alice)
    notFriend.assertStatus(403)
  })

  test('invitee can decline and owner can revoke', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    await createFriendship(alice.id, bobby.id)
    const kalookiGroup = await makeGroup(alice, 'Card Sharks')

    const first = await client
      .post(`/api/v1/groups/${kalookiGroup.id}/invites`)
      .json({ username: 'bobby' })
      .loginAs(alice)
    const firstId = first.body().data.invite.id

    const decline = await client.delete(`/api/v1/group-invites/${firstId}`).loginAs(bobby)
    decline.assertStatus(200)

    const second = await client
      .post(`/api/v1/groups/${kalookiGroup.id}/invites`)
      .json({ username: 'bobby' })
      .loginAs(alice)
    const secondId = second.body().data.invite.id

    const revoke = await client.delete(`/api/v1/group-invites/${secondId}`).loginAs(alice)
    revoke.assertStatus(200)

    const invites = await client.get('/api/v1/group-invites').loginAs(bobby)
    assert.lengthOf(invites.body().data.invites, 0)
  })

  test('group detail lists pending invites until accepted or revoked', async ({
    client,
    assert,
  }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    await createFriendship(alice.id, bobby.id)
    const kalookiGroup = await makeGroup(alice, 'Card Sharks')

    const invite = await client
      .post(`/api/v1/groups/${kalookiGroup.id}/invites`)
      .json({ username: 'bobby' })
      .loginAs(alice)
    const inviteId = invite.body().data.invite.id

    const detail = await client.get(`/api/v1/groups/${kalookiGroup.id}`).loginAs(alice)
    detail.assertStatus(200)
    const pendingInvites = detail.body().data.group.pendingInvites
    assert.lengthOf(pendingInvites, 1)
    assert.equal(pendingInvites[0].id, inviteId)
    assert.equal(pendingInvites[0].user.username, 'bobby')
    assert.notProperty(pendingInvites[0].user, 'email')

    const revoke = await client.delete(`/api/v1/group-invites/${inviteId}`).loginAs(alice)
    revoke.assertStatus(200)

    const afterRevoke = await client.get(`/api/v1/groups/${kalookiGroup.id}`).loginAs(alice)
    assert.lengthOf(afterRevoke.body().data.group.pendingInvites, 0)
  })

  test('groups are capped at 50 members', async ({ client }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    await createFriendship(alice.id, bobby.id)
    const kalookiGroup = await makeGroup(alice, 'Full House')

    // Fill the group to the cap with filler members
    const fillers = await Promise.all(
      Array.from({ length: MAX_GROUP_MEMBERS - 1 }, (_, index) => makeUser(`filler_${index}`))
    )
    await GroupMember.createMany(
      fillers.map((filler) => ({ groupId: kalookiGroup.id, userId: filler.id }))
    )

    const invite = await client
      .post(`/api/v1/groups/${kalookiGroup.id}/invites`)
      .json({ username: 'bobby' })
      .loginAs(alice)
    invite.assertStatus(409)
  })
})

test.group('Group membership', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('members can leave; the owner cannot leave without transferring', async ({
    client,
    assert,
  }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const kalookiGroup = await makeGroup(alice, 'Card Sharks')
    await GroupMember.create({ groupId: kalookiGroup.id, userId: bobby.id })

    const ownerLeaves = await client
      .delete(`/api/v1/groups/${kalookiGroup.id}/members/${alice.id}`)
      .loginAs(alice)
    ownerLeaves.assertStatus(400)

    const bobbyLeaves = await client
      .delete(`/api/v1/groups/${kalookiGroup.id}/members/${bobby.id}`)
      .loginAs(bobby)
    bobbyLeaves.assertStatus(200)

    const bobbysGroups = await client.get('/api/v1/groups').loginAs(bobby)
    assert.lengthOf(dataOf<{ groups: unknown[] }>(bobbysGroups).groups, 0)
  })

  test('only the owner can remove other members', async ({ client }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const carol = await makeUser('carol')
    const kalookiGroup = await makeGroup(alice, 'Card Sharks')
    await GroupMember.create({ groupId: kalookiGroup.id, userId: bobby.id })
    await GroupMember.create({ groupId: kalookiGroup.id, userId: carol.id })

    const byMember = await client
      .delete(`/api/v1/groups/${kalookiGroup.id}/members/${carol.id}`)
      .loginAs(bobby)
    byMember.assertStatus(403)

    const byOwner = await client
      .delete(`/api/v1/groups/${kalookiGroup.id}/members/${carol.id}`)
      .loginAs(alice)
    byOwner.assertStatus(200)
  })

  test('ownership transfers only to members, then the old owner can leave', async ({ client }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const carol = await makeUser('carol')
    const kalookiGroup = await makeGroup(alice, 'Card Sharks')
    await GroupMember.create({ groupId: kalookiGroup.id, userId: bobby.id })

    const toNonMember = await client
      .post(`/api/v1/groups/${kalookiGroup.id}/transfer`)
      .json({ userId: carol.id })
      .loginAs(alice)
    toNonMember.assertStatus(400)

    const toMember = await client
      .post(`/api/v1/groups/${kalookiGroup.id}/transfer`)
      .json({ userId: bobby.id })
      .loginAs(alice)
    toMember.assertStatus(200)

    const oldOwnerLeaves = await client
      .delete(`/api/v1/groups/${kalookiGroup.id}/members/${alice.id}`)
      .loginAs(alice)
    oldOwnerLeaves.assertStatus(200)
  })
})
