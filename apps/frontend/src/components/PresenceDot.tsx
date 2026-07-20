import { cn } from '#/lib/utils'

interface PresenceDotProps {
  online: boolean
  /**
   * Who the dot describes, e.g. a username. Given one, the dot is
   * announced as "alice is online"; without one it is decorative and
   * hidden from screen readers.
   */
  label?: string
  className?: string
}

/**
 * Small filled dot showing whether someone is connected: green when
 * online, a hollow muted dot when not.
 */
export default function PresenceDot({
  online,
  label,
  className,
}: PresenceDotProps) {
  const statusText = online ? 'online' : 'offline'

  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label ? `${label} is ${statusText}` : undefined}
      aria-hidden={label ? undefined : true}
      title={label ? undefined : statusText}
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        online ? 'bg-online' : 'border border-muted-foreground/60',
        className,
      )}
    />
  )
}
