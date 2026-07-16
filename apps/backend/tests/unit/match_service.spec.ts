import { test } from '@japa/runner'
import {
  applyGameAction,
  configureMatchService,
  configureScheduledLobbyStore,
  createLobby,
  joinLobby,
  joinPublicQueue,
  leaveLobby,
  lobbyViewForGroup,
  matchForUser,
  matchSystemMessages,
  onMatchFinished,
  playerDisconnected,
  playerReconnected,
  redactedView,
  resetMatchService,
  restoreScheduledLobby,
  startLobby,
} from '#services/game/match_service'
import { CLASSIC_RULES, GameError } from '#services/game/engine'
import type { ActiveMatch, PlayerIdentity } from '#services/game/match_service'

/** Captured emissions: one entry per toUser call. */
interface Emission {
  userId: number
  event: string
  payload: unknown
}

let emissions: Emission[] = []

function identity(id: number): PlayerIdentity {
  return { id, username: `player_${id}` }
}

/**
 * Configures the service with a capture emitter, an instant queue
 * countdown, and a deterministic rng.
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
    { rng: () => 0.42, queueCountdownMs: 5 }
  )
}

/**
 * Starts a 2-player private match directly through the lobby flow.
 */
function startTwoPlayerMatch(): ActiveMatch {
  createLobby(7, identity(1), CLASSIC_RULES)
  joinLobby(7, identity(2))
  return startLobby(7, 1)
}

test.group('Match service', (group) => {
  group.each.setup(() => {
    setup()
    return () => resetMatchService()
  })

  test('two queued players start a public match after the countdown', async ({ assert }) => {
    joinPublicQueue(identity(1))
    const status = joinPublicQueue(identity(2))
    assert.equal(status.queueSize, 2)
    assert.isNotNull(status.startsInMs)

    await new Promise((resolve) => setTimeout(resolve, 30))

    const match = matchForUser(1)
    assert.isNotNull(match)
    assert.equal(match?.kind, 'public')
    assert.deepEqual(matchForUser(2)?.id, match?.id)

    const startEvents = emissions.filter((emission) => emission.event === 'game:start')
    assert.lengthOf(startEvents, 2)
  })

  test('redacted views never contain another player’s cards', ({ assert }) => {
    const match = startTwoPlayerMatch()

    const viewOne = redactedView(match, 1)
    const viewTwo = redactedView(match, 2)

    assert.lengthOf(viewOne.you.hand, 13)
    assert.lengthOf(viewTwo.you.hand, 13)
    // Opponents appear as counts only
    for (const player of viewOne.players) {
      assert.equal(player.handCount, 13)
    }
    assert.notDeepEqual(viewOne.you.hand, viewTwo.you.hand)

    // The serialized view of one player must not mention any card id
    // from the other player's hand
    const serialized = JSON.stringify(viewOne)
    for (const card of viewTwo.you.hand) {
      assert.notInclude(serialized, `"id":${card.id},`)
    }
  })

  test('actions flow through to the engine and broadcast fresh state', ({ assert }) => {
    const match = startTwoPlayerMatch()
    const currentUserId = match.state.players[match.state.currentPlayerIndex].userId

    emissions = []
    const afterDraw = applyGameAction(match.id, currentUserId, { type: 'draw' })
    assert.lengthOf(afterDraw.you.hand, 14)
    assert.equal(afterDraw.phase, 'acting')

    const stateEvents = emissions.filter((emission) => emission.event === 'game:state')
    assert.lengthOf(stateEvents, 2)

    // Discard ends the turn and passes play
    const cardId = afterDraw.you.hand[0].id
    const afterDiscard = applyGameAction(match.id, currentUserId, { type: 'discard', cardId })
    assert.notEqual(afterDiscard.currentPlayerUserId, currentUserId)
    assert.equal(afterDiscard.discardTop?.id, cardId)
  })

  test('illegal actions raise GameError and change nothing', ({ assert }) => {
    const match = startTwoPlayerMatch()
    const currentUserId = match.state.players[match.state.currentPlayerIndex].userId
    const otherUserId = match.state.players.find((player) => player.userId !== currentUserId)
      ?.userId as number

    assert.throws(() => applyGameAction(match.id, otherUserId, { type: 'draw' }), GameError)
    assert.throws(() => applyGameAction(match.id, 999, { type: 'draw' }), GameError)
  })

  test('a disconnect pauses the game; reconnecting resumes it', ({ assert }) => {
    const match = startTwoPlayerMatch()
    const currentUserId = match.state.players[match.state.currentPlayerIndex].userId

    playerDisconnected(2)
    assert.isTrue(redactedView(match, 1).paused)
    assert.throws(() => applyGameAction(match.id, currentUserId, { type: 'draw' }), /paused/)

    playerReconnected(2)
    assert.isFalse(redactedView(match, 1).paused)
    applyGameAction(match.id, currentUserId, { type: 'draw' })
  })

  test('a disconnect posts a chat countdown that reconnecting cancels', ({ assert }) => {
    const match = startTwoPlayerMatch()

    emissions = []
    playerDisconnected(2)

    // Announced to every participant, and kept for the history endpoint
    const chatEvents = emissions.filter((emission) => emission.event === 'chat:message')
    assert.lengthOf(chatEvents, 2)
    let stored = matchSystemMessages(match.id)
    assert.lengthOf(stored, 1)
    assert.equal(stored[0].body, 'player_2 disconnected, 5 minutes to reconnect.')
    assert.isNull(stored[0].user)

    // Classic 5-minute budget: milestones at 4/3/2/1 min, 30s, and 10s left
    const runtime = match.runtime.get(2)
    assert.lengthOf(runtime?.milestoneTimers ?? [], 6)

    playerReconnected(2)
    assert.lengthOf(runtime?.milestoneTimers ?? [], 0)
    stored = matchSystemMessages(match.id)
    assert.lengthOf(stored, 2)
    assert.equal(stored[1].body, 'player_2 reconnected.')
  })

  test('quitting a 2-player match ends it and notifies the finish listener', ({ assert }) => {
    let finished: ActiveMatch | null = null
    onMatchFinished((match) => {
      finished = match
    })

    const match = startTwoPlayerMatch()
    applyGameAction(match.id, 1, { type: 'quit' })

    assert.equal(match.state.phase, 'finished')
    assert.equal(match.state.winnerUserId, 2)
    assert.isNotNull(finished)
    // Both players are released to join new games
    assert.isNull(matchForUser(1))
    assert.isNull(matchForUser(2))
  })

  test('a group can only set up one game at a time', ({ assert }) => {
    createLobby(7, identity(1), CLASSIC_RULES)
    assert.throws(() => createLobby(7, identity(3), CLASSIC_RULES), /already has a game/)

    joinLobby(7, identity(2))
    startLobby(7, 1)
    // Lobby is gone, but the running match still blocks a new one
    assert.throws(() => createLobby(7, identity(3), CLASSIC_RULES), /already has a game/)
  })

  test('only the lobby owner can start, and 2+ players are required', ({ assert }) => {
    createLobby(7, identity(1), CLASSIC_RULES)
    assert.throws(() => startLobby(7, 1), /At least 2 players/)

    joinLobby(7, identity(2))
    assert.throws(() => startLobby(7, 2), /Only the game creator/)
  })
})

