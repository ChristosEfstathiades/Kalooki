import { useQuery } from '@tanstack/react-query'
import { onlineCountQueryOptions } from '#/lib/presence'
import PresenceDot from '#/components/PresenceDot'
import { cn } from '#/lib/utils'

interface OnlineCountProps {
  className?: string
}

/**
 * How many players are on the site right now. Reads the count once over
 * HTTP and then follows the pushed presence events (lib/presence.ts).
 */
export default function OnlineCount({ className }: OnlineCountProps) {
  const { data: count } = useQuery(onlineCountQueryOptions)

  // Nothing to say until the first response lands
  if (count === undefined) {
    return null
  }

  return (
    <span
      className={cn(
        'flex items-center gap-1.5 text-sm text-muted-foreground',
        className,
      )}
    >
      <PresenceDot online={count > 0} />
      {count} {count === 1 ? 'player' : 'players'} online
    </span>
  )
}
