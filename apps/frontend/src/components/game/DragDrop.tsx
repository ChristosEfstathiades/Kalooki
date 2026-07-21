import {
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { cn } from '#/lib/utils'
import type {
  CollisionDetection,
  SensorDescriptor,
  SensorOptions,
  UniqueIdentifier,
} from '@dnd-kit/core'
import type { ReactNode } from 'react'
import type { GameCard } from '#/lib/game'

/**
 * Shared plumbing for the drag-and-drop table: what a drag carries,
 * where it may land, and the wrappers that register cards and zones
 * with dnd-kit. The game page maps a completed (drag, drop) pair onto a
 * game action or a staging change in its onDragEnd handler.
 */

/** What is being dragged: a card in hand, a staged card, or a pile top. */
export type DragData =
  | { source: 'hand'; card: GameCard }
  | { source: 'staged'; card: GameCard; setIndex: number }
  | { source: 'deck' }
  | { source: 'discard'; card: GameCard }

/** Where a drag can land. */
export type DropData =
  | { target: 'hand' }
  | { target: 'discard' }
  | { target: 'stagedSet'; setIndex: number }
  | { target: 'meld'; meldId: number; runEnd: 'low' | 'high' }
  | { target: 'joker'; meldId: number; jokerCardId: number }

/**
 * Mouse drags start after a few pixels of movement so plain clicks
 * still fire, and touch drags need a short hold so the page can still
 * scroll and taps still select. Together they cover desktop and mobile.
 */
export function useGameDragSensors(): SensorDescriptor<SensorOptions>[] {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  )
}

/**
 * Prefers whichever droppables sit under the pointer and, among nested
 * matches, the smallest one, so a joker token beats the meld chip
 * around it. Falls back to rectangle intersection when the pointer is
 * outside every zone.
 */
export const preciseCollision: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args)
  const candidates =
    underPointer.length > 0 ? underPointer : rectIntersection(args)
  const areaOf = (id: UniqueIdentifier): number => {
    const rect = args.droppableRects.get(id)
    return rect ? rect.width * rect.height : Number.POSITIVE_INFINITY
  }
  return [...candidates].sort((a, b) => areaOf(a.id) - areaOf(b.id))
}

interface CardDragProps {
  id: string
  data: DragData
  disabled?: boolean
  /** Extra classes, e.g. flex sizing when the card lives in a shrinkable row. */
  className?: string
  children: ReactNode
}

/**
 * Registers a card (or pile top) as draggable. The original stays in
 * place, dimmed, while the DragOverlay carries the moving copy. Clicks
 * and taps still reach the child, so the tap fallbacks keep working.
 */
export function CardDrag({
  id,
  data,
  disabled,
  className,
  children,
}: CardDragProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id,
    data,
    disabled,
  })
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      // Block the long-press context menu (Save/Copy/Share) so a
      // touch-drag on a card is not interrupted by it, covering
      // browsers where -webkit-touch-callout has no effect (Android)
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        'inline-block',
        // touch-action none only while draggable, so idle cards
        // still let the page scroll on mobile
        !disabled && 'touch-none',
        isDragging && 'opacity-30',
        className,
      )}
    >
      {children}
    </span>
  )
}

interface DropZoneProps {
  id: string
  data: DropData
  disabled?: boolean
  className?: string
  /** Extra classes applied while a drag hovers over the zone. */
  overClassName?: string
  children?: ReactNode
}

/**
 * Registers an area a drag can land on. Each zone styles its own
 * "you can drop here" affordance via className and overClassName.
 */
export function DropZone({
  id,
  data,
  disabled,
  className,
  overClassName,
  children,
}: DropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data, disabled })
  return (
    <span ref={setNodeRef} className={cn(className, isOver && overClassName)}>
      {children}
    </span>
  )
}
