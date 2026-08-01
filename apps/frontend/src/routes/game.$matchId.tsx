import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { Menu, UserPlus, X } from 'lucide-react'
import { currentUserQueryOptions } from '#/lib/auth'
import { getStoredToken } from '#/lib/auth-token'
import { getSocket } from '#/lib/socket'
import {
  fetchGameView,
  formatChips,
  sendGameAction,
  startPracticeMatch,
} from '#/lib/game'
import {
  friendRequestsQueryOptions,
  friendsQueryOptions,
  useSendFriendRequest,
} from '#/lib/social'
import { useTurnTitleAlert } from '#/lib/use-turn-title'
import PlayingCard, { CardBack } from '#/components/game/PlayingCard'
import StagingArea from '#/components/game/StagingArea'
import { RoundIntro } from '#/components/game/RoundIntro'
import CardFlight, { planCardFlight } from '#/components/game/CardFlight'
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
import { seo } from '#/lib/seo'
import { chatNameColor, usernameColor } from '#/lib/username-color'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import type { DragData, DropData } from '#/components/game/DragDrop'
import type { CardFlightPath } from '#/components/game/CardFlight'
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
  // No canonical: a match URL is private to its players and gone once
  // the game ends, so there is nothing here worth indexing
  head: () =>
    seo({
      title: 'Match',
      description: 'A Kalooki match in progress.',
      noindex: true,
    }),
  beforeLoad: () => {
    if (!getStoredToken()) {
      throw redirect({ to: '/signin' })
    }
  },
  component: GamePage,
})

/**
 * How long the shuffle-and-deal animation runs at the end of the
 * between-rounds intermission. The server bakes the same allowance into
 * the `nextRoundAt` it sends, so the cards land exactly as the animation
 * finishes — keep this in step with `roundDealAnimationMs` in
 * `match_service.ts`.
 */
const ROUND_INTRO_MS = 2500

/** The shuffle runs first, then the deal fills the rest of the intro. */
const SHUFFLE_MS = 1000

/**
 * Rounds whose intro this tab has already played, so refreshing part
 * way through a round does not deal the cards a second time. Kept in
 * sessionStorage rather than a ref, which a reload would reset, and
 * per-tab so it dies with the match rather than piling up.
 */
function roundIntroKey(matchId: string, roundNumber: number): string {
  return `kalooki.roundIntro.${matchId}.${roundNumber}`
}

function hasSeenRoundIntro(matchId: string, roundNumber: number): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return (
    window.sessionStorage.getItem(roundIntroKey(matchId, roundNumber)) !== null
  )
}

function markRoundIntroSeen(matchId: string, roundNumber: number): void {
  if (typeof window === 'undefined') {
    return
  }
  window.sessionStorage.setItem(roundIntroKey(matchId, roundNumber), 'seen')
}

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

/**
 * The place in the hand a drag is currently hovering over, so the hand
 * can open the gap the card would land in. `beforeCardId` is null for
 * the far right of the hand, and the whole thing is null when the drag
 * is not over the hand at all.
 */
interface HandDropTarget {
  beforeCardId: number | null
}

/**
 * A card animating from a pile into the hand after a click-to-draw.
 * `id` climbs with every draw so the animation replays rather than
 * leaving the previous card frozen mid-flight.
 */
interface DrawFlight {
  id: number
  /** The face to fly, or null for a face-down card off the deck. */
  card: GameCard | null
  path: CardFlightPath
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
 * True on narrow (below `sm`) viewports, where the tap-select action
 * buttons are hidden and the table is drag-only. Used to drop the card
 * tap-to-select handler on touch so a quick tap does not compete with
 * the drag gesture.
 */
function useIsCompactViewport(): boolean {
  const [compact, setCompact] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 639px)').matches
      : false,
  )
  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)')
    const update = (): void => setCompact(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return compact
}

/**
 * Splits the server's between-rounds intermission into the two things
 * the table shows: the scoresheet counting down, then the
 * shuffle-and-deal that runs right up to the moment the cards land.
 * `secondsToDeal` is null whenever nothing is scheduled — between
 * rounds that is a match paused for a reconnect or held on a buy-in.
 */
