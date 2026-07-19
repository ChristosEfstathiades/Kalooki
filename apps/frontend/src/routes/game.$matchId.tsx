import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { currentUserQueryOptions } from '#/lib/auth'
import { getStoredToken } from '#/lib/auth-token'
import { getSocket } from '#/lib/socket'
import { fetchGameView, formatChips, sendGameAction } from '#/lib/game'
import { useTurnTitleAlert } from '#/lib/use-turn-title'
import PlayingCard, { CardBack } from '#/components/game/PlayingCard'
import StagingArea from '#/components/game/StagingArea'
import {
  CardDrag,
  DropZone,
  preciseCollision,
  useGameDragSensors,
} from '#/components/game/DragDrop'
import MatchChatPanel from '#/components/chat/MatchChatPanel'
import UserAvatar from '#/components/UserAvatar'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import type { DragData, DropData } from '#/components/game/DragDrop'
import type {
  GameAction,
  GameCard,
  GamePlayerView,
  GameView,
  MeldView,
  Rank,
  RoundResultView,
  Suit,
} from '#/lib/game'

export const Route = createFileRoute('/game/$matchId')({
  beforeLoad: () => {
    if (!getStoredToken()) {
      throw redirect({ to: '/signin' })
    }
  },
  component: GamePage,
})

/** How long the round-end scoresheet popup stays up between rounds. */
const ROUND_POPUP_MS = 5000

/** How long the turn-start cue runs before the table settles to static styling. */
const TURN_FLASH_MS = 1600

type SortMode = 'rank' | 'suit'

/**
 * Display order of the hand. Cards picked up during your turn wait in
 * `fresh` (right of the sorted hand) and only fold into `base` when the
 * turn ends with them still in hand, or when a sort button is pressed.
 */
interface HandOrder {
  base: number[]
  fresh: number[]
}

const PICTURE_RANKS: Record<string, number> = { J: 11, Q: 12, K: 13, A: 14 }

/** Sort value of a card's rank: ace high, jokers above everything. */
function rankValue(card: GameCard): number {
  if (card.isJoker) {
    return 15
  }
  if (typeof card.rank === 'number') {
    return card.rank
  }
  return card.rank === null ? 0 : PICTURE_RANKS[card.rank]
}

const SUIT_ORDER: Record<Suit, number> = {
  spades: 0,
  hearts: 1,
  clubs: 2,
  diamonds: 3,
}

/** Sort value of a card's suit; jokers group after the suits. */
function suitValue(card: GameCard): number {
  return card.suit === null ? 4 : SUIT_ORDER[card.suit]
}

/**
 * Card ids sorted by rank (highest first) or by suit (highest first
 * within each suit).
 */
function sortedIds(cards: GameCard[], mode: SortMode): number[] {
  return [...cards]
    .sort((a, b) =>
      mode === 'rank'
        ? rankValue(b) - rankValue(a) || suitValue(a) - suitValue(b)
        : suitValue(a) - suitValue(b) || rankValue(b) - rankValue(a),
    )
    .map((card) => card.id)
}

/**
 * Fits the display order to the server's hand: dropped cards are
 * pruned, cards picked up mid-turn queue in `fresh`, and once the turn
 * is over any kept pickups settle into the (sorted) hand.
 */
function reconcileHandOrder(
  previous: HandOrder,
  hand: GameCard[],
  myTurnActive: boolean,
  sortMode: SortMode | null,
): HandOrder {
  const idsInHand = new Set(hand.map((card) => card.id))
  const base = previous.base.filter((id) => idsInHand.has(id))
  const fresh = previous.fresh.filter((id) => idsInHand.has(id))
  const known = new Set([...base, ...fresh])
  const incoming = hand
    .filter((card) => !known.has(card.id))
    .map((card) => card.id)

  const unchanged =
    incoming.length === 0 &&
    base.length === previous.base.length &&
    fresh.length === previous.fresh.length

  // A whole new hand (first load or a fresh deal) settles immediately
  if (base.length === 0 && fresh.length === 0) {
    return { base: sortMode ? sortedIds(hand, sortMode) : incoming, fresh: [] }
  }
  if (myTurnActive) {
    return unchanged ? previous : { base, fresh: [...fresh, ...incoming] }
  }
  if (unchanged && fresh.length === 0) {
    return previous
  }
  // Turn over with pickups still in hand: fold them in
  return {
    base: sortMode
      ? sortedIds(hand, sortMode)
      : [...base, ...fresh, ...incoming],
    fresh: [],
  }
}

/**
 * Who plays after the current player, so a seat can be tagged "next"
 * and you can see your go approaching. Mirrors the engine's rotation:
 * the following seat that is still in the game (see `nextActiveIndex`
 * in the backend engine). Null between rounds, when nobody is on turn.
 */
function nextUpUserId(view: GameView): number | null {
  const currentIndex = view.players.findIndex(
    (player) => player.userId === view.currentPlayerUserId,
  )
  if (currentIndex === -1) {
    return null
  }
  for (let step = 1; step <= view.players.length; step++) {
    const player = view.players[(currentIndex + step) % view.players.length]
    if (!player.eliminated) {
      return player.userId
    }
  }
  return null
}

