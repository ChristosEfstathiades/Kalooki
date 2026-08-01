import { useEffect } from 'react'
import PlayingCard, { CardBack } from '#/components/game/PlayingCard'
import type { GameCard } from '#/lib/game'

/**
 * The card that flies from a pile into your hand when you draw by
 * clicking rather than dragging, so a tapped draw shows the same
 * movement a dragged one does. Purely decorative: it renders above the
 * table, never takes pointer events, and the real card arrives from the
 * server while it is in the air.
 */

/** How long a card takes to travel from the pile to the hand. */
export const CARD_FLIGHT_MS = 420

interface Point {
  x: number
  y: number
}

export interface CardFlightPath {
  from: Point
  to: Point
}

/**
 * Measures the line from a pile to the spot a drawn card joins your
 * hand. Returns null when either end is missing from the layout, or the
 * viewer prefers reduced motion, which skips the flight rather than
 * animating a card to the wrong place.
 */
export function planCardFlight(pile: Element | null): CardFlightPath | null {
  if (!pile || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return null
  }
  const landing = document.querySelector('[data-hand-landing]')
  if (!landing) {
    return null
  }
  return { from: centerOf(pile), to: centerOf(landing) }
}

function centerOf(element: Element): Point {
  const box = element.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

interface CardFlightProps {
  /** The face to fly, or null for a face-down card off the deck. */
  card: GameCard | null
  path: CardFlightPath
  /** Called once the flight is over, so the caller can clear it. */
  onDone: () => void
}

/**
 * One card in flight. Mount it under a key that changes per draw, so a
 * second draw replays the animation instead of leaving a stale card.
 */
export default function CardFlight({ card, path, onDone }: CardFlightProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, CARD_FLIGHT_MS)
    return () => clearTimeout(timer)
  }, [onDone])

  // Starts at pile size and grows on the way in; the halves centre the
  // card on the measured point, which the animation translates from
  const size =
    'h-[76px] w-[52px] -translate-x-1/2 -translate-y-1/2 sm:h-24 sm:w-[66px]'

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      <span
        className="card-flight absolute"
        style={
          {
            left: path.from.x,
            top: path.from.y,
            animationDuration: `${CARD_FLIGHT_MS}ms`,
            '--flight-dx': `${path.to.x - path.from.x}px`,
            '--flight-dy': `${path.to.y - path.from.y}px`,
          } as React.CSSProperties
        }
      >
        {card ? (
          <PlayingCard card={card} className={size} />
        ) : (
          <CardBack className={size} />
        )}
      </span>
    </div>
  )
}
