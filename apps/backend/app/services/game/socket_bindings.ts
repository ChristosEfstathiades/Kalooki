import Group from '#models/group'
import { GameError, CLASSIC_RULES } from '#services/game/engine'
import {
  applyGameAction,
  configureMatchService,
  createLobby,
  getMatch,
  joinLobby,
  joinPublicQueue,
  leaveLobby,
  leavePublicQueue,
  lobbyViewForGroup,
  matchForUser,
  playerDisconnected,
  playerReconnected,
  queueStatusFor,
  redactedView,
  startLobby,
  startPracticeMatch,
} from '#services/game/match_service'
import { BOT_DIFFICULTIES } from '#services/game/bot'
import { MAX_BOT_OPPONENTS, ensureBotUsers } from '#services/game/bot_users'
import { isGroupMember } from '#services/group_service'
import { chatRoom } from '#services/socket_service'
import { UNLIMITED_BUY_INS } from '#services/game/engine'
import type User from '#models/user'
import type { BotDifficulty } from '#services/game/bot'
import type { GameRules, MatchStakes } from '#services/game/engine'
import type { GameAction, PlayerIdentity } from '#services/game/match_service'
import type { Server, Socket } from 'socket.io'

/**
 * Socket wiring for matchmaking, private lobbies, and live gameplay.
 * All rule enforcement lives in the engine/match service; this module
 * parses untrusted payloads, checks group authorization, and routes
 * events. Every player gets a `user:{id}` room so match broadcasts can
 * target them individually with their own redacted view.
 */

type Ack = (result: { ok: boolean; error?: string; data?: unknown }) => void

/**
 * Points the match service's outbound events at Socket.IO rooms.
 */
export function bindMatchEmitter(io: Server): void {
  configureMatchService({
    toUser: (userId, event, payload) => {
      io.to(`user:${userId}`).emit(event, payload)
    },
    toGroup: (groupId, event, payload) => {
      io.to(chatRoom({ type: 'group', groupId })).emit(event, payload)
    },
  })
}

function identityOf(user: User): PlayerIdentity {
  return {
    id: user.id,
    username: user.username,
  }
}

/**
 * Runs a handler and funnels the result / GameError into the ack.
 */
async function acked(ack: Ack | undefined, handler: () => Promise<unknown>): Promise<void> {
  try {
    const data = await handler()
    ack?.({ ok: true, data })
  } catch (error) {
    if (error instanceof GameError) {
      ack?.({ ok: false, error: error.message })
      return
    }
    ack?.({ ok: false, error: 'Something went wrong' })
  }
}

/**
 * Clamps an untrusted value to an integer in [min, max], falling back
 * when it is not an integer at all.
 */
function intIn(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' && Number.isInteger(value) ? value : fallback
  return Math.min(max, Math.max(min, parsed))
}

/**
 * Parses custom rules from an untrusted lobby payload, bounded to the
 * options private games may change (docs/Kalooki.md): timers, decks,
 * jokers, the come-down threshold, buy-ins per player, and optional
 * play-money stakes.
 */
function parseCustomRules(payload: unknown): GameRules {
  const input = (payload ?? {}) as Record<string, unknown>

  return {
    ...CLASSIC_RULES,
    decks: intIn(input.decks, 2, 4, CLASSIC_RULES.decks),
    jokers: intIn(input.jokers, 0, 4, CLASSIC_RULES.jokers),
    comeDownThreshold: intIn(input.comeDownThreshold, 5, 150, CLASSIC_RULES.comeDownThreshold),
    moveTimeBankMs:
      intIn(input.moveTimeMinutes, 5, 120, CLASSIC_RULES.moveTimeBankMs / 60000) * 60000,
    rejoinBudgetMs: intIn(input.rejoinMinutes, 1, 15, CLASSIC_RULES.rejoinBudgetMs / 60000) * 60000,
    buyInsPerPlayer:
      input.buyInsPerPlayer === UNLIMITED_BUY_INS
        ? UNLIMITED_BUY_INS
        : intIn(input.buyInsPerPlayer, 0, 3, CLASSIC_RULES.buyInsPerPlayer),
    stakes: parseStakes(input.stakes),
  }
}

