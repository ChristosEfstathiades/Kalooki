import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Bot,
  Clock,
  LoaderCircle,
  Trophy,
  Users,
  UsersRound,
} from 'lucide-react'
import {
  friendRequestsQueryOptions,
  friendsQueryOptions,
  groupInvitesQueryOptions,
  groupsQueryOptions,
} from '#/lib/social'
import {
  joinPublicQueue,
  leavePublicQueue,
  startPracticeMatch,
} from '#/lib/game'
import { getSocket } from '#/lib/socket'
import {
  storedNumber,
  storedObject,
  storedOption,
  useStoredState,
} from '#/lib/preferences'
import { useSiteFlags } from '#/lib/site'
import { seo } from '#/lib/seo'
import FriendsDialog from '#/components/social/FriendsDialog'
import GroupsDialog from '#/components/social/GroupsDialog'
import ChatSidebar from '#/components/chat/ChatSidebar'
import NewsCard from '#/components/NewsCard'
import RecordCard from '#/components/RecordCard'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import type { BotDifficulty, QueueStatus } from '#/lib/game'

interface PlaySearch {
  /**
   * Set when arriving straight from a finished public match, so the
   * player rejoins the queue without a second click.
   */
  queue?: boolean
  /**
   * Set when arriving from a finished private match, to reopen the
   * group that hosted it. Groups live in a dialog rather than on a
   * route of their own, so the link carries the id here.
   */
  group?: number
}

export const Route = createFileRoute('/_app/_auth/play')({
  head: () =>
    seo({
      title: 'Play',
      description:
        'Join the queue for a public Kalooki match, start a private game with friends, or practise against bots.',
      path: '/play',
      noindex: true,
    }),
  // Each key is omitted rather than given a falsy value when absent, so
  // every other link to the lobby stays a plain /play
  validateSearch: (search: Record<string, unknown>): PlaySearch => {
    const parsed: PlaySearch = {}
    if (search.queue === true || search.queue === 'true') {
      parsed.queue = true
    }
    const group = Number(search.group)
    if (Number.isInteger(group) && group > 0) {
      parsed.group = group
    }
    return parsed
  },
  component: PlayPage,
})

interface CountBadgeProps {
  count: number
}

/**
 * Small notification counter shown on a button when something is
 * waiting for the user.
 */
function CountBadge({ count }: CountBadgeProps) {
  if (count === 0) {
    return null
  }
  return (
    <span className="ml-auto rounded-full bg-button-red px-2 py-0.5 text-xs font-semibold text-white">
      {count}
    </span>
  )
}

/**
 * Appends the count to a social button's label, e.g. "Friends (5)". An
 * empty list reads as a plain label rather than "(0)".
 */
function labelWithCount(label: string, count: number): string {
  return count > 0 ? `${label} (${count})` : label
}

/**
 * Logged-in home: match actions and social shortcuts on the left, chat
 * sidebar with the news box below it on the right
 * (docs/Frontend-design.md).
 */
