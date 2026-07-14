import { buildDeck, cardPenalty, shuffle } from '#services/game/cards'
import {
  MeldError,
  jokerReplacementNeeds,
  meldValue,
  resolveGoer,
  resolveMeld,
} from '#services/game/melds'
import type { Card, Rank, Suit, Rng } from '#services/game/cards'
import type { MeldCard, ResolvedMeld } from '#services/game/melds'

/**
 * The Kalooki game engine: a pure state machine over GameState. All
 * I/O (sockets, timers, persistence) lives in the match runner; every
 * function here validates a player action, mutates the state, and
 * throws GameError with a player-facing message when the action is
 * illegal. See docs/Kalooki.md for the rules implemented.
 */

export class GameError extends Error {
  code: string
  constructor(message: string, code = 'E_INVALID_MOVE') {
    super(message)
    this.code = code
  }
}

/** `rules.buyInsPerPlayer` value meaning no limit on buy-ins. */
export const UNLIMITED_BUY_INS = -1

/**
 * Play-money amounts for a private game, in chips. The money is a
 * per-match ledger only — nothing persists between games. Calls and
 * kalookis are paid to the round's caller as they happen; stakes and
 * buy-in money go to the game's winner at the end.
 */
export interface MatchStakes {
  /** Staked by every player at the start; the winner collects all. */
  stake: number
  /** Cost of each buy-in, paid into the pot the winner collects. */
  rebuy: number
  /**
   * Paid to the caller by every other active player when the round is
   * won with a kalooki (all thirteen cards laid in one turn). Replaces
   * the per-call payment for that round.
   */
  kalooki: number
  /** Paid to the caller by every other active player each round. */
  call: number
}

export interface GameRules {
  /** Standard decks in play (2-4). */
  decks: number
  /** Jokers in play (0-4). */
  jokers: number
  /** Points of tabled sets required to come down (default 40). */
  comeDownThreshold: number
  /** Thinking-time bank for the whole game, per player. */
  moveTimeBankMs: number
  /** Per-turn allowance once the bank is exhausted. */
  overtimePerTurnMs: number
  /** Total pause budget a disconnected player gets (not refreshed). */
  rejoinBudgetMs: number
  /**
   * Buy-ins each player may use after busting the score limit
   * (UNLIMITED_BUY_INS for no limit).
   */
  buyInsPerPlayer: number
  /** Penalty points that eliminate a player (out on limit+1). */
  scoreLimit: number
  /** Play-money amounts, or null when not playing for chips. */
  stakes: MatchStakes | null
}

/** The fixed classic ruleset used by all public matches. */
export const CLASSIC_RULES: GameRules = {
  decks: 2,
  jokers: 2,
  comeDownThreshold: 40,
  moveTimeBankMs: 30 * 60 * 1000,
  overtimePerTurnMs: 60 * 1000,
  rejoinBudgetMs: 5 * 60 * 1000,
  buyInsPerPlayer: 1,
  scoreLimit: 150,
  stakes: null,
}

export type GamePhase = 'awaitingDraw' | 'acting' | 'roundEnd' | 'finished'

export interface TabledMeld extends ResolvedMeld {
  id: number
  ownerUserId: number
}

export interface PlayerState {
  userId: number
  hand: Card[]
  hasComeDown: boolean
  score: number
  buyInsUsed: number
  /** Net play-money chips won or lost so far (0 without stakes). */
  chips: number
  /**
   * Whether the player had already come down when their current turn
   * began; null between turns. Calling while this is false is a
   * kalooki: all thirteen cards laid in one turn.
   */
  comeDownAtTurnStart: boolean | null
  /** Out of the game (score over the limit, or removed). */
  eliminated: boolean
  /** Removed by move/rejoin timeout or by quitting. */
  removed: boolean
  /**
   * Card taken from the discard pile this turn. It must appear in a
   * newly tabled set before the player may discard.
   */
  pendingDiscardCardId: number | null
  /**
   * Joker reclaimed from the table this turn. Same obligation: it must
   * be tabled in a new set before discarding, and never as a go-er.
   */
  pendingJokerCardId: number | null
  /**
   * The reversible context of a joker reclaimed this turn: the set it
   * came from, the natural cards swapped in for it, and what it stood
   * for there — enough to hand it back if it cannot be re-tabled. Null
   * whenever no joker take is pending.
   */
  pendingJokerReturn: {
    meldId: number
    replacementCardIds: number[]
    rank: Rank
    suit: Suit | null
  } | null
}

