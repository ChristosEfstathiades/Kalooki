import type Match from '#models/match'
import { publicUserShape } from '#transformers/public_user_transformer'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type { GameRules, RoundResult } from '#services/game/engine'

/**
 * A recorded match with everything docs/features.md asks for: winner,
 * full scoresheet, players with final placements, timing, and the
 * rules in effect. Expects matchPlayers.user to be preloaded.
 */
export default class MatchTransformer extends BaseTransformer<Match> {
  toObject() {
    // Matches recorded before play money predate the stakes/chips
    // fields, so fill in the defaults for a chip-less game
    const rules = JSON.parse(this.resource.rules) as GameRules
    const scoresheet = JSON.parse(this.resource.scoresheet) as RoundResult[]

    return {
      ...this.pick(this.resource, ['id', 'kind', 'winnerUserId', 'botDifficulty']),
      // SQLite hands booleans back as 0/1
      completed: Boolean(this.resource.completed),
      startedAt: this.resource.startedAt.toISO(),
      endedAt: this.resource.endedAt.toISO(),
      durationSeconds: Math.max(
        0,
        Math.round(this.resource.endedAt.diff(this.resource.startedAt).as('seconds'))
      ),
      rules: { ...rules, stakes: rules.stakes ?? null },
      scoresheet: scoresheet.map((round) => ({
        ...round,
        calledKalooki: round.calledKalooki ?? false,
        chips: round.chips ?? {},
      })),
      players: this.resource.matchPlayers
        .slice()
        .sort((a, b) => a.placement - b.placement)
        .map((matchPlayer) => ({
          ...publicUserShape(matchPlayer.user),
          placement: matchPlayer.placement,
          finalScore: matchPlayer.finalScore,
          leftEarly: Boolean(matchPlayer.leftEarly),
          chipsNet: matchPlayer.chipsNet,
        })),
    }
  }
}