function PlayPage() {
  const [openDialog, setOpenDialog] = useState<'friends' | 'groups' | null>(
    null,
  )
  const requests = useQuery(friendRequestsQueryOptions)
  const invites = useQuery(groupInvitesQueryOptions)
  const friends = useQuery(friendsQueryOptions)
  const groups = useQuery(groupsQueryOptions)
  const flags = useSiteFlags()
  const navigate = useNavigate()
  const { group: groupToOpen } = Route.useSearch()
  const [initialGroupId, setInitialGroupId] = useState<number | null>(null)

  const incomingRequestCount = requests.data?.incoming.length ?? 0
  const inviteCount = invites.data?.length ?? 0
  const friendCount = friends.data?.length ?? 0
  const groupCount = groups.data?.length ?? 0

  // Returning from a private match: open that group straight away. The
  // id is dropped from the URL so closing and reopening the dialog
  // lands on the group list as usual.
  useEffect(() => {
    if (groupToOpen === undefined) {
      return
    }
    setInitialGroupId(groupToOpen)
    setOpenDialog('groups')
    void navigate({ to: '/play', search: {}, replace: true })
  }, [groupToOpen, navigate])

  return (
    <div className="page-wrap grid gap-6 py-8 lg:grid-cols-[1fr_320px]">
      <section className="space-y-6">
        <MatchmakingCard />
        {flags.practiceGamesEnabled && <PracticeCard />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Button
            variant="secondary"
            className="justify-start"
            onClick={() => setOpenDialog('friends')}
          >
            <Users aria-hidden="true" />
            {labelWithCount('Friends', friendCount)}
            <CountBadge count={incomingRequestCount} />
          </Button>
          <Button
            variant="secondary"
            className="justify-start"
            onClick={() => setOpenDialog('groups')}
          >
            <UsersRound aria-hidden="true" />
            {labelWithCount('Groups', groupCount)}
            <CountBadge count={inviteCount} />
          </Button>
          <Button asChild variant="secondary" className="justify-start">
            <Link to="/history">
              <Clock aria-hidden="true" />
              Match history
            </Link>
          </Button>
          <Button asChild variant="secondary" className="justify-start">
            <Link to="/leaderboard">
              <Trophy aria-hidden="true" />
              Leaderboard
            </Link>
          </Button>
        </div>

        <RecordCard />
      </section>

      <div className="space-y-6">
        <ChatSidebar />
        <NewsCard />
      </div>

      <FriendsDialog
        open={openDialog === 'friends'}
        onOpenChange={(open) => setOpenDialog(open ? 'friends' : null)}
      />
      <GroupsDialog
        open={openDialog === 'groups'}
        initialGroupId={initialGroupId}
        onOpenChange={(open) => {
          setOpenDialog(open ? 'groups' : null)
          if (!open) {
            setInitialGroupId(null)
          }
        }}
      />
    </div>
  )
}

/**
 * Public matchmaking: joins the classic-rules queue; the game:start
 * event (handled by the authed layout) opens the table when enough
 * players are in.
 */
function MatchmakingCard() {
  const [status, setStatus] = useState<QueueStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { publicMatchmakingEnabled } = useSiteFlags()
  const navigate = useNavigate()
  const { queue: requeueOnArrival } = Route.useSearch()
  // Epoch ms the match starts at, so the countdown ticks between updates
  const [startsAt, setStartsAt] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState<number>(Date.now())

  const applyStatus = (nextStatus: QueueStatus) => {
    setStatus(nextStatus)
    setNowMs(Date.now())
    setStartsAt(
      nextStatus.startsInMs !== null
        ? Date.now() + nextStatus.startsInMs
        : null,
    )
  }

  useEffect(() => {
    const socket = getSocket()
    const onStatus = (nextStatus: QueueStatus) => applyStatus(nextStatus)
    socket.on('queue:status', onStatus)
    return () => {
      socket.off('queue:status', onStatus)
      // Leaving the page also leaves the queue
      void leavePublicQueue().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (startsAt === null) {
      return
    }
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startsAt])

  const inQueue = status?.inQueue ?? false
  const secondsLeft =
    startsAt !== null ? Math.max(0, Math.ceil((startsAt - nowMs) / 1000)) : null

  /**
   * Joins or leaves the queue, surfacing the server's message when the
   * call is refused.
   */
  const runQueueAction = async (action: () => Promise<QueueStatus>) => {
    setError(null)
    try {
      applyStatus(await action())
    } catch (queueError) {
      setError(
        queueError instanceof Error
          ? queueError.message
          : 'Something went wrong',
      )
    }
  }

  // Arriving straight from a finished public match. The flag is dropped
  // from the URL first, so refreshing the lobby does not queue again.
  useEffect(() => {
    if (requeueOnArrival !== true || !publicMatchmakingEnabled) {
      return
    }
    void navigate({ to: '/play', search: {}, replace: true })
    void runQueueAction(joinPublicQueue)
  }, [requeueOnArrival, publicMatchmakingEnabled, navigate])

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h1 className="m-0 text-2xl font-bold">Play Kalooki</h1>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Public matches use the classic ruleset. Private matches with custom
        rules start from your groups.
      </p>
      {inQueue ? (
        <div className="flex flex-wrap items-center gap-3">
          <span
            role="status"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-secondary px-6 text-sm font-medium text-secondary-foreground"
          >
            Searching
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void runQueueAction(leavePublicQueue)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          size="lg"
          className="w-full bg-button-red hover:bg-button-red-hover sm:w-auto"
          disabled={!publicMatchmakingEnabled}
          onClick={() => void runQueueAction(joinPublicQueue)}
        >
          Find public match
        </Button>
      )}
      {!publicMatchmakingEnabled && (
        <p className="mt-2 mb-0 text-xs text-muted-foreground">
          Public matchmaking is paused right now. Private games with your groups
          are unaffected.
        </p>
      )}
      {inQueue && secondsLeft !== null && (
        <p className="mt-2 mb-0 text-xs text-muted-foreground">
          Starting in {secondsLeft}s, more can still join
        </p>
      )}
      {error && (
        <p className="mt-2 mb-0 text-xs text-destructive-foreground">{error}</p>
      )}
    </div>
  )
}

const DIFFICULTY_OPTIONS: { value: BotDifficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

const DIFFICULTY_VALUES = DIFFICULTY_OPTIONS.map((option) => option.value)

const OPPONENT_OPTIONS = [1, 2, 3, 4]

const PRACTICE_SETUP_KEY = 'practice-setup'

interface PracticeSetup {
  difficulty: BotDifficulty
  opponents: number
}

const DEFAULT_PRACTICE_SETUP: PracticeSetup = {
  difficulty: 'medium',
  opponents: 2,
}

/** Validates the remembered practice setup against the options on offer. */
function parsePracticeSetup(stored: unknown): PracticeSetup | null {
  const setup = storedObject(stored)
  if (setup === null) {
    return null
  }
  return {
    difficulty: storedOption(
      setup.difficulty,
      DIFFICULTY_VALUES,
      DEFAULT_PRACTICE_SETUP.difficulty,
    ),
    opponents: storedNumber(
      setup.opponents,
      OPPONENT_OPTIONS[0],
      OPPONENT_OPTIONS[OPPONENT_OPTIONS.length - 1],
      DEFAULT_PRACTICE_SETUP.opponents,
    ),
  }
}

/**
 * Practice mode: starts a solo match against bots on the classic
 * ruleset. Practice games appear in match history flagged as practice
 * and never count toward leaderboard stats. The difficulty and opponent
 * count carry over to the next visit.
 */
function PracticeCard() {
  const navigate = useNavigate()
  const [setup, setSetup] = useStoredState(
    PRACTICE_SETUP_KEY,
    DEFAULT_PRACTICE_SETUP,
    parsePracticeSetup,
  )
  const { difficulty, opponents } = setup
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    setError(null)
    setStarting(true)
    try {
      const { matchId } = await startPracticeMatch(difficulty, opponents)
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
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="m-0 flex items-center gap-2 text-xl font-bold">
        <Bot aria-hidden="true" className="size-5" />
        Play vs computer
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Practice games never count toward the leaderboard.
      </p>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <SegmentedButtons
          label="Difficulty"
          options={DIFFICULTY_OPTIONS}
          active={difficulty}
          onSelect={(value) =>
            setSetup((current) => ({ ...current, difficulty: value }))
          }
        />
        <SegmentedButtons
          label="Opponents"
          options={OPPONENT_OPTIONS.map((count) => ({
            value: String(count),
            label: String(count),
          }))}
          active={String(opponents)}
          onSelect={(value) =>
            setSetup((current) => ({ ...current, opponents: Number(value) }))
          }
        />
      </div>

      <Button
        size="lg"
        className="mt-4 w-full sm:w-auto"
        disabled={starting}
        onClick={() => void start()}
      >
        {starting ? 'Starting…' : 'Start practice game'}
      </Button>
      {error && (
        <p className="mt-2 mb-0 text-xs text-destructive-foreground">{error}</p>
      )}
    </div>
  )
}

interface SegmentedButtonsProps<TValue extends string> {
  label: string
  options: { value: TValue; label: string }[]
  active: TValue
  onSelect: (value: TValue) => void
}

/**
 * A labelled row of mutually exclusive small buttons (radio-style).
 */
function SegmentedButtons<TValue extends string>({
  label,
  options,
  active,
  onSelect,
}: SegmentedButtonsProps<TValue>) {
  return (
    <div
      className="flex items-center gap-2"
      role="radiogroup"
      aria-label={label}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          role="radio"
          size="sm"
          aria-checked={active === option.value}
          variant={active === option.value ? 'default' : 'secondary'}
          className={cn(
            active === option.value &&
              'bg-button-purple hover:bg-button-purple-hover',
          )}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