export interface RoundResult {
  roundNumber: number
  /** Winner of the round (null when the round was aborted). */
  winnerUserId: number | null
  /** True when the caller laid all thirteen cards in one turn. */
  calledKalooki: boolean
  /** Penalty points added this round, per user id. */
  penalties: Record<number, number>
  /** Cumulative scores after the round, per user id. */
  totals: Record<number, number>
  /** Chips won or lost this round, per user id (empty without stakes). */
  chips: Record<number, number>
}

export interface GameState {
  rules: GameRules
  players: PlayerState[]
  deck: Card[]
  discardPile: Card[]
  melds: TabledMeld[]
  nextMeldId: number
  currentPlayerIndex: number
  dealerIndex: number
  phase: GamePhase
  roundNumber: number
  roundResults: RoundResult[]
  /** Players who busted this round and may still buy back in. */
  pendingBuyIns: number[]
  winnerUserId: number | null
}

/**
 * Creates a game and deals the first round. 2-6 players; seating
 * follows the order given.
 */
export function createGame(userIds: number[], rules: GameRules, rng: Rng): GameState {
  if (userIds.length < 2 || userIds.length > 6) {
    throw new GameError('Kalooki is played with 2 to 6 players', 'E_PLAYER_COUNT')
  }

  const state: GameState = {
    rules,
    players: userIds.map((userId) => ({
      userId,
      hand: [],
      hasComeDown: false,
      score: 0,
      buyInsUsed: 0,
      chips: 0,
      comeDownAtTurnStart: null,
      eliminated: false,
      removed: false,
      pendingDiscardCardId: null,
      pendingJokerCardId: null,
      pendingJokerReturn: null,
    })),
    deck: [],
    discardPile: [],
    melds: [],
    nextMeldId: 1,
    currentPlayerIndex: 0,
    dealerIndex: Math.floor(rng() * userIds.length),
    phase: 'awaitingDraw',
    roundNumber: 0,
    roundResults: [],
    pendingBuyIns: [],
    winnerUserId: null,
  }

  dealRound(state, rng)
  return state
}

/**
 * Players still competing (not eliminated).
 */
export function activePlayers(state: GameState): PlayerState[] {
  return state.players.filter((player) => !player.eliminated)
}

/**
 * Finds a player's state or fails.
 */
export function playerState(state: GameState, userId: number): PlayerState {
  const player = state.players.find((candidate) => candidate.userId === userId)
  if (!player) {
    throw new GameError('You are not part of this game', 'E_NOT_IN_GAME')
  }
  return player
}

/**
 * Shuffles and deals 13 cards to every active player and resets
 * per-round state. The player left of the dealer starts.
 */
function dealRound(state: GameState, rng: Rng): void {
  state.roundNumber += 1
  state.melds = []
  state.discardPile = []
  state.deck = shuffle(buildDeck(state.rules.decks, state.rules.jokers), rng)

  for (const player of state.players) {
    player.hand = []
    player.hasComeDown = false
    player.comeDownAtTurnStart = null
    player.pendingDiscardCardId = null
    player.pendingJokerCardId = null
    player.pendingJokerReturn = null
    if (!player.eliminated) {
      player.hand = state.deck.splice(0, 13)
    }
  }

  // Dealer rotates to the next active seat each round; play starts on
  // the dealer's left
  state.dealerIndex = nextActiveIndex(state, state.dealerIndex)
  state.currentPlayerIndex = nextActiveIndex(state, state.dealerIndex)
  state.phase = 'awaitingDraw'
}

/**
 * The next non-eliminated seat after the given index.
 */
function nextActiveIndex(state: GameState, fromIndex: number): number {
  for (let step = 1; step <= state.players.length; step++) {
    const index = (fromIndex + step) % state.players.length
    if (!state.players[index].eliminated) {
      return index
    }
  }
  throw new GameError('No active players remain', 'E_NO_ACTIVE_PLAYERS')
}

/**
 * Asserts it is this player's turn and the game is in the phase the
 * action needs.
 */
