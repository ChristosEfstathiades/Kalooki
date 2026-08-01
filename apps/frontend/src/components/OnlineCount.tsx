import { useQuery } from '@tanstack/react-query'
import { onlineCountQueryOptions } from '#/lib/presence'
import PresenceDot from '#/components/PresenceDot'
import { cn } from '#/lib/utils'

interface OnlineCountProps {
  className?: string
}

/** Below this many players the count reads as empty, so it stays hidden */
const MINIMUM_COUNT_TO_SHOW = 5

/**
 * How many players are on the site right now. Reads the count once over
 * HTTP and then follows the pushed presence events (lib/presence.ts).
 * Only renders once there are more than five players online.
 */
export default function OnlineCount({ className }: OnlineCountProps) {
  const { data: count } = useQuery(onlineCountQueryOptions)

  // Nothing to say until the first response lands, or while the site is quiet
  if (count === undefined || count <= MINIMUM_COUNT_TO_SHOW) {
    return null
  }

  return (
    <span
      className={cn(
        'flex items-center gap-1.5 text-sm text-muted-foreground',
        className,
      )}
    >
      <PresenceDot online />
      {count} players online
    </span>
  )
}
