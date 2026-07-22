import { randomUUID } from 'node:crypto'
import {
  CLASSIC_RULES,
  GameError,
  activePlayers,
  createGame,
  decideBuyIn,
  discard,
  drawFromDeck,
  layMelds,
  addGoer,
  playerState,
  removePlayer,
  returnDiscard,
  returnJoker,
  takeDiscard,
  takeJoker,
} from '#services/game/engine'
import { decideBotAction } from '#services/game/bot'
import { MAX_BOT_OPPONENTS } from '#services/game/bot_users'
import { cryptoRng } from '#services/game/cards'
import type { BotDifficulty } from '#services/game/bot'
import type { GameRules, GameState, TabledMeld, RoundResult } from '#services/game/engine'
import type { Card, Rng } from '#services/game/cards'

/**
 * Live match orchestration: public matchmaking, private group lobbies,
 * practice matches against bots, per-player redacted views,
 * move/rejoin timers, and disconnect-pausing. Pure game rules live in
 * the engine; socket plumbing lives in the socket service and reaches
 * this module through the injected emitter, so everything here is
 * testable without I/O.
 */

export interface PlayerIdentity {
  id: number
  username: string
}

/** Public queue game, private group game, or solo play against bots. */
export type MatchKind = 'public' | 'private' | 'practice'

/** A player-initiated game action, forwarded from the socket layer. */
export type GameAction =
  | { type: 'draw' }
  | { type: 'takeDiscard' }
  | { type: 'returnDiscard' }
  | { type: 'returnJoker' }
  | { type: 'layMelds'; melds: number[][] }
  | { type: 'goer'; meldId: number; cardId: number; runEnd?: 'low' | 'high' }
  | { type: 'takeJoker'; meldId: number; jokerCardId: number; replacementCardIds: number[] }
  | { type: 'discard'; cardId: number }
  | { type: 'buyIn'; accept: boolean }
  | { type: 'quit' }

interface ParticipantRuntime {
  connected: boolean
  /** Pause budget left for future disconnects (not refreshed). */
  remainingRejoinMs: number
  disconnectedAt: number | null
  rejoinTimer: NodeJS.Timeout | null
  /** Pending chat countdown announcements for a disconnect. */
  milestoneTimers: NodeJS.Timeout[]
  /** Thinking-time bank left for the whole game. */
  remainingBankMs: number
}

/**
 * A server-authored line in a match's chat (disconnect countdowns and
 * the like). Kept in memory with the match — like the match itself, it
 * does not survive a restart — and merged into the chat history
 * endpoint so late joiners to the chat panel still see it. A type
 * alias (not an interface) so it stays assignable to the serializer's
 * JSON types.
 */
export type MatchSystemMessage = {
  id: number
  body: string
  createdAt: string
  user: null
  system: true
}

export interface ActiveMatch {
  id: string
  kind: MatchKind
  groupId: number | null
  rules: GameRules
  state: GameState
  identities: Map<number, PlayerIdentity>
  runtime: Map<number, ParticipantRuntime>
  /** Seats played by bots (practice matches only). */
  botIds: Set<number>
  /** Difficulty of every bot in the match; null without bots. */
  botDifficulty: BotDifficulty | null
  /** Pending "bot is thinking" timer for the next bot step. */
  botTimer: NodeJS.Timeout | null
  /** Epoch ms the current turn started (for bank accounting). */
  turnStartedAt: number
  turnTimer: NodeJS.Timeout | null
  /** Absolute deadline of the running turn timer. */
  turnDeadlineAt: number | null
  /** Set while any participant is disconnected. */
  pausedAt: number | null
  /** Whether the current turn already used its overtime grant. */
  overtimeGranted: boolean
  /** Epoch ms the match was created. */
  startedAt: number
  finishedAt: number | null
  /** Epoch ms of the last state change (the idle-expiry clock). */
  lastActivityAt: number
  /** Server-authored chat lines, oldest first. */
  systemMessages: MatchSystemMessage[]
}

/** What the socket layer must provide for outbound messages. */
export interface MatchEmitter {
  toUser(userId: number, event: string, payload: unknown): void
  toGroup(groupId: number, event: string, payload: unknown): void
}

/** The view of a match a single player is allowed to see. */
export interface ClientGameView {
  matchId: string
  kind: MatchKind
  rules: GameRules
  phase: GameState['phase']
  roundNumber: number
  paused: boolean
  turnDeadlineAt: number | null
  currentPlayerUserId: number | null
  dealerUserId: number
  winnerUserId: number | null
  pendingBuyIns: number[]
  deckCount: number
  discardCount: number
  discardTop: Card | null
  melds: TabledMeld[]
  roundResults: RoundResult[]
  players: {
    userId: number
    username: string
    seat: number
    isBot: boolean
    handCount: number
    hasComeDown: boolean
    score: number
    buyInsUsed: number
    chips: number
    eliminated: boolean
    removed: boolean
    connected: boolean
  }[]
  you: {
    hand: Card[]
    pendingDiscardCardId: number | null
    pendingJokerCardId: number | null
  }
}

const matches = new Map<string, ActiveMatch>()
const matchIdByUser = new Map<number, string>()

/** Public matchmaking queue, in join order. */
let publicQueue: PlayerIdentity[] = []
/** The fill window: runs from the first search, ends in a start or a wait. */
let queueCountdown: NodeJS.Timeout | null = null
let queueCountdownEndsAt: number | null = null
/** Short post-window grace once the minimum player count is reached. */
let queueGraceTimer: NodeJS.Timeout | null = null
let queueGraceEndsAt: number | null = null
/** True once the fill window lapsed with too few players to start. */
let queueWindowExpired = false

/** One pending lobby per group. */
interface PrivateLobby {
  groupId: number
  ownerId: number
  rules: GameRules
  players: PlayerIdentity[]
  /**
   * Epoch ms a scheduled lobby opens for joining; null means joinable
   * immediately. Nobody — the owner included — is in a scheduled lobby
   * until it opens.
   */
  opensAt: number | null
  /** Fires the open broadcast, then expiry, for scheduled lobbies. */
  openTimer: NodeJS.Timeout | null
}
const lobbies = new Map<number, PrivateLobby>()