test.group('Match service — scheduled lobbies', (group) => {
  group.each.setup(() => {
    setup()
    return () => resetMatchService()
  })

  test('nobody can join or start a scheduled game before it opens', ({ assert }) => {
    createLobby(7, identity(1), CLASSIC_RULES, Date.now() + 60 * 60 * 1000)

    const view = lobbyViewForGroup(7)
    assert.isNotNull(view)
    assert.lengthOf(view?.players ?? [], 0)
    assert.isNotNull(view?.opensAt)

    assert.throws(() => joinLobby(7, identity(1)), /not opened/)
    assert.throws(() => joinLobby(7, identity(2)), /not opened/)
    assert.throws(() => startLobby(7, 1), /not opened/)
  })

  test('once the scheduled time passes the lobby is joinable and startable', async ({ assert }) => {
    createLobby(7, identity(1), CLASSIC_RULES, Date.now() + 20)
    assert.throws(() => joinLobby(7, identity(2)), /not opened/)

    await new Promise((resolve) => setTimeout(resolve, 40))

    joinLobby(7, identity(1))
    joinLobby(7, identity(2))
    const match = startLobby(7, 1)
    assert.equal(match.kind, 'private')
    assert.isNull(lobbyViewForGroup(7))
  })

  test('the owner can cancel a scheduled game', ({ assert }) => {
    createLobby(7, identity(1), CLASSIC_RULES, Date.now() + 60 * 60 * 1000)
    leaveLobby(7, 1)
    assert.isNull(lobbyViewForGroup(7))
  })

  test('scheduling does not conflict with the owner being in a game', ({ assert }) => {
    startTwoPlayerMatch()
    // Owner of group 8 is mid-game in group 7; scheduling is fine, an
    // immediate lobby is not (it would seat them twice)
    createLobby(8, identity(1), CLASSIC_RULES, Date.now() + 60 * 60 * 1000)
    assert.isNotNull(lobbyViewForGroup(8))
    assert.throws(() => createLobby(9, identity(1), CLASSIC_RULES), /already in a game/)
  })

  test('scheduled lobbies are saved to the store and removed on start or cancel', async ({
    assert,
  }) => {
    const saved: number[] = []
    const removed: number[] = []
    configureScheduledLobbyStore({
      save: (entry) => saved.push(entry.groupId),
      remove: (groupId) => removed.push(groupId),
    })

    createLobby(7, identity(1), CLASSIC_RULES, Date.now() + 20)
    assert.deepEqual(saved, [7])

    await new Promise((resolve) => setTimeout(resolve, 40))
    joinLobby(7, identity(1))
    joinLobby(7, identity(2))
    startLobby(7, 1)
    assert.deepEqual(removed, [7])

    createLobby(8, identity(3), CLASSIC_RULES, Date.now() + 60 * 60 * 1000)
    leaveLobby(8, 3)
    assert.deepEqual(removed, [7, 8])
  })

  test('restoring brings back pending schedules but drops lapsed ones', ({ assert }) => {
    const removed: number[] = []
    configureScheduledLobbyStore({
      save: () => {},
      remove: (groupId) => removed.push(groupId),
    })

    restoreScheduledLobby({
      groupId: 7,
      ownerId: 1,
      rules: CLASSIC_RULES,
      opensAt: Date.now() + 60 * 60 * 1000,
    })
    assert.equal(lobbyViewForGroup(7)?.ownerId, 1)

    // Opened more than its lifetime ago: discarded, not restored
    restoreScheduledLobby({
      groupId: 8,
      ownerId: 2,
      rules: CLASSIC_RULES,
      opensAt: Date.now() - 25 * 60 * 60 * 1000,
    })
    assert.isNull(lobbyViewForGroup(8))
    assert.deepEqual(removed, [8])
  })
})
