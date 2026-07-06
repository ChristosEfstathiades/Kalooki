import { createFileRoute, redirect } from '@tanstack/react-router'
import { getStoredToken } from '#/lib/auth-token'

/**
 * Pathless guard for signed-in-only pages: anyone without a stored
 * access token is sent to the signin page.
 */
export const Route = createFileRoute('/_app/_auth')({
  beforeLoad: () => {
    if (!getStoredToken()) {
      throw redirect({ to: '/signin' })
    }
  },
})