/** A scheduled lobby nobody started is dropped this long after opening. */
const SCHEDULED_LOBBY_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Persistence for scheduled lobbies so they survive a restart (live
 * lobbies stay in-memory only). Wired at boot; both calls are
 * fire-and-forget from the service's point of view.
 */
export interface ScheduledLobbyStore {
  save(entry: { groupId: number; ownerId: number; rules: GameRules; opensAt: number }): void
  remove(groupId: number): void
}
let scheduledStore: ScheduledLobbyStore | null = null

export function configureScheduledLobbyStore(store: ScheduledLobbyStore | null): void {
  scheduledStore = store
}

/** The queue fills for this long from the first search, so more can join. */
let queueCountdownMs = 90 * 1000
/** Grace after the fill window once the minimum is reached, so more can join. */
let queueGraceMs = 5 * 1000
/** Public matches need 3 players and seat at most 5; private lobbies allow 6. */
const PUBLIC_MIN_PLAYERS = 3
const PUBLIC_MAX_PLAYERS = 5
const PRIVATE_MAX_PLAYERS = 6

let emitter: MatchEmitter = {
  toUser: () => {},
  toGroup: () => {},
}
let rng: Rng = cryptoRng

/** Fixed bot thinking time override; null means the jittered default. */
let botDelayMsOverride: number | null = null

/**
 * Wires the outbound emitter (called by the socket provider at boot).
 * The rng, queue countdown, and bot thinking delay can be overridden
 * for deterministic tests.
 */
export function configureMatchService(
  nextEmitter: MatchEmitter,
  options: {
    rng?: Rng
    queueCountdownMs?: number
    queueGraceMs?: number
    botDelayMs?: number
  } = {}
): void {
  emitter = nextEmitter
  if (options.rng) {
    rng = options.rng
  }
  if (options.queueCountdownMs !== undefined) {
    queueCountdownMs = options.queueCountdownMs
  }
  if (options.queueGraceMs !== undefined) {
    queueGraceMs = options.queueGraceMs
  }
  if (options.botDelayMs !== undefined) {
    botDelayMsOverride = options.botDelayMs
  }
  armIdleSweep()
}

/**
 * Clears every match, queue, and lobby. For tests.
 */
export function resetMatchService(): void {
  for (const match of matches.values()) {
    clearMatchTimers(match)
  }
  matches.clear()
  matchIdByUser.clear()
  publicQueue = []
  resetQueueTimers()
  for (const lobby of lobbies.values()) {
    if (lobby.openTimer) {
      clearTimeout(lobby.openTimer)
    }
  }
  lobbies.clear()
  scheduledStore = null
}

/**
 * The match a user currently plays in, if any.
 */
export function matchForUser(userId: number): ActiveMatch | null {
  const matchId = matchIdByUser.get(userId)
  return matchId ? (matches.get(matchId) ?? null) : null
}

export function getMatch(matchId: string): ActiveMatch | null {
  return matches.get(matchId) ?? null
}

/** A snapshot of what the game service is doing right now. */
export type LiveGameStats = {
  matchesInProgress: number
  publicMatches: number
  privateMatches: number
  practiceMatches: number
  playersInMatches: number
  playersQueued: number
  openLobbies: number
}

/**
 * Counts of live games, queued players and open lobbies, for the admin
 * dashboard. Read straight from the in-memory maps, so it reflects this
 * process only — the same caveat presence already carries.
 */
export function liveGameStats(): LiveGameStats {
  const running = [...matches.values()].filter((match) => match.finishedAt === null)

  return {
    matchesInProgress: running.length,
    publicMatches: running.filter((match) => match.kind === 'public').length,
    privateMatches: running.filter((match) => match.kind === 'private').length,
    practiceMatches: running.filter((match) => match.kind === 'practice').length,
    playersInMatches: running.reduce(
      (total, match) =>
        total + [...match.identities.keys()].filter((id) => !match.botIds.has(id)).length,
      0
    ),
    playersQueued: publicQueue.length,
    openLobbies: lobbies.size,
  }
}

/** A place a user already holds: a live match, the queue, or a lobby. */
type Reservation = 'match' | 'queue' | 'lobby'

function reservationFor(userId: number): Reservation | null {
  if (matchForUser(userId)) {
    return 'match'
  }
  if (publicQueue.some((queued) => queued.id === userId)) {
    return 'queue'
  }
  for (const lobby of lobbies.values()) {
    if (lobby.players.some((player) => player.id === userId)) {
      return 'lobby'
    }
  }
  return null
}

/**
 * Guards every entry into a game. A player holds at most one place
 * across matches, the queue, and lobbies, so two of them can never
 * seat the same person. Callers let a player re-enter the place they
 * already hold before reaching this.
 *
 * @throws GameError when the user is committed somewhere else.
 */
function assertNotReserved(userId: number): void {
  const held = reservationFor(userId)
  if (held === null) {
    return
  }
  throw held === 'match'
    ? new GameError('You are already in a game', 'E_ALREADY_IN_GAME')
    : new GameError('You are already waiting for a game to start', 'E_ALREADY_WAITING')
}

/** Drops a user from every lobby they sit in (cancelling ones they own). */
function dropFromLobbies(userId: number): void {
  for (const [groupId, lobby] of [...lobbies]) {
    if (lobby.players.some((player) => player.id === userId)) {
      leaveLobby(groupId, userId)
    }
  }
}

/**
 * Removes a player from the engine and releases their seat, so leaving
 * a game (a quit, a timeout, or a lapsed rejoin window) frees them to
 * start another right away rather than waiting for the game they left
 * to finish. They keep read access to it through `identities`.
 */
function removeFromMatch(
  match: ActiveMatch,
  userId: number,
  options: { markRemoved?: boolean } = {}
): void {
  removePlayer(match.state, userId, rng, options)
  // Bots are never indexed: the same bot sits in many matches at once
  if (!match.botIds.has(userId)) {
    matchIdByUser.delete(userId)
  }
}

/* -------------------------------------------------------------------
 * Public matchmaking
 * ---------------------------------------------------------------- */