function useRoundIntermission(view: GameView | null): {
  dealing: boolean
  secondsToDeal: number | null
} {
  const nextRoundAt = view?.phase === 'roundEnd' ? view.nextRoundAt : null
  // The interval only drives re-renders; the time itself is read below
  // at render, so a deadline arriving after minutes of play can never
  // be measured against a stale clock
  const [, retick] = useReducer((count: number) => count + 1, 0)

  useEffect(() => {
    if (nextRoundAt === null) {
      return
    }
    const tick = setInterval(retick, 250)
    return () => clearInterval(tick)
  }, [nextRoundAt])

  if (nextRoundAt === null) {
    return { dealing: false, secondsToDeal: null }
  }
  const introStartsAt = nextRoundAt - ROUND_INTRO_MS
  const now = Date.now()
  return {
    dealing: now >= introStartsAt,
    secondsToDeal: Math.max(0, Math.ceil((introStartsAt - now) / 1000)),
  }
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [turnFlash, setTurnFlash] = useState(false)
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null)
  const [handDropTarget, setHandDropTarget] = useState<HandDropTarget | null>(
    null,
  )
  const [localIntroUntil, setLocalIntroUntil] = useState<number | null>(null)
  const [flight, setFlight] = useState<DrawFlight | null>(null)
  const wasMyTurnRef = useRef(false)
  const flightIdRef = useRef(0)
  const sensors = useGameDragSensors()
  const clearFlight = useCallback(() => setFlight(null), [])

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

  // The between-rounds scoresheet and the deal that follows it are both
  // paced by the server, which sends the moment the cards land
  const { dealing, secondsToDeal } = useRoundIntermission(view)

  // Round one is already dealt by the time the table loads, so its
  // shuffle-and-deal runs locally; every later round is covered by the
  // intermission above. It only runs on a round nothing has happened in
  // yet, and only once — so a refresh (or a rejoin, which lands on a
  // fresh tab) drops you straight onto the table rather than replaying
  // a deal you already watched.
  const phase = view?.phase
  const roundNumber = view?.roundNumber
  const untouched = view?.discardCount === 0 && view.melds.length === 0
  useEffect(() => {
    if (
      roundNumber === undefined ||
      phase === undefined ||
      phase === 'roundEnd' ||
      phase === 'finished'
    ) {
      return
    }
    if (roundNumber !== 1 || !untouched) {
      return
    }
    if (hasSeenRoundIntro(matchId, roundNumber)) {
      return
    }
    markRoundIntroSeen(matchId, roundNumber)
    setLocalIntroUntil(Date.now() + ROUND_INTRO_MS)
  }, [matchId, phase, roundNumber, untouched])

  useEffect(() => {
    if (localIntroUntil === null) {
      return
    }
    const timer = setTimeout(
      () => setLocalIntroUntil(null),
      Math.max(0, localIntroUntil - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [localIntroUntil])

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
  // Cards are dealt round the table starting on the dealer's left, so
  // the animation follows the same rotation the engine does
  const dealerSeat =
    view.players.find((player) => player.userId === view.dealerUserId)?.seat ??
    0
  const dealOrder = view.players
    .filter((player) => !player.eliminated)
    .sort(
      (a, b) =>
        ((a.seat - dealerSeat - 1 + seatCount) % seatCount) -
        ((b.seat - dealerSeat - 1 + seatCount) % seatCount),
    )
    .map((player) => player.userId)
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

  /**
   * Puts a card in front of another one in the hand (or at the far
   * right when `beforeCardId` is null), so players can arrange their
   * hand by dragging rather than living with the sort buttons. Any
   * active sort is dropped: the order belongs to the player from here
   * on, and cards picked up later join the right-hand end instead of
   * re-sorting what they arranged.
   */
  const arrangeCard = (cardId: number, beforeCardId: number | null) => {
    if (cardId === beforeCardId) {
      return
    }
    setSortMode(null)
    setHandOrder((current) => {
      const order = [...current.base, ...current.fresh]
      // Cards the order state has not caught up with yet sit at the end
      // of the hand row, so give them that place before moving anything
      for (const card of handCards) {
        if (!order.includes(card.id)) {
          order.push(card.id)
        }
      }
      const from = order.indexOf(cardId)
      if (from === -1) {
        return current
      }
      order.splice(from, 1)
      const before = beforeCardId === null ? -1 : order.indexOf(beforeCardId)
      order.splice(before === -1 ? order.length : before, 0, cardId)
      return { base: order, fresh: [] }
    })
  }

  /**
   * Draws by click, flying a card from the pile into the hand so the
   * move is as readable as dragging it there. The flight is decorative;
   * the real card arrives with the server's next view.
   */
  const drawByClick = (
    action: GameAction,
    pileSelector: string,
    face: GameCard | null,
  ) => {
    const path = planCardFlight(document.querySelector(pileSelector))
    if (path) {
      flightIdRef.current += 1
      setFlight({ id: flightIdRef.current, card: face, path })
    }
    void act(action)
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

  /** Tracks the hand position under the drag, so the hand can open a gap there. */
  const handleDragOver = (event: DragOverEvent) => {
    const drop = event.over?.data.current as DropData | undefined
    setHandDropTarget(
      drop?.target === 'handSlot' ? { beforeCardId: drop.beforeCardId } : null,
    )
  }

  /** Maps a completed drag onto a game action or a staging change. */
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null)
    setHandDropTarget(null)
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
      case 'handSlot':
        // A staged card dropped onto a slot comes back out of the tray
        // and takes that place, rather than only returning to the hand
        if (drag.source === 'staged') {
          unstageCard(cardId)
        }
        arrangeCard(cardId, drop.beforeCardId)
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
        onOpenMenu={() => setMenuOpen(true)}
        onToggleChat={() => setChatOpen((open) => !open)}
      />

      {menuOpen && (
        <GameMenu
          view={view}
          onQuit={() => {
            setMenuOpen(false)
            void act({ type: 'quit' })
          }}
          onClose={() => setMenuOpen(false)}
        />
      )}

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
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveDrag(null)
          setHandDropTarget(null)
        }}
      >
        <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 px-0 pt-3 pb-0 sm:pb-3 sm:px-3">
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

          <div className="relative flex flex-1 flex-col justify-between gap-4 rounded-xl bg-felt p-4 shadow-inner">
            {view.paused && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/60">
                <p className="m-0 text-lg font-semibold text-white">
                  Game paused, waiting for a player to reconnect
                </p>
              </div>
            )}

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
                    // The shuffle sits here and the deal flies out from it
                    data-deal-origin=""
                    className="block appearance-none border-0 bg-transparent p-0"
                    onClick={() =>
                      drawByClick({ type: 'draw' }, '[data-deal-origin]', null)
                    }
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
                    // A tapped take flies out from here
                    <span data-discard-origin="" className="block">
                      <CardDrag
                        id="discard-top"
                        data={{ source: 'discard', card: view.discardTop }}
                        disabled={!canDraw || view.paused}
                        className="block"
                      >
                        <PlayingCard
                          card={view.discardTop}
                          className="h-[76px] w-[52px] sm:h-24 sm:w-[66px]"
                          onClick={
                            canDraw
                              ? () =>
                                  drawByClick(
                                    { type: 'takeDiscard' },
                                    '[data-discard-origin]',
                                    view.discardTop,
                                  )
                              : undefined
                          }
                        />
                      </CardDrag>
                    </span>
                  ) : (
                    <span className="flex h-[76px] w-[52px] items-center justify-center rounded-md border border-dashed border-white/40 text-xs text-white/60 sm:h-24 sm:w-[66px]">
                      Empty
                    </span>
                  )}
                </DropZone>
              </PileSlot>
            </div>
          </div>

          <OwnArea
            me={me}
            view={view}
            handCards={displayHand}
            selectedCardIds={selectedCardIds}
            stagedMelds={stagedMelds}
            cardById={cardById}
            activeDrag={activeDrag}
            handDropTarget={handDropTarget}
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
              <PlayingCard
                card={activeDrag.card}
                // A lifted hand card keeps the size it has in the hand;
                // the discard top and staged cards are smaller, so they
                // stay on the default
                className={
                  activeDrag.source === 'hand' ? 'h-36 w-[99px]' : undefined
                }
              />
            </span>
          )}
        </DragOverlay>
      </DndContext>

      {(view.phase === 'finished' ||
        (view.phase === 'roundEnd' && !dealing)) && (
        <RoundEndOverlay
          view={view}
          currentUserId={currentUser.id}
          onBuyIn={act}
          secondsToDeal={secondsToDeal}
        />
      )}

      {(dealing || localIntroUntil !== null) && (
        <RoundIntro
          key={view.roundNumber}
          seatUserIds={dealOrder}
          durationMs={ROUND_INTRO_MS}
          shuffleMs={SHUFFLE_MS}
        />
      )}

      {flight && (
        <CardFlight
          key={flight.id}
          card={flight.card}
          path={flight.path}
          onDone={clearFlight}
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
  onOpenMenu: () => void
  onToggleChat: () => void
}

function TableHeader({ view, onOpenMenu, onToggleChat }: TableHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-panel px-4 py-2">
      <p className="m-0 text-sm font-semibold">
        Kalooki · Round {view.roundNumber} ·{' '}
        <span className="text-muted-foreground hidden sm:inline ">
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
          onClick={onOpenMenu}
          aria-label="Open the game menu"
        >
          <Menu aria-hidden="true" className="size-4" />
          Menu
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

interface BuyInClockProps {
  deadline: number | null
}

/**
 * Time left to answer a buy-in. Only public matches set a deadline, so
 * this renders nothing in private and practice games, where the table
 * waits as long as the decision takes.
 */
function BuyInClock({ deadline }: BuyInClockProps) {
  const [, retick] = useReducer((count: number) => count + 1, 0)
  useEffect(() => {
    if (deadline === null) {
      return
    }
    const interval = setInterval(retick, 250)
    return () => clearInterval(interval)
  }, [deadline])

  if (deadline === null) {
    return null
  }
  const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
  return (
    <p
      className={cn(
        'm-0 mt-2 text-sm font-medium tabular-nums',
        seconds <= 5 ? 'text-destructive-foreground' : 'text-muted-foreground',
      )}
    >
      {seconds}s to decide, or you are out
    </p>
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
      // Where the deal animation flies this player's cards to. Your own
      // seat opts out: your cards fly to your hand row instead
      data-deal-target={isSelf ? undefined : player.userId}
      className={cn(
        // Tighter padding/gap on mobile so two opponent seats fit a row
        'flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1.5 transition-all sm:gap-2 sm:px-3 sm:py-2',
        isCurrent ? 'border-ring ring-2 ring-ring' : 'border-border opacity-60',
        isCurrent && flash && 'turn-pulse',
        player.eliminated && 'opacity-50',
      )}
    >
      <UserAvatar user={player} className="size-7 sm:size-8" />
      <div className="text-xs">
        <p className="m-0 font-semibold">
          {/* Name in the player's chosen colour, matching how it reads in
              chat, falling back to the deterministic hashed colour */}
          <span
            style={{
              color: chatNameColor(
                player.chatColor ?? usernameColor(player.username),
              ),
            }}
          >
            {isSelf ? 'You' : player.username}
          </span>
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
  /** Where in the hand the drag would land, or null when it is elsewhere. */
  handDropTarget: HandDropTarget | null
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
  handDropTarget,
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
  const isCompact = useIsCompactViewport()
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

  // Everything from the hovered slot rightwards slides over, so the gap
  // the card would land in opens where it can be seen rather than under
  // the card being dragged. -1 while the drag is away from the hand.
  const dropIndex =
    handDropTarget === null
      ? -1
      : handDropTarget.beforeCardId === null
        ? visibleHand.length
        : visibleHand.findIndex(
            (card) => card.id === handDropTarget.beforeCardId,
          )

  return (
    <div className="rounded-lg border border-border bg-card px-3 pb-3 pt-0 sm:pt-3">
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
        <div
          // Your dealt cards fly here, not to your seat chip, which is
          // hidden on mobile
          data-deal-target={me?.userId}
          className="flex min-h-36 items-center justify-center py-1"
        >
          {/* No wrapping: each card is a shrinkable flex cell, so a big
              hand compresses the cards instead of spilling onto a
              second row. min-w-0 lets the row squeeze past the cards'
              own widths on narrow screens. */}
          <div className="flex min-w-0 items-center [&>*:not(:first-child)]:-ml-[49.5px]">
            {visibleHand.map((card, index) => (
              // Each card is also a slot a dragged card can take, so a
              // hand can be arranged by hand rather than only sorted
              <DropZone
                key={card.id}
                id={`hand-slot-${card.id}`}
                data={{ target: 'handSlot', beforeCardId: card.id }}
                disabled={!cardDragActive}
                className={cn(
                  'block min-w-12 basis-[99px] transition-transform',
                  dropIndex !== -1 && index >= dropIndex && 'translate-x-6',
                )}
              >
                {/* Never disabled: arranging is allowed off-turn too,
                    which is when there is time for it. Every other drop
                    target stays shut until it is your go, so an off-turn
                    drag can only land back in the hand. */}
                <CardDrag
                  id={`hand-card-${card.id}`}
                  data={{ source: 'hand', card }}
                  className="block w-full"
                >
                  <PlayingCard
                    card={card}
                    fluid
                    selected={selectedCardIds.includes(card.id)}
                    // Drag-only on mobile: dropping the tap handler keeps a
                    // quick touch from competing with the drag gesture
                    onClick={
                      isCompact ? undefined : () => onToggleCard(card.id)
                    }
                  />
                </CardDrag>
              </DropZone>
            ))}
          </div>
          {/* The end of the hand: where a dragged card goes to sit last,
              and the point a clicked draw flies to. Always laid out so
              the hand does not shift when a drag starts. */}
          <span data-hand-landing="" className="shrink-0 pl-1">
            <DropZone
              id="hand-slot-end"
              data={{ target: 'handSlot', beforeCardId: null }}
              disabled={!cardDragActive}
              className={cn(
                'block h-24 w-5 rounded border-2 border-dashed border-ring/60 transition-opacity',
                cardDragActive ? 'opacity-100' : 'opacity-0',
              )}
              overClassName="border-ring bg-ring/20"
            />
          </span>
        </div>
      </DropZone>

      {/* Own seat on its own row on mobile, then the move buttons; the
          whole bar collapses back to a single inline row from sm up */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {me && (
          // Your own seat is redundant on mobile (your hand is right
          // there), so it only shows from sm up to save vertical space
          <div className="hidden items-center gap-2 sm:flex">
            <PlayerSeat
              player={me}
              view={view}
              isCurrent={isMyTurn}
              isNext={isNext}
              isSelf
              flash={turnFlash}
            />
            {(view.rules.stakes || me.hasComeDown) && (
              <p className="m-0 text-xs text-muted-foreground">
                {view.rules.stakes ? `chips: ${formatChips(me.chips)}` : ''}
                {me.hasComeDown ? ' · down' : ''}
              </p>
            )}
          </div>
        )}

        {/* Move controls tile as a 2-column grid on mobile so the four
            buttons stay full-width and tappable, and flow back into an
            inline row from sm up */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1 sm:flex-wrap sm:items-center">
          {/* Stage/discard are drag-only on mobile: the buttons show
              from sm up, below that you drag cards to the tray or the
              discard pile */}
          <Button
            size="sm"
            className="hidden sm:inline-flex"
            disabled={!acting || unstagedSelected.length < 3}
            title="Move the selected cards into the sets tray"
            onClick={onStage}
          >
            Stage set ({unstagedSelected.length})
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="hidden sm:inline-flex"
            disabled={!acting || unstagedSelected.length !== 1}
            onClick={onDiscard}
          >
            Discard selected
          </Button>
          {view.you.pendingDiscardCardId !== null && (
            <Button
              size="sm"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={onReturnDiscard}
            >
              Return taken discard
            </Button>
          )}
          {view.you.pendingJokerCardId !== null && (
            <Button
              size="sm"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={onReturnJoker}
            >
              Return taken joker
            </Button>
          )}
          <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-auto sm:ml-auto sm:flex">
            <Button
              size="sm"
              variant={sortMode === 'rank' ? 'default' : 'secondary'}
              className="w-full sm:w-auto"
              title="Sort your hand from highest to lowest"
              onClick={() => onSort('rank')}
            >
              Sort: high–low
            </Button>
            <Button
              size="sm"
              variant={sortMode === 'suit' ? 'default' : 'secondary'}
              className="w-full sm:w-auto"
              title="Sort your hand by suit"
              onClick={() => onSort('suit')}
            >
              Sort: suit
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** A seat's username, or a stand-in for a player no longer listed. */
function playerNameOf(view: GameView, userId: number): string {
  return (
    view.players.find((player) => player.userId === userId)?.username ??
    `Player ${userId}`
  )
}

interface PlayerNameProps {
  view: GameView
  userId: number
}

/**
 * A player's name in their chosen chat colour, matching how it reads at
 * the seats, and falling back to the deterministic hashed colour.
 */
function PlayerName({ view, userId }: PlayerNameProps) {
  const player = view.players.find((seat) => seat.userId === userId)
  const username = playerNameOf(view, userId)
  return (
    <span
      style={{
        color: chatNameColor(player?.chatColor ?? usernameColor(username)),
      }}
    >
      {username}
    </span>
  )
}

interface GameMenuProps {
  view: GameView
  onQuit: () => void
  onClose: () => void
}

/**
 * The in-game menu: the scoresheet for the match so far, and the way
 * out. Quitting is irreversible, so it sits at the bottom behind a
 * confirmation rather than one tap from the table.
 */
function GameMenu({ view, onQuit, onClose }: GameMenuProps) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-full flex flex-col w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="m-0 text-xl font-bold">Scoresheet</h2>
            <p className="m-0 mt-1 text-sm text-muted-foreground">
              Round {view.roundNumber} · out over {view.rules.scoreLimit} points
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            aria-label="Close the menu"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>

        <GameScoresheet view={view} />

        <Button
          variant="destructive"
          className="mt-6 self-center"
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
          Quit the game
        </Button>
      </div>
    </div>
  )
}

interface GameScoresheetProps {
  view: GameView
}

/**
 * The match so far, laid out like a paper Kalooki sheet: a row per
 * player, a column per round scored, and the running total on the end.
 * Scrolls sideways on its own rather than widening the dialog, because
 * a long game runs to a lot of columns.
 */
function GameScoresheet({ view }: GameScoresheetProps) {
  const rounds = view.roundResults
  const stakes = view.rules.stakes

  if (rounds.length === 0) {
    return (
      <p className="mt-4 mb-0 text-sm text-muted-foreground">
        No rounds have been scored yet.
      </p>
    )
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 pr-3 font-medium">Player</th>
            {rounds.map((round) => (
              <th
                key={round.roundNumber}
                className="px-2 py-1 text-right font-medium"
              >
                R{round.roundNumber}
              </th>
            ))}
            <th className="pl-3 py-1 text-right font-medium">Total</th>
            {stakes && (
              <th className="pl-3 py-1 text-right font-medium">Chips</th>
            )}
          </tr>
        </thead>
        <tbody>
          {view.players.map((player) => (
            <tr key={player.userId} className="border-t border-border">
              <td className="py-1 pr-3 whitespace-nowrap">
                <PlayerName view={view} userId={player.userId} />
                {player.eliminated && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (out)
                  </span>
                )}
              </td>
              {rounds.map((round) => {
                // Anyone already out when the round was scored has no
                // entry at all, rather than a zero
                const scored = player.userId in round.penalties
                return (
                  <td
                    key={round.roundNumber}
                    className={cn(
                      'px-2 py-1 text-right tabular-nums',
                      round.winnerUserId === player.userId && 'font-semibold',
                    )}
                  >
                    {scored ? (
                      round.penalties[player.userId]
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </td>
                )
              })}
              <td className="pl-3 py-1 text-right font-semibold tabular-nums">
                {player.score}
              </td>
              {stakes && (
                <td className="pl-3 py-1 text-right tabular-nums">
                  {formatChips(player.chips)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Buy-ins reset a player onto the leader's score, so the columns
          deliberately do not add up to the total for those players */}
      {view.players.some((player) => player.buyInsUsed > 0) && (
        <p className="mt-2 mb-0 text-xs text-muted-foreground">
          Totals restart at the highest surviving score after a buy-in, so a
          bought-in row will not add up.
        </p>
      )}
    </div>
  )
}

interface RoundEndOverlayProps {
  view: GameView
  currentUserId: number
  onBuyIn: (action: GameAction) => Promise<void>
  /**
   * Seconds until the next round is dealt, or null when nothing is
   * scheduled (the game is over, the match is paused, or a buy-in is
   * still holding things up).
   */
  secondsToDeal: number | null
}

function RoundEndOverlay({
  view,
  currentUserId,
  onBuyIn,
  secondsToDeal,
}: RoundEndOverlayProps) {
  const { data: friends } = useQuery(friendsQueryOptions)
  const { data: friendRequests } = useQuery(friendRequestsQueryOptions)
  const [feedback, setFeedback] = useState<string | null>(null)

  // A match can finish before any round completes (e.g. a quit in
  // round 1), so there may be no result rows yet
  const latest: RoundResultView | undefined = view.roundResults.at(-1)
  const mustDecide = view.pendingBuyIns.includes(currentUserId)
  const finished = view.phase === 'finished'
  const winnerName = view.players.find(
    (player) => player.userId === view.winnerUserId,
  )?.username

  // No point offering a friend request to yourself, to a bot, or to
  // anyone already connected or mid-request in either direction
  const noRequestNeededIds = new Set<number>([
    currentUserId,
    ...(friends ?? []).map((friend) => friend.id),
    ...(friendRequests?.outgoing ?? []).map((request) => request.recipient.id),
    ...(friendRequests?.incoming ?? []).map((request) => request.sender.id),
  ])
  const canAddFriend = (player: GamePlayerView | undefined): boolean =>
    finished &&
    player !== undefined &&
    !player.isBot &&
    !noRequestNeededIds.has(player.userId)

  const stakes = view.rules.stakes
  const winnerChips = view.players.find(
    (player) => player.userId === view.winnerUserId,
  )?.chips

  const usernameOf = (userId: number) => playerNameOf(view, userId)
  const coloredName = (userId: number) => (
    <PlayerName view={view} userId={userId} />
  )

  // A round popup lists the players that round scored. The final
  // scoresheet lists everyone who played, so someone knocked out before
  // the last round is still there to be added as a friend.
  const rowUserIds = finished
    ? view.players.map((player) => player.userId)
    : Object.keys(latest?.totals ?? {}).map(Number)

  const roundTitle =
    latest && latest.winnerUserId !== null
      ? `${usernameOf(latest.winnerUserId)} won round ${latest.roundNumber}${
          latest.calledKalooki ? ' with a kalooki!' : ''
        }`
      : `Round ${latest?.roundNumber ?? view.roundNumber} finished`

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
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

        {/* Nothing to count down while a buy-in is outstanding: the
            prompt (or the note under it) explains the hold instead */}
        {!finished && view.pendingBuyIns.length === 0 && (
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            {view.paused
              ? 'Paused while a player reconnects'
              : secondsToDeal === null
                ? 'Waiting on the table'
                : secondsToDeal > 0
                  ? `Next round deals in ${secondsToDeal}s`
                  : 'Shuffling…'}
          </p>
        )}
        {rowUserIds.length > 0 && (
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
              {rowUserIds.map((userId) => {
                const player = view.players.find(
                  (seat) => seat.userId === userId,
                )
                // Undefined for a player eliminated before this round:
                // they scored nothing in it, but still hold a total
                const penalty = latest?.penalties[userId]
                const total = latest?.totals[userId] ?? player?.score ?? 0

                return (
                  <tr key={userId} className="border-t border-border">
                    <td className="py-1">
                      {coloredName(userId)}
                      {latest?.winnerUserId === userId && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {latest.calledKalooki ? '(kalooki!)' : '(called up)'}
                        </span>
                      )}
                      {canAddFriend(player) && player && (
                        <AddOpponentButton
                          username={player.username}
                          onDone={setFeedback}
                        />
                      )}
                    </td>
                    <td className="py-1">
                      {penalty === undefined ? (
                        <span className="text-muted-foreground">out</span>
                      ) : (
                        `+${penalty}`
                      )}
                    </td>
                    <td className="py-1">{total}</td>
                    {stakes && (
                      <td className="py-1">
                        {formatChips(latest?.chips[userId] ?? 0)}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {feedback && (
          <p className="mt-3 mb-0 text-xs text-muted-foreground">{feedback}</p>
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
                  {coloredName(player.userId)}: {formatChips(player.chips)}{' '}
                  chips
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
            {/* Only public matches put a clock on the decision, so
                strangers cannot stall everyone else's game */}
            <BuyInClock deadline={view.buyInDeadlineAt} />
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

        {finished && <FinishedActions view={view} />}
      </div>
    </div>
  )
}

interface AddOpponentButtonProps {
  username: string
  onDone: (message: string) => void
}

/**
 * Sends a friend request to someone you have just played, from the
 * final scoresheet. The outcome is reported back to the dialog rather
 * than shown inline, so the table keeps its shape either way. The
 * button disappears once the request lands, because the pending request
 * puts the player out of scope for another.
 */
function AddOpponentButton({ username, onDone }: AddOpponentButtonProps) {
  const sendFriendRequest = useSendFriendRequest()

  const send = async () => {
    try {
      await sendFriendRequest.mutateAsync(username)
      onDone(`Friend request sent to ${username}`)
    } catch (error) {
      onDone(error instanceof Error ? error.message : 'Something went wrong')
    }
  }

  return (
    <Button
      size="xs"
      variant="ghost"
      className="ml-1 align-middle"
      title={`Send ${username} a friend request`}
      aria-label={`Send ${username} a friend request`}
      disabled={sendFriendRequest.isPending}
      onClick={() => void send()}
    >
      <UserPlus aria-hidden="true" className="size-3.5" />
    </Button>
  )
}

interface FinishedActionsProps {
  view: GameView
}

/**
 * What to do next once the game is over, matched to the kind of match
 * just played: back into the public queue, another hand against the
 * same bots, or back to the group that hosted the private game. Without
 * these the highest point of interest in a session is spent on a link
 * to an empty lobby.
 */
function FinishedActions({ view }: FinishedActionsProps) {
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const botOpponents = view.players.filter((player) => player.isBot).length

  /** Deals a fresh practice match on the setup just played. */
  const playAgain = async () => {
    setError(null)
    setStarting(true)
    try {
      const { matchId } = await startPracticeMatch(
        view.botDifficulty ?? 'medium',
        botOpponents,
      )
      void navigate({ to: '/game/$matchId', params: { matchId } })
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : 'Something went wrong',
      )
      setStarting(false)
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {view.kind === 'public' && (
          <Button asChild>
            <Link to="/play" search={{ queue: true }}>
              Find another match
            </Link>
          </Button>
        )}
        {view.kind === 'practice' && botOpponents > 0 && (
          <Button disabled={starting} onClick={() => void playAgain()}>
            {starting ? 'Dealing…' : 'Play again'}
          </Button>
        )}
        {view.kind === 'private' && view.groupId !== null && (
          <Button asChild>
            <Link to="/play" search={{ group: view.groupId }}>
              Back to the group
            </Link>
          </Button>
        )}
        <Button asChild variant="secondary">
          <Link to="/play">Back to the lobby</Link>
        </Button>
      </div>
      {error && (
        <p className="mt-2 mb-0 text-xs text-destructive-foreground">{error}</p>
      )}
    </div>
  )
}
