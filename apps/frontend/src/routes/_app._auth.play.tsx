import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Bot, Clock, Trophy, Users, UsersRound } from 'lucide-react'
import {
  friendRequestsQueryOptions,
  groupInvitesQueryOptions,
} from '#/lib/social'
import {
  joinPublicQueue,
  leavePublicQueue,
  startPracticeMatch,
} from '#/lib/game'
import { getSocket } from '#/lib/socket'
import FriendsDialog from '#/components/social/FriendsDialog'
import GroupsDialog from '#/components/social/GroupsDialog'
import ChatSidebar from '#/components/chat/ChatSidebar'
import NewsCard from '#/components/NewsCard'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import type { BotDifficulty, QueueStatus } from '#/lib/game'

export const Route = createFileRoute('/_app/_auth/play')({
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

  const incomingRequestCount = requests.data?.incoming.length ?? 0
  const inviteCount = invites.data?.length ?? 0

  return (
    <div className="page-wrap grid gap-6 py-8 lg:grid-cols-[1fr_320px]">
      <section className="space-y-6">
        <MatchmakingCard />
        <PracticeCard />

        <div className="grid gap-4 sm:grid-cols-2">
          <Button
            variant="secondary"
            className="justify-start"
            onClick={() => setOpenDialog('friends')}
          >
            <Users aria-hidden="true" />
            Friends
            <CountBadge count={incomingRequestCount} />
          </Button>
          <Button
            variant="secondary"
            className="justify-start"
            onClick={() => setOpenDialog('groups')}
          >
            <UsersRound aria-hidden="true" />
            Groups
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
        onOpenChange={(open) => setOpenDialog(open ? 'groups' : null)}
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

  const toggleQueue = async () => {
    setError(null)
    try {
      applyStatus(inQueue ? await leavePublicQueue() : await joinPublicQueue())
    } catch (queueError) {
      setError(
        queueError instanceof Error
          ? queueError.message
          : 'Something went wrong',
      )
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h1 className="m-0 text-2xl font-bold">Play Kalooki</h1>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Public matches use the classic ruleset. Private matches with custom
        rules start from your groups.
      </p>
      <Button
        size="lg"
        className={
          inQueue
            ? undefined
            : 'w-full bg-button-red hover:bg-button-red-hover sm:w-auto'
        }
        variant={inQueue ? 'secondary' : 'default'}
        onClick={() => void toggleQueue()}
      >
        {inQueue ? 'Leave queue' : 'Find public match'}
      </Button>
      {inQueue && status && (
        <p className="mt-2 mb-0 text-xs text-muted-foreground">
          {status.queueSize} {status.queueSize === 1 ? 'player' : 'players'}{' '}
          waiting
          {secondsLeft !== null
            ? `, starting in ${secondsLeft}s, more can still join`
            : ', the game starts once at least 3 players are here'}
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

const OPPONENT_OPTIONS = [1, 2, 3, 4]

/**
 * Practice mode: starts a solo match against bots on the classic
 * ruleset. Practice games appear in match history flagged as practice
 * and never count toward leaderboard stats.
 */
function PracticeCard() {
  const navigate = useNavigate()
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium')
  const [opponents, setOpponents] = useState(2)
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
          onSelect={setDifficulty}
        />
        <SegmentedButtons
          label="Opponents"
          options={OPPONENT_OPTIONS.map((count) => ({
            value: String(count),
            label: String(count),
          }))}
          active={String(opponents)}
          onSelect={(value) => setOpponents(Number(value))}
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