export interface QueueStatus {
  inQueue: boolean
  queueSize: number
  /** Ms until the match starts; null while more players are still needed. */
  startsInMs: number | null
}

/**
 * Joins the public queue. The first search opens a fill window
 * (90 seconds) so more players can gather. A full queue of 5 starts
 * immediately; when the window closes with 3+ players the match starts;
 * with fewer, the queue waits, and once a 3rd player arrives a short
 * grace runs so a 4th or 5th can still make it.
 */
export function joinPublicQueue(identity: PlayerIdentity): QueueStatus {
  if (!publicQueue.some((queued) => queued.id === identity.id)) {
    assertNotReserved(identity.id)
    publicQueue.push(identity)
  }

  if (publicQueue.length >= PUBLIC_MAX_PLAYERS) {
    startPublicMatch()
    return queueStatusFor(identity.id)
  }
  if (!queueWindowExpired) {
    if (!queueCountdown) {
      queueCountdownEndsAt = Date.now() + queueCountdownMs
      queueCountdown = setTimeout(() => {
        queueCountdown = null
        queueCountdownEndsAt = null
        if (publicQueue.length >= PUBLIC_MIN_PLAYERS) {
          startPublicMatch()
        } else {
          queueWindowExpired = true
          broadcastQueueStatus()
        }
      }, queueCountdownMs)
    }
  } else if (publicQueue.length >= PUBLIC_MIN_PLAYERS && !queueGraceTimer) {
    queueGraceEndsAt = Date.now() + queueGraceMs
    queueGraceTimer = setTimeout(() => {
      queueGraceTimer = null
      queueGraceEndsAt = null
      startPublicMatch()
    }, queueGraceMs)
  }
  broadcastQueueStatus()
  return queueStatusFor(identity.id)
}

/**
 * Leaves the public queue. An emptied queue resets the fill window;
 * dropping below the minimum cancels a running grace timer.
 */
export function leavePublicQueue(userId: number): void {
  publicQueue = publicQueue.filter((queued) => queued.id !== userId)
  if (publicQueue.length === 0) {
    resetQueueTimers()
  } else if (queueGraceTimer && publicQueue.length < PUBLIC_MIN_PLAYERS) {
    clearTimeout(queueGraceTimer)
    queueGraceTimer = null
    queueGraceEndsAt = null
  }
  broadcastQueueStatus()
}

export function queueStatusFor(userId: number): QueueStatus {
  return {
    inQueue: publicQueue.some((queued) => queued.id === userId),
    queueSize: publicQueue.length,
    startsInMs: queueStartsInMs(),
  }
}

/**
 * Remaining ms until a scheduled start, or null when no start is
 * guaranteed yet (below the minimum, or waiting after the window).
 */
function queueStartsInMs(): number | null {
  if (queueGraceEndsAt !== null) {
    return Math.max(0, queueGraceEndsAt - Date.now())
  }
  if (queueCountdownEndsAt !== null && publicQueue.length >= PUBLIC_MIN_PLAYERS) {
    return Math.max(0, queueCountdownEndsAt - Date.now())
  }
  return null
}

function broadcastQueueStatus(): void {
  for (const queued of publicQueue) {
    emitter.toUser(queued.id, 'queue:status', queueStatusFor(queued.id))
  }
}

function resetQueueTimers(): void {
  if (queueCountdown) {
    clearTimeout(queueCountdown)
  }
  queueCountdown = null
  queueCountdownEndsAt = null
  if (queueGraceTimer) {
    clearTimeout(queueGraceTimer)
  }
  queueGraceTimer = null
  queueGraceEndsAt = null
  queueWindowExpired = false
}

function startPublicMatch(): void {
  resetQueueTimers()
  // Backstop: anyone seated elsewhere since queueing is not dealt in
  publicQueue = publicQueue.filter((queued) => !matchIdByUser.has(queued.id))
  if (publicQueue.length < PUBLIC_MIN_PLAYERS) {
    broadcastQueueStatus()
    return
  }
  const starters = publicQueue.slice(0, PUBLIC_MAX_PLAYERS)
  publicQueue = publicQueue.slice(starters.length)
  createMatch(starters, CLASSIC_RULES, 'public', null)
  broadcastQueueStatus()
}

/* -------------------------------------------------------------------
 * Private lobbies (one per group, started by the owner)
 * ---------------------------------------------------------------- */

export function lobbyForGroup(groupId: number): PrivateLobby | null {
  return lobbies.get(groupId) ?? null
}

/** Whether a lobby can be joined yet (scheduled ones open later). */
function lobbyIsOpen(lobby: PrivateLobby): boolean {
  return lobby.opensAt === null || lobby.opensAt <= Date.now()
}

/**
 * Opens a lobby for the group with the given rules, either joinable
 * immediately or scheduled to open at a future time (nobody joins a
 * scheduled lobby until then). Only one game or lobby can exist per
 * group at a time (docs/features.md).
 */
export function createLobby(
  groupId: number,
  owner: PlayerIdentity,
  rules: GameRules,
  opensAt: number | null = null
): void {
  if (lobbies.has(groupId)) {
    throw new GameError('This group already has a game being set up', 'E_LOBBY_EXISTS')
  }
  for (const match of matches.values()) {
    if (match.groupId === groupId && match.finishedAt === null) {
      throw new GameError('This group already has a game in progress', 'E_GAME_IN_PROGRESS')
    }
  }
  // Scheduling doesn't seat the owner, so holding a place elsewhere is
  // only a conflict for a lobby that opens right away
  if (opensAt === null) {
    assertNotReserved(owner.id)
  }

  const lobby: PrivateLobby = {
    groupId,
    ownerId: owner.id,
    rules,
    players: opensAt === null ? [owner] : [],
    opensAt,
    openTimer: null,
  }
  lobbies.set(groupId, lobby)
  if (opensAt !== null) {
    scheduledStore?.save({ groupId, ownerId: owner.id, rules, opensAt })
    armLobbyTimers(lobby)
  }
  broadcastLobby(groupId)
}

/**
 * Rebuilds a scheduled lobby from persistence at boot. The player list
 * starts empty (it is never persisted); a schedule whose post-open
 * lifetime already lapsed is discarded instead.
 */
