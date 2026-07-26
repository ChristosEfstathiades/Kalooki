import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import Match from '#models/match'
import MatchPlayer from '#models/match_player'
import { CLASSIC_RULES } from '#services/game/engine'
import { invalidateLeaderboard } from '#services/leaderboard_service'
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

interface SeedMatchOptions {
  kind: 'public' | 'private' | 'practice'
  players: User[]
  /** null records the match as incomplete with no winner. */
  winner: User | null
  endedAt: DateTime
}

/**
 * Records a finished match directly, the same shape the match history
 * service writes, so the record's inputs are fully controlled.
 */
async function seedMatch(options: SeedMatchOptions): Promise<void> {
  const match = await Match.create({
    kind: options.kind,
    rules: JSON.stringify(CLASSIC_RULES),
    scoresheet: JSON.stringify([]),
    completed: options.winner !== null,
    winnerUserId: options.winner?.id ?? null,
    startedAt: options.endedAt.minus({ minutes: 20 }),
    endedAt: options.endedAt,
  })
  await MatchPlayer.createMany(
    options.players.map((user, index) => ({
      matchId: match.id,
      userId: user.id,
      placement:
        options.winner === null ? index + 1 : user.id === options.winner.id ? 1 : index + 2,
      finalScore: 0,
      leftEarly: false,
    }))
  )
}

test.group('Player record', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  // The ranked list behind the record is cached process-wide, so each
  // case must start clean or it would see the previous case's data.
  group.each.setup(() => invalidateLeaderboard())

  test('starts empty for a new account', async ({ client, assert }) => {
    const alice = await makeUser('alice')

    const response = await client.get('/api/v1/record').loginAs(alice)
    response.assertStatus(200)
    const record = response.body().data.record

    assert.equal(record.gamesPlayed, 0)
    assert.equal(record.wins, 0)
    assert.equal(record.winRate, 0)
    assert.equal(record.minMatches, 10)
    assert.isNull(record.rank)
    assert.equal(record.rankedPlayers, 0)
  })

  test('counts completed public matches and nothing else', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const base = DateTime.fromISO('2026-01-01T12:00:00.000Z')

    // Four completed public matches, alice winning one of them.
    for (let index = 0; index < 4; index += 1) {
      await seedMatch({
        kind: 'public',
        players: [alice, bobby],
        winner: index === 0 ? alice : bobby,
        endedAt: base.plus({ days: index }),
      })
    }

    // Must not reach the headline figures: an abandoned public match,
    // two private games and a practice game.
    await seedMatch({
      kind: 'public',
      players: [alice, bobby],
      winner: null,
      endedAt: base.plus({ days: 10 }),
    })
    for (let index = 0; index < 2; index += 1) {
      await seedMatch({
        kind: 'private',
        players: [alice, bobby],
        winner: alice,
        endedAt: base.plus({ days: 11 + index }),
      })
    }
    await seedMatch({
      kind: 'practice',
      players: [alice],
      winner: alice,
      endedAt: base.plus({ days: 13 }),
    })

    const response = await client.get('/api/v1/record').loginAs(alice)
    response.assertStatus(200)
    const record = response.body().data.record

    // The abandoned public match and the private and practice games
    // must leave the figures untouched
    assert.equal(record.gamesPlayed, 4)
    assert.equal(record.wins, 1)
    assert.equal(record.winRate, 0.25)
    // Four games is short of the ten needed to be ranked
    assert.isNull(record.rank)
  })

  test('reports the leaderboard position once the player qualifies', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const base = DateTime.fromISO('2026-02-01T12:00:00.000Z')

    // Ten public matches; alice takes six, so she outranks bobby.
    for (let index = 0; index < 10; index += 1) {
      await seedMatch({
        kind: 'public',
        players: [alice, bobby],
        winner: index < 6 ? alice : bobby,
        endedAt: base.plus({ days: index }),
      })
    }

    const first = await client.get('/api/v1/record').loginAs(alice)
    first.assertStatus(200)
    assert.equal(first.body().data.record.gamesPlayed, 10)
    assert.equal(first.body().data.record.wins, 6)
    assert.equal(first.body().data.record.winRate, 0.6)
    assert.equal(first.body().data.record.rank, 1)
    assert.equal(first.body().data.record.rankedPlayers, 2)

    const second = await client.get('/api/v1/record').loginAs(bobby)
    second.assertStatus(200)
    assert.equal(second.body().data.record.rank, 2)
    assert.equal(second.body().data.record.rankedPlayers, 2)
  })

  test('leaves an excluded account unranked', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const base = DateTime.fromISO('2026-03-01T12:00:00.000Z')

    for (let index = 0; index < 10; index += 1) {
      await seedMatch({
        kind: 'public',
        players: [alice, bobby],
        winner: index < 6 ? alice : bobby,
        endedAt: base.plus({ days: index }),
      })
    }

    alice.excludedFromLeaderboard = true
    await alice.save()
    invalidateLeaderboard()

    const response = await client.get('/api/v1/record').loginAs(alice)
    response.assertStatus(200)
    const record = response.body().data.record

    // The games are still hers; only the ranking is withheld
    assert.equal(record.gamesPlayed, 10)
    assert.equal(record.wins, 6)
    assert.isNull(record.rank)
    assert.equal(record.rankedPlayers, 1)
  })

  test('requires authentication', async ({ client }) => {
    const response = await client.get('/api/v1/record')
    response.assertStatus(401)
  })
})
