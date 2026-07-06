import { useEffect, useState } from 'react'
import {
  createLobby,
  fetchLobby,
  joinLobby,
  leaveLobby,
  startLobby,
} from '#/lib/game'
import { getSocket } from '#/lib/socket'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import type { CustomRulesInput, LobbyView } from '#/lib/game'

interface GroupGamePanelProps {
  groupId: number
  currentUserId: number
  isOwner: boolean
}

const DEFAULT_RULES: CustomRulesInput = {
  decks: 2,
  jokers: 2,
  comeDownThreshold: 40,
  moveTimeMinutes: 30,
  rejoinMinutes: 5,
}

/**
 * The group's game corner: the owner sets up a private match with
 * custom rules (docs/Kalooki.md), members join the lobby, and the
 * owner starts it once 2+ players are in. One game per group at a
 * time.
 */
export default function GroupGamePanel({
  groupId,
  currentUserId,
  isOwner,
}: GroupGamePanelProps) {
  const [lobby, setLobby] = useState<LobbyView | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [rules, setRules] = useState<CustomRulesInput>(DEFAULT_RULES)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
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

  const run = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await action()
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Something went wrong',
      )
    }
  }

  const ruleField = (
    label: string,
    key: keyof CustomRulesInput,
    min: number,
    max: number,
  ): React.ReactNode => (
    <div className="space-y-1">
      <Label htmlFor={`rule-${key}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`rule-${key}`}
        type="number"
        min={min}
        max={max}
        value={rules[key]}
        onChange={(event) =>
          setRules((current) => ({
            ...current,
            [key]: Number(event.target.value),
          }))
        }
      />
    </div>
  )

  return (
    <section className="rounded-md border border-border bg-muted/50 p-3">
      <h3 className="m-0 text-sm font-semibold text-muted-foreground">
        Private game
      </h3>
      {error && (
        <p className="mt-1 mb-0 text-xs text-destructive-foreground">{error}</p>
      )}

      {lobby ? (
        <div className="mt-2 space-y-2">
          <p className="m-0 text-sm">
            Game being set up · {lobby.players.length}/6 joined:{' '}
            {lobby.players.map((player) => player.username).join(', ')}
          </p>
          <div className="flex flex-wrap gap-2">
            {lobby.players.some((player) => player.id === currentUserId) ? (
              <>
                {lobby.ownerId === currentUserId && (
                  <Button
                    size="sm"
                    className="bg-button-red hover:bg-button-red-hover"
                    disabled={lobby.players.length < 2}
                    onClick={() => void run(() => startLobby(groupId))}
                  >
                    {lobby.players.length < 2
                      ? 'Waiting for players…'
                      : 'Start the game'}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void run(() => leaveLobby(groupId))}
                >
                  {lobby.ownerId === currentUserId ? 'Cancel game' : 'Leave'}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => void run(() => joinLobby(groupId))}
              >
                Join the game
              </Button>
            )}
          </div>
        </div>
      ) : isOwner ? (
        showSetup ? (
          <div className="mt-2 space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ruleField('Decks (2-4)', 'decks', 2, 4)}
              {ruleField('Jokers (0-4)', 'jokers', 0, 4)}
              {ruleField('Come down at', 'comeDownThreshold', 5, 150)}
              {ruleField('Move bank (min)', 'moveTimeMinutes', 5, 120)}
              {ruleField('Rejoin (min)', 'rejoinMinutes', 1, 15)}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => void run(() => createLobby(groupId, rules))}
              >
                Open the lobby
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSetup(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <Button size="sm" onClick={() => setShowSetup(true)}>
              Set up a game
            </Button>
          </div>
        )
      ) : (
        <p className="mt-1 mb-0 text-xs text-muted-foreground">
          The group owner can start a game here.
        </p>
      )}
    </section>
  )
}