export function restoreScheduledLobby(entry: {
  groupId: number
  ownerId: number
  rules: GameRules
  opensAt: number
}): void {
  if (lobbies.has(entry.groupId) || entry.opensAt + SCHEDULED_LOBBY_TTL_MS <= Date.now()) {
    scheduledStore?.remove(entry.groupId)
    return
  }
  const lobby: PrivateLobby = {
    groupId: entry.groupId,
    ownerId: entry.ownerId,
    rules: entry.rules,
    players: [],
    opensAt: entry.opensAt,
    openTimer: null,
  }
  lobbies.set(entry.groupId, lobby)
  armLobbyTimers(lobby)
}

/**
 * Timers for a scheduled lobby: broadcast the moment it opens (pinned
 * banners flip to joinable), then drop it if nobody has started the
 * game within its post-open lifetime.
 */
function armLobbyTimers(lobby: PrivateLobby): void {
  if (lobby.opensAt === null) {
    return
  }
  if (lobby.openTimer) {
    clearTimeout(lobby.openTimer)
    lobby.openTimer = null
  }

  const now = Date.now()
  if (now < lobby.opensAt) {
    lobby.openTimer = setTimeout(() => {
      lobby.openTimer = null
      broadcastLobby(lobby.groupId)
      armLobbyTimers(lobby)
    }, lobby.opensAt - now)
    return
  }

  lobby.openTimer = setTimeout(
    () => {
      lobby.openTimer = null
      if (lobbies.get(lobby.groupId) === lobby) {
        removeLobby(lobby)
        broadcastLobby(lobby.groupId)
      }
    },
    lobby.opensAt + SCHEDULED_LOBBY_TTL_MS - now
  )
}

/** Drops a lobby, clearing its timer and persisted schedule. */
function removeLobby(lobby: PrivateLobby): void {
  if (lobby.openTimer) {
    clearTimeout(lobby.openTimer)
    lobby.openTimer = null
  }
  lobbies.delete(lobby.groupId)
  if (lobby.opensAt !== null) {
    scheduledStore?.remove(lobby.groupId)
  }
}

/**
 * Joins a group's open lobby (membership is checked by the caller).
 */
export function joinLobby(groupId: number, identity: PlayerIdentity): void {
  const lobby = lobbies.get(groupId)
  if (!lobby) {
    throw new GameError('There is no game being set up in this group', 'E_NO_LOBBY')
  }
  if (!lobbyIsOpen(lobby)) {
    throw new GameError('This game has not opened for joining yet', 'E_LOBBY_NOT_OPEN')
  }
  if (lobby.players.length >= PRIVATE_MAX_PLAYERS) {
    throw new GameError('This game is full (6 players max)', 'E_LOBBY_FULL')
  }
  if (!lobby.players.some((player) => player.id === identity.id)) {
    assertNotReserved(identity.id)
    lobby.players.push(identity)
  }
  broadcastLobby(groupId)
}

/**
 * Leaves a lobby. If the owner leaves, the lobby (or scheduled game)
 * is cancelled.
 */
export function leaveLobby(groupId: number, userId: number): void {
  const lobby = lobbies.get(groupId)
  if (!lobby) {
    return
  }
  if (lobby.ownerId === userId) {
    removeLobby(lobby)
  } else {
    lobby.players = lobby.players.filter((player) => player.id !== userId)
  }
  broadcastLobby(groupId)
}

/**
 * Starts the lobby's match. Owner only, 2+ players, and never before a
 * scheduled lobby has opened.
 */
export function startLobby(groupId: number, userId: number): ActiveMatch {
  const lobby = lobbies.get(groupId)
  if (!lobby) {
    throw new GameError('There is no game being set up in this group', 'E_NO_LOBBY')
  }
  if (lobby.ownerId !== userId) {
    throw new GameError('Only the game creator can start it', 'E_NOT_LOBBY_OWNER')
  }
  if (!lobbyIsOpen(lobby)) {
    throw new GameError('This game has not opened for joining yet', 'E_LOBBY_NOT_OPEN')
  }
  if (lobby.players.length < 2) {
    throw new GameError('At least 2 players are needed to start', 'E_NOT_ENOUGH_PLAYERS')
  }

  removeLobby(lobby)
  const match = createMatch(lobby.players, lobby.rules, 'private', groupId)
  broadcastLobby(groupId)
  return match
}

export interface LobbyView {
  groupId: number
  ownerId: number
  rules: GameRules
  players: PlayerIdentity[]
  opensAt: number | null
}

/**
 * The serializable view of a group's lobby (never the raw lobby — that
 * holds a live timer handle), or null when none exists.
 */
export function lobbyViewForGroup(groupId: number): LobbyView | null {
  const lobby = lobbies.get(groupId)
  return lobby
    ? {
        groupId: lobby.groupId,
        ownerId: lobby.ownerId,
        rules: lobby.rules,
        players: lobby.players,
        opensAt: lobby.opensAt,
      }
    : null
}

function broadcastLobby(groupId: number): void {
  emitter.toGroup(groupId, 'lobby:state', { groupId, lobby: lobbyViewForGroup(groupId) })
}

/* -------------------------------------------------------------------
 * Match lifecycle
 * ---------------------------------------------------------------- */

