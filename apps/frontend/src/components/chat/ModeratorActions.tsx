import { useState } from 'react'
import { Ban, Trash2, VolumeX } from 'lucide-react'
import {
  MUTE_DURATIONS,
  canModerate,
  useBanUser,
  useDeleteMessage,
  useMuteUser,
} from '#/lib/moderation'
import { extractApiErrors } from '#/lib/auth'
import FormErrors from '#/components/FormErrors'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { cn } from '#/lib/utils'
import type { CurrentUser } from '#/lib/auth'
import type { PublicUser } from '#/lib/social'

/** Which action the confirmation dialog is collecting details for. */
type PendingAction = 'delete' | 'mute' | 'ban'

interface ModeratorActionsProps {
  currentUser: CurrentUser | null | undefined
  author: PublicUser
  messageId: number
  /** True for the global chatroom and live game chats, where moderators
   * may delete messages. Private group chats are out of reach. */
  canDeleteMessages: boolean
  onFinished: (feedback: string) => void
}

/**
 * The moderator entries in a chat message's menu: delete the message,
 * and mute or ban its author. Each opens a small dialog to confirm and
 * record an optional reason (docs/features.md, Roles & Moderation).
 */
export default function ModeratorActions({
  currentUser,
  author,
  messageId,
  canDeleteMessages,
  onFinished,
}: ModeratorActionsProps) {
  const [pending, setPending] = useState<PendingAction | null>(null)
  const canActOnAuthor = canModerate(currentUser, author.role, author.id)

  if (!canDeleteMessages && !canActOnAuthor) {
    return null
  }

  return (
    <>
      {canDeleteMessages && (
        <Button size="xs" variant="ghost" onClick={() => setPending('delete')}>
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
      )}
      {canActOnAuthor && (
        <>
          <Button size="xs" variant="ghost" onClick={() => setPending('mute')}>
            <VolumeX aria-hidden="true" />
            Mute
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setPending('ban')}>
            <Ban aria-hidden="true" />
            Ban
          </Button>
        </>
      )}

      {pending !== null && (
        <ModeratorActionDialog
          action={pending}
          author={author}
          messageId={messageId}
          onClose={() => setPending(null)}
          onFinished={onFinished}
        />
      )}
    </>
  )
}

interface ModeratorActionDialogProps {
  action: PendingAction
  author: PublicUser
  messageId: number
  onClose: () => void
  onFinished: (feedback: string) => void
}

/**
 * Confirmation dialog for a moderator action. Bans are indefinite and
 * mutes take one of the fixed lengths; both accept an optional reason
 * that is stored on the audit trail.
 */
function ModeratorActionDialog({
  action,
  author,
  messageId,
  onClose,
  onFinished,
}: ModeratorActionDialogProps) {
  const [reason, setReason] = useState('')
  const [durationMinutes, setDurationMinutes] = useState<number | null>(60)
  const [errors, setErrors] = useState<string[]>([])

  const deleteMessage = useDeleteMessage()
  const muteUser = useMuteUser()
  const banUser = useBanUser()
  const isSubmitting =
    deleteMessage.isPending || muteUser.isPending || banUser.isPending

  const copy = {
    delete: {
      title: 'Delete this message',
      description: `The message disappears for everyone, including ${author.username}. It stays on record so any report against it can still be reviewed.`,
      confirm: 'Delete message',
      done: 'Message deleted',
    },
    mute: {
      title: `Mute ${author.username}`,
      description: `${author.username} can keep playing and reading chat, but cannot post until the mute lifts.`,
      confirm: 'Mute user',
      done: `${author.username} has been muted`,
    },
    ban: {
      title: `Ban ${author.username}`,
      description: `${author.username}'s account stays intact but they can no longer sign in. They are signed out of every device immediately.`,
      confirm: 'Ban user',
      done: `${author.username} has been banned`,
    },
  }[action]

  const submit = async () => {
    setErrors([])
    const trimmedReason = reason.trim()
    try {
      if (action === 'delete') {
        await deleteMessage.mutateAsync({ messageId, reason: trimmedReason })
      } else if (action === 'mute') {
        await muteUser.mutateAsync({
          userId: author.id,
          durationMinutes,
          reason: trimmedReason,
        })
      } else {
        await banUser.mutateAsync({ userId: author.id, reason: trimmedReason })
      }
      onFinished(copy.done)
      onClose()
    } catch (error) {
      setErrors(extractApiErrors(error))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {action === 'mute' && (
          <div className="space-y-2">
            <p className="m-0 text-sm font-medium">How long</p>
            <div className="flex flex-wrap gap-2">
              {MUTE_DURATIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setDurationMinutes(option.minutes)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-medium',
                    durationMinutes === option.minutes
                      ? 'border-transparent bg-button-purple text-white'
                      : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="moderation-reason">
            Reason <span className="text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="moderation-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Recorded on the moderation log"
            maxLength={500}
            rows={3}
          />
        </div>

        <FormErrors errors={errors} />

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={isSubmitting}>
            {isSubmitting ? 'Working…' : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
