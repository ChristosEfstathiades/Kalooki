import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import User from '#models/user'
import Group from '#models/group'
import GroupMember from '#models/group_member'
import ChatMessage from '#models/chat_message'
import ModerationAction from '#models/moderation_action'
import { postChatMessage, recentChatMessages, resetChatRateLimits } from '#services/chat_service'
import testUtils from '@adonisjs/core/services/test_utils'
import type { UserRole } from '#services/role_service'

/**
 * Creates a user at a given authorization level, with a valid password
 * for auth-client logins.
 */
async function makeUser(username: string, role: UserRole = 'player'): Promise<User> {
  return User.create({
    username,
    email: `${username}@example.com`,
    password: 'Kalooki!23',
    role,
  })
}

test.group('Moderation | authorization', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => resetChatRateLimits())

  test('moderation routes reject unauthenticated and plain players', async ({ client }) => {
    const alice = await makeUser('alice')
    const bob = await makeUser('bob')

    const anonymous = await client.post(`/api/v1/moderation/users/${bob.id}/ban`)
    anonymous.assertStatus(401)

    const asPlayer = await client.post(`/api/v1/moderation/users/${bob.id}/ban`).loginAs(alice)
    asPlayer.assertStatus(403)
  })

  test('admin routes reject moderators', async ({ client }) => {
    const mod = await makeUser('mod', 'moderator')

    const response = await client.get('/api/v1/admin/users').loginAs(mod)
    response.assertStatus(403)
  })

  test('moderators cannot act on peers or themselves, admins can act on moderators', async ({
    client,
    assert,
  }) => {
    const modOne = await makeUser('mod_one', 'moderator')
    const modTwo = await makeUser('mod_two', 'moderator')
    const admin = await makeUser('boss', 'admin')

    const onPeer = await client.post(`/api/v1/moderation/users/${modTwo.id}/ban`).loginAs(modOne)
    onPeer.assertStatus(403)

    const onSelf = await client.post(`/api/v1/moderation/users/${modOne.id}/ban`).loginAs(modOne)
    onSelf.assertStatus(403)

    const byAdmin = await client.post(`/api/v1/moderation/users/${modTwo.id}/ban`).loginAs(admin)
    byAdmin.assertStatus(200)
    await modTwo.refresh()
    assert.isNotNull(modTwo.bannedAt)
  })
})

test.group('Moderation | chat messages', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => resetChatRateLimits())

  test('a moderator deletes a global message and it disappears for everyone', async ({
    client,
    assert,
  }) => {
    const alice = await makeUser('alice')
    const mod = await makeUser('mod', 'moderator')
    const message = await postChatMessage(alice, { type: 'global' }, 'something nasty')

    const response = await client.delete(`/api/v1/moderation/messages/${message.id}`).loginAs(mod)
    response.assertStatus(200)

    // Soft-deleted: the row survives for reports and the audit trail
    const stored = await ChatMessage.findOrFail(message.id)
    assert.isNotNull(stored.deletedAt)
    assert.equal(stored.deletedBy, mod.id)

    const history = await recentChatMessages({ type: 'global' })
    assert.isEmpty(history.filter((entry) => entry.id === message.id))

    const audit = await ModerationAction.query().where('action', 'message.delete').firstOrFail()
    assert.equal(audit.actorId, mod.id)
    assert.equal(audit.messageId, message.id)
    assert.equal(audit.messageBody, 'something nasty')
  })

  test('deleting the same message twice reports it as gone', async ({ client }) => {
    const alice = await makeUser('alice')
    const mod = await makeUser('mod', 'moderator')
    const message = await postChatMessage(alice, { type: 'global' }, 'first')

    await client.delete(`/api/v1/moderation/messages/${message.id}`).loginAs(mod)
    const second = await client.delete(`/api/v1/moderation/messages/${message.id}`).loginAs(mod)
    second.assertStatus(404)
  })

  test('private group messages are out of reach', async ({ client }) => {
    const alice = await makeUser('alice')
    const mod = await makeUser('mod', 'moderator')
    const groupRow = await Group.create({ name: 'The Regulars', ownerId: alice.id })
    await GroupMember.create({ groupId: groupRow.id, userId: alice.id })
    const message = await postChatMessage(
      alice,
      { type: 'group', groupId: groupRow.id },
      'private talk'
    )

    const response = await client.delete(`/api/v1/moderation/messages/${message.id}`).loginAs(mod)
    response.assertStatus(403)
  })

  test('a deleted message can no longer be reported', async ({ client }) => {
    const alice = await makeUser('alice')
    const bob = await makeUser('bob')
    const mod = await makeUser('mod', 'moderator')
    const message = await postChatMessage(alice, { type: 'global' }, 'something nasty')

    await client.delete(`/api/v1/moderation/messages/${message.id}`).loginAs(mod)
    const report = await client.post(`/api/v1/chat/messages/${message.id}/report`).loginAs(bob)
    report.assertStatus(404)
  })
})

