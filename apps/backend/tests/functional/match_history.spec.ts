import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import User from '#models/user'
import Group from '#models/group'
import GroupMember from '#models/group_member'
import Match from '#models/match'
import MatchPlayer from '#models/match_player'
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

/**
 * Inserts a recorded match directly (the filters only read recorded
 * rows, so playing a full engine game per fixture would be overkill).
 */
async function seedMatch(options: {
  kind: 'public' | 'private'
  players: User[]
  winner: User
  daysAgo: number
}): Promise<Match> {
  const endedAt = DateTime.now().minus({ days: options.daysAgo })
  const match = await Match.create({
    kind: options.kind,
    rules: JSON.stringify(CLASSIC_RULES),
    scoresheet: JSON.stringify([]),
    completed: true,
    winnerUserId: options.winner.id,
    startedAt: endedAt.minus({ minutes: 20 }),
    endedAt,
  })
  await MatchPlayer.createMany(
    options.players.map((player, index) => ({
      matchId: match.id,
      userId: player.id,
      placement: index + 1,
      finalScore: index * 50,
      leftEarly: false,
    }))
  )
  return match
}

test.group('Match history filters', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * Seeds three matches for alice: public won 3 days ago, private
   * lost 2 days ago, public lost 1 day ago. Returns their ids oldest
   * first alongside the users.
   */
  async function seedHistory() {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const players = [alice, bobby]
    const publicWin = await seedMatch({ kind: 'public', players, winner: alice, daysAgo: 3 })
    const privateLoss = await seedMatch({ kind: 'private', players, winner: bobby, daysAgo: 2 })
    const publicLoss = await seedMatch({ kind: 'public', players, winner: bobby, daysAgo: 1 })
    return { alice, publicWin, privateLoss, publicLoss }
  }

  /**
   * The ids of the returned matches, in response order.
   */
  function idsOf(response: { body: () => { data: { matches: { id: number }[] } } }): number[] {
    return response.body().data.matches.map((match) => match.id)
  }

  test('defaults to every match, newest first', async ({ client, assert }) => {
    const { alice, publicWin, privateLoss, publicLoss } = await seedHistory()

    const response = await client.get('/api/v1/matches').loginAs(alice)

    assert.deepEqual(idsOf(response), [publicLoss.id, privateLoss.id, publicWin.id])
  })

  test('filters by match kind', async ({ client, assert }) => {
    const { alice, publicWin, privateLoss, publicLoss } = await seedHistory()

    const publicOnly = await client.get('/api/v1/matches').qs({ kind: 'public' }).loginAs(alice)
    assert.deepEqual(idsOf(publicOnly), [publicLoss.id, publicWin.id])

    const privateOnly = await client.get('/api/v1/matches').qs({ kind: 'private' }).loginAs(alice)
    assert.deepEqual(idsOf(privateOnly), [privateLoss.id])
  })

  test('sorts oldest first when requested', async ({ client, assert }) => {
    const { alice, publicWin, privateLoss, publicLoss } = await seedHistory()

    const response = await client.get('/api/v1/matches').qs({ sort: 'oldest' }).loginAs(alice)

    assert.deepEqual(idsOf(response), [publicWin.id, privateLoss.id, publicLoss.id])
  })

  test('filters to matches the user won', async ({ client, assert }) => {
    const { alice, publicWin } = await seedHistory()

    const response = await client.get('/api/v1/matches').qs({ wonOnly: true }).loginAs(alice)

    assert.deepEqual(idsOf(response), [publicWin.id])
  })

  test('filters combine', async ({ client, assert }) => {
    const { alice, publicWin } = await seedHistory()

    const response = await client
      .get('/api/v1/matches')
      .qs({ kind: 'public', sort: 'oldest', wonOnly: true })
      .loginAs(alice)

    assert.deepEqual(idsOf(response), [publicWin.id])
  })

  test('rejects an unknown kind', async ({ client }) => {
    const { alice } = await seedHistory()

    // Deliberately invalid: the cast smuggles a bad kind past the
    // typed client so the server-side validator is what rejects it
    const response = await client
      .get('/api/v1/matches')
      .qs({ kind: 'ranked' as 'public' })
      .loginAs(alice)

    response.assertStatus(422)
  })
})
