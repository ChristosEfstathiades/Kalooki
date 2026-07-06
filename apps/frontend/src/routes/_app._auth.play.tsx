import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Clock, UserPlus, Users, UsersRound } from 'lucide-react'
import {
  friendRequestsQueryOptions,
  groupInvitesQueryOptions,
} from '#/lib/social'
import SendFriendRequestDialog from '#/components/social/SendFriendRequestDialog'
import FriendsDialog from '#/components/social/FriendsDialog'
import GroupsDialog from '#/components/social/GroupsDialog'
import ChatSidebar from '#/components/chat/ChatSidebar'
import { Button } from '#/components/ui/button'

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
 * sidebar on the right (docs/Frontend-design.md).
 */
function PlayPage() {
  const [openDialog, setOpenDialog] = useState<
    'sendRequest' | 'friends' | 'groups' | null
  >(null)
  const requests = useQuery(friendRequestsQueryOptions)
  const invites = useQuery(groupInvitesQueryOptions)

  const incomingRequestCount = requests.data?.incoming.length ?? 0
  const inviteCount = invites.data?.length ?? 0

  return (
    <div className="page-wrap grid gap-6 py-8 lg:grid-cols-[1fr_320px]">
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="m-0 text-2xl font-bold">Play Kalooki</h1>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Public matches use the classic ruleset. Private matches with custom
            rules start from your groups.
          </p>
          <Button
            size="lg"
            className="w-full bg-button-red hover:bg-button-red-hover sm:w-auto"
            disabled
            title="Matchmaking opens when the game engine lands"
          >
            Find public match
          </Button>
          <p className="mt-2 mb-0 text-xs text-muted-foreground">
            Matchmaking is not open yet — it arrives with the game engine.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Button
            variant="secondary"
            className="justify-start"
            onClick={() => setOpenDialog('sendRequest')}
          >
            <UserPlus aria-hidden="true" />
            Send friend request
          </Button>
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
          <Button
            variant="secondary"
            className="justify-start"
            disabled
            title="Coming soon"
          >
            <Clock aria-hidden="true" />
            Match history
          </Button>
        </div>
      </section>

      <ChatSidebar />

      <SendFriendRequestDialog
        open={openDialog === 'sendRequest'}
        onOpenChange={(open) => setOpenDialog(open ? 'sendRequest' : null)}
      />
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