test.group('Moderation | bans', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => resetChatRateLimits())

  test('a banned user cannot sign in and their tokens are revoked', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const mod = await makeUser('mod', 'moderator')

    const signin = await client.post('/api/v1/auth/login').json({
      identifier: 'alice',
      password: 'Kalooki!23',
      rememberMe: false,
    })
    signin.assertStatus(200)
    const tokensBeforeBan = await User.accessTokens.all(alice)
    assert.isAbove(tokensBeforeBan.length, 0)

    const ban = await client
      .post(`/api/v1/moderation/users/${alice.id}/ban`)
      .json({ reason: 'Racial abuse in the global chat' })
      .loginAs(mod)
    ban.assertStatus(200)

    await alice.refresh()
    assert.isNotNull(alice.bannedAt)
    assert.equal(alice.bannedBy, mod.id)
    assert.equal(alice.banReason, 'Racial abuse in the global chat')
    assert.lengthOf(await User.accessTokens.all(alice), 0)

    const blocked = await client.post('/api/v1/auth/login').json({
      identifier: 'alice',
      password: 'Kalooki!23',
      rememberMe: false,
    })
    blocked.assertStatus(403)
    blocked.assertBodyContains({
      message: 'Your account has been banned. Reason: Racial abuse in the global chat',
    })
  })

  test('a banned user is rejected on authenticated requests', async ({ client }) => {
    const alice = await makeUser('alice')
    alice.bannedAt = DateTime.now()
    await alice.save()

    const response = await client.get('/api/v1/account/profile').loginAs(alice)
    response.assertStatus(403)
  })

  test('banning twice conflicts, and lifting a ban restores sign in', async ({
    client,
    assert,
  }) => {
    const alice = await makeUser('alice')
    const mod = await makeUser('mod', 'moderator')

    await client.post(`/api/v1/moderation/users/${alice.id}/ban`).loginAs(mod)
    const again = await client.post(`/api/v1/moderation/users/${alice.id}/ban`).loginAs(mod)
    again.assertStatus(409)

    const lift = await client.delete(`/api/v1/moderation/users/${alice.id}/ban`).loginAs(mod)
    lift.assertStatus(200)

    await alice.refresh()
    assert.isNull(alice.bannedAt)
    assert.isNull(alice.banReason)

    const signin = await client.post('/api/v1/auth/login').json({
      identifier: 'alice',
      password: 'Kalooki!23',
      rememberMe: false,
    })
    signin.assertStatus(200)
  })
})

