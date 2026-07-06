import { backendUrl } from '#/lib/api'
import { cn } from '#/lib/utils'
import type { CurrentUser } from '#/lib/auth'

interface UserAvatarProps {
  user: Pick<CurrentUser, 'username' | 'avatarUrl' | 'initials'>
  className?: string
}

/**
 * Circular avatar for a user: their uploaded photo when they have one,
 * otherwise a two-letter monogram derived from their username.
 */
export default function UserAvatar({ user, className }: UserAvatarProps) {
  if (user.avatarUrl) {
    return (
      <img
        src={backendUrl(user.avatarUrl)}
        alt={`${user.username}'s avatar`}
        className={cn('size-8 rounded-full object-cover', className)}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-8 items-center justify-center rounded-full bg-button-purple text-xs font-semibold text-white',
        className,
      )}
    >
      {user.initials}
    </span>
  )
}
