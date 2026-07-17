import { getSocket } from '#/lib/socket'

/**
 * Gameplay data layer: types mirroring the backend's redacted match
 * view plus promise-wrapped socket calls. Opponents' hands never reach
 * the client — only counts.
 */

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 'J' | 'Q' | 'K' | 'A'

export interface GameCard {
  id: number
  isJoker: boolean
  suit: Suit | null
  rank: Rank | null
}

export interface MeldCardView {
  card: GameCard
  rank: Rank
  suit: Suit | null
}

export interface MeldView {
  id: number
  ownerUserId: number
  type: 'group' | 'run'
  cards: MeldCardView[]
}

/** `buyInsPerPlayer` value meaning no limit on buy-ins. */
export const UNLIMITED_BUY_INS = -1

/**
 * Play-money amounts (chips) for a private game; a per-match ledger
 * only, nothing persists between games.
 */
export interface MatchStakesView {
  stake: number
  rebuy: number
  kalooki: number
  call: number
}

export interface GameRulesView {
  decks: number
  jokers: number
  comeDownThreshold: number
  moveTimeBankMs: number
  overtimePerTurnMs: number
  rejoinBudgetMs: number
  buyInsPerPlayer: number
  scoreLimit: number
  stakes: MatchStakesView | null
}

export interface RoundResultView {
  roundNumber: number
  winnerUserId: number | null
  calledKalooki: boolean
  penalties: Record<number, number>
  totals: Record<number, number>
  chips: Record<number, number>
}

export interface GamePlayerView {
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
}

export type MatchKind = 'public' | 'private' | 'practice'

export type BotDifficulty = 'easy' | 'medium' | 'hard'

export interface GameView {
  matchId: string
  kind: MatchKind
  rules: GameRulesView
  phase: 'awaitingDraw' | 'acting' | 'roundEnd' | 'finished'
  roundNumber: number
  paused: boolean
  turnDeadlineAt: number | null
  currentPlayerUserId: number | null
  dealerUserId: number
  winnerUserId: number | null
  pendingBuyIns: number[]
  deckCount: number
  discardCount: number
  discardTop: GameCard | null
  melds: MeldView[]
  roundResults: RoundResultView[]
  players: GamePlayerView[]
  you: {
    hand: GameCard[]
    pendingDiscardCardId: number | null
    pendingJokerCardId: number | null
  }
}

export type GameAction =
  | { type: 'draw' }
  | { type: 'takeDiscard' }
  | { type: 'returnDiscard' }
  | { type: 'returnJoker' }
  | { type: 'layMelds'; melds: number[][] }
  | { type: 'goer'; meldId: number; cardId: number; runEnd?: 'low' | 'high' }
  | {
      type: 'takeJoker'
      meldId: number
      jokerCardId: number
      replacementCardIds: number[]
    }
  | { type: 'discard'; cardId: number }
  | { type: 'buyIn'; accept: boolean }
  | { type: 'quit' }

export interface QueueStatus {
  inQueue: boolean
  queueSize: number
  startsInMs: number | null
}

export interface LobbyView {
  groupId: number
  ownerId: number
  rules: GameRulesView
  players: {
    id: number
    username: string
  }[]
  /** Epoch ms a scheduled lobby opens for joining; null = open now. */
  opensAt: number | null
}

/** Whether a lobby can be joined yet (scheduled ones open later). */
export function lobbyIsOpen(lobby: LobbyView): boolean {
  return lobby.opensAt === null || lobby.opensAt <= Date.now()
}

/**
 * A short countdown for a scheduled lobby, e.g. "2h 05m" or "3m".
 */
export function formatOpensIn(opensAt: number): string {
  const remainingMs = Math.max(0, opensAt - Date.now())
  const totalMinutes = Math.ceil(remainingMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) {
    return `${minutes}m`
  }
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

export interface CustomRulesInput {
  decks: number
  jokers: number
  comeDownThreshold: number
  scoreLimit: number
  moveTimeMinutes: number
  rejoinMinutes: number
  buyInsPerPlayer: number
  stakes: MatchStakesView | null
}

interface Ack<T> {
  ok: boolean
  error?: string
  data?: T
}

/**
 * Emits a socket event and resolves with the acked data, rejecting
 * with the server's message on failure.
 */
function call<T>(event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    getSocket()
      .timeout(10000)
      .emit(event, payload, (timeoutError: Error | null, ack: Ack<T>) => {
        if (timeoutError) {
          reject(
            new Error('The server did not respond, check your connection'),
          )
        } else if (!ack.ok) {
          reject(new Error(ack.error ?? 'Something went wrong'))
        } else {
          resolve(ack.data as T)
        }
      })
  })
}

export function sendGameAction(
  matchId: string,
  action: GameAction,
): Promise<GameView> {
  return call<GameView>('game:action', { matchId, action })
}

export function fetchGameView(matchId: string): Promise<GameView> {
  return call<GameView>('game:view', { matchId })
}

export function joinPublicQueue(): Promise<QueueStatus> {
  return call<QueueStatus>('match:queue', {})
}

export function leavePublicQueue(): Promise<QueueStatus> {
  return call<QueueStatus>('match:unqueue', {})
}

/**
 * Starts a practice match against 1-3 bots on the classic ruleset.
 * Practice games are saved to history but never count toward stats.
 */
export function startPracticeMatch(
  difficulty: BotDifficulty,
  opponents: number,
): Promise<{ matchId: string }> {
  return call<{ matchId: string }>('match:practice', { difficulty, opponents })
}

export function fetchLobby(groupId: number): Promise<LobbyView | null> {
  return call<LobbyView | null>('lobby:get', { groupId })
}

export function createLobby(
  groupId: number,
  rules: CustomRulesInput,
  scheduleHours = 0,
): Promise<LobbyView | null> {
  return call<LobbyView | null>('match:createLobby', {
    groupId,
    rules,
    scheduleHours,
  })
}

export function joinLobby(groupId: number): Promise<LobbyView | null> {
  return call<LobbyView | null>('match:joinLobby', { groupId })
}

export function leaveLobby(groupId: number): Promise<void> {
  return call<void>('match:leaveLobby', { groupId })
}

export function startLobby(groupId: number): Promise<{ matchId: string }> {
  return call<{ matchId: string }>('match:startLobby', { groupId })
}

/**
 * Card point value shown in the UI (aces 11, pictures 10, joker 15).
 */
export function cardLabel(card: GameCard): string {
  if (card.isJoker) {
    return 'Joker'
  }
  return `${String(card.rank)} of ${card.suit}`
}

/**
 * A signed chips amount for display: +4, 0, -6.
 */
export function formatChips(amount: number): string {
  return amount > 0 ? `+${amount}` : String(amount)
}
