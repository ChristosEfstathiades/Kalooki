import { cn } from '#/lib/utils'

interface StatTileProps {
  label: string
  value: number | string
  /** Secondary figure, e.g. "+12 today". */
  detail?: string
  /** Draws attention when the number means work is waiting. */
  tone?: 'neutral' | 'warn' | 'danger'
}

const TONE_CLASSES: Record<NonNullable<StatTileProps['tone']>, string> = {
  neutral: 'border-edge',
  warn: 'border-warn',
  danger: 'border-danger',
}

/**
 * One figure on the overview page. Kept to a label, a number and one
 * line of context — a dashboard that explains each tile in a paragraph
 * stops being scannable.
 */
export default function StatTile({
  label,
  value,
  detail,
  tone = 'neutral',
}: StatTileProps) {
  return (
    <div
      className={cn('rounded-lg border bg-panel px-4 py-3', TONE_CLASSES[tone])}
    >
      <p className="m-0 text-xs font-medium tracking-wide text-ink-soft uppercase">
        {label}
      </p>
      <p className="m-0 text-2xl font-semibold tabular-nums">{value}</p>
      {detail !== undefined && (
        <p className="m-0 text-xs text-ink-soft">{detail}</p>
      )}
    </div>
  )
}
