import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import Match from '#models/match'
import MatchPlayer from '#models/match_player'
import { CLASSIC_RULES } from '#services/game/engine'
import testUtils from '@adonisjs/core/services/test_utils'
import type { RoundResult } from '#services/game/engine'

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
  kind: 'public' | 'private'
  players: User[]
  /** null records the match as incomplete with no winner. */
  winner: User | null
  endedAt: DateTime
  scoresheet?: RoundResult[]
}

/**
 * Records a finished match directly, the same shape the match history
 * service writes, so leaderboard inputs are fully controlled.
 */
async function seedMatch(options: SeedMatchOptions): Promise<void> {
  const match = await Match.create({
    kind: options.kind,
    rules: JSON.stringify(CLASSIC_RULES),
    scoresheet: JSON.stringify(options.scoresheet ?? []),
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

/**
 * The scoresheet used for every seeded alice-vs-bobby match: alice
 * takes round 1 (bobby +25), bobby takes round 2 (alice +30). Over any
 * number of matches alice averages 15 points a round, bobby 12.5, and
 * each wins half the rounds.
 */
function standardSheet(alice: User, bobby: User): RoundResult[] {
  return [
    {
      roundNumber: 1,
      winnerUserId: alice.id,
      penalties: { [alice.id]: 0, [bobby.id]: 25 },
      totals: { [alice.id]: 0, [bobby.id]: 25 },
    },
    {
      roundNumber: 2,
      winnerUserId: bobby.id,
      penalties: { [alice.id]: 30, [bobby.id]: 0 },
      totals: { [alice.id]: 30, [bobby.id]: 25 },
    },
  ]
}

test.group('Leaderboard', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('ranks players with enough public matches by win rate, with full stats', async ({
    client,
    assert,
  }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const carol = await makeUser('carol')
    const frank = await makeUser('frank')
    const base = DateTime.fromISO('2026-01-01T12:00:00.000Z')

    // Ten public matches between alice and bobby. Alice wins 6 with a
    // longest streak of 3 (matches 0-2); bobby wins 4, longest streak 2.
    const aliceWins = new Set([0, 1, 2, 4, 6, 7])
    for (let index = 0; index < 10; index += 1) {
      await seedMatch({
        kind: 'public',
        players: [alice, bobby],
        winner: aliceWins.has(index) ? alice : bobby,
        endedAt: base.plus({ days: index }),
        scoresheet: standardSheet(alice, bobby),
      })
    }

    // Noise that must not count: an incomplete public match, a
    // completed private match, and carol stopping one game short.
    await seedMatch({
      kind: 'public',
      players: [alice, bobby],
      winner: null,
      endedAt: base.plus({ days: 20 }),
    })
    await seedMatch({
      kind: 'private',
      players: [alice, bobby],
      winner: alice,
      endedAt: base.plus({ days: 21 }),
      scoresheet: standardSheet(alice, bobby),
    })
    for (let index = 0; index < 9; index += 1) {
      await seedMatch({
        kind: 'public',
        players: [carol, frank],
        winner: carol,
        endedAt: base.plus({ days: index }),
      })
    }

    const response = await client.get('/api/v1/leaderboard').loginAs(carol)
    response.assertStatus(200)
    const { entries, minMatches } = response.body().data

    assert.equal(minMatches, 10)
    assert.lengthOf(entries, 2)
    assert.deepEqual(
      entries.map((entry: { username: string }) => entry.username),
      ['alice', 'bobby']
    )

    const [first, second] = entries
    assert.equal(first.rank, 1)
    assert.equal(first.gamesPlayed, 10)
    assert.equal(first.wins, 6)
    assert.equal(first.winRate, 0.6)
    assert.equal(first.avgPointsPerRound, 15)
    assert.equal(first.roundsWonRate, 0.5)
    assert.equal(first.longestWinStreak, 3)
    assert.equal(first.avgPlayersPerMatch, 2)
    assert.notProperty(first, 'email')

    assert.equal(second.rank, 2)
    assert.equal(second.wins, 4)
    assert.equal(second.winRate, 0.4)
    assert.equal(second.avgPointsPerRound, 12.5)
    assert.equal(second.longestWinStreak, 2)
  })

  test('breaks win-rate ties by games played', async ({ client, assert }) => {
    const dave = await makeUser('dave')
    const grace = await makeUser('grace')
    const erin = await makeUser('erin')
    const henry = await makeUser('henry')
    const base = DateTime.fromISO('2026-02-01T12:00:00.000Z')

    // Everyone ends on a 50% win rate: dave/grace over 20 games,
    // erin/henry over 10.
    for (let index = 0; index < 20; index += 1) {
      await seedMatch({
        kind: 'public',
        players: [dave, grace],
        winner: index % 2 === 0 ? dave : grace,
        endedAt: base.plus({ hours: index }),
      })
    }
    for (let index = 0; index < 10; index += 1) {
      await seedMatch({
        kind: 'public',
        players: [erin, henry],
        winner: index % 2 === 0 ? erin : henry,
        endedAt: base.plus({ hours: index }),
      })
    }

    const response = await client.get('/api/v1/leaderboard').loginAs(dave)
    response.assertStatus(200)
    const entries = response.body().data.entries

    assert.deepEqual(
      entries.map((entry: { username: string; rank: number }) => entry.username),
      ['dave', 'grace', 'erin', 'henry']
    )
    assert.deepEqual(
      entries.map((entry: { rank: number }) => entry.rank),
      [1, 2, 3, 4]
    )
  })

  test('requires authentication and handles an empty board', async ({ client, assert }) => {
    const unauthenticated = await client.get('/api/v1/leaderboard')
    unauthenticated.assertStatus(401)

    const alice = await makeUser('alice')
    const response = await client.get('/api/v1/leaderboard').loginAs(alice)
    response.assertStatus(200)
    assert.deepEqual(response.body().data.entries, [])
    assert.equal(response.body().data.minMatches, 10)
  })
})
