import { test } from '@japa/runner'
import User from '#models/user'
import Group from '#models/group'
import GroupMember from '#models/group_member'
import { CLASSIC_RULES } from '#services/game/engine'
import {
  applyGameAction,
  configureMatchService,
  createLobby,
  joinLobby,
  resetMatchService,
  startLobby,
} from '#services/game/match_service'
import { recordMatch } from '#services/match_history_service'
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

function identityOf(user: User): PlayerIdentity {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    initials: user.initials,
  }
}

/**
 * Plays a real 2-player match to its end (one player quits, the other
 * wins) and returns the finished ActiveMatch. The lobby's group must
 * exist because the recorded match references it.
 */
async function playMatchToEnd(alice: User, bobby: User): Promise<ActiveMatch> {
  const group = await Group.create({ name: 'Match History Club', ownerId: alice.id })
  await GroupMember.createMany([
    { groupId: group.id, userId: alice.id },
    { groupId: group.id, userId: bobby.id },
  ])

  configureMatchService({ toUser: () => {}, toGroup: () => {} }, { rng: () => 0.37 })
  createLobby(group.id, identityOf(alice), CLASSIC_RULES)
  joinLobby(group.id, identityOf(bobby))
  const match = startLobby(group.id, alice.id)
  applyGameAction(match.id, bobby.id, { type: 'quit' })
  return match
}

test.group('Match history', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    resetMatchService()
    return () => resetMatchService()
  })

  test('records a finished match with placements and left-early flags', async ({ assert }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const match = await playMatchToEnd(alice, bobby)

    const recorded = await recordMatch(match)
    await recorded.load('matchPlayers')

    assert.isTrue(recorded.completed)
    assert.equal(recorded.winnerUserId, alice.id)
    assert.equal(recorded.kind, 'private')
    assert.equal(recorded.runtimeId, match.id)
    assert.lengthOf(recorded.matchPlayers, 2)

    const aliceRow = recorded.matchPlayers.find((player) => player.userId === alice.id)
    const bobbyRow = recorded.matchPlayers.find((player) => player.userId === bobby.id)
    assert.equal(aliceRow?.placement, 1)
    assert.isFalse(Boolean(aliceRow?.leftEarly))
    assert.equal(bobbyRow?.placement, 2)
    assert.isTrue(Boolean(bobbyRow?.leftEarly))
  })

  test('participants see the match; outsiders do not', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const mallory = await makeUser('mallory')
    await recordMatch(await playMatchToEnd(alice, bobby))

    const asParticipant = await client.get('/api/v1/matches').loginAs(alice)
    asParticipant.assertStatus(200)
    const matches = asParticipant.body().data.matches
    assert.lengthOf(matches, 1)
    assert.equal(matches[0].players.length, 2)
    assert.equal(matches[0].players[0].placement, 1)
    assert.isTrue(matches[0].completed)
    assert.equal(matches[0].rules.scoreLimit, 150)
    assert.notProperty(matches[0].players[0], 'email')

    const asOutsider = await client.get('/api/v1/matches').loginAs(mallory)
    assert.lengthOf(asOutsider.body().data.matches, 0)

    const unauthenticated = await client.get('/api/v1/matches')
    unauthenticated.assertStatus(401)
  })
})
