import { useQuery } from '@tanstack/react-query'
import {
  friendRequestsQueryOptions,
  friendsQueryOptions,
  useAcceptFriendRequest,
  useDeleteFriendRequest,
  useRemoveFriend,
} from '#/lib/social'
import UserAvatar from '#/components/UserAvatar'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import type { PublicUser } from '#/lib/social'

interface FriendsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface UserRowProps {
  user: PublicUser
  children: React.ReactNode
}

/**
 * One row in the friends dialog: avatar, username, and actions.
 */
function UserRow({ user, children }: UserRowProps) {
  return (
    <li className="flex items-center justify-between gap-2 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <UserAvatar user={user} />
        <span className="truncate text-sm font-medium">{user.username}</span>
      </span>
      <span className="flex shrink-0 gap-2">{children}</span>
    </li>
  )
}

/**
 * Friends list with pending incoming and outgoing requests
 * (docs/Frontend-design.md: the friends list is a popup modal).
 */
export default function FriendsDialog({
  open,
  onOpenChange,
}: FriendsDialogProps) {
  const friends = useQuery(friendsQueryOptions)
  const requests = useQuery(friendRequestsQueryOptions)
  const acceptRequest = useAcceptFriendRequest()
  const deleteRequest = useDeleteFriendRequest()
  const removeFriend = useRemoveFriend()

  const incoming = requests.data?.incoming ?? []
  const outgoing = requests.data?.outgoing ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Friends</DialogTitle>
          <DialogDescription>
            Your friends and pending requests. Friends can be invited to your
            groups.
          </DialogDescription>
        </DialogHeader>

        {incoming.length > 0 && (
          <section>
            <h3 className="m-0 text-sm font-semibold text-muted-foreground">
              Incoming requests
            </h3>
            <ul className="m-0 list-none divide-y divide-border p-0">
              {incoming.map((request) => (
                <UserRow key={request.id} user={request.sender}>
                  <Button
                    size="sm"
                    disabled={acceptRequest.isPending}
                    onClick={() => acceptRequest.mutate(request.id)}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={deleteRequest.isPending}
                    onClick={() => deleteRequest.mutate(request.id)}
                  >
                    Decline
                  </Button>
                </UserRow>
              ))}
            </ul>
          </section>
        )}

        {outgoing.length > 0 && (
          <section>
            <h3 className="m-0 text-sm font-semibold text-muted-foreground">
              Sent requests
            </h3>
            <ul className="m-0 list-none divide-y divide-border p-0">
              {outgoing.map((request) => (
                <UserRow key={request.id} user={request.recipient}>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={deleteRequest.isPending}
                    onClick={() => deleteRequest.mutate(request.id)}
                  >
                    Cancel
                  </Button>
                </UserRow>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="m-0 text-sm font-semibold text-muted-foreground">
            Your friends {friends.data ? `(${friends.data.length})` : ''}
          </h3>
          {friends.data && friends.data.length === 0 ? (
            <p className="my-2 text-sm text-muted-foreground">
              No friends yet — send a request by username to get started.
            </p>
          ) : (
            <ul className="m-0 list-none divide-y divide-border p-0">
              {(friends.data ?? []).map((friend) => (
                <UserRow key={friend.id} user={friend}>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={removeFriend.isPending}
                    onClick={() => removeFriend.mutate(friend.id)}
                  >
                    Remove
                  </Button>
                </UserRow>
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}
