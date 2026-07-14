import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { currentUserQueryOptions } from '#/lib/auth'
import { getStoredToken } from '#/lib/auth-token'
import { getSocket } from '#/lib/socket'
import { fetchGameView, formatChips, sendGameAction } from '#/lib/game'
import PlayingCard, { CardBack } from '#/components/game/PlayingCard'
import MatchChatPanel from '#/components/chat/MatchChatPanel'
import UserAvatar from '#/components/UserAvatar'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
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
 * The live Kalooki table: opponents around the top of the felt, sets
 * and piles in the middle, your hand and actions at the bottom
 * (docs/Frontend-design.md). No header or footer on this page.
 */
function GamePage() {
  const { matchId } = Route.useParams()
  const { data: currentUser } = useQuery(currentUserQueryOptions)
  const [view, setView] = useState<GameView | null>(null)
  const [lastEvent, setLastEvent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>([])
  const [stagedMelds, setStagedMelds] = useState<number[][]>([])
  const [chatOpen, setChatOpen] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode | null>(null)
  const [handOrder, setHandOrder] = useState<HandOrder>({ base: [], fresh: [] })
  const [roundPopupOpen, setRoundPopupOpen] = useState(false)
  const seenResultsRef = useRef<number | null>(null)

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
        setLastEvent(payload.event)
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
        setSelectedCardIds([])
        setStagedMelds([])
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
  const opponents = view.players.filter(
    (player) => player.userId !== currentUser.id,
  )
  const isMyTurn = view.currentPlayerUserId === currentUser.id
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

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <TableHeader
        view={view}
        onQuit={() => void act({ type: 'quit' })}
        onToggleChat={() => setChatOpen((open) => !open)}
      />

      {chatOpen && (
        <MatchChatPanel
          matchId={matchId}
          finished={view.phase === 'finished'}
          onClose={() => setChatOpen(false)}
        />
      )}

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 p-3">
        <div className="flex flex-wrap justify-center gap-3">
          {opponents.map((player) => (
            <OpponentSeat key={player.userId} player={player} view={view} />
          ))}
        </div>

        <div className="relative flex flex-1 flex-col gap-4 rounded-xl bg-felt p-4 shadow-inner">
          {view.paused && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/60">
              <p className="m-0 text-lg font-semibold text-white">
                Game paused — waiting for a player to reconnect
              </p>
            </div>
          )}

          <div className="flex items-start justify-center gap-8">
            <div className="text-center">
              <button
                type="button"
                className="appearance-none border-0 bg-transparent p-0"
                onClick={() => void act({ type: 'draw' })}
                disabled={!isMyTurn || view.phase !== 'awaitingDraw'}
                title="Draw from the deck"
              >
                <CardBack />
              </button>
              <p className="m-0 mt-1 text-xs text-white/80">
                Deck · {view.deckCount}
              </p>
            </div>
            <div className="text-center">
              {view.discardTop ? (
                <PlayingCard
                  card={view.discardTop}
                  onClick={
                    isMyTurn && view.phase === 'awaitingDraw'
                      ? () => void act({ type: 'takeDiscard' })
                      : undefined
                  }
                />
              ) : (
                <span className="flex h-24 w-[66px] items-center justify-center rounded-md border border-dashed border-white/40 text-xs text-white/60">
                  Empty
                </span>
              )}
              <p className="m-0 mt-1 text-xs text-white/80">
                Discard · {view.discardCount}
              </p>
            </div>
          </div>

          <MeldsArea
            view={view}
            selectedCardIds={unstagedSelected}
            cardById={cardById}
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
          isMyTurn={isMyTurn}
          error={error}
          lastEvent={lastEvent}
          sortMode={sortMode}
          onSort={applySort}
          onToggleCard={toggleCard}
          onStage={stageSelected}
          onClearStaged={() => {
            setStagedMelds([])
            setSelectedCardIds([])
          }}
          onLayStaged={() => void act({ type: 'layMelds', melds: stagedMelds })}
          onDiscard={() =>
            unstagedSelected.length === 1 &&
            void act({ type: 'discard', cardId: unstagedSelected[0] })
          }
          onReturnDiscard={() => void act({ type: 'returnDiscard' })}
          onReturnJoker={() => void act({ type: 'returnJoker' })}
        />
      </section>

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
        <TurnClock deadline={view.turnDeadlineAt} paused={view.paused} />
        <Button size="sm" variant="secondary" onClick={onToggleChat}>
          Chat
        </Button>
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
 * Remaining move time for the current turn, ticking every second.
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

interface OpponentSeatProps {
  player: GamePlayerView
  view: GameView
}

function OpponentSeat({ player, view }: OpponentSeatProps) {
  const isTurn = view.currentPlayerUserId === player.userId
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-card px-3 py-2',
        isTurn ? 'border-ring' : 'border-border',
        player.eliminated && 'opacity-50',
      )}
    >
      <UserAvatar user={player} />
      <div className="text-xs">
        <p className="m-0 font-semibold">
          {player.username}
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
    </div>
  )
}

