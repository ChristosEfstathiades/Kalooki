import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MoreVertical } from 'lucide-react'
import { currentUserQueryOptions, extractApiErrors } from '#/lib/auth'
import {
  friendRequestsQueryOptions,
  friendsQueryOptions,
  groupsQueryOptions,
  useAcceptFriendRequest,
  useDeleteFriendRequest,
  useInviteToGroup,
  useRemoveFriend,
  useSendFriendRequest,
} from '#/lib/social'
import UserAvatar from '#/components/UserAvatar'
import FormErrors from '#/components/FormErrors'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import type { Group, PublicUser } from '#/lib/social'

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
  const { data: currentUser } = useQuery(currentUserQueryOptions)
  const friends = useQuery(friendsQueryOptions)
  const requests = useQuery(friendRequestsQueryOptions)
  const groups = useQuery(groupsQueryOptions)
  const acceptRequest = useAcceptFriendRequest()
  const deleteRequest = useDeleteFriendRequest()
  const removeFriend = useRemoveFriend()
  const inviteToGroup = useInviteToGroup()
  const sendRequest = useSendFriendRequest()

  const [inviteError, setInviteError] = useState<string[]>([])
  const [username, setUsername] = useState('')
  const [sendErrors, setSendErrors] = useState<string[]>([])
  const [sentTo, setSentTo] = useState<string | null>(null)

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault()
    setSendErrors([])
    setSentTo(null)
    try {
      const request = await sendRequest.mutateAsync(username.trim())
      setSentTo(request.recipient.username)
      setUsername('')
    } catch (error) {
      setSendErrors(extractApiErrors(error))
    }
  }

  const incoming = requests.data?.incoming ?? []
  const outgoing = requests.data?.outgoing ?? []
  const ownedGroups = (groups.data ?? []).filter(
    (group) => group.ownerId === currentUser?.id,
  )

  const submitInvite = async (group: Group, friend: PublicUser) => {
    setInviteError([])
    try {
      await inviteToGroup.mutateAsync({
        groupId: group.id,
        username: friend.username,
      })
    } catch (error) {
      setInviteError(extractApiErrors(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Friends</DialogTitle>
          <DialogDescription>
            Add friends, respond to requests, and invite friends to your groups.
          </DialogDescription>
        </DialogHeader>

        <section>
          <h3 className="m-0 text-sm font-semibold text-muted-foreground">
            Add a friend
          </h3>
          <form className="mt-2 space-y-2" onSubmit={submitRequest}>
            <FormErrors errors={sendErrors} />
            {sentTo && (
              <p className="m-0 rounded-md border border-felt bg-felt/20 px-3 py-2 text-sm">
                Friend request sent to {sentTo}.
              </p>
            )}
            <div className="flex gap-2">
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Exact username"
                aria-label="Username"
                autoComplete="off"
              />
              <Button
                type="submit"
                className="shrink-0"
                disabled={sendRequest.isPending || username.trim() === ''}
              >
                {sendRequest.isPending ? 'Sending…' : 'Send request'}
              </Button>
            </div>
          </form>
        </section>

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
          <FormErrors errors={inviteError} />
          {friends.data && friends.data.length === 0 ? (
            <p className="my-2 text-sm text-muted-foreground">
              No friends yet — send a request by username to get started.
            </p>
          ) : (
            <ul className="m-0 list-none divide-y divide-border p-0">
              {(friends.data ?? []).map((friend) => (
                <UserRow key={friend.id} user={friend}>
                  <FriendActionsMenu
                    friend={friend}
                    invitableGroups={ownedGroups.filter(
                      (group) => !group.memberIds.includes(friend.id),
                    )}
                    onInvite={(group) => submitInvite(group, friend)}
                    onRemove={() => removeFriend.mutate(friend.id)}
                  />
                </UserRow>
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}

interface FriendActionsMenuProps {
  friend: PublicUser
  invitableGroups: Group[]
  onInvite: (group: Group) => void
  onRemove: () => void
}

/**
 * Per-friend "..." menu: remove the friend, or invite them to a group
 * the current user owns that they aren't already a member of.
 */
function FriendActionsMenu({
  friend,
  invitableGroups,
  onInvite,
  onRemove,
}: FriendActionsMenuProps) {
  return (
    // Non-modal: this menu is nested inside a modal Dialog, and two
    // nested modal focus/pointer traps fight over outside-click
    // detection — the Dialog ends up closing whenever the dropdown does.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Actions for ${friend.username}`}
        >
          <MoreVertical aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {invitableGroups.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Invite to group</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {invitableGroups.map((group) => (
                <DropdownMenuItem
                  key={group.id}
                  onClick={() => onInvite(group)}
                >
                  {group.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuItem variant="destructive" onClick={onRemove}>
          Remove friend
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
