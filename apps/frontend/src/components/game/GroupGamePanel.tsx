import { useEffect, useState } from 'react'
import {
  UNLIMITED_BUY_INS,
  createLobby,
  fetchLobby,
  joinLobby,
  leaveLobby,
  lobbyIsOpen,
  startLobby,
} from '#/lib/game'
import { getSocket } from '#/lib/socket'
import {
  storedNumber,
  storedObject,
  storedOption,
  useStoredState,
} from '#/lib/preferences'
import OpensIn from '#/components/game/OpensIn'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Switch } from '#/components/ui/switch'
import type { CustomRulesInput, LobbyView, MatchStakesView } from '#/lib/game'

interface GroupGamePanelProps {
  groupId: number
  currentUserId: number
  isOwner: boolean
}

const DEFAULT_RULES: Omit<CustomRulesInput, 'stakes'> = {
  decks: 2,
  jokers: 2,
  comeDownThreshold: 40,
  scoreLimit: 150,
  moveTimeMinutes: 30,
  rejoinMinutes: 5,
  buyInsPerPlayer: 1,
}

/** Default chip amounts, mirroring the example scoresheet. */
const DEFAULT_STAKES: MatchStakesView = {
  stake: 4,
  rebuy: 4,
  kalooki: 2,
  call: 1,
}

const COME_DOWN_OPTIONS = [40, 50]
const SCORE_LIMIT_OPTIONS = [101, 150]
const BUY_IN_OPTIONS = [0, 1, 2, 3, UNLIMITED_BUY_INS]

const PRIVATE_SETUP_KEY = 'private-game-setup'

interface PrivateGameSetup {
  rules: Omit<CustomRulesInput, 'stakes'>
  playMoney: boolean
  stakes: MatchStakesView
}

const DEFAULT_SETUP: PrivateGameSetup = {
  rules: DEFAULT_RULES,
  playMoney: false,
  stakes: DEFAULT_STAKES,
}

/**
 * Validates the remembered setup field by field against the ranges the
 * form allows, so a stored value from an older release (or one the
 * server would now reject) falls back to the default rather than
 * pre-filling the form with something unusable.
 */