/**
 * The live Kalooki table: opponents around the top of the felt, sets
 * and piles in the middle, your hand and actions at the bottom
 * (docs/Frontend-design.md). No header or footer on this page.
 */
function GamePage() {
  const { matchId } = Route.useParams()
  const { data: currentUser } = useQuery(currentUserQueryOptions)
  const [view, setView] = useState<GameView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>([])
  const [stagedMelds, setStagedMelds] = useState<number[][]>([])
  const [chatOpen, setChatOpen] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode | null>(null)
  const [handOrder, setHandOrder] = useState<HandOrder>({ base: [], fresh: [] })
  const [roundPopupOpen, setRoundPopupOpen] = useState(false)
  const [turnFlash, setTurnFlash] = useState(false)
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null)
  const seenResultsRef = useRef<number | null>(null)
  const wasMyTurnRef = useRef(false)
  const sensors = useGameDragSensors()

  // Initial view + live updates
  useEffect(() => {
    let cancelled = false
    fetchGameView(matchId)
      .then((initial) => {
        if (!cancelled) {
          setView(initial)
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Could not load the game',
          )
        }
      })

    const socket = getSocket()
    const onState = (payload: { view: GameView; event: string }) => {
      if (payload.view.matchId === matchId) {
        setView(payload.view)
      }
    }
    socket.on('game:state', onState)
    return () => {
      cancelled = true
      socket.off('game:state', onState)
    }
  }, [matchId])

  // Pop the round-end scoresheet for a few seconds whenever a new
  // round result arrives (skipping whatever history loads with the page)
  const resultsCount = view?.roundResults.length ?? null
  useEffect(() => {
    if (resultsCount === null) {
      return
    }
    if (seenResultsRef.current === null) {
      seenResultsRef.current = resultsCount
      return
    }
    if (resultsCount > seenResultsRef.current) {
      seenResultsRef.current = resultsCount
      setRoundPopupOpen(true)
      const timer = setTimeout(() => setRoundPopupOpen(false), ROUND_POPUP_MS)
      return () => clearTimeout(timer)
    }
  }, [resultsCount])

  // Keep the displayed hand order in step with the server's hand
  const hand = view?.you.hand
  const myTurnActive =
    view !== null &&
    view.currentPlayerUserId === currentUser?.id &&
    (view.phase === 'awaitingDraw' || view.phase === 'acting')
  useEffect(() => {
    if (hand) {
      setHandOrder((previous) =>
        reconcileHandOrder(previous, hand, myTurnActive, sortMode),
      )
    }
  }, [hand, myTurnActive, sortMode])

  // Cards that leave the hand (laid, discarded, swapped for a joker)
  // also leave the staged sets and the selection
  useEffect(() => {
    if (!hand) {
      return
    }
    const idsInHand = new Set(hand.map((card) => card.id))
    setStagedMelds((current) => {
      const pruned = current
        .map((set) => set.filter((id) => idsInHand.has(id)))
        .filter((set) => set.length > 0)
      const unchanged =
        pruned.length === current.length &&
        pruned.every((set, index) => set.length === current[index].length)
      return unchanged ? current : pruned
    })
    setSelectedCardIds((current) => {
      const kept = current.filter((id) => idsInHand.has(id))
      return kept.length === current.length ? current : kept
    })
  }, [hand])

  // Flash the table once as the turn arrives, then let it settle
  useEffect(() => {
    const wasMyTurn = wasMyTurnRef.current
    wasMyTurnRef.current = myTurnActive
    if (!myTurnActive || wasMyTurn) {
      return
    }
    setTurnFlash(true)
    const timer = setTimeout(() => setTurnFlash(false), TURN_FLASH_MS)
    return () => clearTimeout(timer)
  }, [myTurnActive])

  useTurnTitleAlert(myTurnActive)

  const applySort = useCallback(
    (mode: SortMode) => {
      setSortMode(mode)
      if (hand) {
        setHandOrder({ base: sortedIds(hand, mode), fresh: [] })
      }
    },
    [hand],
  )

  const act = useCallback(
    async (action: GameAction) => {
      setError(null)
      try {
        const next = await sendGameAction(matchId, action)
        setView(next)
        // Staged sets survive the action; the prune effect drops any
        // staged cards the action moved out of the hand
        setSelectedCardIds([])
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : 'That move was rejected',
        )
      }
    },
    [matchId],
  )

  if (!view || !currentUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">{error ?? 'Loading the table…'}</p>
      </main>
    )
  }

  const me = view.players.find((player) => player.userId === currentUser.id)
  // Seated in turn order from the player who goes after you, so the
  // table reads left to right and your go is visibly approaching
  const seatCount = view.players.length
  const mySeat = me?.seat ?? 0
  const turnsAway = (player: GamePlayerView): number =>
    (player.seat - mySeat + seatCount) % seatCount
  const opponents = view.players
    .filter((player) => player.userId !== currentUser.id)
    .sort((a, b) => turnsAway(a) - turnsAway(b))
  const nextPlayerUserId = nextUpUserId(view)
  const isMyTurn = myTurnActive
  const canDraw = myTurnActive && view.phase === 'awaitingDraw'
  const stagedIds = stagedMelds.flat()
  const handCards = view.you.hand
  const unstagedSelected = selectedCardIds.filter(
    (id) => !stagedIds.includes(id),
  )

  // The hand in display order: settled cards first, this turn's
  // pickups on the right, then anything the order state hasn't seen yet
  const cardsById = new Map(handCards.map((card) => [card.id, card]))
  const displayHand: GameCard[] = []
  for (const id of [...handOrder.base, ...handOrder.fresh]) {
    const card = cardsById.get(id)
    if (card) {
      displayHand.push(card)
      cardsById.delete(id)
    }
  }
  displayHand.push(...cardsById.values())

  const toggleCard = (cardId: number) => {
    if (stagedIds.includes(cardId)) {
      return
    }
    setSelectedCardIds((current) =>
      current.includes(cardId)
        ? current.filter((id) => id !== cardId)
        : [...current, cardId],
    )
  }

  const stageSelected = () => {
    if (unstagedSelected.length >= 3) {
      setStagedMelds((current) => [...current, unstagedSelected])
      setSelectedCardIds([])
    }
  }

  const cardById = (cardId: number): GameCard | undefined =>
    handCards.find((card) => card.id === cardId)

  /** Moves a card into a staged set; an index past the end starts a new set. */
  const stageCardToSet = (cardId: number, setIndex: number) => {
    setSelectedCardIds((current) => current.filter((id) => id !== cardId))
    setStagedMelds((current) => {
      const without = current.map((set) => set.filter((id) => id !== cardId))
      if (setIndex < without.length) {
        without[setIndex] = [...without[setIndex], cardId]
      } else {
        without.push([cardId])
      }
      return without.filter((set) => set.length > 0)
    })
  }

  const unstageCard = (cardId: number) => {
    setStagedMelds((current) =>
      current
        .map((set) => set.filter((id) => id !== cardId))
        .filter((set) => set.length > 0),
    )
  }

  // What the in-flight drag may legally land on, so only sensible
  // targets light up (the server still has the final say)
  const acting = myTurnActive && view.phase === 'acting' && !view.paused
  const draggedCard =
    activeDrag !== null &&
    (activeDrag.source === 'hand' || activeDrag.source === 'staged')
      ? activeDrag.card
      : null
  const canExtendMelds = acting && me?.hasComeDown === true
  const goerDropActive =
    draggedCard !== null &&
    canExtendMelds &&
    draggedCard.id !== view.you.pendingDiscardCardId &&
    draggedCard.id !== view.you.pendingJokerCardId
  const jokerDropActive =
    draggedCard !== null && canExtendMelds && !draggedCard.isJoker
  const discardDropEligible = draggedCard !== null && acting

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDrag((event.active.data.current as DragData | undefined) ?? null)
  }

  /** Maps a completed drag onto a game action or a staging change. */
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null)
    const drag = event.active.data.current as DragData | undefined
    const drop = event.over?.data.current as DropData | undefined
    if (!drag || !drop) {
      return
    }
    if (drag.source === 'deck') {
      if (drop.target === 'hand') {
        void act({ type: 'draw' })
      }
      return
    }
    if (drag.source === 'discard') {
      if (drop.target === 'hand') {
        void act({ type: 'takeDiscard' })
      }
      return
    }
    const cardId = drag.card.id
    switch (drop.target) {
      case 'discard':
        void act({ type: 'discard', cardId })
        break
      case 'stagedSet':
        stageCardToSet(cardId, drop.setIndex)
        break
      case 'hand':
        if (drag.source === 'staged') {
          unstageCard(cardId)
        }
        break
      case 'meld':
        void act({
          type: 'goer',
          meldId: drop.meldId,
          cardId,
          runEnd: drop.runEnd,
        })
        break
      case 'joker':
        // The dragged card plus any tap-selected cards, for the group
        // case where the joker needs both natural replacements
        void act({
          type: 'takeJoker',
          meldId: drop.meldId,
          jokerCardId: drop.jokerCardId,
          replacementCardIds: [
            cardId,
            ...unstagedSelected.filter((id) => id !== cardId),
          ],
        })
        break
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <TableHeader
        view={view}
        onQuit={() => void act({ type: 'quit' })}
        onToggleChat={() => setChatOpen((open) => !open)}
      />

      {chatOpen && view.kind !== 'practice' && (
        <MatchChatPanel
          matchId={matchId}
          finished={view.phase === 'finished'}
          onClose={() => setChatOpen(false)}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={preciseCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDrag(null)}
      >
        <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 p-3">
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {opponents.map((player) => (
              // Equal-width cells on small screens, so wrapped seats
              // line up in tidy columns instead of ragged rows
              <div
                key={player.userId}
                className="w-[calc(50%-0.25rem)] sm:w-auto"
              >
                <PlayerSeat
                  player={player}
                  view={view}
                  isCurrent={view.currentPlayerUserId === player.userId}
                  isNext={nextPlayerUserId === player.userId}
                />
              </div>
            ))}
          </div>

          <div className="relative flex flex-1 flex-col gap-4 rounded-xl bg-felt p-4 shadow-inner">
            {view.paused && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/60">
                <p className="m-0 text-lg font-semibold text-white">
                  Game paused, waiting for a player to reconnect
                </p>
              </div>
            )}

            <div className="flex items-start justify-center gap-4 sm:gap-8">
              <PileSlot
                label={`Deck · ${view.deckCount}`}
                live={canDraw}
                flash={turnFlash}
              >
                <CardDrag
                  id="deck"
                  data={{ source: 'deck' }}
                  disabled={!canDraw || view.paused}
                >
                  <button
                    type="button"
                    className="appearance-none border-0 bg-transparent p-0"
                    onClick={() => void act({ type: 'draw' })}
                    disabled={!canDraw}
                    title="Drag the deck to your hand to draw, or tap it"
                  >
                    <CardBack className="h-[76px] w-[52px] sm:h-24 sm:w-[66px]" />
                  </button>
                </CardDrag>
              </PileSlot>
              <PileSlot
                label={`Discard · ${view.discardCount}`}
                live={
                  (canDraw && view.discardTop !== null) || discardDropEligible
                }
                flash={turnFlash}
              >
                <DropZone
                  id="discard-zone"
                  data={{ target: 'discard' }}
                  disabled={!discardDropEligible}
                  className="inline-flex rounded-md transition-colors"
                  overClassName="bg-white/25 ring-2 ring-white"
                >
                  {view.discardTop ? (
                    <CardDrag
                      id="discard-top"
                      data={{ source: 'discard', card: view.discardTop }}
                      disabled={!canDraw || view.paused}
                    >
                      <PlayingCard
                        card={view.discardTop}
                        className="h-[76px] w-[52px] sm:h-24 sm:w-[66px]"
                        onClick={
                          canDraw
                            ? () => void act({ type: 'takeDiscard' })
                            : undefined
                        }
                      />
                    </CardDrag>
                  ) : (
                    <span className="flex h-[76px] w-[52px] items-center justify-center rounded-md border border-dashed border-white/40 text-xs text-white/60 sm:h-24 sm:w-[66px]">
                      Empty
                    </span>
                  )}
                </DropZone>
              </PileSlot>
            </div>

            <MeldsArea
              view={view}
              selectedCardIds={unstagedSelected}
              cardById={cardById}
              goerDropActive={goerDropActive}
              jokerDropActive={jokerDropActive}
              onGoer={(meldId, cardId, runEnd) =>
                void act({ type: 'goer', meldId, cardId, runEnd })
              }
              onTakeJoker={(meldId, jokerCardId) =>
                void act({
                  type: 'takeJoker',
                  meldId,
                  jokerCardId,
                  replacementCardIds: unstagedSelected,
                })
              }
            />
          </div>

          <OwnArea
            me={me}
            view={view}
            handCards={displayHand}
            selectedCardIds={selectedCardIds}
            stagedMelds={stagedMelds}
            cardById={cardById}
            activeDrag={activeDrag}
            isMyTurn={isMyTurn}
            isNext={nextPlayerUserId === currentUser.id}
            turnFlash={turnFlash}
            error={error}
            sortMode={sortMode}
            onSort={applySort}
            onToggleCard={toggleCard}
            onStage={stageSelected}
            onClearStaged={() => {
              setStagedMelds([])
              setSelectedCardIds([])
            }}
            onLayStaged={() =>
              void act({ type: 'layMelds', melds: stagedMelds })
            }
            onDiscard={() =>
              unstagedSelected.length === 1 &&
              void act({ type: 'discard', cardId: unstagedSelected[0] })
            }
            onReturnDiscard={() => void act({ type: 'returnDiscard' })}
            onReturnJoker={() => void act({ type: 'returnJoker' })}
          />
        </section>

        <DragOverlay dropAnimation={null}>
          {activeDrag === null ? null : activeDrag.source === 'deck' ? (
            <CardBack />
          ) : (
            <span className="block rotate-6 drop-shadow-xl">
              <PlayingCard card={activeDrag.card} />
            </span>
          )}
        </DragOverlay>
      </DndContext>

      {(view.phase === 'roundEnd' ||
        view.phase === 'finished' ||
        roundPopupOpen) && (
        <RoundEndOverlay
          view={view}
          currentUserId={currentUser.id}
          onBuyIn={act}
          onDismiss={
            view.phase !== 'roundEnd' && view.phase !== 'finished'
              ? () => setRoundPopupOpen(false)
              : undefined
          }
        />
      )}
    </main>
  )
}

