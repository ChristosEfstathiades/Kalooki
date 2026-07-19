import PlayingCard from '#/components/game/PlayingCard'
import { CardDrag, DropZone } from '#/components/game/DragDrop'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import type { GameCard } from '#/lib/game'

interface StagingAreaProps {
  stagedMelds: number[][]
  cardById: (cardId: number) => GameCard | undefined
  /** Whether it is this player's acting phase, so drops and lay-down are allowed. */
  acting: boolean
  /** Whether a card drag is in progress, so the slots light up as targets. */
  cardDragActive: boolean
  onLay: () => void
  onClear: () => void
}

/**
 * The build-your-sets tray between the felt and your hand: drag cards
 * up from the hand into a slot (or the "new set" slot) to assemble
 * sets, then lay them all down with one tap. While assembling, cards
 * can be dragged between slots or back down to the hand.
 */
export default function StagingArea({
  stagedMelds,
  cardById,
  acting,
  cardDragActive,
  onLay,
  onClear,
}: StagingAreaProps) {
  const canLay =
    acting &&
    stagedMelds.length > 0 &&
    stagedMelds.every((set) => set.length >= 3)
  const highlight = acting && cardDragActive

  return (
    <div className="mt-2 rounded-md border border-border bg-muted/50 p-2">
      <div className="flex flex-wrap items-center gap-2">
        {stagedMelds.map((set, index) => (
          <DropZone
            key={index}
            id={`staged-set-${index}`}
            data={{ target: 'stagedSet', setIndex: index }}
            disabled={!acting}
            className={cn(
              'block rounded-md border-2 border-dashed p-1 transition-colors',
              // A set that is still too small to lay is tinted amber
              set.length < 3 ? 'border-amber-500/70' : 'border-border',
              highlight && 'border-ring/70',
            )}
            overClassName="border-ring bg-ring/10"
          >
            <span className="flex [&>*:not(:first-child)]:-ml-3">
              {set.map((cardId) => {
                const card = cardById(cardId)
                return card ? (
                  <CardDrag
                    key={cardId}
                    id={`staged-card-${cardId}`}
                    data={{ source: 'staged', card, setIndex: index }}
                    disabled={!acting}
                  >
                    <PlayingCard card={card} className="h-16 w-11" />
                  </CardDrag>
                ) : null
              })}
            </span>
          </DropZone>
        ))}
        <DropZone
          id={`staged-set-${stagedMelds.length}`}
          data={{ target: 'stagedSet', setIndex: stagedMelds.length }}
          disabled={!acting}
          className={cn(
            'flex h-[72px] min-w-[84px] items-center justify-center rounded-md border-2 border-dashed border-border px-2 text-center text-xs text-muted-foreground transition-colors',
            highlight && 'border-ring/70 text-foreground',
          )}
          overClassName="border-ring bg-ring/10"
        >
          {stagedMelds.length === 0
            ? 'Drag cards here to build a set'
            : '+ new set'}
        </DropZone>
        <div className="ml-auto flex flex-col items-stretch gap-2">
          <Button
            size="sm"
            className="bg-button-red hover:bg-button-red-hover"
            disabled={!canLay}
            title={canLay ? undefined : 'Each set needs at least 3 cards'}
            onClick={onLay}
          >
            Lay down
          </Button>
          {stagedMelds.length > 0 && (
            <Button size="sm" variant="secondary" onClick={onClear}>
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