function createMatch(
  players: PlayerIdentity[],
  rules: GameRules,
  kind: MatchKind,
  groupId: number | null,
  practice?: { botIds: number[]; difficulty: BotDifficulty }
): ActiveMatch {
  // Seating is the only place a double booking can do harm, so it is
  // also where the invariant is enforced. The check below and the
  // matchIdByUser writes further down run without an await between
  // them, so nothing can seat the same player in between.
  // Snapshot first: releasing pending places mutates the queue and
  // lobby arrays that `players` may point at.
  const seating = [...players]
  const botIds = new Set(practice?.botIds ?? [])
  // Bots are exempt: the same bot legitimately plays many matches
  const doubleSeated = seating.find(
    (player) => !botIds.has(player.id) && matchIdByUser.has(player.id)
  )
  if (doubleSeated) {
    throw new GameError(`${doubleSeated.username} is already in a game`, 'E_ALREADY_IN_GAME')
  }

  const state = createGame(
    seating.map((player) => player.id),
    rules,
    rng
  )

  const match: ActiveMatch = {
    id: randomUUID(),
    kind,
    groupId,
    rules,
    state,
    identities: new Map(seating.map((player) => [player.id, player])),
    runtime: new Map(
      seating.map((player) => [
        player.id,
        {
          connected: true,
          remainingRejoinMs: rules.rejoinBudgetMs,
          disconnectedAt: null,
          rejoinTimer: null,
          milestoneTimers: [],
          remainingBankMs: rules.moveTimeBankMs,
        },
      ])
    ),
    botIds,
    botDifficulty: practice?.difficulty ?? null,
    botTimer: null,
    turnStartedAt: Date.now(),
    turnTimer: null,
    turnDeadlineAt: null,
    pausedAt: null,
    overtimeGranted: false,
    startedAt: Date.now(),
    finishedAt: null,
    lastActivityAt: Date.now(),
    systemMessages: [],
  }

  matches.set(match.id, match)
  for (const player of seating) {
    // Bots never connect, so they stay out of the per-user match
    // index: the same bot may sit in many matches at once
    if (botIds.has(player.id)) {
      continue
    }
    matchIdByUser.set(player.id, match.id)
    // Leave no pending place behind that could seat them a second time
    leavePublicQueue(player.id)
    dropFromLobbies(player.id)
    emitter.toUser(player.id, 'game:start', { matchId: match.id })
  }
  scheduleTurnTimer(match)
  broadcastState(match, 'The game has started')
  maybeScheduleBotTurn(match)
  return match
}

/**
 * Starts a practice match: the human against 1-3 bots on the classic
 * ruleset. Practice games are recorded in history but flagged, and
 * never count toward competitive stats.
 */
export function startPracticeMatch(
  human: PlayerIdentity,
  bots: PlayerIdentity[],
  difficulty: BotDifficulty
): ActiveMatch {
  assertNotReserved(human.id)
  if (bots.length < 1 || bots.length > MAX_BOT_OPPONENTS) {
    throw new GameError(
      `Practice games take 1 to ${MAX_BOT_OPPONENTS} bot opponents`,
      'E_BOT_COUNT'
    )
  }
  leavePublicQueue(human.id)
  return createMatch([human, ...bots], CLASSIC_RULES, 'practice', null, {
    botIds: bots.map((bot) => bot.id),
    difficulty,
  })
}

/**
 * Applies a player action to their match and broadcasts the new state.
 * Returns the acting player's updated view.
 *
 * @throws GameError with a player-facing message on illegal actions.
 */
export function applyGameAction(
  matchId: string,
  userId: number,
  action: GameAction
): ClientGameView {
  const match = matches.get(matchId)
  if (!match || matchIdByUser.get(userId) !== matchId) {
    throw new GameError('You are not part of this game', 'E_NOT_IN_GAME')
  }
  if (match.pausedAt !== null && action.type !== 'quit') {
    throw new GameError('The game is paused while a player reconnects', 'E_PAUSED')
  }

  const turnUserBefore = currentTurnUserId(match.state)
  const eventText = performAction(match, userId, action)
  afterStateChange(match, turnUserBefore)
  broadcastState(match, eventText)
  return redactedView(match, userId)
}

/**
 * Applies one action to the engine (shared by human moves and bot
 * steps) and describes it for the event feed.
 *
 * @throws GameError from the engine on illegal actions.
 */
function performAction(match: ActiveMatch, userId: number, action: GameAction): string {
  const username = match.identities.get(userId)?.username ?? 'A player'

  switch (action.type) {
    case 'draw':
      drawFromDeck(match.state, userId, rng)
      return `${username} drew from the deck`
    case 'takeDiscard':
      takeDiscard(match.state, userId)
      return `${username} took the discard`
    case 'returnDiscard':
      returnDiscard(match.state, userId)
      return `${username} returned the discard`
    case 'returnJoker':
      returnJoker(match.state, userId)
      return `${username} returned the joker`
    case 'layMelds':
      layMelds(match.state, userId, action.melds)
      return `${username} laid down`
    case 'goer':
      addGoer(match.state, userId, action)
      return `${username} added a go-er`
    case 'takeJoker':
      takeJoker(match.state, userId, action)
      return `${username} took a joker`
    case 'discard':
      discard(match.state, userId, action.cardId, rng)
      return `${username} discarded`
    case 'buyIn':
      decideBuyIn(match.state, userId, action.accept, rng)
      return action.accept ? `${username} bought back in` : `${username} is out`
    case 'quit':
      removeFromMatch(match, userId)
      return `${username} left the game`
  }
}

/**
 * The user whose turn it currently is (null between rounds / at end).
 */
function currentTurnUserId(state: GameState): number | null {
  if (state.phase !== 'awaitingDraw' && state.phase !== 'acting') {
    return null
  }
  return state.players[state.currentPlayerIndex].userId
}

/**
 * Timer bookkeeping after any state change: charge the bank of a
 * player whose turn ended, reschedule the timer, and finish the match
 * when the game is over.
 */
function afterStateChange(match: ActiveMatch, turnUserBefore: number | null): void {
  const turnUserAfter = currentTurnUserId(match.state)

  if (turnUserBefore !== null && turnUserBefore !== turnUserAfter) {
    const runtime = match.runtime.get(turnUserBefore)
    if (runtime) {
      const elapsed = Date.now() - match.turnStartedAt
      runtime.remainingBankMs = Math.max(0, runtime.remainingBankMs - elapsed)
    }
    match.turnStartedAt = Date.now()
    match.overtimeGranted = false
  }

  settlePracticeIfHumanOut(match)

  if (match.state.phase === 'finished') {
    finishMatch(match)
    return
  }
  scheduleTurnTimer(match)
  maybeScheduleBotTurn(match)
}

/* -------------------------------------------------------------------
 * Bot turns (practice matches)
 * ---------------------------------------------------------------- */

/** Thinking time before a bot's next step, jittered to feel alive. */
function botDelayMs(): number {
  return botDelayMsOverride ?? 900 + Math.floor(rng() * 800)
}