function assertTurn(state: GameState, userId: number, phase: GamePhase): PlayerState {
  const player = playerState(state, userId)
  if (state.phase !== phase) {
    const explanation =
      state.phase === 'awaitingDraw'
        ? 'Draw a card first'
        : state.phase === 'acting'
          ? 'You have already drawn this turn'
          : 'The round is not in play'
    throw new GameError(explanation, 'E_WRONG_PHASE')
  }
  if (state.players[state.currentPlayerIndex].userId !== userId) {
    throw new GameError('It is not your turn', 'E_NOT_YOUR_TURN')
  }
  if (player.eliminated) {
    throw new GameError('You are out of this game', 'E_ELIMINATED')
  }
  return player
}

/**
 * Draws the top card of the deck. When the deck is empty the discard
 * pile (minus its top card) is reshuffled into a new deck first.
 */
export function drawFromDeck(state: GameState, userId: number, rng: Rng): Card {
  const player = assertTurn(state, userId, 'awaitingDraw')

  if (state.deck.length === 0) {
    const topDiscard = state.discardPile.pop()
    state.deck = shuffle(state.discardPile, rng)
    state.discardPile = topDiscard ? [topDiscard] : []
    if (state.deck.length === 0) {
      throw new GameError('No cards left to draw', 'E_DECK_EMPTY')
    }
  }

  const card = state.deck.shift() as Card
  player.hand.push(card)
  markTurnStart(player)
  state.phase = 'acting'
  return card
}

/**
 * Snapshots whether the player had come down before this turn (for
 * kalooki detection). Only the first draw of the turn counts — a
 * returned discard and re-draw stays within the same turn.
 */
function markTurnStart(player: PlayerState): void {
  if (player.comeDownAtTurnStart === null) {
    player.comeDownAtTurnStart = player.hasComeDown
  }
}

/**
 * Takes the top discard. It must be tabled in a new set this turn
 * (docs/Kalooki.md: a discard can only be taken to complete a set laid
 * immediately, and never held or used as a go-er).
 */
export function takeDiscard(state: GameState, userId: number): Card {
  const player = assertTurn(state, userId, 'awaitingDraw')
  const card = state.discardPile[state.discardPile.length - 1]
  if (!card) {
    throw new GameError('The discard pile is empty', 'E_DISCARD_EMPTY')
  }

  state.discardPile.pop()
  player.hand.push(card)
  player.pendingDiscardCardId = card.id
  markTurnStart(player)
  state.phase = 'acting'
  return card
}

/**
 * Puts a just-taken discard back, returning the turn to the draw
 * phase. Escape hatch so a player who took the discard but cannot
 * legally table it is not stuck; only allowed before any other action.
 */
export function returnDiscard(state: GameState, userId: number): void {
  const player = assertTurn(state, userId, 'acting')
  if (player.pendingDiscardCardId === null) {
    throw new GameError('You have no taken discard to return', 'E_NO_PENDING_DISCARD')
  }
  const card = player.hand.find((candidate) => candidate.id === player.pendingDiscardCardId)
  if (!card) {
    throw new GameError('The taken discard has already been played', 'E_NO_PENDING_DISCARD')
  }

  player.hand = player.hand.filter((candidate) => candidate.id !== card.id)
  state.discardPile.push(card)
  player.pendingDiscardCardId = null
  state.phase = 'awaitingDraw'
}

/**
 * Cards from the player's hand matching the given ids, or an error if
 * any are missing.
 */
function cardsFromHand(player: PlayerState, cardIds: number[]): Card[] {
  return cardIds.map((cardId) => {
    const card = player.hand.find((candidate) => candidate.id === cardId)
    if (!card) {
      throw new GameError('You can only play cards from your own hand', 'E_CARD_NOT_IN_HAND')
    }
    return card
  })
}

/**
 * Lays one or more new sets on the table. A player who has not come
 * down yet must lay sets worth the come-down threshold in one go
 * (default 40+ points); afterwards any legal sets may be laid.
 */
