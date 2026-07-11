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
  takeDiscard,
  takeJoker,
} from '#services/game/engine'
import type { GameRules, GameState, TabledMeld, RoundResult } from '#services/game/engine'
import type { Card, Rng } from '#services/game/cards'

/**
 * Live match orchestration: public matchmaking, private group lobbies,
 * per-player redacted views, move/rejoin timers, and
 * disconnect-pausing. Pure game rules live in the engine; socket
 * plumbing lives in the socket service and reaches this module through
 * the injected emitter, so everything here is testable without I/O.
 */

export interface PlayerIdentity {
  id: number
  username: string
  avatarUrl: string | null
  initials: string
}

/** A player-initiated game action, forwarded from the socket layer. */
export type GameAction =
  | { type: 'draw' }
  | { type: 'takeDiscard' }
  | { type: 'returnDiscard' }
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
  /** Thinking-time bank left for the whole game. */
  remainingBankMs: number
}

export interface ActiveMatch {
  id: string
  kind: 'public' | 'private'
  groupId: number | null
  rules: GameRules
  state: GameState
  identities: Map<number, PlayerIdentity>
  runtime: Map<number, ParticipantRuntime>
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
}

/** What the socket layer must provide for outbound messages. */
export interface MatchEmitter {
  toUser(userId: number, event: string, payload: unknown): void
  toGroup(groupId: number, event: string, payload: unknown): void
}