interface PileSlotProps {
  label: string
  /** Whether this pile is a legal target right now. */
  live: boolean
  flash: boolean
  children: React.ReactNode
}

/**
 * A pile in the middle of the felt with its count underneath. When it
 * is a legal target it is ringed and lifted, so the turn is readable
 * from the centre of the table rather than only from the status text.
 */
function PileSlot({ label, live, flash, children }: PileSlotProps) {
  return (
    <div className="text-center">
      <span
        // The felt is green, so the purple --ring reads poorly here
        style={{ '--turn-pulse-color': 'white' } as React.CSSProperties}
        className={cn(
          // inline-flex so the ring hugs the card with no baseline gap
          'inline-flex rounded-md transition-all',
          live
            ? 'ring-2 ring-white/90 ring-offset-2 ring-offset-felt hover:-translate-y-1'
            : 'opacity-70',
          live && flash && 'turn-pulse',
        )}
      >
        {children}
      </span>
      <p className="m-0 mt-1 text-xs text-white/80">{label}</p>
    </div>
  )
}

interface TableHeaderProps {
  view: GameView
  onQuit: () => void
  onToggleChat: () => void
}

function TableHeader({ view, onQuit, onToggleChat }: TableHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-panel px-4 py-2">
      <p className="m-0 text-sm font-semibold">
        Kalooki · Round {view.roundNumber} ·{' '}
        <span className="text-muted-foreground">
          {view.kind === 'private' ? 'Custom rules' : 'Classic rules'}
          {view.kind === 'practice' && ' · Practice'} · out at{' '}
          {view.rules.scoreLimit + 1}
        </span>
      </p>
      <div className="flex items-center gap-3">
        {view.kind !== 'practice' && (
          <Button size="sm" variant="secondary" onClick={onToggleChat}>
            Chat
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            if (
              window.confirm(
                'Leave the game? You cannot rejoin after quitting.',
              )
            ) {
              onQuit()
            }
          }}
        >
          Quit
        </Button>
      </div>
    </header>
  )
}