/**
 * The bot that must act right now: the bot whose turn it is, or a bot
 * with a pending buy-in decision at round end.
 */
function nextBotActor(match: ActiveMatch): number | null {
  if (match.botIds.size === 0) {
    return null
  }
  if (match.state.phase === 'roundEnd') {
    return match.state.pendingBuyIns.find((userId) => match.botIds.has(userId)) ?? null
  }
  const turnUser = currentTurnUserId(match.state)
  return turnUser !== null && match.botIds.has(turnUser) ? turnUser : null
}

/**
 * Arms (or clears) the timer for the next bot step. Bots act one
 * engine action at a time — draw, then lay, then discard — each after
 * a short thinking delay, so humans watch the turn unfold. Never runs
 * while the match is paused for a disconnected human.
 */
function maybeScheduleBotTurn(match: ActiveMatch): void {
  if (match.botTimer) {
    clearTimeout(match.botTimer)
    match.botTimer = null
  }
  if (match.pausedAt !== null || match.finishedAt !== null || match.state.phase === 'finished') {
    return
  }
  const botId = nextBotActor(match)
  if (botId === null || match.botDifficulty === null) {
    return
  }
  const difficulty = match.botDifficulty
  match.botTimer = setTimeout(() => {
    match.botTimer = null
    runBotStep(match, botId, difficulty)
  }, botDelayMs())
}

/**
 * Executes one bot step through the same engine path as human moves.
 * If the bot's chosen action is rejected by the engine, a simple
 * fallback keeps the game moving; as a last resort the bot is removed
 * so a match can never hang on a bot.
 */
function runBotStep(match: ActiveMatch, botId: number, difficulty: BotDifficulty): void {
  if (match.pausedAt !== null || match.finishedAt !== null || nextBotActor(match) !== botId) {
    return
  }

  const turnUserBefore = currentTurnUserId(match.state)
  let eventText: string
  try {
    eventText = performAction(match, botId, decideBotAction(match.state, botId, difficulty, rng))
  } catch (error) {
    if (!(error instanceof GameError)) {
      throw error
    }
    eventText = recoverBotStep(match, botId)
  }

  afterStateChange(match, turnUserBefore)
  broadcastState(match, eventText)
}

/**
 * Fallback when a bot's action was illegal: undo a pending discard
 * take, otherwise make the simplest legal move; failing that, remove
 * the bot so play continues.
 */
function recoverBotStep(match: ActiveMatch, botId: number): string {
  const username = match.identities.get(botId)?.username ?? 'A bot'
  const bot = playerState(match.state, botId)
  try {
    if (match.state.phase === 'acting') {
      if (bot.pendingDiscardCardId !== null) {
        returnDiscard(match.state, botId)
        return `${username} returned the discard`
      }
      if (bot.pendingJokerCardId !== null) {
        returnJoker(match.state, botId)
        return `${username} returned the joker`
      }
      discard(match.state, botId, bot.hand[0].id, rng)
      return `${username} discarded`
    }
    if (match.state.phase === 'awaitingDraw') {
      drawFromDeck(match.state, botId, rng)
      return `${username} drew from the deck`
    }
  } catch (error) {
    if (!(error instanceof GameError)) {
      throw error
    }
  }
  removeFromMatch(match, botId)
  return `${username} could not move and was removed`
}

/**
 * Ends a practice match the moment its human is out (quit, timed out,
 * or eliminated with no buy-in left): bots do not play on alone.
 * Folding the highest-scoring bots one by one hands the win to the
 * best-placed bot and lets the normal finish path record the match.
 */
function settlePracticeIfHumanOut(match: ActiveMatch): void {
  if (match.kind !== 'practice' || match.state.phase === 'finished') {
    return
  }
  const humanStillIn = match.state.players.some(
    (player) => !match.botIds.has(player.userId) && !player.eliminated
  )
  if (humanStillIn) {
    return
  }
  while (activePlayers(match.state).length > 1) {
    const leaders = activePlayers(match.state).sort((a, b) => b.score - a.score)
    // Folded to settle the game, not a genuine early departure — history
    // must not record these bots as having left
    removeFromMatch(match, leaders[0].userId, { markRemoved: false })
  }
}

/**
 * Schedules (or clears) the move timer for the current turn: the
 * player's remaining bank, or the per-turn overtime once the bank is
 * gone. Expiry removes them from the game (docs/Kalooki.md).
 */
function scheduleTurnTimer(match: ActiveMatch): void {
  if (match.turnTimer) {
    clearTimeout(match.turnTimer)
    match.turnTimer = null
    match.turnDeadlineAt = null
  }
  // Practice matches are solo play against bots: no other player is
  // waiting, so there is no move timer to enforce.
  if (match.kind === 'practice') {
    return
  }
  if (match.pausedAt !== null || match.state.phase === 'finished') {
    return
  }

  const turnUser = currentTurnUserId(match.state)
  if (turnUser === null) {
    return
  }
  const runtime = match.runtime.get(turnUser)
  if (!runtime) {
    return
  }

  const allowance =
    runtime.remainingBankMs > 0 ? runtime.remainingBankMs : match.rules.overtimePerTurnMs
  match.turnDeadlineAt = Date.now() + allowance
  match.turnTimer = setTimeout(() => {
    match.turnTimer = null
    if (runtime.remainingBankMs > 0 && !match.overtimeGranted) {
      // The bank ran dry mid-turn: one overtime allowance, then removal
      runtime.remainingBankMs = 0
      match.overtimeGranted = true
      scheduleTurnTimer(match)
      broadcastState(match, 'Time bank exhausted, 60 seconds per turn now')
      return
    }
    timeOutPlayer(match, turnUser)
  }, allowance)
}

function timeOutPlayer(match: ActiveMatch, userId: number): void {
  const username = match.identities.get(userId)?.username ?? 'A player'
  removeFromMatch(match, userId)
  afterStateChange(match, userId)
  broadcastState(match, `${username} ran out of time and was removed`)
}

/* -------------------------------------------------------------------
 * Disconnects: pause the game and run the rejoin budget
 * ---------------------------------------------------------------- */

