import { botttsAvatarUri } from '#/lib/avatar'
import { cn } from '#/lib/utils'

interface UserAvatarProps {
  user: { username: string }
  className?: string
}

/**
 * Circular avatar for a user: a deterministic DiceBear "bottts" robot
 * generated from their username, so every user has a consistent icon
 * without uploading a photo.
 */
export default function UserAvatar({ user, className }: UserAvatarProps) {
  return (
    <img
      src={botttsAvatarUri(user.username)}
      alt={`${user.username}'s avatar`}
      className={cn('size-8 rounded-full', className)}
    />
  )
}