interface MeldsAreaProps {
  view: GameView
  selectedCardIds: number[]
  cardById: (cardId: number) => GameCard | undefined
  onGoer: (meldId: number, cardId: number, runEnd: 'low' | 'high') => void
  onTakeJoker: (meldId: number, jokerCardId: number) => void
}

function MeldsArea({
  view,
  selectedCardIds,
  cardById,
  onGoer,
  onTakeJoker,
}: MeldsAreaProps) {
  const singleSelected =
    selectedCardIds.length === 1 ? cardById(selectedCardIds[0]) : undefined

  if (view.melds.length === 0) {
    return (
      <p className="m-0 text-center text-sm text-white/60">
        No sets on the table yet — first to {view.rules.comeDownThreshold}{' '}
        points comes down.
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
          onGoer={onGoer}
          onTakeJoker={onTakeJoker}
        />
      ))}
    </div>
  )
}

interface MeldGroupProps {
  meld: MeldView
  singleSelected: GameCard | undefined
  hasReplacementsSelected: boolean
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
  onGoer,
  onTakeJoker,
}: MeldGroupProps) {
  return (
    <div className="rounded-md bg-white/90 px-2 py-1 shadow-sm">
      <div className="flex items-center gap-2">
        {meld.cards.map((meldCard) => (
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
        ))}
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
  isMyTurn: boolean
  error: string | null
  lastEvent: string | null
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
  isMyTurn,
  error,
  lastEvent,
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
  const acting = isMyTurn && view.phase === 'acting'

  const statusText = view.paused
    ? 'Paused'
    : isMyTurn
      ? view.phase === 'awaitingDraw'
        ? 'Your turn — draw from the deck or take the discard'
        : 'Lay sets, add go-ers, then discard to end your turn'
      : `Waiting for ${
          view.players.find(
            (player) => player.userId === view.currentPlayerUserId,
          )?.username ?? 'the next round'
        }`

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-sm font-medium">{statusText}</p>
        <p className="m-0 text-xs text-muted-foreground">
          {me ? `Your score: ${me.score}` : ''}
          {me && view.rules.stakes ? ` · chips: ${formatChips(me.chips)}` : ''}
          {me?.hasComeDown ? ' · down' : ''}
          {lastEvent ? ` · ${lastEvent}` : ''}
        </p>
      </div>

      {error && (
        <p className="mt-2 mb-0 rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1 text-xs text-destructive-foreground">
          {error}
        </p>
      )}

      {stagedMelds.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-muted p-2">
          <span className="text-xs text-muted-foreground">Staged sets:</span>
          {stagedMelds.map((meld, index) => (
            <span key={index} className="flex gap-0.5">
              {meld.map((cardId) => {
                const card = handCards.find(
                  (candidate) => candidate.id === cardId,
                )
                return card ? (
                  <PlayingCard key={cardId} card={card} small />
                ) : null
              })}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap [&>*:not(:first-child)]:-ml-5">
        {handCards.map((card) => (
          <PlayingCard
            key={card.id}
            card={card}
            selected={
              selectedCardIds.includes(card.id) || stagedIds.includes(card.id)
            }
            onClick={() => onToggleCard(card.id)}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!acting || unstagedSelected.length < 3}
          onClick={onStage}
        >
          Stage set ({unstagedSelected.length})
        </Button>
        <Button
          size="sm"
          className="bg-button-red hover:bg-button-red-hover"
          disabled={!acting || stagedMelds.length === 0}
          onClick={onLayStaged}
        >
          Lay down staged sets
        </Button>
        {stagedMelds.length > 0 && (
          <Button size="sm" variant="secondary" onClick={onClearStaged}>
            Clear staged
          </Button>
        )}
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
