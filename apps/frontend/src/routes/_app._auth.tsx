import { useEffect } from 'react'
import {
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { getStoredToken } from '#/lib/auth-token'
import { getSocket } from '#/lib/socket'

/**
 * Pathless guard for signed-in-only pages: anyone without a stored
 * access token is sent to the signin page. While signed in, a starting
 * match navigates straight to the table from any page.
 */
export const Route = createFileRoute('/_app/_auth')({
  beforeLoad: () => {
    if (!getStoredToken()) {
      throw redirect({ to: '/signin' })
    }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const navigate = useNavigate()

  useEffect(() => {
    const socket = getSocket()
    const onGameStart = (payload: { matchId: string }) => {
      void navigate({
        to: '/game/$matchId',
        params: { matchId: payload.matchId },
      })
    }
    socket.on('game:start', onGameStart)
    return () => {
      socket.off('game:start', onGameStart)
    }
  }, [navigate])

  return <Outlet />
}