interface TurnClockProps {
  deadline: number | null
  paused: boolean
}

/**
 * Remaining move time for the current turn, ticking every second. Shown
 * on the seat of whoever is on turn, so the countdown always has a name
 * attached to it.
 */
function TurnClock({ deadline, paused }: TurnClockProps) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (paused || deadline === null) {
    return null
  }
  const remaining = Math.max(0, deadline - now)
  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  return (
    <span
      className={cn(
        'font-mono text-sm tabular-nums',
        remaining < 60000
          ? 'text-destructive-foreground'
          : 'text-muted-foreground',
      )}
    >
      {minutes}:{String(seconds).padStart(2, '0')}
    </span>
  )
}

interface PlayerSeatProps {
  player: GamePlayerView
  view: GameView
  /** Whose go it is: exactly one seat at the table is lit. */
  isCurrent: boolean
  isNext: boolean
  /** Your own seat, shown alongside your hand rather than in the opponent row. */
  isSelf?: boolean
  flash?: boolean
}

/**
 * A player's place at the table: avatar, cards left, score, and the
 * move clock while they are on turn. The seat on turn is ringed and the
 * rest are dimmed, so whose go it is reads at a glance.
 */
function PlayerSeat({
  player,
  view,
  isCurrent,
  isNext,
  isSelf,
  flash,
}: PlayerSeatProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-card px-3 py-2 transition-all',
        isCurrent ? 'border-ring ring-2 ring-ring' : 'border-border opacity-60',
        isCurrent && flash && 'turn-pulse',
        player.eliminated && 'opacity-50',
      )}
    >
      <UserAvatar user={player} />
      <div className="text-xs">
        <p className="m-0 font-semibold">
          {isSelf ? 'You' : player.username}
          {player.isBot && (
            <span className="ml-1 rounded bg-muted px-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Bot
            </span>
          )}
          {!player.connected && !player.eliminated && (
            <span className="ml-1 text-destructive-foreground">
              (disconnected)
            </span>
          )}
          {player.removed && (
            <span className="ml-1 text-muted-foreground">(left)</span>
          )}
          {isNext && !isCurrent && !player.eliminated && (
            <span className="ml-1 font-normal text-muted-foreground">
              · next
            </span>
          )}
        </p>
        <p className="m-0 text-muted-foreground">
          {player.eliminated
            ? 'Out'
            : `${player.handCount} cards · ${player.score} pts`}
          {view.rules.stakes && (
            <span className="ml-1">· {formatChips(player.chips)} chips</span>
          )}
          {player.handCount === 1 && !player.eliminated && (
            <span className="ml-1 font-semibold text-button-red-hover">
              Last card!
            </span>
          )}
        </p>
      </div>
      {isCurrent && (
        <TurnClock deadline={view.turnDeadlineAt} paused={view.paused} />
      )}
    </div>
  )
}

