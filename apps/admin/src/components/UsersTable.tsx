import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ban, ChevronLeft, ChevronRight, Search, VolumeX } from 'lucide-react'
import { USER_ROLES, useSetUserRole, usersQueryOptions } from '#/lib/admin'
import { extractApiErrors } from '#/lib/auth'
import Button from '#/components/Button'
import StatusPill from '#/components/StatusPill'
import UserActionDialog from '#/components/UserActionDialog'
import { formatDateTime } from '#/lib/utils'
import type { AdminUser, UserRole } from '#/lib/admin'
import type { UserAction } from '#/components/UserActionDialog'
import type { CurrentUser } from '#/lib/auth'

interface UsersTableProps {
  currentAdmin: CurrentUser
}

/**
 * The user directory: every account, searchable and filterable by role,
 * with the promote/demote, ban and mute controls an admin needs.
 */
export default function UsersTable({ currentAdmin }: UsersTableProps) {
  const [page, setPage] = useState(1)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<UserRole | 'all'>('all')
  const [pending, setPending] = useState<{
    action: UserAction
    user: AdminUser
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const users = useQuery(usersQueryOptions({ page, search, role }))
  const setUserRole = useSetUserRole()

  const applySearch = (event: React.FormEvent) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchDraft.trim())
  }

  const changeRole = async (user: AdminUser, nextRole: UserRole) => {
    setError(null)
    try {
      await setUserRole.mutateAsync({ userId: user.id, role: nextRole })
    } catch (caught) {
      setError(extractApiErrors(caught)[0])
    }
  }

  const meta = users.data?.meta
  const rows = users.data?.users ?? []

  return (
    <section className="rounded-lg border border-edge bg-panel">
      <header className="flex flex-wrap items-center gap-3 border-b border-edge px-4 py-3">
        <h2 className="m-0 mr-auto text-sm font-semibold">
          Users
          {meta && (
            <span className="ml-2 font-normal text-ink-soft">{meta.total}</span>
          )}
        </h2>

        <form className="flex items-center gap-2" onSubmit={applySearch}>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-ink-soft"
            />
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Username or email"
              aria-label="Search users"
              className="h-8 w-52 rounded-md border border-edge bg-surface pr-2 pl-7 text-sm outline-none placeholder:text-ink-soft focus-visible:ring-2 focus-visible:ring-accent-hover"
            />
          </div>
          <Button size="sm" variant="outline" type="submit">
            Search
          </Button>
        </form>

        <select
          value={role}
          onChange={(event) => {
            setPage(1)
            setRole(event.target.value as UserRole | 'all')
          }}
          aria-label="Filter by role"
          className="h-8 rounded-md border border-edge bg-surface px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent-hover"
        >
          <option value="all">All roles</option>
          {USER_ROLES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </header>

      {error !== null && (
        <p role="alert" className="m-0 border-b border-edge px-4 py-2 text-sm text-ink">
          {error}
        </p>
      )}

      <div className="thin-scrollbar overflow-x-auto">
        <table className="w-full min-w-3xl border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-ink-soft uppercase">
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Joined</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.isPending && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-soft">
                  Loading users…
                </td>
              </tr>
            )}
            {users.isSuccess && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-soft">
                  No users match this filter.
                </td>
              </tr>
            )}
            {rows.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSelf={user.id === currentAdmin.id}
                onChangeRole={changeRole}
                onAction={(action) => setPending({ action, user })}
              />
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.lastPage > 1 && (
        <footer className="flex items-center justify-end gap-2 border-t border-edge px-4 py-2 text-sm">
          <span className="mr-auto text-ink-soft">
            Page {meta.page} of {meta.lastPage}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={meta.page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            <ChevronLeft aria-hidden="true" />
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={meta.page >= meta.lastPage}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
            <ChevronRight aria-hidden="true" />
          </Button>
        </footer>
      )}

      {pending !== null && (
        <UserActionDialog
          action={pending.action}
          user={pending.user}
          onClose={() => setPending(null)}
        />
      )}
    </section>
  )
}

interface UserRowProps {
  user: AdminUser
  isSelf: boolean
  onChangeRole: (user: AdminUser, role: UserRole) => void
  onAction: (action: UserAction) => void
}

/**
 * One account in the directory. An admin's own row has its controls
 * disabled: the backend refuses self-targeted role changes and bans, so
 * there is nothing to offer.
 */
function UserRow({ user, isSelf, onChangeRole, onAction }: UserRowProps) {
  return (
    <tr className="border-t border-edge align-middle">
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{user.username}</span>
          {isSelf && <StatusPill label="You" tone="accent" />}
          {user.isBot && <StatusPill label="Bot" />}
        </div>
        <div className="text-xs text-ink-soft">{user.email}</div>
      </td>
      <td className="px-4 py-2 whitespace-nowrap text-ink-soft">
        {formatDateTime(user.createdAt)}
      </td>
      <td className="px-4 py-2">
        <div className="flex flex-wrap gap-1">
          {user.isBanned && (
            <StatusPill
              label="Banned"
              tone="danger"
              title={user.banReason ?? undefined}
            />
          )}
          {user.isMuted && (
            <StatusPill
              label={user.mutedUntil === null ? 'Muted' : 'Muted (timed)'}
              tone="warn"
              title={
                user.mutedUntil === null
                  ? (user.muteReason ?? 'Permanent mute')
                  : `Until ${formatDateTime(user.mutedUntil)}`
              }
            />
          )}
          {user.deletedAt !== null && <StatusPill label="Deleting" />}
          {!user.isBanned && !user.isMuted && user.deletedAt === null && (
            <StatusPill label="Active" tone="ok" />
          )}
        </div>
      </td>
      <td className="px-4 py-2">
        <select
          value={user.role}
          disabled={isSelf}
          onChange={(event) =>
            onChangeRole(user, event.target.value as UserRole)
          }
          aria-label={`Role for ${user.username}`}
          className="h-7 rounded-md border border-edge bg-surface px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent-hover disabled:opacity-50"
        >
          {USER_ROLES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2">
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={isSelf}
            onClick={() => onAction(user.isMuted ? 'unmute' : 'mute')}
          >
            <VolumeX aria-hidden="true" />
            {user.isMuted ? 'Unmute' : 'Mute'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isSelf}
            onClick={() => onAction(user.isBanned ? 'unban' : 'ban')}
          >
            <Ban aria-hidden="true" />
            {user.isBanned ? 'Unban' : 'Ban'}
          </Button>
        </div>
      </td>
    </tr>
  )
}