/** Remaining-time marks announced in chat while a player is away. */
const REJOIN_MILESTONES: { ms: number; label: string }[] = [
  { ms: 5 * 60_000, label: '5 minutes' },
  { ms: 4 * 60_000, label: '4 minutes' },
  { ms: 3 * 60_000, label: '3 minutes' },
  { ms: 2 * 60_000, label: '2 minutes' },
  { ms: 60_000, label: '1 minute' },
  { ms: 30_000, label: '30 seconds' },
  { ms: 10_000, label: '10 seconds' },
]

let nextSystemMessageId = -1

/**
 * Posts a server-authored line to the match's chat: stored with the
 * match for the history endpoint and pushed live to every participant.
 * Negative ids keep system lines clear of database message ids.
 */
function postMatchSystemMessage(match: ActiveMatch, body: string): void {
  const message: MatchSystemMessage = {
    id: nextSystemMessageId--,
    body,
    createdAt: new Date().toISOString(),
    user: null,
    system: true,
  }
  match.systemMessages.push(message)
  for (const userId of match.identities.keys()) {
    if (match.botIds.has(userId)) {
      continue
    }
    emitter.toUser(userId, 'chat:message', {
      channel: 'match',
      groupId: null,
      matchId: match.id,
      message,
    })
  }
}

/**
 * Server-authored chat lines for a match (empty when the match is
 * unknown, e.g. already dropped from memory).
 */
export function matchSystemMessages(matchId: string): MatchSystemMessage[] {
  return matches.get(matchId)?.systemMessages ?? []
}

/**
 * A rejoin allowance in words, e.g. "5 minutes" or "2 minutes 30
 * seconds".
 */
function describeDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []
  if (minutes > 0) {
    parts.push(minutes === 1 ? '1 minute' : `${minutes} minutes`)
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(seconds === 1 ? '1 second' : `${seconds} seconds`)
  }
  return parts.join(' ')
}

function clearMilestoneTimers(runtime: ParticipantRuntime): void {
  for (const timer of runtime.milestoneTimers) {
    clearTimeout(timer)
  }
  runtime.milestoneTimers = []
}

/**
 * Marks a participant disconnected: the game pauses and their
 * remaining rejoin budget starts counting down (docs/Kalooki.md — the
 * budget is never refreshed within a game). Chat gets a countdown:
 * the time left at each milestone, then the removal notice. Practice
 * matches only pause — no budget, no countdown (docs/features.md).
 */
export function playerDisconnected(userId: number): void {
  leavePublicQueue(userId)
  dropFromLobbies(userId)

  const match = matchForUser(userId)
  if (!match || match.finishedAt !== null) {
    return
  }
  const runtime = match.runtime.get(userId)
  if (!runtime || !runtime.connected) {
    return
  }

  const username = match.identities.get(userId)?.username ?? 'A player'
  runtime.connected = false
  runtime.disconnectedAt = Date.now()

  // Practice matches have no rejoin timer, mirroring the move timer:
  // it is solo play, so nobody is kept waiting. The game (and its
  // bots) just pauses until the human returns — a page reload counts
  // as a disconnect, so removal here would forfeit the game on every
  // refresh.
  if (match.kind === 'practice') {
    pauseMatch(match)
    broadcastState(match, `${username} disconnected, game paused`)
    return
  }

  runtime.rejoinTimer = setTimeout(() => {
    runtime.rejoinTimer = null
    clearMilestoneTimers(runtime)
    removeFromMatch(match, userId)
    resumeIfNobodyDisconnected(match)
    afterStateChange(match, userId)
    broadcastState(match, `${username} did not reconnect in time and was removed`)
    postMatchSystemMessage(
      match,
      `${username} did not reconnect in time and has been kicked from the game.`
    )
  }, runtime.remainingRejoinMs)

  for (const milestone of REJOIN_MILESTONES) {
    if (milestone.ms < runtime.remainingRejoinMs) {
      runtime.milestoneTimers.push(
        setTimeout(() => {
          postMatchSystemMessage(match, `${username} has ${milestone.label} left to reconnect.`)
        }, runtime.remainingRejoinMs - milestone.ms)
      )
    }
  }

  pauseMatch(match)
  broadcastState(match, `${username} disconnected, game paused`)
  postMatchSystemMessage(
    match,
    `${username} disconnected, ${describeDuration(runtime.remainingRejoinMs)} to reconnect.`
  )
}

/**
 * Marks a participant connected again. Their rejoin budget shrinks by
 * the time they were away; the game resumes when nobody is missing.
 */
export function playerReconnected(userId: number): ActiveMatch | null {
  const match = matchForUser(userId)
  if (!match || match.finishedAt !== null) {
    return match
  }
  const runtime = match.runtime.get(userId)
  if (!runtime || runtime.connected) {
    return match
  }

  runtime.connected = true
  if (runtime.rejoinTimer) {
    clearTimeout(runtime.rejoinTimer)
    runtime.rejoinTimer = null
  }
  clearMilestoneTimers(runtime)
  if (runtime.disconnectedAt !== null) {
    // Practice matches never enforce the budget, so time away is free
    if (match.kind !== 'practice') {
      runtime.remainingRejoinMs = Math.max(
        0,
        runtime.remainingRejoinMs - (Date.now() - runtime.disconnectedAt)
      )
    }
    runtime.disconnectedAt = null
  }

  resumeIfNobodyDisconnected(match)
  const username = match.identities.get(userId)?.username ?? 'A player'
  broadcastState(match, `${username} reconnected`)
  postMatchSystemMessage(match, `${username} reconnected.`)
  return match
}

function pauseMatch(match: ActiveMatch): void {
  if (match.pausedAt !== null) {
    return
  }
  match.pausedAt = Date.now()
  if (match.turnTimer) {
    clearTimeout(match.turnTimer)
    match.turnTimer = null
    match.turnDeadlineAt = null
  }
  // Bots wait out the pause too
  if (match.botTimer) {
    clearTimeout(match.botTimer)
    match.botTimer = null
  }
}