interface MeldsAreaProps {
  view: GameView
  selectedCardIds: number[]
  cardById: (cardId: number) => GameCard | undefined
  /** Whether the in-flight drag may land on a meld end as a go-er. */
  goerDropActive: boolean
  /** Whether the in-flight drag may land on a tabled joker to swap it out. */
  jokerDropActive: boolean
  onGoer: (meldId: number, cardId: number, runEnd: 'low' | 'high') => void
  onTakeJoker: (meldId: number, jokerCardId: number) => void
}

function MeldsArea({
  view,
  selectedCardIds,
  cardById,
  goerDropActive,
  jokerDropActive,
  onGoer,
  onTakeJoker,
}: MeldsAreaProps) {
  const singleSelected =
    selectedCardIds.length === 1 ? cardById(selectedCardIds[0]) : undefined

  if (view.melds.length === 0) {
    return (
      <p className="m-0 text-center text-sm text-white/60">
        No sets on the table yet, first to {view.rules.comeDownThreshold} points
        comes down.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap justify-center gap-4">
      {view.melds.map((meld) => (
        <MeldGroup
          key={meld.id}
          meld={meld}
          singleSelected={singleSelected}
          hasReplacementsSelected={selectedCardIds.length > 0}
          goerDropActive={goerDropActive}
          jokerDropActive={jokerDropActive}
          onGoer={onGoer}
          onTakeJoker={onTakeJoker}
        />
      ))}
    </div>
  )
}

interface GoerDropZoneProps {
  meldId: number
  runEnd: 'low' | 'high'
  /** Zone label; defaults to the run end name. */
  label?: string
}

/**
 * A drop target on the end of a tabled set: dropping the dragged card
 * here plays it as a go-er (for runs, on the low or the high end).
 */
function GoerDropZone({ meldId, runEnd, label }: GoerDropZoneProps) {
  return (
    <DropZone
      id={`meld-${meldId}-${runEnd}`}
      data={{ target: 'meld', meldId, runEnd }}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded border-2 border-dashed border-zinc-400 text-[10px] font-semibold text-zinc-500 uppercase"
      overClassName="border-zinc-800 bg-zinc-800/10 text-zinc-900"
    >
      {label ?? runEnd}
    </DropZone>
  )
}

interface MeldGroupProps {
  meld: MeldView
  singleSelected: GameCard | undefined
  hasReplacementsSelected: boolean
  goerDropActive: boolean
  jokerDropActive: boolean
  onGoer: (meldId: number, cardId: number, runEnd: 'low' | 'high') => void
  onTakeJoker: (meldId: number, jokerCardId: number) => void
}

const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

/** Red suits print red, black suits near-black, on the light meld chip. */
function suitColorClass(suit: Suit | null): string {
  return suit === 'hearts' || suit === 'diamonds'
    ? 'text-red-600'
    : 'text-zinc-900'
}

function MeldGroup({
  meld,
  singleSelected,
  hasReplacementsSelected,
  goerDropActive,
  jokerDropActive,
  onGoer,
  onTakeJoker,
}: MeldGroupProps) {
  return (
    <div className="rounded-md bg-white/90 px-2 py-1 shadow-sm">
      <div className="flex items-center gap-2">
        {goerDropActive && meld.type === 'run' && (
          <GoerDropZone meldId={meld.id} runEnd="low" />
        )}
        {meld.cards.map((meldCard) =>
          meldCard.card.isJoker && jokerDropActive ? (
            <DropZone
              key={meldCard.card.id}
              id={`joker-${meld.id}-${meldCard.card.id}`}
              data={{
                target: 'joker',
                meldId: meld.id,
                jokerCardId: meldCard.card.id,
              }}
              className="inline-flex rounded p-0.5 ring-2 ring-purple-400"
              overClassName="bg-purple-200 ring-purple-600"
            >
              <MeldToken rank={meldCard.rank} suit={meldCard.suit} isJoker />
            </DropZone>
          ) : (
            <MeldToken
              key={meldCard.card.id}
              rank={meldCard.rank}
              suit={meldCard.suit}
              isJoker={meldCard.card.isJoker}
              onClick={
                meldCard.card.isJoker && hasReplacementsSelected
                  ? () => onTakeJoker(meld.id, meldCard.card.id)
                  : undefined
              }
            />
          ),
        )}
        {goerDropActive && (
          <GoerDropZone
            meldId={meld.id}
            runEnd="high"
            label={meld.type === 'run' ? undefined : 'add'}
          />
        )}
      </div>
      {singleSelected && (
        <div className="mt-1 flex justify-center gap-1">
          {meld.type === 'run' && (
            <button
              type="button"
              className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-white hover:bg-zinc-900"
              onClick={() => onGoer(meld.id, singleSelected.id, 'low')}
            >
              + low
            </button>
          )}
          <button
            type="button"
            className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-white hover:bg-zinc-900"
            onClick={() => onGoer(meld.id, singleSelected.id, 'high')}
          >
            {meld.type === 'run' ? '+ high' : 'Add here'}
          </button>
        </div>
      )}
    </div>
  )
}

interface MeldTokenProps {
  rank: Rank
  suit: Suit | null
  isJoker: boolean
  onClick?: () => void
}

/**
 * A laid-down card shown as compact text (e.g. "10♥") rather than a
 * card image. Jokers display the rank/suit they stand in for, marked
 * with a star and purple ring, and stay clickable so a selected card
 * can be swapped in for them.
 */
function MeldToken({ rank, suit, isJoker, onClick }: MeldTokenProps) {
  const content = (
    <span
      className={cn(
        'inline-flex items-baseline text-lg leading-none font-semibold tabular-nums',
        suitColorClass(suit),
        isJoker && 'rounded px-1 ring-1 ring-purple-500/70',
      )}
    >
      {String(rank)}
      {suit && <span className="ml-0.5">{SUIT_SYMBOL[suit]}</span>}
      {isJoker && <span className="ml-0.5 text-xs text-purple-600">★</span>}
    </span>
  )

  if (!onClick) {
    return content
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title="Swap your selected card in for this joker"
      className="appearance-none border-0 bg-transparent p-0 hover:opacity-70"
    >
      {content}
    </button>
  )
}

interface OwnAreaProps {
  me: GamePlayerView | undefined
  view: GameView
  handCards: GameCard[]
  selectedCardIds: number[]
  stagedMelds: number[][]
  cardById: (cardId: number) => GameCard | undefined
  activeDrag: DragData | null
  isMyTurn: boolean
  isNext: boolean
  turnFlash: boolean
  error: string | null
  sortMode: SortMode | null
  onSort: (mode: SortMode) => void
  onToggleCard: (cardId: number) => void
  onStage: () => void
  onClearStaged: () => void
  onLayStaged: () => void
  onDiscard: () => void
  onReturnDiscard: () => void
  onReturnJoker: () => void
}

function OwnArea({
  me,
  view,
  handCards,
  selectedCardIds,
  stagedMelds,
  cardById,
  activeDrag,
  isMyTurn,
  isNext,
  turnFlash,
  error,
  sortMode,
  onSort,
  onToggleCard,
  onStage,
  onClearStaged,
  onLayStaged,
  onDiscard,
  onReturnDiscard,
  onReturnJoker,
}: OwnAreaProps) {
  const stagedIds = stagedMelds.flat()
  const unstagedSelected = selectedCardIds.filter(
    (id) => !stagedIds.includes(id),
  )
  const acting = isMyTurn && view.phase === 'acting' && !view.paused
  // Staged cards live in the tray, not the hand row
  const visibleHand = handCards.filter((card) => !stagedIds.includes(card.id))
  const cardDragActive =
    activeDrag !== null &&
    (activeDrag.source === 'hand' || activeDrag.source === 'staged')
  const pileDragActive =
    activeDrag !== null &&
    (activeDrag.source === 'deck' || activeDrag.source === 'discard')

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      {error && (
        <p className="mt-2 mb-0 rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1 text-xs text-destructive-foreground">
          {error}
        </p>
      )}

      {(acting || stagedMelds.length > 0) && (
        <StagingArea
          stagedMelds={stagedMelds}
          cardById={cardById}
          acting={acting}
          cardDragActive={cardDragActive}
          onLay={onLayStaged}
          onClear={onClearStaged}
        />
      )}

      <DropZone
        id="hand-zone"
        data={{ target: 'hand' }}
        disabled={activeDrag === null || activeDrag.source === 'hand'}
        className={cn(
          'mt-3 block rounded-md transition-colors',
          // Lit while the deck or discard is being dragged, so the
          // "drop it here to take it" target is obvious
          pileDragActive && 'ring-2 ring-ring/70',
        )}
        overClassName="bg-ring/10"
      >
        {/* No wrapping: each card is a shrinkable flex cell, so a big
            hand compresses the cards instead of spilling onto a second
            row */}
        <div className="flex min-h-24 items-center justify-center py-1 [&>*:not(:first-child)]:-ml-[33px]">
          {visibleHand.map((card) => (
            <CardDrag
              key={card.id}
              id={`hand-card-${card.id}`}
              data={{ source: 'hand', card }}
              disabled={!acting}
              className="min-w-8 basis-[66px]"
            >
              <PlayingCard
                card={card}
                fluid
                selected={selectedCardIds.includes(card.id)}
                onClick={() => onToggleCard(card.id)}
              />
            </CardDrag>
          ))}
        </div>
      </DropZone>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {me && (
          <PlayerSeat
            player={me}
            view={view}
            isCurrent={isMyTurn}
            isNext={isNext}
            isSelf
            flash={turnFlash}
          />
        )}
        {me && (view.rules.stakes || me.hasComeDown) ? (
          <p className="m-0 text-xs text-muted-foreground">
            {view.rules.stakes ? `chips: ${formatChips(me.chips)}` : ''}
            {me.hasComeDown ? ' · down' : ''}
          </p>
        ) : null}
        <Button
          size="sm"
          disabled={!acting || unstagedSelected.length < 3}
          title="Move the selected cards into the sets tray"
          onClick={onStage}
        >
          Stage set ({unstagedSelected.length})
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!acting || unstagedSelected.length !== 1}
          onClick={onDiscard}
        >
          Discard selected
        </Button>
        {view.you.pendingDiscardCardId !== null && (
          <Button size="sm" variant="secondary" onClick={onReturnDiscard}>
            Return taken discard
          </Button>
        )}
        {view.you.pendingJokerCardId !== null && (
          <Button size="sm" variant="secondary" onClick={onReturnJoker}>
            Return taken joker
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant={sortMode === 'rank' ? 'default' : 'secondary'}
            title="Sort your hand from highest to lowest"
            onClick={() => onSort('rank')}
          >
            Sort: high–low
          </Button>
          <Button
            size="sm"
            variant={sortMode === 'suit' ? 'default' : 'secondary'}
            title="Sort your hand by suit"
            onClick={() => onSort('suit')}
          >
            Sort: suit
          </Button>
        </div>
      </div>
    </div>
  )
}

interface RoundEndOverlayProps {
  view: GameView
  currentUserId: number
  onBuyIn: (action: GameAction) => Promise<void>
  /** Set for the transient between-rounds popup: clicking the backdrop closes it early. */
  onDismiss?: () => void
}

function RoundEndOverlay({
  view,
  currentUserId,
  onBuyIn,
  onDismiss,
}: RoundEndOverlayProps) {
  // A match can finish before any round completes (e.g. a quit in
  // round 1), so there may be no result rows yet
  const latest: RoundResultView | undefined = view.roundResults.at(-1)
  const mustDecide = view.pendingBuyIns.includes(currentUserId)
  const finished = view.phase === 'finished'
  const winnerName = view.players.find(
    (player) => player.userId === view.winnerUserId,
  )?.username

  const stakes = view.rules.stakes
  const winnerChips = view.players.find(
    (player) => player.userId === view.winnerUserId,
  )?.chips

  const usernameOf = (userId: number) =>
    view.players.find((player) => player.userId === userId)?.username ??
    `Player ${userId}`

  const roundTitle =
    latest && latest.winnerUserId !== null
      ? `${usernameOf(latest.winnerUserId)} won round ${latest.roundNumber}${
          latest.calledKalooki ? ' with a kalooki!' : ''
        }`
      : `Round ${latest?.roundNumber ?? view.roundNumber} finished`

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="m-0 text-xl font-bold">
          {finished
            ? winnerName
              ? `${winnerName} wins the game${
                  stakes && winnerChips !== undefined
                    ? ` and ${winnerChips} chips`
                    : ''
                }`
              : 'Game over'
            : roundTitle}
        </h2>
        {latest && (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 font-medium">Player</th>
                <th className="py-1 font-medium">Round</th>
                <th className="py-1 font-medium">Total</th>
                {stakes && <th className="py-1 font-medium">Chips</th>}
              </tr>
            </thead>
            <tbody>
              {Object.keys(latest.totals).map((userIdKey) => {
                const userId = Number(userIdKey)
                return (
                  <tr key={userId} className="border-t border-border">
                    <td className="py-1">
                      {usernameOf(userId)}
                      {latest.winnerUserId === userId && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {latest.calledKalooki ? '(kalooki!)' : '(called up)'}
                        </span>
                      )}
                    </td>
                    <td className="py-1">+{latest.penalties[userId] ?? 0}</td>
                    <td className="py-1">{latest.totals[userId]}</td>
                    {stakes && (
                      <td className="py-1">
                        {formatChips(latest.chips[userId] ?? 0)}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {finished && stakes && (
          <div className="mt-4 rounded-md border border-border bg-muted p-3">
            <p className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Final chips
            </p>
            <p className="m-0 mt-1 text-xs text-muted-foreground">
              Round money as it was won, plus every stake ({stakes.stake}) and
              buy-in ({stakes.rebuy} each) collected by the winner.
            </p>
            <ul className="m-0 mt-2 list-none space-y-0.5 p-0 text-sm">
              {view.players.map((player) => (
                <li
                  key={player.userId}
                  className={cn(
                    player.userId === view.winnerUserId && 'font-semibold',
                  )}
                >
                  {player.username}: {formatChips(player.chips)} chips
                </li>
              ))}
            </ul>
          </div>
        )}

        {mustDecide && (
          <div className="mt-4 rounded-md border border-border bg-muted p-3">
            <p className="m-0 text-sm">
              You are over {view.rules.scoreLimit} points. Use a buy-in to
              rejoin on the highest remaining score?
              {stakes &&
                ` Buying in costs ${stakes.rebuy} chips, paid to the eventual winner.`}
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                onClick={() => void onBuyIn({ type: 'buyIn', accept: true })}
              >
                Buy back in
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void onBuyIn({ type: 'buyIn', accept: false })}
              >
                I&apos;m out
              </Button>
            </div>
          </div>
        )}

        {!mustDecide && !finished && view.pendingBuyIns.length > 0 && (
          <p className="mt-4 mb-0 text-sm text-muted-foreground">
            Waiting for buy-in decisions…
          </p>
        )}

        {finished && (
          <div className="mt-4">
            <Button asChild>
              <Link to="/play">Back to the lobby</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
