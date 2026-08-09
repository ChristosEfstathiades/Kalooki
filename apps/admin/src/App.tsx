import { useQuery } from '@tanstack/react-query'
import { currentAdminQueryOptions } from '#/lib/auth'
import DashboardPage from '#/pages/DashboardPage'
import SignInPage from '#/pages/SignInPage'

/**
 * Chooses between the sign-in screen and the dashboard. The app is a
 * single view for now, so it needs no router; add one when the admin
 * tooling grows past one page.
 */
export default function App() {
  const currentAdmin = useQuery(currentAdminQueryOptions)

  if (currentAdmin.isPending) {
    return (
      <main className="flex min-h-full items-center justify-center">
        <p className="text-sm text-ink-soft">Loading…</p>
      </main>
    )
  }

  if (!currentAdmin.data) {
    return <SignInPage />
  }

  return <DashboardPage currentAdmin={currentAdmin.data} />
}
