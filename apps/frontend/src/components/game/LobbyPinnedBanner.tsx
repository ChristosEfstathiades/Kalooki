import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pin } from 'lucide-react'
import { fetchLobby, joinLobby, lobbyIsOpen } from '#/lib/game'
import { currentUserQueryOptions } from '#/lib/auth'
import { getSocket } from '#/lib/socket'
import OpensIn from '#/components/game/OpensIn'
import { Button } from '#/components/ui/button'
import type { LobbyView } from '#/lib/game'

interface LobbyPinnedBannerProps {
  groupId: number
}

/**
 * Twitch-style pinned notice at the top of a group's chat: shows the
 * group's private game while one is open to join or scheduled, with a
 * join button / opening countdown. Hidden when there is no lobby.
 */
export default function LobbyPinnedBanner({ groupId }: LobbyPinnedBannerProps) {
  const { data: currentUser } = useQuery(currentUserQueryOptions)
  const [lobby, setLobby] = useState<LobbyView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLobby(null)
    setError(null)
    fetchLobby(groupId)
      .then((current) => {
        if (!cancelled) {
          setLobby(current)
        }
      })
      .catch(() => {})

    const socket = getSocket()
    const onLobbyState = (payload: {
      groupId: number
      lobby: LobbyView | null
    }) => {
      if (payload.groupId === groupId) {
        setLobby(payload.lobby)
      }
    }
    socket.on('lobby:state', onLobbyState)
    return () => {
      cancelled = true
      socket.off('lobby:state', onLobbyState)
    }
  }, [groupId])

  if (!lobby || !currentUser) {
    return null
  }

  const open = lobbyIsOpen(lobby)
  const joined = lobby.players.some((player) => player.id === currentUser.id)

  const join = async () => {
    setError(null)
    try {
      await joinLobby(groupId)
    } catch (joinError) {
      setError(
        joinError instanceof Error ? joinError.message : 'Could not join',
      )
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-border bg-button-purple/15 px-3 py-2 text-xs">
      <Pin
        aria-hidden="true"
        className="size-3.5 shrink-0 text-button-purple"
      />
      <span className="min-w-0 flex-1">
        {open ? (
          joined ? (
            `You're in — waiting for the game to start (${lobby.players.length}/6)`
          ) : (
            `Private game open — ${lobby.players.length}/6 joined`
          )
        ) : (
          <>
            Private game scheduled — opens in{' '}
            <OpensIn opensAt={lobby.opensAt ?? 0} />
          </>
        )}
        {error && (
          <span className="text-destructive-foreground"> · {error}</span>
        )}
      </span>
      {open && !joined && (
        <Button size="xs" onClick={() => void join()}>
          Join
        </Button>
      )}
    </div>
  )
}
