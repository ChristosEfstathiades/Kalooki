import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { currentUserQueryOptions, useLogout } from '#/lib/auth'
import UserAvatar from '#/components/UserAvatar'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/_app/_auth/settings')({
  component: SettingsPage,
})

/**
 * Account settings: profile overview and sign-out. Username and avatar
 * editing activate once the backend exposes profile-update endpoints.
 */
function SettingsPage() {
  const navigate = useNavigate()
  const { data: user } = useQuery(currentUserQueryOptions)
  const logout = useLogout()

  if (!user) {
    return null
  }

  return (
    <div className="page-wrap max-w-2xl py-8">
      <h1 className="m-0 text-2xl font-bold">Settings</h1>

      <section className="mt-6 rounded-lg border border-border bg-card p-6">
        <h2 className="m-0 text-lg font-semibold">Profile</h2>
        <div className="mt-4 flex items-center gap-4">
          <UserAvatar user={user} className="size-16 text-lg" />
          <div>
            <p className="m-0 font-medium">{user.username}</p>
            <p className="m-0 text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <p className="mt-4 mb-0 text-sm text-muted-foreground">
          Changing your username and profile photo is coming soon.
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-6">
        <h2 className="m-0 text-lg font-semibold">Session</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Signing out ends this session on this device.
        </p>
        <Button
          variant="secondary"
          disabled={logout.isPending}
          onClick={() => {
            logout.mutate(undefined, {
              onSettled: () => {
                void navigate({ to: '/' })
              },
            })
          }}
        >
          {logout.isPending ? 'Signing out…' : 'Sign out'}
        </Button>
      </section>
    </div>
  )
}