function parsePrivateGameSetup(stored: unknown): PrivateGameSetup | null {
  const setup = storedObject(stored)
  if (setup === null) {
    return null
  }
  const rules = storedObject(setup.rules) ?? {}
  const stakes = storedObject(setup.stakes) ?? {}
  const stakeAmount = (value: unknown, fallback: number): number =>
    storedNumber(value, 0, 1000, fallback)

  return {
    rules: {
      decks: storedNumber(rules.decks, 2, 4, DEFAULT_RULES.decks),
      jokers: storedNumber(rules.jokers, 0, 4, DEFAULT_RULES.jokers),
      comeDownThreshold: storedOption(
        rules.comeDownThreshold,
        COME_DOWN_OPTIONS,
        DEFAULT_RULES.comeDownThreshold,
      ),
      scoreLimit: storedOption(
        rules.scoreLimit,
        SCORE_LIMIT_OPTIONS,
        DEFAULT_RULES.scoreLimit,
      ),
      moveTimeMinutes: storedNumber(
        rules.moveTimeMinutes,
        5,
        120,
        DEFAULT_RULES.moveTimeMinutes,
      ),
      rejoinMinutes: storedNumber(
        rules.rejoinMinutes,
        1,
        15,
        DEFAULT_RULES.rejoinMinutes,
      ),
      buyInsPerPlayer: storedOption(
        rules.buyInsPerPlayer,
        BUY_IN_OPTIONS,
        DEFAULT_RULES.buyInsPerPlayer,
      ),
    },
    playMoney: setup.playMoney === true,
    stakes: {
      stake: stakeAmount(stakes.stake, DEFAULT_STAKES.stake),
      rebuy: stakeAmount(stakes.rebuy, DEFAULT_STAKES.rebuy),
      kalooki: stakeAmount(stakes.kalooki, DEFAULT_STAKES.kalooki),
      call: stakeAmount(stakes.call, DEFAULT_STAKES.call),
    },
  }
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
  // The rules and stakes the owner last set up carry over to the next
  // game they create; when the game starts is deliberately not
  // remembered, so a game is never scheduled by accident
  const [setup, setSetup] = useStoredState(
    PRIVATE_SETUP_KEY,
    DEFAULT_SETUP,
    parsePrivateGameSetup,
  )
  const [scheduleHours, setScheduleHours] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const { rules, playMoney, stakes } = setup

  const setRules = (
    update: (
      current: Omit<CustomRulesInput, 'stakes'>,
    ) => Omit<CustomRulesInput, 'stakes'>,
  ): void =>
    setSetup((current) => ({ ...current, rules: update(current.rules) }))

  const setStakes = (
    update: (current: MatchStakesView) => MatchStakesView,
  ): void =>
    setSetup((current) => ({ ...current, stakes: update(current.stakes) }))

  const setPlayMoney = (value: boolean): void =>
    setSetup((current) => ({ ...current, playMoney: value }))

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
    key: keyof Omit<CustomRulesInput, 'stakes'>,
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

  const ruleSelect = (
    label: string,
    key: keyof Omit<CustomRulesInput, 'stakes'>,
    options: number[],
  ): React.ReactNode => (
    <div className="space-y-1">
      <Label htmlFor={`rule-${key}`} className="text-xs">
        {label}
      </Label>
      <Select
        value={String(rules[key])}
        onValueChange={(value) =>
          setRules((current) => ({
            ...current,
            [key]: Number(value),
          }))
        }
      >
        <SelectTrigger id={`rule-${key}`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  const stakeField = (
    label: string,
    key: keyof MatchStakesView,
  ): React.ReactNode => (
    <div className="space-y-1">
      <Label htmlFor={`stake-${key}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`stake-${key}`}
        type="number"
        min={0}
        max={1000}
        value={stakes[key]}
        onChange={(event) =>
          setStakes((current) => ({
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
          {lobbyIsOpen(lobby) ? (
            <p className="m-0 text-sm">
              Game being set up · {lobby.players.length}/6 joined
              {lobby.players.length > 0
                ? `: ${lobby.players.map((player) => player.username).join(', ')}`
                : ''}
            </p>
          ) : (
            <p className="m-0 text-sm">
              Game scheduled, opens for joining in{' '}
              <OpensIn opensAt={lobby.opensAt ?? 0} />.
            </p>
          )}
          {lobby.rules.stakes && (
            <p className="m-0 text-xs text-muted-foreground">
              Play money (chips): stake {lobby.rules.stakes.stake} · buy-in{' '}
              {lobby.rules.stakes.rebuy} · kalooki {lobby.rules.stakes.kalooki}{' '}
              · each call {lobby.rules.stakes.call}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {lobbyIsOpen(lobby) &&
              (lobby.players.some((player) => player.id === currentUserId) ? (
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
              ))}
            {lobby.ownerId === currentUserId &&
              !lobby.players.some((player) => player.id === currentUserId) && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void run(() => leaveLobby(groupId))}
                >
                  {lobbyIsOpen(lobby) ? 'Cancel game' : 'Cancel scheduled game'}
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
              {ruleSelect(
                'Come down at',
                'comeDownThreshold',
                COME_DOWN_OPTIONS,
              )}
              {ruleSelect('Score limit', 'scoreLimit', SCORE_LIMIT_OPTIONS)}
              {ruleField('Move bank (min)', 'moveTimeMinutes', 5, 120)}
              {ruleField('Rejoin (min)', 'rejoinMinutes', 1, 15)}
              <div className="space-y-1">
                <Label htmlFor="rule-buyIns" className="text-xs">
                  Buy-ins per player
                </Label>
                <Select
                  value={String(rules.buyInsPerPlayer)}
                  onValueChange={(value) =>
                    setRules((current) => ({
                      ...current,
                      buyInsPerPlayer: Number(value),
                    }))
                  }
                >
                  <SelectTrigger id="rule-buyIns" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">None</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value={String(UNLIMITED_BUY_INS)}>
                      Unlimited
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rule-schedule" className="text-xs">
                  Starts
                </Label>
                <Select
                  value={String(scheduleHours)}
                  onValueChange={(value) => setScheduleHours(Number(value))}
                >
                  <SelectTrigger id="rule-schedule" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Now</SelectItem>
                    <SelectItem value="1">In 1 hour</SelectItem>
                    <SelectItem value="3">In 3 hours</SelectItem>
                    <SelectItem value="6">In 6 hours</SelectItem>
                    <SelectItem value="12">In 12 hours</SelectItem>
                    <SelectItem value="24">In 24 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {scheduleHours > 0 && (
              <p className="m-0 text-xs text-muted-foreground">
                Nobody can join until the game opens; it will be pinned in the
                group&apos;s chat, and members join once the countdown ends.
              </p>
            )}

            <div className="space-y-2 rounded-md border border-border bg-background/50 p-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="play-money"
                  checked={playMoney}
                  onCheckedChange={setPlayMoney}
                />
                <Label htmlFor="play-money" className="text-xs">
                  Play for chips (play money)
                </Label>
              </div>
              {playMoney && (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {stakeField('Stake', 'stake')}
                    {stakeField('Buy-in cost', 'rebuy')}
                    {stakeField('Kalooki', 'kalooki')}
                    {stakeField('Each call', 'call')}
                  </div>
                  <p className="m-0 text-xs text-muted-foreground">
                    Chips are play money, tallied on the scoresheet. Each round
                    the caller collects the call amount from every other player,
                    or the kalooki amount instead when they lay all 13 cards in
                    one turn. The winner collects everyone&apos;s stake plus the
                    cost of their buy-ins.
                  </p>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  void run(() =>
                    createLobby(
                      groupId,
                      { ...rules, stakes: playMoney ? stakes : null },
                      scheduleHours,
                    ),
                  )
                }
              >
                {scheduleHours > 0 ? 'Schedule the game' : 'Open the lobby'}
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
