import { LogOut, ShieldCheck } from 'lucide-react'
import { useAdminSignout } from '#/lib/auth'
import Button from '#/components/Button'
import ModerationLog from '#/components/ModerationLog'
import UsersTable from '#/components/UsersTable'
import type { CurrentUser } from '#/lib/auth'

interface DashboardPageProps {
  currentAdmin: CurrentUser
}

/**
 * The admin dashboard. Today it is the user directory plus the
 * moderation log; further admin tooling gets added alongside them.
 */
export default function DashboardPage({ currentAdmin }: DashboardPageProps) {
  const signout = useAdminSignout()

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-edge bg-panel px-4 py-3">
        <ShieldCheck aria-hidden="true" className="size-5 text-ink-soft" />
        <h1 className="m-0 mr-auto text-base font-semibold">Kalooki Admin</h1>
        <span className="text-sm text-ink-soft">{currentAdmin.username}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => signout.mutate()}
          disabled={signout.isPending}
        >
          <LogOut aria-hidden="true" />
          Sign out
        </Button>
      </header>

      <main className="grid gap-4 p-4 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <UsersTable currentAdmin={currentAdmin} />
        <ModerationLog />
      </main>
    </div>
  )
}