/** The view of a match a single player is allowed to see. */
export interface ClientGameView {
  matchId: string
  kind: 'public' | 'private'
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
    avatarUrl: string | null
    initials: string
    seat: number
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
let queueCountdown: NodeJS.Timeout | null = null

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

/** Queue fills for this long once it can start, so more can join. */
let queueCountdownMs = 10 * 1000
const MAX_PLAYERS = 6

let emitter: MatchEmitter = {
  toUser: () => {},
  toGroup: () => {},
}
let rng: Rng = Math.random

/**
 * Wires the outbound emitter (called by the socket provider at boot).
 * The rng and queue countdown can be overridden for deterministic
 * tests.
 */
export function configureMatchService(
  nextEmitter: MatchEmitter,
  options: { rng?: Rng; queueCountdownMs?: number } = {}
): void {
  emitter = nextEmitter
  if (options.rng) {
    rng = options.rng
  }
  if (options.queueCountdownMs !== undefined) {
    queueCountdownMs = options.queueCountdownMs
  }
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
  if (queueCountdown) {
    clearTimeout(queueCountdown)
    queueCountdown = null
  }
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

/* -------------------------------------------------------------------
 * Public matchmaking
 * ---------------------------------------------------------------- */

export interface QueueStatus {
  inQueue: boolean
  queueSize: number
  startsInMs: number | null
}

/**
 * Joins the public queue. Once 2+ players are waiting a short
 * countdown runs so more can join (up to 6), then the match starts
 * with the classic ruleset.
 */
export function joinPublicQueue(identity: PlayerIdentity): QueueStatus {
  if (matchForUser(identity.id)) {
    throw new GameError('You are already in a game', 'E_ALREADY_IN_GAME')
  }
  if (!publicQueue.some((queued) => queued.id === identity.id)) {
    publicQueue.push(identity)
  }

  if (publicQueue.length >= 2 && !queueCountdown) {
    queueCountdown = setTimeout(() => {
      queueCountdown = null
      startPublicMatch()
    }, queueCountdownMs)
  }
  broadcastQueueStatus()
  return queueStatusFor(identity.id)
}

/**
 * Leaves the public queue; a countdown with fewer than 2 players left
 * is cancelled.
 */
export function leavePublicQueue(userId: number): void {
  publicQueue = publicQueue.filter((queued) => queued.id !== userId)
  if (publicQueue.length < 2 && queueCountdown) {
    clearTimeout(queueCountdown)
    queueCountdown = null
  }
  broadcastQueueStatus()
}

export function queueStatusFor(userId: number): QueueStatus {
  return {
    inQueue: publicQueue.some((queued) => queued.id === userId),
    queueSize: publicQueue.length,
    startsInMs: queueCountdown ? queueCountdownMs : null,
  }
}

function broadcastQueueStatus(): void {
  for (const queued of publicQueue) {
    emitter.toUser(queued.id, 'queue:status', queueStatusFor(queued.id))
  }
}

function startPublicMatch(): void {
  const starters = publicQueue.slice(0, MAX_PLAYERS)
  publicQueue = publicQueue.slice(starters.length)
  if (starters.length < 2) {
    broadcastQueueStatus()
    return
  }
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
  // Scheduling doesn't seat the owner, so being in a game is only a
  // conflict for a lobby that opens right away
  if (opensAt === null && matchForUser(owner.id)) {
    throw new GameError('You are already in a game', 'E_ALREADY_IN_GAME')
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
  if (matchForUser(identity.id)) {
    throw new GameError('You are already in a game', 'E_ALREADY_IN_GAME')
  }
  if (lobby.players.length >= MAX_PLAYERS) {
    throw new GameError('This game is full (6 players max)', 'E_LOBBY_FULL')
  }
  if (!lobby.players.some((player) => player.id === identity.id)) {
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
  kind: 'public' | 'private',
  groupId: number | null
): ActiveMatch {
  const state = createGame(
    players.map((player) => player.id),
    rules,
    rng
  )

  const match: ActiveMatch = {
    id: randomUUID(),
    kind,
    groupId,
    rules,
    state,
    identities: new Map(players.map((player) => [player.id, player])),
    runtime: new Map(
      players.map((player) => [
        player.id,
        {
          connected: true,
          remainingRejoinMs: rules.rejoinBudgetMs,
          disconnectedAt: null,
          rejoinTimer: null,
          remainingBankMs: rules.moveTimeBankMs,
        },
      ])
    ),
    turnStartedAt: Date.now(),
    turnTimer: null,
    turnDeadlineAt: null,
    pausedAt: null,
    overtimeGranted: false,
    startedAt: Date.now(),
    finishedAt: null,
  }

  matches.set(match.id, match)
  for (const player of players) {
    matchIdByUser.set(player.id, match.id)
    emitter.toUser(player.id, 'game:start', { matchId: match.id })
  }
  scheduleTurnTimer(match)
  broadcastState(match, 'The game has started')
  return match
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

  const username = match.identities.get(userId)?.username ?? 'A player'
  const turnUserBefore = currentTurnUserId(match.state)
  let eventText: string

  switch (action.type) {
    case 'draw':
      drawFromDeck(match.state, userId, rng)
      eventText = `${username} drew from the deck`
      break
    case 'takeDiscard':
      takeDiscard(match.state, userId)
      eventText = `${username} took the discard`
      break
    case 'returnDiscard':
      returnDiscard(match.state, userId)
      eventText = `${username} returned the discard`
      break
    case 'layMelds':
      layMelds(match.state, userId, action.melds)
      eventText = `${username} laid down`
      break
    case 'goer':
      addGoer(match.state, userId, action)
      eventText = `${username} added a go-er`
      break
    case 'takeJoker':
      takeJoker(match.state, userId, action)
      eventText = `${username} took a joker`
      break
    case 'discard':
      discard(match.state, userId, action.cardId, rng)
      eventText = `${username} discarded`
      break
    case 'buyIn':
      decideBuyIn(match.state, userId, action.accept, rng)
      eventText = action.accept ? `${username} bought back in` : `${username} is out`
      break
    case 'quit':
      removePlayer(match.state, userId, rng)
      eventText = `${username} left the game`
      break
  }

  afterStateChange(match, turnUserBefore)
  broadcastState(match, eventText)
  return redactedView(match, userId)
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

  if (match.state.phase === 'finished') {
    finishMatch(match)
    return
  }
  scheduleTurnTimer(match)
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
      broadcastState(match, 'Time bank exhausted — 60 seconds per turn now')
      return
    }
    timeOutPlayer(match, turnUser)
  }, allowance)
}

function timeOutPlayer(match: ActiveMatch, userId: number): void {
  const username = match.identities.get(userId)?.username ?? 'A player'
  removePlayer(match.state, userId, rng)
  afterStateChange(match, userId)
  broadcastState(match, `${username} ran out of time and was removed`)
}

/* -------------------------------------------------------------------
 * Disconnects: pause the game and run the rejoin budget
 * ---------------------------------------------------------------- */

/**
 * Marks a participant disconnected: the game pauses and their
 * remaining rejoin budget starts counting down (docs/Kalooki.md — the
 * budget is never refreshed within a game).
 */
export function playerDisconnected(userId: number): void {
  leavePublicQueue(userId)
  for (const [groupId, lobby] of lobbies) {
    if (lobby.players.some((player) => player.id === userId)) {
      leaveLobby(groupId, userId)
    }
  }

  const match = matchForUser(userId)
  if (!match || match.finishedAt !== null) {
    return
  }
  const runtime = match.runtime.get(userId)
  if (!runtime || !runtime.connected) {
    return
  }

  runtime.connected = false
  runtime.disconnectedAt = Date.now()
  runtime.rejoinTimer = setTimeout(() => {
    runtime.rejoinTimer = null
    const username = match.identities.get(userId)?.username ?? 'A player'
    removePlayer(match.state, userId, rng)
    resumeIfNobodyDisconnected(match)
    afterStateChange(match, userId)
    broadcastState(match, `${username} did not reconnect in time and was removed`)
  }, runtime.remainingRejoinMs)

  pauseMatch(match)
  const username = match.identities.get(userId)?.username ?? 'A player'
  broadcastState(match, `${username} disconnected — game paused`)
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
  if (runtime.disconnectedAt !== null) {
    runtime.remainingRejoinMs = Math.max(
      0,
      runtime.remainingRejoinMs - (Date.now() - runtime.disconnectedAt)
    )
    runtime.disconnectedAt = null
  }

  resumeIfNobodyDisconnected(match)
  const username = match.identities.get(userId)?.username ?? 'A player'
  broadcastState(match, `${username} reconnected`)
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
        avatarUrl: identity?.avatarUrl ?? null,
        initials: identity?.initials ?? '??',
        seat,
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
  for (const userId of match.identities.keys()) {
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
  for (const runtime of match.runtime.values()) {
    if (runtime.rejoinTimer) {
      clearTimeout(runtime.rejoinTimer)
      runtime.rejoinTimer = null
    }
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