/**
 * Parses play-money amounts (chips) from an untrusted payload; absent
 * or malformed input means the game is not played for chips. Defaults
 * mirror the example scoresheet (stake 4, rebuy 4, kalooki 2, call 1).
 */
function parseStakes(value: unknown): MatchStakes | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const input = value as Record<string, unknown>
  return {
    stake: intIn(input.stake, 0, 1000, 4),
    rebuy: intIn(input.rebuy, 0, 1000, 4),
    kalooki: intIn(input.kalooki, 0, 1000, 2),
    call: intIn(input.call, 0, 1000, 1),
  }
}

/**
 * Parses an untrusted bot difficulty, defaulting to medium.
 */
function parseBotDifficulty(value: unknown): BotDifficulty {
  return BOT_DIFFICULTIES.includes(value as BotDifficulty) ? (value as BotDifficulty) : 'medium'
}

/** Hours ahead a private game may be scheduled (docs/features.md). */
const SCHEDULE_HOUR_OPTIONS = [1, 3, 6, 12, 24]

/**
 * Parses the optional schedule delay from an untrusted lobby payload:
 * one of the fixed hour options, anything else meaning "open now".
 */
function parseOpensAt(value: unknown): number | null {
  if (typeof value !== 'number' || !SCHEDULE_HOUR_OPTIONS.includes(value)) {
    return null
  }
  return Date.now() + value * 60 * 60 * 1000
}

/**
 * Registers the game events on a freshly connected (authenticated)
 * socket and reports reconnection to any running match.
 */
export function bindGameHandlers(io: Server, socket: Socket, user: User): void {
  void socket.join(`user:${user.id}`)

  // Rejoining a running match after a disconnect
  const runningMatch = playerReconnected(user.id)
  if (runningMatch) {
    socket.emit('game:start', { matchId: runningMatch.id })
  }

  socket.on('match:queue', (_payload: unknown, ack?: Ack) => {
    void acked(ack, async () => joinPublicQueue(identityOf(user)))
  })

  socket.on('match:unqueue', (_payload: unknown, ack?: Ack) => {
    void acked(ack, async () => {
      leavePublicQueue(user.id)
      return queueStatusFor(user.id)
    })
  })

  socket.on('match:practice', (payload: unknown, ack?: Ack) => {
    void acked(ack, async () => {
      const input = (payload ?? {}) as { difficulty?: unknown; opponents?: unknown }
      const difficulty = parseBotDifficulty(input.difficulty)
      const opponents = intIn(input.opponents, 1, MAX_BOT_OPPONENTS, 2)
      const bots = await ensureBotUsers(opponents)
      const match = startPracticeMatch(identityOf(user), bots, difficulty)
      return { matchId: match.id }
    })
  })

  socket.on('match:createLobby', (payload: unknown, ack?: Ack) => {
    void acked(ack, async () => {
      const { groupId } = (payload ?? {}) as { groupId?: unknown }
      if (typeof groupId !== 'number') {
        throw new GameError('Malformed request', 'E_MALFORMED')
      }
      const group = await Group.find(groupId)
      if (!group || !(await isGroupMember(groupId, user.id))) {
        throw new GameError('Group not found', 'E_GROUP_NOT_FOUND')
      }
      if (group.ownerId !== user.id) {
        throw new GameError('Only the group owner can start a game', 'E_NOT_GROUP_OWNER')
      }
      const rules = parseCustomRules((payload as { rules?: unknown }).rules)
      const opensAt = parseOpensAt((payload as { scheduleHours?: unknown }).scheduleHours)
      createLobby(groupId, identityOf(user), rules, opensAt)
      return lobbyViewForGroup(groupId)
    })
  })

  socket.on('match:joinLobby', (payload: unknown, ack?: Ack) => {
    void acked(ack, async () => {
      const { groupId } = (payload ?? {}) as { groupId?: unknown }
      if (typeof groupId !== 'number') {
        throw new GameError('Malformed request', 'E_MALFORMED')
      }
      if (!(await isGroupMember(groupId, user.id))) {
        throw new GameError('Group not found', 'E_GROUP_NOT_FOUND')
      }
      joinLobby(groupId, identityOf(user))
      return lobbyViewForGroup(groupId)
    })
  })

  socket.on('match:leaveLobby', (payload: unknown, ack?: Ack) => {
    void acked(ack, async () => {
      const { groupId } = (payload ?? {}) as { groupId?: unknown }
      if (typeof groupId !== 'number') {
        throw new GameError('Malformed request', 'E_MALFORMED')
      }
      leaveLobby(groupId, user.id)
    })
  })

  socket.on('match:startLobby', (payload: unknown, ack?: Ack) => {
    void acked(ack, async () => {
      const { groupId } = (payload ?? {}) as { groupId?: unknown }
      if (typeof groupId !== 'number') {
        throw new GameError('Malformed request', 'E_MALFORMED')
      }
      const match = startLobby(groupId, user.id)
      return { matchId: match.id }
    })
  })

  socket.on('lobby:get', (payload: unknown, ack?: Ack) => {
    void acked(ack, async () => {
      const { groupId } = (payload ?? {}) as { groupId?: unknown }
      if (typeof groupId !== 'number' || !(await isGroupMember(groupId, user.id))) {
        throw new GameError('Group not found', 'E_GROUP_NOT_FOUND')
      }
      return lobbyViewForGroup(groupId)
    })
  })

  socket.on('game:view', (payload: unknown, ack?: Ack) => {
    void acked(ack, async () => {
      const { matchId } = (payload ?? {}) as { matchId?: unknown }
      const match = typeof matchId === 'string' ? getMatch(matchId) : matchForUser(user.id)
      if (!match || !match.identities.has(user.id)) {
        throw new GameError('You are not part of this game', 'E_NOT_IN_GAME')
      }
      return redactedView(match, user.id)
    })
  })

  socket.on('game:action', (payload: unknown, ack?: Ack) => {
    void acked(ack, async () => {
      const { matchId, action } = (payload ?? {}) as { matchId?: unknown; action?: unknown }
      if (typeof matchId !== 'string' || !isGameAction(action)) {
        throw new GameError('Malformed game action', 'E_MALFORMED')
      }
      return applyGameAction(matchId, user.id, action)
    })
  })

  socket.on('disconnect', () => {
    void handleUserDisconnect(io, user.id)
  })
}

