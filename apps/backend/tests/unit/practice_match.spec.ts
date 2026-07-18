import { test } from '@japa/runner'
import {
  IDLE_MATCH_TTL_MS,
  applyGameAction,
  configureMatchService,
  matchForUser,
  onMatchFinished,
  playerDisconnected,
  playerReconnected,
  redactedView,
  resetMatchService,
  startPracticeMatch,
  sweepIdleMatches,
} from '#services/game/match_service'
import { assertMatchChatAccess } from '#services/chat_service'
import type { ActiveMatch, PlayerIdentity } from '#services/game/match_service'
import type { Rng } from '#services/game/cards'

/** Captured emissions: one entry per toUser call. */
interface Emission {
  userId: number
  event: string
  payload: unknown
}

let emissions: Emission[] = []

function identity(id: number): PlayerIdentity {
  return { id, username: id >= 900 ? `bot_${id}` : `player_${id}` }
}

/** Deterministic rng so the same game plays out every run. */
function lcg(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

/**
 * Configures the service with a capture emitter, deterministic rng,
 * and instant bot moves.
 */
function setup(): void {
  emissions = []
  resetMatchService()
  configureMatchService(
    {
      toUser: (userId, event, payload) => {
        emissions.push({ userId, event, payload })
      },
      toGroup: () => {},
    },
    { rng: lcg(11), queueCountdownMs: 5, botDelayMs: 0 }
  )
}

/**
 * Polls until the condition holds, failing the test on timeout.
 */
async function waitFor(condition: () => boolean, timeoutMs = 10_000): Promise<void> {
  const startedAt = Date.now()
  while (!condition()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for the match to progress')
    }
    await new Promise((resolve) => setTimeout(resolve, 2))
  }
}

test.group('Practice matches', (group) => {
  group.each.setup(() => {
    setup()
    return () => resetMatchService()
  })

  test('seats bots without indexing them and flags them in views', ({ assert }) => {
    const match = startPracticeMatch(identity(1), [identity(901), identity(902)], 'hard')

    assert.equal(match.kind, 'practice')
    assert.equal(match.botDifficulty, 'hard')
    assert.equal(matchForUser(1)?.id, match.id)
    // Bots stay out of the per-user index so they can sit anywhere
    assert.isNull(matchForUser(901))
    assert.isNull(matchForUser(902))

    const view = redactedView(match, 1)
    assert.deepEqual(
      view.players.map((player) => player.isBot),
      [false, true, true]
    )

    // No event — and no view holding a bot's hand — ever targets a bot
    assert.isEmpty(emissions.filter((emission) => emission.userId >= 900))
    const startEvents = emissions.filter((emission) => emission.event === 'game:start')
    assert.deepEqual(
      startEvents.map((emission) => emission.userId),
      [1]
    )
  })

  test('bots take full turns and play returns to the human', async ({ assert }) => {
    const match = startPracticeMatch(identity(1), [identity(901), identity(902)], 'medium')

    await waitFor(() => redactedView(match, 1).currentPlayerUserId === 1)

    // One human turn, then every bot must complete a whole turn before
    // play comes back around
    applyGameAction(match.id, 1, { type: 'draw' })
    const hand = redactedView(match, 1).you.hand
    applyGameAction(match.id, 1, { type: 'discard', cardId: hand[hand.length - 1].id })
    await waitFor(() => redactedView(match, 1).currentPlayerUserId === 1)

    // No bot move was ever rejected hard enough to remove the bot
    assert.isTrue(match.state.players.every((player) => !player.removed))
  }).timeout(15_000)

  test('the human quitting ends the match with a bot winner and records it', ({ assert }) => {
    const finished: ActiveMatch[] = []
    onMatchFinished((match) => finished.push(match))
    const match = startPracticeMatch(identity(1), [identity(901), identity(902)], 'easy')

    applyGameAction(match.id, 1, { type: 'quit' })

    assert.equal(match.state.phase, 'finished')
    assert.isNotNull(match.finishedAt)
    assert.isNotNull(match.state.winnerUserId)
    assert.isTrue(match.botIds.has(match.state.winnerUserId as number))
    assert.include(finished, match)
    assert.isNull(matchForUser(1))
  })

  test('has no move timer and no table chat', ({ assert }) => {
    const match = startPracticeMatch(identity(1), [identity(901), identity(902)], 'medium')

    assert.isNull(match.turnDeadlineAt)
    assert.isNull(match.turnTimer)
    assert.isNull(redactedView(match, 1).turnDeadlineAt)
    assert.throws(() => assertMatchChatAccess(match.id, 1))
  })

  test('a disconnected human pauses bot play until they return', async ({ assert }) => {
    const match = startPracticeMatch(identity(1), [identity(901)], 'medium')

    playerDisconnected(1)
    assert.isNotNull(match.pausedAt)
    assert.isNull(match.botTimer)

    // Nothing moves while paused
    const emissionsWhilePaused = emissions.length
    await new Promise((resolve) => setTimeout(resolve, 25))
    assert.lengthOf(emissions, emissionsWhilePaused)

    playerReconnected(1)
    assert.isNull(match.pausedAt)
    await waitFor(() => redactedView(match, 1).currentPlayerUserId === 1)
  }).timeout(15_000)

  test('waits indefinitely for a disconnected human instead of removing them', async ({
    assert,
  }) => {
    const match = startPracticeMatch(identity(1), [identity(901)], 'medium')
    const runtime = match.runtime.get(1)
    assert.isDefined(runtime)
    // Even an exhausted budget must not arm a removal timer in practice
    runtime!.remainingRejoinMs = 5

    playerDisconnected(1)
    assert.isNull(runtime!.rejoinTimer)
    assert.isEmpty(runtime!.milestoneTimers)

    await new Promise((resolve) => setTimeout(resolve, 30))
    assert.isNull(match.finishedAt)
    assert.isNotNull(match.pausedAt)

    // Rejoining works, the unenforced budget was not charged, and the
    // player can still act (here: quit)
    assert.equal(playerReconnected(1)?.id, match.id)
    assert.equal(runtime!.remainingRejoinMs, 5)
    const view = applyGameAction(match.id, 1, { type: 'quit' })
    assert.equal(view.phase, 'finished')
  })

  test('the idle sweep ends a practice game abandoned for 12 hours', ({ assert }) => {
    const finished: ActiveMatch[] = []
    onMatchFinished((match) => finished.push(match))
    const match = startPracticeMatch(identity(1), [identity(901)], 'medium')
    playerDisconnected(1)

    // Not idle for long enough yet: the sweep leaves the match alone
    sweepIdleMatches()
    assert.isNull(match.finishedAt)

    match.lastActivityAt = Date.now() - IDLE_MATCH_TTL_MS
    sweepIdleMatches()

    assert.equal(match.state.phase, 'finished')
    assert.isNotNull(match.finishedAt)
    // The human abandoned the game; the win goes to a bot
    assert.isTrue(match.state.players.find((player) => player.userId === 1)?.removed)
    assert.isTrue(match.botIds.has(match.state.winnerUserId as number))
    assert.include(finished, match)
    assert.isNull(matchForUser(1))
  })
})
