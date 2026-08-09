import { cn } from '#/lib/utils'

type PillTone = 'neutral' | 'accent' | 'danger' | 'warn' | 'ok'

interface StatusPillProps {
  label: string
  tone?: PillTone
  title?: string
}

const TONE_CLASSES: Record<PillTone, string> = {
  neutral: 'bg-panel-raised text-ink-soft',
  accent: 'bg-accent text-ink',
  danger: 'bg-danger text-ink',
  warn: 'bg-warn text-ink',
  ok: 'bg-ok text-ink',
}

/**
 * Compact status marker used for roles and moderation state in the
 * user table.
 */
export default function StatusPill({
  label,
  tone = 'neutral',
  title,
}: StatusPillProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-block rounded px-1.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide uppercase',
        TONE_CLASSES[tone],
      )}
    >
      {label}
    </span>
  )
}
