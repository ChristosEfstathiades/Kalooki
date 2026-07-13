import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Clock, Trophy, Users, UsersRound } from 'lucide-react'
import {
  friendRequestsQueryOptions,
  groupInvitesQueryOptions,
} from '#/lib/social'
import { joinPublicQueue, leavePublicQueue } from '#/lib/game'
import { getSocket } from '#/lib/socket'
import FriendsDialog from '#/components/social/FriendsDialog'
import GroupsDialog from '#/components/social/GroupsDialog'
import ChatSidebar from '#/components/chat/ChatSidebar'
import NewsCard from '#/components/NewsCard'
import { Button } from '#/components/ui/button'
import type { QueueStatus } from '#/lib/game'

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
  const [openDialog, setOpenDialog] = useState<
    'friends' | 'groups' | null
  >(null)
  const requests = useQuery(friendRequestsQueryOptions)
  const invites = useQuery(groupInvitesQueryOptions)

  const incomingRequestCount = requests.data?.incoming.length ?? 0
  const inviteCount = invites.data?.length ?? 0

  return (
    <div className="page-wrap grid gap-6 py-8 lg:grid-cols-[1fr_320px]">
      <section className="space-y-6">
        <MatchmakingCard />

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

  useEffect(() => {
    const socket = getSocket()
    const onStatus = (nextStatus: QueueStatus) => setStatus(nextStatus)
    socket.on('queue:status', onStatus)
    return () => {
      socket.off('queue:status', onStatus)
      // Leaving the page also leaves the queue
      void leavePublicQueue().catch(() => {})
    }
  }, [])

  const inQueue = status?.inQueue ?? false

  const toggleQueue = async () => {
    setError(null)
    try {
      setStatus(inQueue ? await leavePublicQueue() : await joinPublicQueue())
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
          {status.startsInMs !== null
            ? ' — starting shortly, more can still join'
            : ' — the game starts when at least one more player queues'}
        </p>
      )}
      {error && (
        <p className="mt-2 mb-0 text-xs text-destructive-foreground">{error}</p>
      )}
    </div>
  )
}
