import { useState } from 'react'
import type { TrendPoint } from '#/lib/metrics'

/**
 * The last fortnight of signups and completed matches.
 *
 * Deliberately two charts rather than one with two y-axes: the series
 * measure different things on different scales, and overlaying them on
 * a shared axis would invent a relationship between the heights that
 * does not exist. Small multiples let each keep its own scale while the
 * dates still line up column for column.
 */

interface TrendChartProps {
  trend: TrendPoint[]
}

export default function TrendChart({ trend }: TrendChartProps) {
  return (
    <section className="rounded-lg border border-edge bg-panel">
      <header className="border-b border-edge px-4 py-3">
        <h2 className="m-0 text-sm font-semibold">Last 14 days</h2>
        <p className="m-0 text-xs text-ink-soft">
          New player accounts and completed matches, per day
        </p>
      </header>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <TrendSeries
          title="Signups"
          trend={trend}
          value={(point) => point.signups}
          color="var(--color-chart-signups)"
        />
        <TrendSeries
          title="Matches completed"
          trend={trend}
          value={(point) => point.matches}
          color="var(--color-chart-matches)"
        />
      </div>
    </section>
  )
}

interface TrendSeriesProps {
  title: string
  trend: TrendPoint[]
  value: (point: TrendPoint) => number
  color: string
}

/** Plot geometry, in the SVG's own user units. */
const PLOT_WIDTH = 280
const PLOT_HEIGHT = 90
/** Gap between adjacent bars, so fills never touch. */
const BAR_GAP = 2
/** Rounding on the data end of each bar. */
const BAR_RADIUS = 2

/**
 * One measure over the window: a bar per day, its own scale, and a
 * tooltip on hover. Only the peak is labelled — a number on every bar
 * would out-shout the shape.
 */
function TrendSeries({ title, trend, value, color }: TrendSeriesProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const values = trend.map(value)
  const peak = Math.max(...values, 1)
  const total = values.reduce((sum, entry) => sum + entry, 0)
  const slotWidth = trend.length === 0 ? 0 : PLOT_WIDTH / trend.length
  const barWidth = Math.max(1, slotWidth - BAR_GAP)
  const hoveredPoint = hovered === null ? null : trend[hovered]

  return (
    <figure className="m-0">
      <figcaption className="mb-1 flex items-baseline gap-2">
        <span className="text-xs font-medium tracking-wide text-ink-soft uppercase">
          {title}
        </span>
        <span className="ml-auto text-xs text-ink-soft tabular-nums">
          {total} total · peak {peak}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT + 14}`}
        className="h-28 w-full"
        role="img"
        aria-label={`${title} per day over the last ${trend.length} days`}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Recessive baseline: present for reference, never competing */}
        <line
          x1={0}
          y1={PLOT_HEIGHT}
          x2={PLOT_WIDTH}
          y2={PLOT_HEIGHT}
          stroke="var(--color-edge)"
          strokeWidth={1}
        />

        {trend.map((point, index) => {
          const height = (values[index] / peak) * PLOT_HEIGHT
          const x = index * slotWidth
          return (
            <g key={point.date}>
              <rect
                x={x}
                y={PLOT_HEIGHT - height}
                width={barWidth}
                height={Math.max(height, values[index] > 0 ? 1 : 0)}
                rx={BAR_RADIUS}
                fill={color}
                opacity={hovered === null || hovered === index ? 1 : 0.45}
              />
              {/* Full-height hit target, so thin bars are still hoverable */}
              <rect
                x={x}
                y={0}
                width={Math.max(barWidth, 6)}
                height={PLOT_HEIGHT}
                fill="transparent"
                onMouseEnter={() => setHovered(index)}
              />
            </g>
          )
        })}

        {hoveredPoint !== null && (
          <text
            x={PLOT_WIDTH}
            y={PLOT_HEIGHT + 12}
            textAnchor="end"
            className="fill-ink text-[9px]"
          >
            {formatDay(hoveredPoint.date)}: {value(hoveredPoint)}
          </text>
        )}
        {hoveredPoint === null && trend.length > 0 && (
          <>
            <text
              x={0}
              y={PLOT_HEIGHT + 12}
              className="fill-ink-soft text-[9px]"
            >
              {formatDay(trend[0].date)}
            </text>
            <text
              x={PLOT_WIDTH}
              y={PLOT_HEIGHT + 12}
              textAnchor="end"
              className="fill-ink-soft text-[9px]"
            >
              {formatDay(trend[trend.length - 1].date)}
            </text>
          </>
        )}
      </svg>
    </figure>
  )
}

/**
 * Short day label for the axis ends, e.g. "14 Jul".
 */
function formatDay(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) {
    return isoDate
  }
  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
}