/**
 * Reports a disconnect only when the user has no other open sockets
 * (multiple tabs count as one presence).
 */
async function handleUserDisconnect(io: Server, userId: number): Promise<void> {
  const remaining = await io.in(`user:${userId}`).fetchSockets()
  if (remaining.length === 0) {
    playerDisconnected(userId)
  }
}

/**
 * Structural check for an untrusted game action payload. Deep
 * validation happens in the engine.
 */
function isGameAction(value: unknown): value is GameAction {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    return false
  }
  const action = value as { type: unknown }
  switch (action.type) {
    case 'draw':
    case 'takeDiscard':
    case 'returnDiscard':
      return true
    case 'layMelds': {
      const { melds } = value as { melds?: unknown }
      return (
        Array.isArray(melds) &&
        melds.every((meld) => Array.isArray(meld) && meld.every((id) => typeof id === 'number'))
      )
    }
    case 'goer': {
      const { meldId, cardId, runEnd } = value as {
        meldId?: unknown
        cardId?: unknown
        runEnd?: unknown
      }
      return (
        typeof meldId === 'number' &&
        typeof cardId === 'number' &&
        (runEnd === undefined || runEnd === 'low' || runEnd === 'high')
      )
    }
    case 'takeJoker': {
      const { meldId, jokerCardId, replacementCardIds } = value as {
        meldId?: unknown
        jokerCardId?: unknown
        replacementCardIds?: unknown
      }
      return (
        typeof meldId === 'number' &&
        typeof jokerCardId === 'number' &&
        Array.isArray(replacementCardIds) &&
        replacementCardIds.every((id) => typeof id === 'number')
      )
    }
    case 'discard': {
      const { cardId } = value as { cardId?: unknown }
      return typeof cardId === 'number'
    }
    case 'buyIn': {
      const { accept } = value as { accept?: unknown }
      return typeof accept === 'boolean'
    }
    case 'quit':
      return true
    default:
      return false
  }
}