function resumeIfNobodyDisconnected(match: ActiveMatch): void {
  const stillMissing = [...match.runtime.entries()].some(
    ([userId, runtime]) => !runtime.connected && !playerState(match.state, userId).eliminated
  )
  if (stillMissing || match.pausedAt === null) {
    return
  }

  // Paused time never counts against the mover's bank
  match.turnStartedAt += Date.now() - match.pausedAt
  match.pausedAt = null
  scheduleTurnTimer(match)
  maybeScheduleBotTurn(match)
}

/* -------------------------------------------------------------------
 * Idle expiry: abandoned games are ended after 12 hours
 * ---------------------------------------------------------------- */

/** An unfinished match with no state change for this long is expired. */
export const IDLE_MATCH_TTL_MS = 12 * 60 * 60 * 1000

/** How often the sweep looks for abandoned matches. */
const IDLE_SWEEP_INTERVAL_MS = 30 * 60 * 1000

let idleSweepTimer: NodeJS.Timeout | null = null

/** Arms the recurring idle sweep once (called from configuration). */
function armIdleSweep(): void {
  if (!idleSweepTimer) {
    idleSweepTimer = setInterval(sweepIdleMatches, IDLE_SWEEP_INTERVAL_MS)
    idleSweepTimer.unref?.()
  }
}

/**
 * Ends every match that has sat with no state change for 12 hours:
 * a practice game whose human never came back, or a multiplayer game
 * hung on something no timer covers (e.g. an unanswered buy-in). Runs
 * on an interval; exported so tests can trigger it directly.
 */
export function sweepIdleMatches(): void {
  for (const match of matches.values()) {
    if (match.finishedAt === null && Date.now() - match.lastActivityAt >= IDLE_MATCH_TTL_MS) {
      expireIdleMatch(match)
    }
  }
}

/**
 * Force-finishes an abandoned match: active humans are removed worst
 * score first, so the best-placed player takes the win; practice bots
 * then fold, and the normal finish path records the result.
 */
function expireIdleMatch(match: ActiveMatch): void {
  while (match.state.phase !== 'finished') {
    const humans = activePlayers(match.state)
      .filter((player) => !match.botIds.has(player.userId))
      .sort((a, b) => b.score - a.score)
    if (humans.length === 0) {
      break
    }
    removeFromMatch(match, humans[0].userId)
  }
  afterStateChange(match, null)
  broadcastState(match, 'The game sat idle for too long and has ended')
}

/* -------------------------------------------------------------------
 * Views and broadcasting
 * ---------------------------------------------------------------- */

/**
 * The match state as one player may see it: their own hand, everyone
 * else's card counts only. Opponents' hidden cards never leave the
 * server (docs/Architecture.md).
 */
export function redactedView(match: ActiveMatch, viewerUserId: number): ClientGameView {
  const state = match.state
  const viewer = playerState(state, viewerUserId)

  return {
    matchId: match.id,
    kind: match.kind,
    rules: match.rules,
    phase: state.phase,
    roundNumber: state.roundNumber,
    paused: match.pausedAt !== null,
    turnDeadlineAt: match.turnDeadlineAt,
    currentPlayerUserId: currentTurnUserId(state),
    dealerUserId: state.players[state.dealerIndex].userId,
    winnerUserId: state.winnerUserId,
    pendingBuyIns: state.pendingBuyIns,
    deckCount: state.deck.length,
    discardCount: state.discardPile.length,
    discardTop: state.discardPile[state.discardPile.length - 1] ?? null,
    melds: state.melds,
    roundResults: state.roundResults,
    players: state.players.map((player, seat) => {
      const identity = match.identities.get(player.userId)
      const runtime = match.runtime.get(player.userId)
      return {
        userId: player.userId,
        username: identity?.username ?? `Player ${player.userId}`,
        seat,
        isBot: match.botIds.has(player.userId),
        handCount: player.hand.length,
        hasComeDown: player.hasComeDown,
        score: player.score,
        buyInsUsed: player.buyInsUsed,
        chips: player.chips,
        eliminated: player.eliminated,
        removed: player.removed,
        connected: runtime?.connected ?? true,
      }
    }),
    you: {
      hand: viewer.hand,
      pendingDiscardCardId: viewer.pendingDiscardCardId,
      pendingJokerCardId: viewer.pendingJokerCardId,
    },
  }
}

function broadcastState(match: ActiveMatch, eventText: string): void {
  // Every state change funnels through here: reset the idle clock
  match.lastActivityAt = Date.now()
  for (const userId of match.identities.keys()) {
    // Bots have no sockets; never emit a view holding a bot's hand
    if (match.botIds.has(userId)) {
      continue
    }
    emitter.toUser(userId, 'game:state', {
      view: redactedView(match, userId),
      event: eventText,
    })
  }
}

function clearMatchTimers(match: ActiveMatch): void {
  if (match.turnTimer) {
    clearTimeout(match.turnTimer)
    match.turnTimer = null
  }
  if (match.botTimer) {
    clearTimeout(match.botTimer)
    match.botTimer = null
  }
  for (const runtime of match.runtime.values()) {
    if (runtime.rejoinTimer) {
      clearTimeout(runtime.rejoinTimer)
      runtime.rejoinTimer = null
    }
    clearMilestoneTimers(runtime)
  }
}

/**
 * Marks the match finished and releases its players. The match stays
 * readable for a grace period so end screens can render, then drops
 * from memory. Recording to match history hooks in here.
 */
function finishMatch(match: ActiveMatch): void {
  if (match.finishedAt !== null) {
    return
  }
  match.finishedAt = Date.now()
  clearMatchTimers(match)
  for (const userId of match.identities.keys()) {
    matchIdByUser.delete(userId)
  }
  for (const listener of matchFinishedListeners) {
    listener(match)
  }
  setTimeout(() => {
    matches.delete(match.id)
  }, 60 * 1000).unref?.()
}

type MatchFinishedListener = (match: ActiveMatch) => void
const matchFinishedListeners: MatchFinishedListener[] = []

/**
 * Registers a callback for finished matches (used by match history
 * recording).
 */
export function onMatchFinished(listener: MatchFinishedListener): void {
  matchFinishedListeners.push(listener)
}

/**
 * Active players who remain (used to describe end states).
 */
export function remainingPlayers(match: ActiveMatch): number[] {
  return activePlayers(match.state).map((player) => player.userId)
}