test.group('Moderation | mutes', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => resetChatRateLimits())

  test('a muted user cannot post but can still read chat', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const mod = await makeUser('mod', 'moderator')

    const mute = await client
      .post(`/api/v1/moderation/users/${alice.id}/mute`)
      .json({ durationMinutes: 60, reason: 'Spamming' })
      .loginAs(mod)
    mute.assertStatus(200)

    await alice.refresh()
    await assert.rejects(() => postChatMessage(alice, { type: 'global' }, 'let me in'))

    // Reading is unaffected
    const history = await client.get('/api/v1/chat/global/messages').loginAs(alice)
    history.assertStatus(200)
  })

  test('a permanent mute has no expiry, and an expired mute stops applying', async ({
    client,
    assert,
  }) => {
    const alice = await makeUser('alice')
    const mod = await makeUser('mod', 'moderator')

    const permanent = await client
      .post(`/api/v1/moderation/users/${alice.id}/mute`)
      .json({ durationMinutes: null })
      .loginAs(mod)
    permanent.assertStatus(200)
    await alice.refresh()
    assert.isNotNull(alice.mutedAt)
    assert.isNull(alice.mutedUntil)

    // Back-date the expiry: the mute has run out, so posting works again
    alice.mutedUntil = DateTime.now().minus({ minutes: 1 })
    await alice.save()
    const message = await postChatMessage(alice, { type: 'global' }, 'back again')
    assert.equal(message.body, 'back again')
  })

  test('mute durations outside the offered lengths are rejected', async ({ client }) => {
    const alice = await makeUser('alice')
    const mod = await makeUser('mod', 'moderator')

    const response = await client
      .post(`/api/v1/moderation/users/${alice.id}/mute`)
      .json({ durationMinutes: 7 })
      .loginAs(mod)
    response.assertStatus(422)
  })

  test('lifting a mute that is not set conflicts', async ({ client }) => {
    const alice = await makeUser('alice')
    const mod = await makeUser('mod', 'moderator')

    const response = await client.delete(`/api/v1/moderation/users/${alice.id}/mute`).loginAs(mod)
    response.assertStatus(409)
  })
})

test.group('Admin | users and audit trail', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => resetChatRateLimits())

  test('the user list pages, searches and filters by role', async ({ client, assert }) => {
    const admin = await makeUser('boss', 'admin')
    await makeUser('alice')
    await makeUser('bob')
    await makeUser('carol', 'moderator')

    const all = await client.get('/api/v1/admin/users').loginAs(admin)
    all.assertStatus(200)
    assert.equal(all.body().data.meta.total, 4)

    const searched = await client.get('/api/v1/admin/users').qs({ search: 'ALI' }).loginAs(admin)
    assert.lengthOf(searched.body().data.users, 1)
    assert.equal(searched.body().data.users[0].username, 'alice')

    const mods = await client.get('/api/v1/admin/users').qs({ role: 'moderator' }).loginAs(admin)
    assert.lengthOf(mods.body().data.users, 1)
    assert.equal(mods.body().data.users[0].username, 'carol')

    const paged = await client.get('/api/v1/admin/users').qs({ page: 2, perPage: 3 }).loginAs(admin)
    assert.lengthOf(paged.body().data.users, 1)
    assert.equal(paged.body().data.meta.lastPage, 2)
  })

  test('an admin promotes and demotes users but never themselves', async ({ client, assert }) => {
    const admin = await makeUser('boss', 'admin')
    const alice = await makeUser('alice')

    const promote = await client
      .patch(`/api/v1/admin/users/${alice.id}/role`)
      .json({ role: 'moderator' })
      .loginAs(admin)
    promote.assertStatus(200)
    await alice.refresh()
    assert.equal(alice.role, 'moderator')

    const unchanged = await client
      .patch(`/api/v1/admin/users/${alice.id}/role`)
      .json({ role: 'moderator' })
      .loginAs(admin)
    unchanged.assertStatus(409)

    const self = await client
      .patch(`/api/v1/admin/users/${admin.id}/role`)
      .json({ role: 'player' })
      .loginAs(admin)
    self.assertStatus(403)
  })

  test('the audit feed records who did what, newest first', async ({ client, assert }) => {
    const admin = await makeUser('boss', 'admin')
    const alice = await makeUser('alice')

    await client
      .patch(`/api/v1/admin/users/${alice.id}/role`)
      .json({ role: 'moderator' })
      .loginAs(admin)
    await client
      .post(`/api/v1/moderation/users/${alice.id}/mute`)
      .json({ durationMinutes: 60, reason: 'Cooling off' })
      .loginAs(admin)

    const feed = await client.get('/api/v1/admin/moderation-actions').loginAs(admin)
    feed.assertStatus(200)

    const actions = feed.body().data.actions as Array<Record<string, unknown>>
    assert.equal(actions[0].action, 'user.mute')
    assert.equal(actions[0].actorUsername, 'boss')
    assert.equal(actions[0].targetUsername, 'alice')
    assert.equal(actions[0].reason, 'Cooling off')
    assert.equal(actions[1].action, 'user.role')
    assert.include(String(actions[1].details), '"to":"moderator"')
  })
})