export function layMelds(state: GameState, userId: number, meldCardIds: number[][]): void {
  const player = assertTurn(state, userId, 'acting')
  if (meldCardIds.length === 0) {
    throw new GameError('Select at least one set to lay down', 'E_NO_MELDS')
  }

  const flatIds = meldCardIds.flat()
  if (new Set(flatIds).size !== flatIds.length) {
    throw new GameError('A card can only be used in one set', 'E_DUPLICATE_CARD')
  }

  let resolved: ResolvedMeld[]
  try {
    resolved = meldCardIds.map((cardIds) => resolveMeld(cardsFromHand(player, cardIds)))
  } catch (error) {
    if (error instanceof MeldError) {
      throw new GameError(error.message, 'E_INVALID_MELD')
    }
    throw error
  }

  if (!player.hasComeDown) {
    const total = resolved.reduce((sum, meld) => sum + meldValue(meld), 0)
    if (total < state.rules.comeDownThreshold) {
      throw new GameError(
        `Coming down needs sets worth ${state.rules.comeDownThreshold}+ points (these are worth ${total})`,
        'E_BELOW_THRESHOLD'
      )
    }
  }

  // Melding everything but keeping no card to discard is not allowed:
  // a round is won by discarding the final card
  if (player.hand.length - flatIds.length < 1) {
    throw new GameError('You must keep a card to discard', 'E_MUST_KEEP_DISCARD')
  }

  for (const meld of resolved) {
    state.melds.push({ ...meld, id: state.nextMeldId++, ownerUserId: userId })
  }
  player.hand = player.hand.filter((card) => !flatIds.includes(card.id))
  player.hasComeDown = true

  if (player.pendingDiscardCardId !== null && flatIds.includes(player.pendingDiscardCardId)) {
    player.pendingDiscardCardId = null
  }
  if (player.pendingJokerCardId !== null && flatIds.includes(player.pendingJokerCardId)) {
    player.pendingJokerCardId = null
    player.pendingJokerReturn = null
  }
}

/**
 * Adds a single card from hand onto a tabled set (a "go-er"). Only
 * allowed once the player has come down; a card taken from the discard
 * pile or a reclaimed joker can never be placed as a go-er.
 */
export function addGoer(
  state: GameState,
  userId: number,
  input: { meldId: number; cardId: number; runEnd?: 'low' | 'high' }
): void {
  const player = assertTurn(state, userId, 'acting')
  if (!player.hasComeDown) {
    throw new GameError('You can only add to sets after coming down', 'E_NOT_COME_DOWN')
  }
  if (input.cardId === player.pendingDiscardCardId) {
    throw new GameError('A taken discard cannot be used as a go-er', 'E_DISCARD_AS_GOER')
  }
  if (input.cardId === player.pendingJokerCardId) {
    throw new GameError('A reclaimed joker cannot be used as a go-er', 'E_JOKER_AS_GOER')
  }

  const meld = state.melds.find((candidate) => candidate.id === input.meldId)
  if (!meld) {
    throw new GameError('That set is not on the table', 'E_MELD_NOT_FOUND')
  }
  const [card] = cardsFromHand(player, [input.cardId])
  if (player.hand.length <= 1) {
    throw new GameError('You must keep a card to discard', 'E_MUST_KEEP_DISCARD')
  }

  let extended: ResolvedMeld
  try {
    extended = resolveGoer(meld, card, input.runEnd ?? 'high')
  } catch (error) {
    if (error instanceof MeldError) {
      throw new GameError(error.message, 'E_INVALID_GOER')
    }
    throw error
  }

  meld.cards = extended.cards
  player.hand = player.hand.filter((candidate) => candidate.id !== card.id)
}

/**
 * Takes a joker out of a tabled set by handing over its natural
 * replacement card(s) — all of them, per the stricter default rule in
 * docs/Kalooki.md. The joker lands in hand with the obligation to be
 * tabled in a new set before this turn's discard.
 */
