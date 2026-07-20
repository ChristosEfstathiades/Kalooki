import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { extractApiErrors, useAdminSignin } from '#/lib/auth'
import Button from '#/components/Button'

/**
 * Admin sign in. Only accounts with the admin role get through; a
 * moderator's or player's credentials are rejected here and their token
 * discarded, so this site never holds a non-admin session.
 */
export default function SignInPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const signin = useAdminSignin()

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrors([])
    try {
      await signin.mutateAsync({ identifier, password })
    } catch (error) {
      setErrors(extractApiErrors(error))
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-lg border border-edge bg-panel p-6"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-5 text-ink-soft" />
            <h1 className="m-0 text-lg font-semibold">Kalooki Admin</h1>
          </div>
          <p className="m-0 text-sm text-ink-soft">
            Administrator access only.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="identifier">
            Username or email
          </label>
          <input
            id="identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            required
            className="h-9 w-full rounded-md border border-edge bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent-hover"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="h-9 w-full rounded-md border border-edge bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent-hover"
          />
        </div>

        {errors.length > 0 && (
          <div
            role="alert"
            className="rounded-md border border-danger bg-danger/20 px-3 py-2 text-sm"
          >
            {errors.map((message) => (
              <p key={message} className="m-0">
                {message}
              </p>
            ))}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={signin.isPending}>
          {signin.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  )
}
