import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { currentUserQueryOptions, extractApiErrors } from '#/lib/auth'
import {
  groupDetailQueryOptions,
  groupInvitesQueryOptions,
  groupsQueryOptions,
  useAcceptGroupInvite,
  useCreateGroup,
  useDeleteGroup,
  useDeleteGroupInvite,
  useInviteToGroup,
  useRemoveGroupMember,
  useTransferOwnership,
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

interface GroupsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Group management: pending invites, the user's groups, creating a
 * group, and per-group member management for the owner.
 */
export default function GroupsDialog({
  open,
  onOpenChange,
}: GroupsDialogProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSelectedGroupId(null)
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent>
        {selectedGroupId === null ? (
          <GroupsOverview onOpenGroup={setSelectedGroupId} />
        ) : (
          <GroupDetail
            groupId={selectedGroupId}
            onBack={() => setSelectedGroupId(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface GroupsOverviewProps {
  onOpenGroup: (groupId: number) => void
}

function GroupsOverview({ onOpenGroup }: GroupsOverviewProps) {
  const groups = useQuery(groupsQueryOptions)
  const invites = useQuery(groupInvitesQueryOptions)
  const acceptInvite = useAcceptGroupInvite()
  const declineInvite = useDeleteGroupInvite()
  const createGroup = useCreateGroup()

  const [newGroupName, setNewGroupName] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrors([])
    try {
      const group = await createGroup.mutateAsync(newGroupName.trim())
      setNewGroupName('')
      onOpenGroup(group.id)
    } catch (error) {
      setErrors(extractApiErrors(error))
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Groups</DialogTitle>
        <DialogDescription>
          Private groups for chatting and games with custom rules. Only the
          group owner can send invites.
        </DialogDescription>
      </DialogHeader>

      {(invites.data ?? []).length > 0 && (
        <section>
          <h3 className="m-0 text-sm font-semibold text-muted-foreground">
            Invitations
          </h3>
          <ul className="m-0 list-none divide-y divide-border p-0">
            {(invites.data ?? []).map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <span className="min-w-0 text-sm">
                  <span className="font-medium">{invite.group.name}</span>{' '}
                  <span className="text-muted-foreground">
                    — invited by {invite.group.owner.username}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    disabled={acceptInvite.isPending}
                    onClick={() => acceptInvite.mutate(invite.id)}
                  >
                    Join
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={declineInvite.isPending}
                    onClick={() => declineInvite.mutate(invite.id)}
                  >
                    Decline
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="m-0 text-sm font-semibold text-muted-foreground">
          Your groups {groups.data ? `(${groups.data.length})` : ''}
        </h3>
        {groups.data && groups.data.length === 0 ? (
          <p className="my-2 text-sm text-muted-foreground">
            You are not in any groups yet. Create one below.
          </p>
        ) : (
          <ul className="m-0 list-none divide-y divide-border p-0">
            {(groups.data ?? []).map((group) => (
              <li
                key={group.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <span className="min-w-0 text-sm">
                  <span className="font-medium">{group.name}</span>{' '}
                  <span className="text-muted-foreground">
                    — {group.memberCount}{' '}
                    {group.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onOpenGroup(group.id)}
                >
                  Open
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        className="space-y-3 border-t border-border pt-4"
        onSubmit={submitCreate}
      >
        <FormErrors errors={errors} />
        <div className="flex gap-2">
          <Input
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            placeholder="New group name"
            aria-label="New group name"
          />
          <Button
            type="submit"
            disabled={createGroup.isPending || newGroupName.trim().length < 3}
          >
            Create
          </Button>
        </div>
      </form>
    </>
  )
}

interface GroupDetailProps {
  groupId: number
  onBack: () => void
}

function GroupDetail({ groupId, onBack }: GroupDetailProps) {
  const { data: currentUser } = useQuery(currentUserQueryOptions)
  const group = useQuery(groupDetailQueryOptions(groupId))
  const inviteToGroup = useInviteToGroup()
  const removeMember = useRemoveGroupMember()
  const transferOwnership = useTransferOwnership()
  const deleteGroup = useDeleteGroup()

  const [inviteUsername, setInviteUsername] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [inviteSentTo, setInviteSentTo] = useState<string | null>(null)

  if (!group.data || !currentUser) {
    return (
      <DialogHeader>
        <DialogTitle>Loading group…</DialogTitle>
      </DialogHeader>
    )
  }

  const isOwner = group.data.ownerId === currentUser.id

  const submitInvite = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrors([])
    setInviteSentTo(null)
    try {
      const invite = await inviteToGroup.mutateAsync({
        groupId,
        username: inviteUsername.trim(),
      })
      setInviteSentTo(invite.user.username)
      setInviteUsername('')
    } catch (error) {
      setErrors(extractApiErrors(error))
    }
  }

  const runWithErrors = async (
    action: () => Promise<unknown>,
    closeAfter = false,
  ) => {
    setErrors([])
    try {
      await action()
      if (closeAfter) {
        onBack()
      }
    } catch (error) {
      setErrors(extractApiErrors(error))
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to groups"
            onClick={onBack}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
          {group.data.name}
        </DialogTitle>
        <DialogDescription>
          Owned by {group.data.owner.username}
          {isOwner ? ' (you)' : ''} · {group.data.members.length}{' '}
          {group.data.members.length === 1 ? 'member' : 'members'}
        </DialogDescription>
      </DialogHeader>

      <FormErrors errors={errors} />

      {isOwner && (
        <form className="space-y-2" onSubmit={submitInvite}>
          {inviteSentTo && (
            <p className="m-0 rounded-md border border-felt bg-felt/20 px-3 py-2 text-sm">
              Invite sent to {inviteSentTo}.
            </p>
          )}
          <div className="flex gap-2">
            <Input
              value={inviteUsername}
              onChange={(event) => setInviteUsername(event.target.value)}
              placeholder="Invite a friend by exact username"
              aria-label="Invite a friend by exact username"
              autoComplete="off"
            />
            <Button
              type="submit"
              disabled={inviteToGroup.isPending || inviteUsername.trim() === ''}
            >
              Invite
            </Button>
          </div>
        </form>
      )}

      <section>
        <h3 className="m-0 text-sm font-semibold text-muted-foreground">
          Members
        </h3>
        <ul className="m-0 max-h-64 list-none divide-y divide-border overflow-y-auto p-0">
          {group.data.members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-2 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <UserAvatar user={member} />
                <span className="truncate text-sm font-medium">
                  {member.username}
                  {member.id === group.data.ownerId && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (owner)
                    </span>
                  )}
                </span>
              </span>
              {isOwner && member.id !== currentUser.id && (
                <span className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={transferOwnership.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Make ${member.username} the owner of this group?`,
                        )
                      ) {
                        void runWithErrors(() =>
                          transferOwnership.mutateAsync({
                            groupId,
                            userId: member.id,
                          }),
                        )
                      }
                    }}
                  >
                    Make owner
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={removeMember.isPending}
                    onClick={() =>
                      runWithErrors(() =>
                        removeMember.mutateAsync({
                          groupId,
                          userId: member.id,
                        }),
                      )
                    }
                  >
                    Remove
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="border-t border-border pt-4">
        {isOwner ? (
          <Button
            variant="destructive"
            size="sm"
            disabled={deleteGroup.isPending}
            onClick={() => {
              if (
                window.confirm(
                  'Delete this group? It disbands for every member.',
                )
              ) {
                void runWithErrors(() => deleteGroup.mutateAsync(groupId), true)
              }
            }}
          >
            Delete group
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={removeMember.isPending}
            onClick={() =>
              runWithErrors(
                () =>
                  removeMember.mutateAsync({ groupId, userId: currentUser.id }),
                true,
              )
            }
          >
            Leave group
          </Button>
        )}
      </div>
    </>
  )
}
