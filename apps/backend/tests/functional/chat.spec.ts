import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import User from '#models/user'
import Group from '#models/group'
import GroupMember from '#models/group_member'
import ChatMessage from '#models/chat_message'
import MessageReport from '#models/message_report'
import {
  deleteExpiredChatMessages,
  postChatMessage,
  recentChatMessages,
  resetChatRateLimits,
} from '#services/chat_service'
import {
  applyGameAction,
  configureMatchService,
  createLobby,
  joinLobby,
  resetMatchService,
  startLobby,
} from '#services/game/match_service'
import { CLASSIC_RULES } from '#services/game/engine'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ActiveMatch, PlayerIdentity } from '#services/game/match_service'

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
 * Creates a group owned by the user, with their membership row.
 */
async function makeGroup(owner: User, name: string): Promise<Group> {
  const group = await Group.create({ name, ownerId: owner.id })
  await GroupMember.create({ groupId: group.id, userId: owner.id })
  return group
}

test.group('Chat messages', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => resetChatRateLimits())

  test('global history requires auth and returns recent messages oldest first', async ({
    client,
    assert,
  }) => {
    const alice = await makeUser('alice')

    const unauthenticated = await client.get('/api/v1/chat/global/messages')
    unauthenticated.assertStatus(401)

    await postChatMessage(alice, { type: 'global' }, 'first message')
    const response = await client.get('/api/v1/chat/global/messages').loginAs(alice)
    response.assertStatus(200)
    const messages = response.body().data.messages
    assert.lengthOf(messages, 1)
    assert.equal(messages[0].body, 'first message')
    assert.equal(messages[0].user.username, 'alice')
    assert.notProperty(messages[0].user, 'email')
  })

  test('group history is members-only', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const mallory = await makeUser('mallory')
    const sharks = await makeGroup(alice, 'Card Sharks')
    await postChatMessage(alice, { type: 'group', groupId: sharks.id }, 'members only')

    const asMember = await client.get(`/api/v1/groups/${sharks.id}/messages`).loginAs(alice)
    asMember.assertStatus(200)
    assert.lengthOf(asMember.body().data.messages, 1)

    const asStranger = await client.get(`/api/v1/groups/${sharks.id}/messages`).loginAs(mallory)
    asStranger.assertStatus(404)
  })

  test('group messages never appear in the global channel', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const sharks = await makeGroup(alice, 'Card Sharks')
    await postChatMessage(alice, { type: 'group', groupId: sharks.id }, 'private note')

    const globalHistory = await client.get('/api/v1/chat/global/messages').loginAs(alice)
    assert.lengthOf(globalHistory.body().data.messages, 0)
  })

  test('non-members cannot post to a group chat', async ({ assert }) => {
    const alice = await makeUser('alice')
    const mallory = await makeUser('mallory')
    const sharks = await makeGroup(alice, 'Card Sharks')

    await assert.rejects(
      () => postChatMessage(mallory, { type: 'group', groupId: sharks.id }, 'let me in'),
      'Group not found'
    )
  })

  test('blocked words are masked but the message still posts', async ({ assert }) => {
    const alice = await makeUser('alice')
    const message = await postChatMessage(alice, { type: 'global' }, 'that was shit luck')

    assert.equal(message.body, 'that was **** luck')
    assert.isTrue(message.wasCensored)
  })

  test('global chat allows one message every 3 seconds', async ({ assert }) => {
    const alice = await makeUser('rate_limited_alice')
    await postChatMessage(alice, { type: 'global' }, 'first')

    await assert.rejects(
      () => postChatMessage(alice, { type: 'global' }, 'second'),
      'You can only send one message every 3 seconds'
    )
  })

  test('messages expire after 30 days', async ({ assert }) => {
    const alice = await makeUser('alice')
    const message = await postChatMessage(alice, { type: 'global' }, 'ancient history')
    message.createdAt = DateTime.now().minus({ days: 31 })
    await message.save()

    const visible = await recentChatMessages({ type: 'global' })
    assert.lengthOf(visible, 0)

    await deleteExpiredChatMessages()
    assert.isNull(await ChatMessage.find(message.id))
  })
})

/**
 * The identity the match service tracks for a player.
 */
function identityOf(user: User): PlayerIdentity {
  return { id: user.id, username: user.username, avatarUrl: null, initials: 'P?' }
}

/**
 * Starts a live 2-player match through a private lobby on the group.
 */
function startMatch(groupId: number, alice: User, bobby: User): ActiveMatch {
  createLobby(groupId, identityOf(alice), CLASSIC_RULES)
  joinLobby(groupId, identityOf(bobby))
  return startLobby(groupId, alice.id)
}

