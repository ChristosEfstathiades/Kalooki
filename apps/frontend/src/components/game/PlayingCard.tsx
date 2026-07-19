import { cn } from '#/lib/utils'
import type { GameCard, Rank, Suit } from '#/lib/game'

/**
 * Eagerly-resolved URLs for every card face image under assets/cards,
 * keyed by filename (e.g. "ace_of_spades.png"). Vite inlines these at
 * build time so lookups are synchronous.
 */
const CARD_IMAGES = import.meta.glob<string>('../../assets/cards/*.png', {
  eager: true,
  import: 'default',
})

const RANK_WORDS: Record<Exclude<Rank, number>, string> = {
  J: 'jack',
  Q: 'queen',
  K: 'king',
  A: 'ace',
}

const JOKER_IMAGES = ['red_joker.png', 'black_joker.png'] as const

/**
 * Resolves the asset URL for a card's face image. Jokers alternate
 * between the red and black artwork by id so a hand with two jokers
 * still reads as two distinct cards.
 */
function cardImageUrl(card: GameCard): string | undefined {
  const file = card.isJoker
    ? JOKER_IMAGES[card.id % JOKER_IMAGES.length]
    : cardFileName(card.rank, card.suit)
  return file ? CARD_IMAGES[`../../assets/cards/${file}`] : undefined
}

/**
 * Builds the filename for a ranked card, e.g. "10_of_hearts.png" or
 * "queen_of_spades.png". Returns undefined for incomplete cards.
 */
function cardFileName(
  rank: Rank | null,
  suit: Suit | null,
): string | undefined {
  if (rank === null || suit === null) {
    return undefined
  }
  const rankPart = typeof rank === 'number' ? String(rank) : RANK_WORDS[rank]
  return `${rankPart}_of_${suit}.png`
}

interface PlayingCardProps {
  card: GameCard
  selected?: boolean
  onClick?: () => void
  small?: boolean
  /**
   * Sizes the card to fill its container (keeping the card aspect
   * ratio) instead of the fixed size, so a flexbox parent can shrink
   * it when space is tight.
   */
  fluid?: boolean
  /** Extra classes for the card face, e.g. a responsive size override. */
  className?: string
}

/**
 * A face-up playing card rendered from its artwork under assets/cards.
 */
export default function PlayingCard({
  card,
  selected,
  onClick,
  small,
  fluid,
  className,
}: PlayingCardProps) {
  const label = card.isJoker ? 'Joker' : `${String(card.rank)} of ${card.suit}`
  const src = cardImageUrl(card)

  const face = (
    <span
      className={cn(
        // block, not inline-block: an inline card sits on the text
        // baseline and leaves descender space below it, which any
        // border or ring drawn around the card would then include.
        // translate-y-0 on every card keeps them all in the same
        // paint phase, so a selected (translated) card never jumps
        // above the neighbour overlapping it from the right
        'block translate-y-0 overflow-hidden rounded-md bg-white shadow-sm select-none',
        small
          ? 'h-10 w-7'
          : fluid
            ? 'aspect-[11/16] h-auto w-full'
            : 'h-24 w-[66px]',
        selected && '-translate-y-2 ring-2 ring-ring',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={label}
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </span>
  )

  if (!onClick) {
    return face
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'appearance-none border-0 bg-transparent p-0',
        // The face's percentage width needs a definite width to
        // resolve against, which an inline button cannot provide
        fluid && 'block w-full',
      )}
    >
      {face}
    </button>
  )
}

interface CardBackProps {
  small?: boolean
  /** Extra classes, e.g. a responsive size override. */
  className?: string
}

/**
 * A face-down card, used for the deck and opponents' hands.
 */
export function CardBack({ small, className }: CardBackProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block rounded-md border border-black/30 bg-button-purple shadow-sm',
        small ? 'h-10 w-7' : 'h-24 w-[66px]',
        className,
      )}
      style={{
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 4px, transparent 4px 8px)',
      }}
    />
  )
}
