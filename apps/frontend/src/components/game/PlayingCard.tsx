import { cn } from '#/lib/utils'
import {
  cardBackUrl,
  cardFaceUrl,
  cardFitClass,
  useCardDeck,
} from '#/lib/card-deck'
import type { CardDeck } from '#/lib/card-deck'
import type { GameCard } from '#/lib/game'

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
  /**
   * Forces a deck instead of the one chosen on this device, for the
   * previews on the settings page.
   */
  deck?: CardDeck
  /** Extra classes for the card face, e.g. a responsive size override. */
  className?: string
}

/**
 * A face-up playing card rendered from the artwork of the deck the
 * player picked in settings.
 */
export default function PlayingCard({
  card,
  selected,
  onClick,
  small,
  fluid,
  deck,
  className,
}: PlayingCardProps) {
  const activeDeck = useCardDeck()
  const cardDeck = deck ?? activeDeck
  const label = card.isJoker ? 'Joker' : `${String(card.rank)} of ${card.suit}`
  const src = cardFaceUrl(card, cardDeck)

  const face = (
    <span
      className={cn(
        // block, not inline-block: an inline card sits on the text
        // baseline and leaves descender space below it, which any
        // border or ring drawn around the card would then include.
        // translate-y-0 on every card keeps them all in the same
        // paint phase, so a selected (translated) card never jumps
        // above the neighbour overlapping it from the right.
        // playing-card: see styles.css, kills the mobile long-press
        // image callout so a touch-drag is not hijacked
        'playing-card block translate-y-0 overflow-hidden rounded-md bg-white shadow-sm select-none',
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
          className={cn('h-full w-full', cardFitClass(cardDeck))}
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
        // block for the same reason as the face: an inline-block button
        // sits on the baseline and leaves descender space below the card.
        // It also gives the face's percentage width a definite width to
        // resolve against, which an inline button cannot provide.
        'playing-card block appearance-none border-0 bg-transparent p-0',
        fluid && 'w-full',
      )}
    >
      {face}
    </button>
  )
}

interface CardBackProps {
  small?: boolean
  /** Forces a deck instead of the one chosen on this device. */
  deck?: CardDeck
  /** Extra classes, e.g. a responsive size override. */
  className?: string
}

/**
 * A face-down card, used for the deck and opponents' hands. Decks that
 * ship no back artwork fall back to the woven CSS pattern.
 */
export function CardBack({ small, deck, className }: CardBackProps) {
  const activeDeck = useCardDeck()
  const cardDeck = deck ?? activeDeck
  const src = cardBackUrl(cardDeck)
  const sizing = cn(
    'playing-card block rounded-md shadow-sm',
    small ? 'h-10 w-7' : 'h-24 w-[66px]',
    className,
  )

  if (src) {
    return (
      <span
        aria-hidden="true"
        className={cn(sizing, 'overflow-hidden bg-white')}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className={cn('h-full w-full', cardFitClass(cardDeck))}
        />
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(sizing, 'border border-black/30 bg-button-purple')}
      style={{
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 4px, transparent 4px 8px)',
      }}
    />
  )
}
