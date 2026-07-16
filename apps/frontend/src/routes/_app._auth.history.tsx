import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '#/lib/api'
import { currentUserQueryOptions } from '#/lib/auth'
import { UNLIMITED_BUY_INS, formatChips } from '#/lib/game'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_app/_auth/history')({
  component: HistoryPage,
})

interface MatchFilters {
  kind: 'all' | 'public' | 'private' | 'practice'
  sort: 'newest' | 'oldest'
  wonOnly: boolean
}

const defaultFilters: MatchFilters = {
  kind: 'all',
  sort: 'newest',
  wonOnly: false,
}

/**
 * Query for the match list. Filtering happens server-side (the API
 * caps the list at 50 matches, so filtering the fetched page locally
 * would miss older matches); default values are omitted from the
 * request.
 */
const matchesQueryOptions = (filters: MatchFilters) =>
  queryOptions({
    queryKey: ['matches', filters],
    queryFn: async () => {
      const response = await api.get('/api/v1/matches', {
        query: {
          ...(filters.kind === 'all' ? {} : { kind: filters.kind }),
          ...(filters.sort === 'oldest' ? { sort: 'oldest' as const } : {}),
          ...(filters.wonOnly ? { wonOnly: true } : {}),
        },
      })
      return response.data.matches
    },
  })

type MatchRecord = NonNullable<
  Awaited<ReturnType<NonNullable<ReturnType<typeof matchesQueryOptions>['queryFn']>>>
>[number]

/**
 * Match history: every game the user played, filterable by match type,
 * date order, and wins only, with a click-to-expand scoresheet
 * (docs/Frontend-design.md).
 */
function HistoryPage() {
  const [filters, setFilters] = useState<MatchFilters>(defaultFilters)
  const matches = useQuery(matchesQueryOptions(filters))
  const { data: currentUser } = useQuery(currentUserQueryOptions)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const filtersActive =
    filters.kind !== 'all' || filters.wonOnly || filters.sort !== 'newest'

  return (
    <div className="page-wrap max-w-4xl py-8">
      <Link
        to="/play"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to lobby
      </Link>
      <h1 className="m-0 text-2xl font-bold">Match history</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Every game you have played. Click a match for the full scoresheet.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <FilterButtonGroup
          label="Type"
          options={[
            { value: 'all', label: 'All' },
            { value: 'public', label: 'Public' },
            { value: 'private', label: 'Private' },
            { value: 'practice', label: 'Practice' },
          ]}
          active={filters.kind}
          onSelect={(kind) => setFilters({ ...filters, kind })}
        />
        <FilterButtonGroup
          label="Order"
          options={[
            { value: 'newest', label: 'Newest first' },
            { value: 'oldest', label: 'Oldest first' },
          ]}
          active={filters.sort}
          onSelect={(sort) => setFilters({ ...filters, sort })}
        />
        <Label className="font-normal">
          <input
            type="checkbox"
            checked={filters.wonOnly}
            onChange={(event) =>
              setFilters({ ...filters, wonOnly: event.target.checked })
            }
            className="size-4 accent-[var(--button-purple)]"
          />
          Only matches I won
        </Label>
      </div>

      {matches.isSuccess && matches.data.length === 0 && (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          {filtersActive
            ? 'No matches fit these filters.'
            : 'No games yet, find a public match or start one in a group.'}
        </p>
      )}

      <ul className="m-0 list-none space-y-2 p-0">
        {(matches.data ?? []).map((match) => (
          <MatchRow
            key={match.id}
            match={match}
            currentUserId={currentUser?.id ?? 0}
            expanded={expandedId === match.id}
            onToggle={() =>
              setExpandedId(expandedId === match.id ? null : match.id)
            }
          />
        ))}
      </ul>
    </div>
  )
}

interface FilterButtonGroupProps<TValue extends string> {
  label: string
  options: { value: TValue; label: string }[]
  active: TValue
  onSelect: (value: TValue) => void
}

/**
 * A labelled row of mutually exclusive filter buttons (radio-style),
 * matching the theme picker's segmented-buttons pattern.
 */
