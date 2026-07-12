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
function cardFileName(rank: Rank | null, suit: Suit | null): string | undefined {
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
}

/**
 * A face-up playing card rendered from its artwork under assets/cards.
 */
export default function PlayingCard({
  card,
  selected,
  onClick,
  small,
}: PlayingCardProps) {
  const label = card.isJoker
    ? 'Joker'
    : `${String(card.rank)} of ${card.suit}`
  const src = cardImageUrl(card)

  const face = (
    <span
      className={cn(
        'inline-block overflow-hidden rounded-md bg-white shadow-sm select-none',
        small ? 'h-10 w-7' : 'h-24 w-[66px]',
        selected && '-translate-y-2 ring-2 ring-ring',
        onClick && 'cursor-pointer',
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
        'relative appearance-none border-0 bg-transparent p-0 hover:z-20',
        selected ? 'z-10' : 'z-0',
      )}
    >
      {face}
    </button>
  )
}

interface CardBackProps {
  small?: boolean
}

/**
 * A face-down card, used for the deck and opponents' hands.
 */
export function CardBack({ small }: CardBackProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block rounded-md border border-black/30 bg-button-purple shadow-sm',
        small ? 'h-10 w-7' : 'h-24 w-[66px]',
      )}
      style={{
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 4px, transparent 4px 8px)',
      }}
    />
  )
}
