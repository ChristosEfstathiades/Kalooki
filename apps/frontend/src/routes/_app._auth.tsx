import { useEffect } from 'react'
import {
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { clearStoredToken, getStoredToken } from '#/lib/auth-token'
import { closeSocket, getSocket } from '#/lib/socket'
import { currentUserQueryOptions } from '#/lib/auth'
import { usePresenceSync } from '#/lib/presence'

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
  const queryClient = useQueryClient()

  usePresenceSync()

  useEffect(() => {
    const socket = getSocket()
    const onGameStart = (payload: { matchId: string }) => {
      void navigate({
        to: '/game/$matchId',
        params: { matchId: payload.matchId },
      })
    }

    // The server drops a socket when the account is banned mid-session;
    // tear the local session down rather than leaving a dead page up.
    const onSessionRevoked = () => {
      clearStoredToken()
      closeSocket()
      queryClient.setQueryData(currentUserQueryOptions.queryKey, null)
      void navigate({ to: '/signin' })
    }

    socket.on('game:start', onGameStart)
    socket.on('session:revoked', onSessionRevoked)
    return () => {
      socket.off('game:start', onGameStart)
      socket.off('session:revoked', onSessionRevoked)
    }
  }, [navigate, queryClient])

  return <Outlet />
}