function FilterButtonGroup<TValue extends string>({
  label,
  options,
  active,
  onSelect,
}: FilterButtonGroupProps<TValue>) {
  return (
    <div
      className="flex items-center gap-2"
      role="radiogroup"
      aria-label={label}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          role="radio"
          size="sm"
          aria-checked={active === option.value}
          variant={active === option.value ? 'default' : 'secondary'}
          className={cn(
            active === option.value &&
              'bg-button-purple hover:bg-button-purple-hover',
          )}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

interface MatchRowProps {
  match: MatchRecord
  currentUserId: number
  expanded: boolean
  onToggle: () => void
}

function MatchRow({ match, currentUserId, expanded, onToggle }: MatchRowProps) {
  const you = match.players.find((player) => player.id === currentUserId)
  const winner = match.players.find(
    (player) => player.id === match.winnerUserId,
  )
  const date = match.startedAt ? new Date(match.startedAt).toLocaleString() : ''
  const minutes = Math.max(1, Math.round(match.durationSeconds / 60))

  return (
    <li className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {expanded ? (
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        ) : (
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {matchKindLabel(match)} ·{' '}
            {match.players.map((player) => player.username).join(', ')}
          </span>
          <span className="block text-xs text-muted-foreground">
            {date} · {minutes} min ·{' '}
            {match.completed
              ? winner
                ? `${winner.username} won`
                : 'Finished'
              : 'Incomplete, no winner'}
            {you && typeof you.chipsNet === 'number'
              ? ` · ${formatChips(you.chipsNet)} chips`
              : ''}
          </span>
        </span>
        {you && (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
              you.placement === 1
                ? 'bg-felt text-white'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {ordinal(you.placement)}
          </span>
        )}
      </button>

      {expanded && <MatchDetail match={match} />}
    </li>
  )
}

interface MatchDetailProps {
  match: MatchRecord
}

function MatchDetail({ match }: MatchDetailProps) {
  const playMoney = match.rules.stakes != null

  return (
    <div className="space-y-4 border-t border-border px-4 py-3 text-sm">
      <section>
        <h3 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Final standings
        </h3>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 font-medium">Place</th>
              <th className="py-1 font-medium">Player</th>
              <th className="py-1 font-medium">Score</th>
              {playMoney && <th className="py-1 font-medium">Chips</th>}
              <th className="py-1 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {match.players.map((player) => (
              <tr key={player.id} className="border-t border-border">
                <td className="py-1">{ordinal(player.placement)}</td>
                <td className="py-1">{player.username}</td>
                <td className="py-1">{player.finalScore}</td>
                {playMoney && (
                  <td className="py-1">
                    {typeof player.chipsNet === 'number'
                      ? formatChips(player.chipsNet)
                      : '-'}
                  </td>
                )}
                <td className="py-1 text-xs text-muted-foreground">
                  {player.leftEarly ? 'left early' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {match.scoresheet.length > 0 && (
        <section>
          <h3 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Round by round
          </h3>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Round</th>
                  {match.players.map((player) => (
                    <th key={player.id} className="py-1 font-medium">
                      {player.username}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {match.scoresheet.map((round) => (
                  <tr
                    key={round.roundNumber}
                    className="border-t border-border"
                  >
                    <td className="py-1">
                      {round.roundNumber}
                      {round.calledKalooki && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (kalooki)
                        </span>
                      )}
                    </td>
                    {match.players.map((player) => (
                      <td key={player.id} className="py-1">
                        {player.id in round.totals ? (
                          <>
                            {round.totals[player.id]}
                            <span className="ml-1 text-xs text-muted-foreground">
                              (+{round.penalties[player.id] ?? 0})
                            </span>
                            {playMoney && player.id in round.chips && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                {formatChips(round.chips[player.id])}c
                              </span>
                            )}
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="text-xs text-muted-foreground">
        Rules: {match.rules.decks} decks · {match.rules.jokers} jokers · come
        down at {match.rules.comeDownThreshold} · out at{' '}
        {match.rules.scoreLimit + 1} · buy-ins:{' '}
        {match.rules.buyInsPerPlayer === UNLIMITED_BUY_INS
          ? 'unlimited'
          : match.rules.buyInsPerPlayer}
        {match.rules.stakes &&
          ` · play money (chips): stake ${match.rules.stakes.stake}, buy-in ${match.rules.stakes.rebuy}, kalooki ${match.rules.stakes.kalooki}, each call ${match.rules.stakes.call}`}
      </section>
    </div>
  )
}

/**
 * A match's headline label: "Public match", "Private match", or, for
 * bot games, "Practice (hard bots)".
 */
function matchKindLabel(match: MatchRecord): string {
  if (match.kind === 'practice') {
    return match.botDifficulty
      ? `Practice (${match.botDifficulty} bots)`
      : 'Practice'
  }
  return match.kind === 'public' ? 'Public match' : 'Private match'
}

/**
 * 1 → 1st, 2 → 2nd, 3 → 3rd, everything else → Nth.
 */
function ordinal(place: number): string {
  const suffix =
    place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th'
  return `${place}${suffix}`
}
