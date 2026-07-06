/**
 * Card primitives for Kalooki: 2-4 standard decks plus 0-4 jokers
 * (classic: 2 decks + 2 jokers = 106 cards). See docs/Kalooki.md.
 */

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 'J' | 'Q' | 'K' | 'A'

/**
 * A physical card. Every card in a game has a unique id so clients and
 * the server can reference it unambiguously (duplicates exist across
 * decks). Jokers have no suit or rank of their own.
 */
export interface Card {
  id: number
  isJoker: boolean
  suit: Suit | null
  rank: Rank | null
}

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']

/** Ranks in run order: 2 low, ace high (A-2-3 is never legal). */
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A']

/**
 * Position of a rank in run order (2 → 0 … A → 12).
 */
export function rankIndex(rank: Rank): number {
  return RANKS.indexOf(rank)
}

/**
 * Point value of a rank: aces 11, picture cards 10, others face value.
 * Used both for the come-down threshold and penalty scoring.
 */
export function rankValue(rank: Rank): number {
  if (rank === 'A') {
    return 11
  }
  if (rank === 'J' || rank === 'Q' || rank === 'K') {
    return 10
  }
  return rank
}

/**
 * Penalty points for a card left in hand at the end of a round.
 * Jokers cost their maximum value of 15.
 */
export function cardPenalty(card: Card): number {
  if (card.isJoker || card.rank === null) {
    return 15
  }
  return rankValue(card.rank)
}

/**
 * Builds the (unshuffled) pile for a game: `decks` standard 52-card
 * decks plus `jokers` jokers, each card with a unique id.
 */
export function buildDeck(decks: number, jokers: number): Card[] {
  const cards: Card[] = []
  let id = 0
  for (let deck = 0; deck < decks; deck++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: id++, isJoker: false, suit, rank })
      }
    }
  }
  for (let joker = 0; joker < jokers; joker++) {
    cards.push({ id: id++, isJoker: true, suit: null, rank: null })
  }
  return cards
}

/**
 * Random source in [0, 1). Injectable so tests can deal deterministic
 * hands.
 */
export type Rng = () => number

/**
 * Fisher-Yates shuffle. Returns a new array; the input is untouched.
 */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
