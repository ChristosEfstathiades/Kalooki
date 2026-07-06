import { RANKS, SUITS, rankIndex, rankValue } from '#services/game/cards'
import type { Card, Rank, Suit } from '#services/game/cards'

/**
 * Meld (set) rules from docs/Kalooki.md:
 * - A group is 3-4 cards of the same rank in different suits.
 * - A run is 3+ consecutive cards of one suit; 2-3-4 is the lowest,
 *   Q-K-A the highest (aces never start a low run).
 * - Jokers stand in for any card and it must be clear which.
 */

/**
 * A card inside a tabled meld, together with what it represents. For a
 * joker in a run this pins an exact rank+suit; in a group the rank is
 * fixed but the suit stays open (the joker covers whichever suits are
 * missing), which is why taking it needs every missing natural card.
 */
export interface MeldCard {
  card: Card
  rank: Rank
  suit: Suit | null
}

export interface ResolvedMeld {
  type: 'group' | 'run'
  cards: MeldCard[]
}

export class MeldError extends Error {}

/**
 * Validates a proposed meld and infers what each joker represents.
 * Runs must be submitted in sequence order (lowest first); groups in
 * any order.
 *
 * @throws MeldError when the cards do not form a legal group or run.
 */
export function resolveMeld(cards: Card[]): ResolvedMeld {
  if (cards.length < 3) {
    throw new MeldError('A set needs at least 3 cards')
  }

  const naturals = cards.filter((card) => !card.isJoker)
  if (naturals.length === 0) {
    throw new MeldError('A set needs at least one natural card')
  }

  const ranks = new Set(naturals.map((card) => card.rank))
  const suits = new Set(naturals.map((card) => card.suit))

  // Same rank across different suits → group; otherwise try a run
  if (ranks.size === 1 && cards.length <= 4) {
    if (suits.size === naturals.length) {
      return resolveGroup(cards, naturals)
    }
    // Same rank and same suit could be a nonsense submission; a run of
    // identical ranks is impossible anyway
    throw new MeldError('A group cannot contain two cards of the same suit')
  }

  return resolveRun(cards)
}

/**
 * Resolves a group: 3-4 cards of one rank, no repeated natural suit.
 * Jokers keep an open suit.
 */
function resolveGroup(cards: Card[], naturals: Card[]): ResolvedMeld {
  const groupRank = naturals[0].rank as Rank
  if (cards.length > 4) {
    throw new MeldError('A group can have at most 4 cards')
  }

  return {
    type: 'group',
    cards: cards.map((card) => ({
      card,
      rank: groupRank,
      suit: card.isJoker ? null : card.suit,
    })),
  }
}

/**
 * Resolves a run from cards submitted in sequence order. The first
 * natural card anchors the sequence: every position's represented rank
 * follows from its offset. Aces are high only.
 */
function resolveRun(cards: Card[]): ResolvedMeld {
  const firstNaturalIndex = cards.findIndex((card) => !card.isJoker)
  const anchor = cards[firstNaturalIndex]
  const runSuit = anchor.suit as Suit
  const anchorRankIndex = rankIndex(anchor.rank as Rank)

  const startIndex = anchorRankIndex - firstNaturalIndex
  const endIndex = startIndex + cards.length - 1
  if (startIndex < 0 || endIndex >= RANKS.length) {
    throw new MeldError('That run goes out of bounds — runs go from 2 up to ace')
  }

  const meldCards: MeldCard[] = cards.map((card, position) => {
    const representedRank = RANKS[startIndex + position]
    if (!card.isJoker) {
      if (card.suit !== runSuit) {
        throw new MeldError('Every card in a run must be the same suit')
      }
      if (card.rank !== representedRank) {
        throw new MeldError('Run cards must be consecutive')
      }
    }
    return { card, rank: representedRank, suit: runSuit }
  })

  return { type: 'run', cards: meldCards }
}

/**
 * Point value of a resolved meld. Jokers count as the card they
 * represent (docs/Kalooki.md).
 */
export function meldValue(meld: ResolvedMeld): number {
  return meld.cards.reduce((total, meldCard) => total + rankValue(meldCard.rank), 0)
}

/**
 * Where a go-er may be added to a tabled meld, and what the added card
 * would represent. Returns the extended card list (in meld order).
 *
 * @throws MeldError when the card cannot legally join the meld.
 */
export function resolveGoer(
  meld: ResolvedMeld,
  card: Card,
  runEnd: 'low' | 'high' = 'high'
): ResolvedMeld {
  if (meld.type === 'group') {
    if (meld.cards.length >= 4) {
      throw new MeldError('That group is already complete')
    }
    const groupRank = meld.cards[0].rank
    if (!card.isJoker) {
      if (card.rank !== groupRank) {
        throw new MeldError('A group go-er must match the rank of the group')
      }
      const usedSuits = meld.cards.map((meldCard) => meldCard.suit).filter((suit) => suit !== null)
      if (card.suit !== null && usedSuits.includes(card.suit)) {
        throw new MeldError('That suit is already in the group')
      }
    }
    return {
      type: 'group',
      cards: [...meld.cards, { card, rank: groupRank, suit: card.isJoker ? null : card.suit }],
    }
  }

  const runSuit = meld.cards[0].suit as Suit
  const lowIndex = rankIndex(meld.cards[0].rank)
  const highIndex = rankIndex(meld.cards[meld.cards.length - 1].rank)
  const targetIndex = runEnd === 'low' ? lowIndex - 1 : highIndex + 1
  if (targetIndex < 0 || targetIndex >= RANKS.length) {
    throw new MeldError('That run cannot be extended any further at that end')
  }
  const representedRank = RANKS[targetIndex]

  if (!card.isJoker && (card.suit !== runSuit || card.rank !== representedRank)) {
    throw new MeldError(
      `Extending this run at that end needs the ${String(representedRank)} of ${runSuit}`
    )
  }

  const added: MeldCard = { card, rank: representedRank, suit: runSuit }
  return {
    type: 'run',
    cards: runEnd === 'low' ? [added, ...meld.cards] : [...meld.cards, added],
  }
}

/**
 * The natural cards a player must hand over to take a joker out of a
 * tabled meld. Kalooki's stricter default rule (docs/Kalooki.md): in a
 * group, EVERY suit the joker could stand for must be provided; in a
 * run, the joker's exact natural replacement.
 */
export function jokerReplacementNeeds(
  meld: ResolvedMeld,
  jokerCardId: number
): { rank: Rank; suit: Suit }[] {
  const jokerMeldCard = meld.cards.find(
    (meldCard) => meldCard.card.id === jokerCardId && meldCard.card.isJoker
  )
  if (!jokerMeldCard) {
    throw new MeldError('That joker is not part of this set')
  }

  if (meld.type === 'run') {
    return [{ rank: jokerMeldCard.rank, suit: jokerMeldCard.suit as Suit }]
  }

  const usedSuits = meld.cards
    .filter((meldCard) => !meldCard.card.isJoker)
    .map((meldCard) => meldCard.suit)
  return SUITS.filter((suit) => !usedSuits.includes(suit)).map((suit) => ({
    rank: jokerMeldCard.rank,
    suit,
  }))
}