export function takeJoker(
  state: GameState,
  userId: number,
  input: { meldId: number; jokerCardId: number; replacementCardIds: number[] }
): void {
  const player = assertTurn(state, userId, 'acting')
  if (!player.hasComeDown) {
    throw new GameError('You can only take a joker after coming down', 'E_NOT_COME_DOWN')
  }
  if (player.pendingJokerCardId !== null) {
    throw new GameError('Table the joker you already took first', 'E_JOKER_PENDING')
  }

  const meld = state.melds.find((candidate) => candidate.id === input.meldId)
  if (!meld) {
    throw new GameError('That set is not on the table', 'E_MELD_NOT_FOUND')
  }

  let needs: ReturnType<typeof jokerReplacementNeeds>
  try {
    needs = jokerReplacementNeeds(meld, input.jokerCardId)
  } catch (error) {
    if (error instanceof MeldError) {
      throw new GameError(error.message, 'E_INVALID_JOKER_TAKE')
    }
    throw error
  }

  const replacements = cardsFromHand(player, input.replacementCardIds)
  if (replacements.some((card) => card.isJoker)) {
    throw new GameError('Jokers cannot replace a joker', 'E_INVALID_JOKER_TAKE')
  }

  // Every needed rank+suit must be covered exactly once
  const remaining = [...needs]
  for (const card of replacements) {
    const index = remaining.findIndex((need) => need.rank === card.rank && need.suit === card.suit)
    if (index === -1) {
      throw new GameError(
        'Those cards are not the natural replacements for that joker',
        'E_INVALID_JOKER_TAKE'
      )
    }
    remaining.splice(index, 1)
  }
  if (remaining.length > 0 || replacements.length !== needs.length) {
    throw new GameError(
      `Taking that joker needs ${needs.length} natural card(s): ${needs
        .map((need) => `${String(need.rank)} of ${need.suit}`)
        .join(', ')}`,
      'E_INVALID_JOKER_TAKE'
    )
  }

  // Swap: replacements into the meld, joker into the hand
  const jokerMeldCard = meld.cards.find((meldCard) => meldCard.card.id === input.jokerCardId)
  if (!jokerMeldCard) {
    throw new GameError('That joker is not part of this set', 'E_INVALID_JOKER_TAKE')
  }
  const jokerCard = jokerMeldCard.card

  meld.cards = meld.cards.filter((meldCard) => meldCard.card.id !== input.jokerCardId)
  for (const card of replacements) {
    meld.cards.push({ card, rank: card.rank as NonNullable<Card['rank']>, suit: card.suit })
  }
  if (meld.type === 'run') {
    meld.cards.sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank))
  }

  player.hand = player.hand.filter((candidate) => !input.replacementCardIds.includes(candidate.id))
  player.hand.push(jokerCard)
  player.pendingJokerCardId = jokerCard.id
  // Remember how to undo this swap in case the joker cannot be re-tabled
  player.pendingJokerReturn = {
    meldId: meld.id,
    replacementCardIds: [...input.replacementCardIds],
    rank: jokerMeldCard.rank,
    suit: jokerMeldCard.suit,
  }
}

/**
 * Puts a joker reclaimed this turn back into the set it came from,
 * undoing the swap: the natural replacement cards return to hand and
 * the joker leaves it. The escape hatch — mirroring returnDiscard — for
 * a player who took a joker but cannot legally table it, so the turn is
 * never stuck. Only valid while the joker is still in hand (not yet
 * tabled) and its set can legally take it back.
 */
export function returnJoker(state: GameState, userId: number): void {
  const player = assertTurn(state, userId, 'acting')
  const pending = player.pendingJokerReturn
  if (player.pendingJokerCardId === null || pending === null) {
    throw new GameError('You have no taken joker to return', 'E_NO_PENDING_JOKER')
  }
  const jokerCard = player.hand.find((candidate) => candidate.id === player.pendingJokerCardId)
  if (!jokerCard) {
    throw new GameError('The taken joker has already been played', 'E_NO_PENDING_JOKER')
  }
  const meld = state.melds.find((candidate) => candidate.id === pending.meldId)
  if (!meld) {
    throw new GameError(
      'The set that joker came from is no longer on the table',
      'E_MELD_NOT_FOUND'
    )
  }

  // The natural replacements must still be in that set to swap back out
  const replacementMeldCards = pending.replacementCardIds.map((cardId) =>
    meld.cards.find((meldCard) => meldCard.card.id === cardId)
  )
  if (replacementMeldCards.some((meldCard) => meldCard === undefined)) {
    throw new GameError('That joker can no longer be returned to its set', 'E_JOKER_RETURN_BLOCKED')
  }

  const restored: MeldCard[] = meld.cards.filter(
    (meldCard) => !pending.replacementCardIds.includes(meldCard.card.id)
  )
  restored.push({ card: jokerCard, rank: pending.rank, suit: pending.suit })
  if (meld.type === 'run') {
    restored.sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank))
  }

  // The set must still be a legal meld with the joker back in it
  try {
    resolveMeld(restored.map((meldCard) => meldCard.card))
  } catch (error) {
    if (error instanceof MeldError) {
      throw new GameError(
        'That joker can no longer be returned to its set',
        'E_JOKER_RETURN_BLOCKED'
      )
    }
    throw error
  }

  meld.cards = restored
  const replacementCards = replacementMeldCards.map((meldCard) => (meldCard as MeldCard).card)
  player.hand = player.hand.filter((candidate) => candidate.id !== jokerCard.id)
  player.hand.push(...replacementCards)
  player.pendingJokerCardId = null
  player.pendingJokerReturn = null
}

