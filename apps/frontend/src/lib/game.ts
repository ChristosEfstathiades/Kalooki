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

export interface GameRulesView {
  decks: number
  jokers: number
  comeDownThreshold: number
  moveTimeBankMs: number
  overtimePerTurnMs: number
  rejoinBudgetMs: number
  buyInsPerPlayer: number
  scoreLimit: number
}

export interface RoundResultView {
  roundNumber: number
  winnerUserId: number | null
  penalties: Record<number, number>
  totals: Record<number, number>
}

export interface GamePlayerView {
  userId: number
  username: string
  avatarUrl: string | null
  initials: string
  seat: number
  handCount: number
  hasComeDown: boolean
  score: number
  buyInsUsed: number
  eliminated: boolean
  removed: boolean
  connected: boolean
}

export interface GameView {
  matchId: string
  kind: 'public' | 'private'
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
    avatarUrl: string | null
    initials: string
  }[]
}

export interface CustomRulesInput {
  decks: number
  jokers: number
  comeDownThreshold: number
  moveTimeMinutes: number
  rejoinMinutes: number
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
            new Error('The server did not respond — check your connection'),
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

export function fetchLobby(groupId: number): Promise<LobbyView | null> {
  return call<LobbyView | null>('lobby:get', { groupId })
}

export function createLobby(
  groupId: number,
  rules: CustomRulesInput,
): Promise<LobbyView | null> {
  return call<LobbyView | null>('match:createLobby', { groupId, rules })
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
