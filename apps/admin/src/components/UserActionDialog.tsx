import { useState } from 'react'
import {
  MUTE_DURATIONS,
  useBanUser,
  useMuteUser,
  useUnbanUser,
  useUnmuteUser,
} from '#/lib/admin'
import { extractApiErrors } from '#/lib/auth'
import Button from '#/components/Button'
import { cn } from '#/lib/utils'
import type { AdminUser } from '#/lib/admin'

/** Which action the dialog is collecting details for. */
export type UserAction = 'ban' | 'unban' | 'mute' | 'unmute'

interface UserActionDialogProps {
  action: UserAction
  user: AdminUser
  onClose: () => void
}

/**
 * Confirmation dialog for a moderation action taken from the admin user
 * table. Every action accepts an optional reason that is stored on the
 * moderation audit trail.
 */
export default function UserActionDialog({
  action,
  user,
  onClose,
}: UserActionDialogProps) {
  const [reason, setReason] = useState('')
  const [durationMinutes, setDurationMinutes] = useState<number | null>(60)
  const [errors, setErrors] = useState<string[]>([])

  const banUser = useBanUser()
  const unbanUser = useUnbanUser()
  const muteUser = useMuteUser()
  const unmuteUser = useUnmuteUser()
  const isSubmitting =
    banUser.isPending ||
    unbanUser.isPending ||
    muteUser.isPending ||
    unmuteUser.isPending

  const copy = {
    ban: {
      title: `Ban ${user.username}`,
      description: `The account stays intact but ${user.username} can no longer sign in, and is signed out of every device immediately.`,
      confirm: 'Ban user',
      destructive: true,
    },
    unban: {
      title: `Lift the ban on ${user.username}`,
      description: `${user.username} will be able to sign in again.`,
      confirm: 'Lift ban',
      destructive: false,
    },
    mute: {
      title: `Mute ${user.username}`,
      description: `${user.username} can keep playing and reading chat, but cannot post until the mute lifts.`,
      confirm: 'Mute user',
      destructive: true,
    },
    unmute: {
      title: `Lift the mute on ${user.username}`,
      description: `${user.username} will be able to post in chat again.`,
      confirm: 'Lift mute',
      destructive: false,
    },
  }[action]

  const submit = async () => {
    setErrors([])
    const trimmedReason = reason.trim()
    try {
      if (action === 'ban') {
        await banUser.mutateAsync({ userId: user.id, reason: trimmedReason })
      } else if (action === 'unban') {
        await unbanUser.mutateAsync({ userId: user.id, reason: trimmedReason })
      } else if (action === 'mute') {
        await muteUser.mutateAsync({
          userId: user.id,
          durationMinutes,
          reason: trimmedReason,
        })
      } else {
        await unmuteUser.mutateAsync({ userId: user.id, reason: trimmedReason })
      }
      onClose()
    } catch (error) {
      setErrors(extractApiErrors(error))
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="w-full max-w-md space-y-4 rounded-lg border border-edge bg-panel p-5 shadow-2xl">
        <div className="space-y-1">
          <h2 className="m-0 text-base font-semibold">{copy.title}</h2>
          <p className="m-0 text-sm text-ink-soft">{copy.description}</p>
        </div>

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
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                    durationMinutes === option.minutes
                      ? 'border-transparent bg-accent text-ink'
                      : 'border-edge text-ink-soft hover:bg-panel-raised',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="action-reason">
            Reason <span className="text-ink-soft">(optional)</span>
          </label>
          <textarea
            id="action-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Recorded on the moderation log"
            maxLength={500}
            rows={3}
            className="w-full rounded-md border border-edge bg-surface px-3 py-2 text-sm outline-none placeholder:text-ink-soft focus-visible:ring-2 focus-visible:ring-accent-hover"
          />
        </div>

        {errors.length > 0 && (
          <div
            role="alert"
            className="rounded-md border border-danger bg-danger/20 px-3 py-2 text-sm"
          >
            {errors.map((message) => (
              <p key={message} className="m-0">
                {message}
              </p>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={copy.destructive ? 'danger' : 'primary'}
            onClick={submit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Working…' : copy.confirm}
          </Button>
        </div>
      </div>
    </div>
  )
}
