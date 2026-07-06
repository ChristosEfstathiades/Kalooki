import { cn } from '#/lib/utils'
import type { GameCard } from '#/lib/game'

const SUIT_GLYPHS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
} as const

interface PlayingCardProps {
  card: GameCard
  selected?: boolean
  onClick?: () => void
  small?: boolean
}

/**
 * A face-up playing card. Hearts/diamonds red, clubs/spades black, on
 * a white face so cards read instantly against the felt.
 */
export default function PlayingCard({
  card,
  selected,
  onClick,
  small,
}: PlayingCardProps) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds'
  const label = card.isJoker
    ? 'Joker'
    : `${String(card.rank)}${SUIT_GLYPHS[card.suit ?? 'spades']}`

  const face = (
    <span
      className={cn(
        'flex flex-col items-center justify-center rounded-md border border-black/20 bg-white font-semibold shadow-sm select-none',
        small ? 'h-10 w-7 text-[11px]' : 'h-16 w-11 text-sm',
        card.isJoker
          ? 'text-button-purple'
          : isRed
            ? 'text-red-700'
            : 'text-zinc-900',
        selected && '-translate-y-2 ring-2 ring-ring',
        onClick && 'cursor-pointer',
      )}
      aria-label={
        card.isJoker ? 'Joker' : `${String(card.rank)} of ${card.suit}`
      }
    >
      {card.isJoker ? (
        <span className={small ? 'text-sm' : 'text-xl'}>★</span>
      ) : (
        <>
          <span>{String(card.rank)}</span>
          <span className={small ? 'text-xs' : 'text-base'}>
            {SUIT_GLYPHS[card.suit ?? 'spades']}
          </span>
        </>
      )}
      <span className="sr-only">{label}</span>
    </span>
  )

  if (!onClick) {
    return face
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="appearance-none border-0 bg-transparent p-0"
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
        small ? 'h-10 w-7' : 'h-16 w-11',
      )}
      style={{
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 4px, transparent 4px 8px)',
      }}
    />
  )
}