/** Rank order helper for keeping runs sorted after a joker swap. */
function rankOrder(rank: NonNullable<Card['rank']>): number {
  const order: Record<string, number> = {
    2: 0,
    3: 1,
    4: 2,
    5: 3,
    6: 4,
    7: 5,
    8: 6,
    9: 7,
    10: 8,
    J: 9,
    Q: 10,
    K: 11,
    A: 12,
  }
  return order[String(rank)]
}

/**
 * Discards a card, ending the turn. Discarding the last card in hand
 * wins the round ("calling up"); otherwise play passes left. Pending
 * obligations (a taken discard or reclaimed joker not yet tabled)
 * block the discard.
 */
export function discard(state: GameState, userId: number, cardId: number, rng: Rng): void {
  const player = assertTurn(state, userId, 'acting')
  if (player.pendingDiscardCardId !== null) {
    throw new GameError(
      'The discard you took must be tabled in a new set before you discard',
      'E_PENDING_DISCARD'
    )
  }
  if (player.pendingJokerCardId !== null) {
    throw new GameError(
      'The joker you took must be tabled in a new set before you discard',
      'E_PENDING_JOKER'
    )
  }

  const [card] = cardsFromHand(player, [cardId])
  player.hand = player.hand.filter((candidate) => candidate.id !== card.id)
  state.discardPile.push(card)

  if (player.hand.length === 0) {
    endRound(state, player.userId, rng)
    return
  }

  player.comeDownAtTurnStart = null
  state.currentPlayerIndex = nextActiveIndex(state, state.currentPlayerIndex)
  state.phase = 'awaitingDraw'
}

/**
 * Scores the round: everyone but the caller adds up the cards left in
 * hand. In a play-money game every other active player pays the caller
 * the call amount — or the kalooki amount instead when the caller laid
 * all thirteen cards in one turn. Players over the limit may buy back
 * in (never when fewer than 3 players would remain in the game).
 */
function endRound(state: GameState, winnerUserId: number | null, rng: Rng): void {
  const penalties: Record<number, number> = {}
  const totals: Record<number, number> = {}

  for (const player of activePlayers(state)) {
    const penalty =
      player.userId === winnerUserId
        ? 0
        : player.hand.reduce((sum, card) => sum + cardPenalty(card), 0)
    penalties[player.userId] = penalty
    player.score += penalty
    totals[player.userId] = player.score
  }

  const winner = winnerUserId === null ? null : playerState(state, winnerUserId)
  const calledKalooki = winner !== null && winner.comeDownAtTurnStart === false
  const chips: Record<number, number> = {}
  if (state.rules.stakes && winner) {
    const payment = calledKalooki ? state.rules.stakes.kalooki : state.rules.stakes.call
    for (const player of activePlayers(state)) {
      if (player.userId === winner.userId) {
        continue
      }
      player.chips -= payment
      winner.chips += payment
      chips[player.userId] = -payment
    }
    chips[winner.userId] = payment * Object.keys(chips).length
  }

  state.roundResults.push({
    roundNumber: state.roundNumber,
    winnerUserId,
    calledKalooki,
    penalties,
    totals,
    chips,
  })

  // Who busted, and who may buy back in
  const busted = activePlayers(state).filter((player) => player.score > state.rules.scoreLimit)
  const survivors = activePlayers(state).length - busted.length
  state.pendingBuyIns = []
  for (const player of busted) {
    const buyInsLeft =
      state.rules.buyInsPerPlayer === UNLIMITED_BUY_INS ||
      player.buyInsUsed < state.rules.buyInsPerPlayer
    if (buyInsLeft && survivors + busted.length > 2) {
      state.pendingBuyIns.push(player.userId)
    } else {
      player.eliminated = true
    }
  }

  state.phase = 'roundEnd'
  if (state.pendingBuyIns.length === 0) {
    concludeRound(state, rng)
  }
}

/**
 * A busted player's buy-in decision. Buying in re-enters them on the
 * highest remaining score; declining eliminates them. The next round
 * deals once every decision is in.
 */
