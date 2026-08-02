import { useSyncExternalStore } from 'react'
import {
  readPreference,
  storedOption,
  writePreference,
} from '#/lib/preferences'
import type { GameCard, Rank, Suit } from '#/lib/game'

const DECK_STORAGE_KEY = 'cardDeck'

export type CardDeck = 'standard' | 'illustrated'

export const CARD_DECK_IDS = ['standard', 'illustrated'] as const

/** The deck a player gets before they choose one. */
export const DEFAULT_CARD_DECK: CardDeck = 'standard'

interface CardDeckOption {
  id: CardDeck
  label: string
  description: string
}

/** The decks offered on the settings page, in display order. */
export const CARD_DECKS: readonly CardDeckOption[] = [
  {
    id: 'standard',
    label: 'Standard',
    description: 'The classic deck, plain pips and simple faces.',
  },
  {
    id: 'illustrated',
    label: 'Illustrated',
    description: 'Bold colour faces with a patterned card back.',
  },
]

/**
 * Eagerly-resolved URLs for every card image, keyed by the path Vite
 * globs them under (e.g. "../assets/cards/ace_of_spades.png"). Eager
 * so a lookup during render is synchronous.
 */
const STANDARD_IMAGES = import.meta.glob<string>('../assets/cards/*.png', {
  eager: true,
  import: 'default',
})

const ILLUSTRATED_IMAGES = import.meta.glob<string>(
  '../assets/cards_alt/*.png',
  { eager: true, import: 'default' },
)

const RANK_WORDS: Record<Exclude<Rank, number>, string> = {
  J: 'jack',
  Q: 'queen',
  K: 'king',
  A: 'ace',
}

const RANK_NUMBERS: Record<Exclude<Rank, number>, number> = {
  A: 1,
  J: 11,
  Q: 12,
  K: 13,
}

const SUIT_LETTERS: Record<Suit, string> = {
  clubs: 'C',
  diamonds: 'D',
  hearts: 'H',
  spades: 'S',
}

interface DeckArtwork {
  /** Filename for a ranked card, or undefined for an incomplete card. */
  faceFile: (rank: Rank | null, suit: Suit | null) => string | undefined
  /** Red joker first, so `id % 2` picks the same colour in every deck. */
  jokerFiles: readonly [string, string]
  /** Face-down artwork, or undefined for decks drawing their own back. */
  backFile?: string
  /**
   * How the artwork fills the card box. The illustrated set is a little
   * taller than the 11:16 box, so covering it would crop the printed
   * border off its face cards.
   */
  fitClass: 'object-cover' | 'object-contain'
  images: Record<string, string>
  directory: string
}

const DECK_ARTWORK: Record<CardDeck, DeckArtwork> = {
  standard: {
    faceFile: (rank, suit) =>
      rank === null || suit === null
        ? undefined
        : `${typeof rank === 'number' ? String(rank) : RANK_WORDS[rank]}_of_${suit}.png`,
    jokerFiles: ['red_joker.png', 'black_joker.png'],
    fitClass: 'object-cover',
    images: STANDARD_IMAGES,
    directory: '../assets/cards',
  },
  illustrated: {
    faceFile: (rank, suit) =>
      rank === null || suit === null
        ? undefined
        : `${SUIT_LETTERS[suit]}-${typeof rank === 'number' ? rank : RANK_NUMBERS[rank]}.png`,
    jokerFiles: ['X-R.png', 'X-B.png'],
    backFile: 'Back-B.png',
    fitClass: 'object-contain',
    images: ILLUSTRATED_IMAGES,
    directory: '../assets/cards_alt',
  },
}

/**
 * Resolves the artwork URL for a card's face in the given deck. Jokers
 * alternate between the red and black artwork by id so a hand with two
 * jokers still reads as two distinct cards.
 */
export function cardFaceUrl(
  card: GameCard,
  deck: CardDeck,
): string | undefined {
  const artwork = DECK_ARTWORK[deck]
  const file = card.isJoker
    ? artwork.jokerFiles[card.id % artwork.jokerFiles.length]
    : artwork.faceFile(card.rank, card.suit)
  return file ? artwork.images[`${artwork.directory}/${file}`] : undefined
}

/**
 * The face-down artwork for a deck, or undefined when the deck has no
 * back image and the card back is drawn in CSS instead.
 */
export function cardBackUrl(deck: CardDeck): string | undefined {
  const artwork = DECK_ARTWORK[deck]
  return artwork.backFile
    ? artwork.images[`${artwork.directory}/${artwork.backFile}`]
    : undefined
}

/** The object-fit class a deck's artwork needs inside the card box. */
export function cardFitClass(deck: CardDeck): string {
  return DECK_ARTWORK[deck].fitClass
}

function parseDeck(stored: unknown): CardDeck {
  return storedOption(stored, CARD_DECK_IDS, DEFAULT_CARD_DECK)
}

// Every card on the table has to react to the picker on the settings
// page, so the choice lives in one module-level store the cards
// subscribe to rather than in a component's state.
let activeDeck: CardDeck | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): CardDeck {
  activeDeck ??=
    readPreference(DECK_STORAGE_KEY, parseDeck) ?? DEFAULT_CARD_DECK
  return activeDeck
}

function getServerSnapshot(): CardDeck {
  return DEFAULT_CARD_DECK
}

/**
 * The deck chosen on this device. Renders the default on the server and
 * during hydration, then swaps to the stored choice once mounted.
 */
export function useCardDeck(): CardDeck {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Applies and remembers a deck choice, re-rendering every card. */
export function setCardDeck(deck: CardDeck): void {
  activeDeck = deck
  writePreference(DECK_STORAGE_KEY, deck)
  for (const listener of listeners) {
    listener()
  }
}
