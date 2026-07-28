import { useEffect, useState } from 'react'
import { CardBack } from '#/components/game/PlayingCard'

/**
 * The shuffle-and-deal that opens every round: the deck riffles on the
 * spot, then card backs fly out to each seat in rotation. Purely
 * decorative — it renders above the felt but never takes pointer events,
 * and the real cards arrive from the server as it finishes.
 */

/** Cards dealt to each player, matching the thirteen the engine deals. */
const CARDS_PER_PLAYER = 13

/**
 * Upper bound on the card backs in flight. Six players at thirteen
 * cards would be 78 animated elements for no extra readability, so
 * longer tables deal fewer passes rather than more cards.
 */
const MAX_CARDS_IN_FLIGHT = 45

/** How long one card takes to travel from the deck to a seat. */
const FLIGHT_MS = 380

interface Point {
  x: number
  y: number
}

interface DealtCard {
  /** Offset from the deck to the seat this card lands on. */
  dx: number
  dy: number
  delayMs: number
  /** Small per-card tilt, so the landed pile is not a perfect stack. */
  rotation: number
}

interface RoundIntroProps {
  /** Seats to deal to, in dealing order (the dealer's left first). */
  seatUserIds: number[]
  /** Total time available for the shuffle and the deal together. */
  durationMs: number
  /** How much of that time the shuffle takes before the deal starts. */
  shuffleMs: number
}

/**
 * Measures where the deck sits and where each seat is, then builds the
 * flight path for every card back. Returns an empty list when the table
 * is not laid out yet (or the viewer prefers reduced motion), which
 * skips the animation rather than flashing cards in the wrong places.
 */
function planDeal(
  seatUserIds: number[],
  dealWindowMs: number,
  shuffleMs: number,
): DealtCard[] {
  const origin = document.querySelector('[data-deal-origin]')
  if (!origin || seatUserIds.length === 0) {
    return []
  }
  const deck = centerOf(origin)

  const seats: Point[] = []
  for (const userId of seatUserIds) {
    const seat = document.querySelector(`[data-deal-target="${userId}"]`)
    // A seat can be missing from the layout (your own chip is hidden on
    // mobile); skipping it keeps the rest of the deal intact
    if (seat) {
      seats.push(centerOf(seat))
    }
  }
  if (seats.length === 0) {
    return []
  }

  const passes = Math.max(
    1,
    Math.min(CARDS_PER_PLAYER, Math.floor(MAX_CARDS_IN_FLIGHT / seats.length)),
  )
  const total = passes * seats.length
  // Spread the deal across the window, leaving room for the last card
  // to complete its flight
  const stagger = Math.max(
    0,
    (dealWindowMs - FLIGHT_MS) / Math.max(1, total - 1),
  )

  const cards: DealtCard[] = []
  for (let pass = 0; pass < passes; pass++) {
    seats.forEach((seat, index) => {
      const order = pass * seats.length + index
      cards.push({
        dx: seat.x - deck.x,
        dy: seat.y - deck.y,
        delayMs: shuffleMs + order * stagger,
        rotation: ((order % 5) - 2) * 4,
      })
    })
  }
  return cards
}

function centerOf(element: Element): Point {
  const box = element.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

export function RoundIntro({
  seatUserIds,
  durationMs,
  shuffleMs,
}: RoundIntroProps) {
  const [origin, setOrigin] = useState<Point | null>(null)
  const [cards, setCards] = useState<DealtCard[]>([])

  // Measured once per round: the table does not reflow mid-animation,
  // and re-measuring would restart every card mid-flight. Keyed on the
  // seats as a string because the caller rebuilds the array each render.
  const seatKey = seatUserIds.join(',')
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduced.matches) {
      return
    }
    const deck = document.querySelector('[data-deal-origin]')
    if (!deck) {
      return
    }
    setOrigin(centerOf(deck))
    setCards(
      planDeal(
        seatKey.split(',').map(Number),
        durationMs - shuffleMs,
        shuffleMs,
      ),
    )
  }, [seatKey, durationMs, shuffleMs])

  if (origin === null || cards.length === 0) {
    return null
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {/* The deck riffling in place before the first card leaves */}
      <span
        className="round-intro-shuffle absolute"
        style={{
          left: origin.x,
          top: origin.y,
          animationDuration: `${shuffleMs}ms`,
        }}
      >
        <CardBack className="h-[76px] w-[52px] -translate-x-1/2 -translate-y-1/2 sm:h-24 sm:w-[66px]" />
      </span>

      {cards.map((card, index) => (
        <span
          key={index}
          className="round-intro-card absolute"
          style={
            {
              left: origin.x,
              top: origin.y,
              animationDelay: `${card.delayMs}ms`,
              animationDuration: `${FLIGHT_MS}ms`,
              '--deal-dx': `${card.dx}px`,
              '--deal-dy': `${card.dy}px`,
              '--deal-rotate': `${card.rotation}deg`,
            } as React.CSSProperties
          }
        >
          <CardBack className="h-[76px] w-[52px] -translate-x-1/2 -translate-y-1/2 sm:h-24 sm:w-[66px]" />
        </span>
      ))}
    </div>
  )
}