test.group('Match chat', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    resetChatRateLimits()
    resetMatchService()
    configureMatchService(
      { toUser: () => {}, toGroup: () => {} },
      { rng: () => 0.42, queueCountdownMs: 5 }
    )
    return () => resetMatchService()
  })

  test('players can chat during a live game; messages carry the game id', async ({
    client,
    assert,
  }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const sharks = await makeGroup(alice, 'Card Sharks')
    const match = startMatch(sharks.id, alice, bobby)

    const message = await postChatMessage(alice, { type: 'match', matchId: match.id }, 'good luck')
    assert.equal(message.channel, 'match')
    assert.equal(message.matchId, match.id)

    const asPlayer = await client.get(`/api/v1/matches/${match.id}/messages`).loginAs(bobby)
    asPlayer.assertStatus(200)
    assert.lengthOf(asPlayer.body().data.messages, 1)
    assert.equal(asPlayer.body().data.messages[0].body, 'good luck')

    // Match messages never leak into the global chatroom
    const globalHistory = await recentChatMessages({ type: 'global' })
    assert.lengthOf(globalHistory, 0)
  })

  test('non-players can neither read nor post', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const mallory = await makeUser('mallory')
    const sharks = await makeGroup(alice, 'Card Sharks')
    const match = startMatch(sharks.id, alice, bobby)

    const asStranger = await client.get(`/api/v1/matches/${match.id}/messages`).loginAs(mallory)
    asStranger.assertStatus(404)

    await assert.rejects(
      () => postChatMessage(mallory, { type: 'match', matchId: match.id }, 'hello players'),
      'Match chat not found'
    )
  })

  test('match chat allows one message every 3 seconds', async ({ assert }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const sharks = await makeGroup(alice, 'Card Sharks')
    const match = startMatch(sharks.id, alice, bobby)

    await postChatMessage(alice, { type: 'match', matchId: match.id }, 'first')
    await assert.rejects(
      () => postChatMessage(alice, { type: 'match', matchId: match.id }, 'second'),
      'You can only send one message every 3 seconds'
    )

    // The limit is per chat: the other player is unaffected
    const fromBobby = await postChatMessage(bobby, { type: 'match', matchId: match.id }, 'hello')
    assert.equal(fromBobby.body, 'hello')
  })

  test('the chat closes when the game ends, but rows stay for retention', async ({
    client,
    assert,
  }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const sharks = await makeGroup(alice, 'Card Sharks')
    const match = startMatch(sharks.id, alice, bobby)
    await postChatMessage(alice, { type: 'match', matchId: match.id }, 'last words')

    // Bobby quits the 2-player game, which finishes it
    applyGameAction(match.id, bobby.id, { type: 'quit' })

    const afterEnd = await client.get(`/api/v1/matches/${match.id}/messages`).loginAs(alice)
    afterEnd.assertStatus(404)
    await assert.rejects(
      () => postChatMessage(alice, { type: 'match', matchId: match.id }, 'anyone there?'),
      'Match chat not found'
    )

    // Stored (associated with the game id) until the 30-day sweep
    const stored = await ChatMessage.query().where('matchId', match.id)
    assert.lengthOf(stored, 1)
    stored[0].createdAt = DateTime.now().minus({ days: 31 })
    await stored[0].save()
    await deleteExpiredChatMessages()
    assert.lengthOf(await ChatMessage.query().where('matchId', match.id), 0)
  })
})

test.group('Message reports', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => resetChatRateLimits())

  test('a user can report a message they can see, once', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const message = await postChatMessage(alice, { type: 'global' }, 'rude message')

    const first = await client.post(`/api/v1/chat/messages/${message.id}/report`).loginAs(bobby)
    first.assertStatus(200)
    const second = await client.post(`/api/v1/chat/messages/${message.id}/report`).loginAs(bobby)
    second.assertStatus(200)

    const reports = await MessageReport.query().where('messageId', message.id)
    assert.lengthOf(reports, 1)
  })

  test('group messages can only be reported by members', async ({ client }) => {
    const alice = await makeUser('alice')
    const mallory = await makeUser('mallory')
    const sharks = await makeGroup(alice, 'Card Sharks')
    const message = await postChatMessage(
      alice,
      { type: 'group', groupId: sharks.id },
      'group talk'
    )

    const response = await client
      .post(`/api/v1/chat/messages/${message.id}/report`)
      .loginAs(mallory)
    response.assertStatus(404)
  })

  test('you cannot report your own message', async ({ client }) => {
    const alice = await makeUser('alice')
    const message = await postChatMessage(alice, { type: 'global' }, 'self report')

    const response = await client.post(`/api/v1/chat/messages/${message.id}/report`).loginAs(alice)
    response.assertStatus(400)
  })
})