export function decideBuyIn(state: GameState, userId: number, accept: boolean, rng: Rng): void {
  if (state.phase !== 'roundEnd' || !state.pendingBuyIns.includes(userId)) {
    throw new GameError('You have no buy-in decision to make', 'E_NO_BUY_IN')
  }
  const player = playerState(state, userId)
  state.pendingBuyIns = state.pendingBuyIns.filter((pendingId) => pendingId !== userId)

  if (accept) {
    const survivorScores = activePlayers(state)
      .filter(
        (candidate) => candidate.score <= state.rules.scoreLimit && candidate.userId !== userId
      )
      .map((candidate) => candidate.score)
    // Rejoin on the highest surviving score; if everyone busted at
    // once, fall back to the limit itself
    player.score = survivorScores.length > 0 ? Math.max(...survivorScores) : state.rules.scoreLimit
    player.buyInsUsed += 1
  } else {
    player.eliminated = true
  }

  if (state.pendingBuyIns.length === 0) {
    concludeRound(state, rng)
  }
}

/**
 * After scoring and buy-ins: end the game when one player stands, or
 * deal the next round.
 */
function concludeRound(state: GameState, rng: Rng): void {
  if (activePlayers(state).length <= 1) {
    finishGame(state)
    return
  }
  dealRound(state, rng)
}

/**
 * Marks the game finished and, in a play-money game, settles the
 * winner-takes-all money: every other player owes the winner the game
 * stake plus the cost of each buy-in they used (the scoresheet's
 * "buy-in money"). Round money was already paid as it happened. When
 * nobody remained to win, nothing is settled.
 */
function finishGame(state: GameState): void {
  state.phase = 'finished'
  state.winnerUserId = activePlayers(state)[0]?.userId ?? null

  const stakes = state.rules.stakes
  if (!stakes || state.winnerUserId === null) {
    return
  }
  const winner = playerState(state, state.winnerUserId)
  for (const player of state.players) {
    if (player.userId === winner.userId) {
      continue
    }
    const owed = stakes.stake + stakes.rebuy * player.buyInsUsed
    player.chips -= owed
    winner.chips += owed
  }
}

/**
 * Removes a player mid-game (move timer expired, rejoin window
 * expired, or quit). Their hand is shuffled back into the deck and
 * they cannot rejoin (docs/Kalooki.md). If they were mid-turn the turn
 * passes; if one player remains they win.
 *
 * `markRemoved` (default true) flags the player as having left early;
 * pass false to fold a player out to settle a game they did not quit
 * (e.g. practice bots after the human is out) so history does not
 * record them as leaving.
 */
export function removePlayer(
  state: GameState,
  userId: number,
  rng: Rng,
  options: { markRemoved?: boolean } = {}
): void {
  const player = playerState(state, userId)
  if (player.eliminated || state.phase === 'finished') {
    return
  }

  const wasCurrent = state.players[state.currentPlayerIndex].userId === userId

  // A joker reclaimed this turn but never tabled goes back to the set
  // it came from — not buried in the deck — when the player leaves
  // (timed out, quit, or rejoin window expired). A pending joker only
  // exists on the leaver's own acting turn, so the return is in phase.
  if (player.pendingJokerCardId !== null) {
    try {
      returnJoker(state, userId)
    } catch (error) {
      if (!(error instanceof GameError)) {
        throw error
      }
      // The set changed so the joker can no longer go back: fall
      // through and let it rejoin the deck with the rest of the hand.
    }
  }

  player.eliminated = true
  player.removed = options.markRemoved ?? true
  state.deck = shuffle([...state.deck, ...player.hand], rng)
  player.hand = []
  player.comeDownAtTurnStart = null
  player.pendingDiscardCardId = null
  player.pendingJokerCardId = null
  player.pendingJokerReturn = null
  state.pendingBuyIns = state.pendingBuyIns.filter((pendingId) => pendingId !== userId)

  if (activePlayers(state).length <= 1) {
    finishGame(state)
    return
  }

  if (state.phase === 'roundEnd') {
    if (state.pendingBuyIns.length === 0) {
      concludeRound(state, rng)
    }
    return
  }

  if (wasCurrent) {
    state.currentPlayerIndex = nextActiveIndex(state, state.currentPlayerIndex)
    state.phase = 'awaitingDraw'
  }
}
