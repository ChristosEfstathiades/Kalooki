import { RANKS, SUITS, cardPenalty, rankIndex, rankValue } from '#services/game/cards'
import { MeldError, jokerReplacementNeeds, resolveGoer } from '#services/game/melds'
import { playerState } from '#services/game/engine'
import type { Card, Rng } from '#services/game/cards'
import type { GameState, PlayerState, TabledMeld } from '#services/game/engine'
import type { GameAction } from '#services/game/match_service'

/**
 * Bot players for practice matches. `decideBotAction` returns exactly
 * one game action for the bot whose turn it is; the match service
 * applies it through the same engine path as human moves and calls
 * back for the next action, so a bot's turn unfolds step by step
 * (draw, lay, discard) like a human's.
 *
 * Fairness: bots only ever read what a human in their seat could see —
 * their own hand, the discard pile (every card in it was discarded
 * face up), tabled melds, and opponents' public counters (hand SIZE,
 * score, come-down state). Opponents' hand contents are never read.
 */

export type BotDifficulty = 'easy' | 'medium' | 'hard'

export const BOT_DIFFICULTIES: BotDifficulty[] = ['easy', 'medium', 'hard']

/* -------------------------------------------------------------------
 * Meld planning: find the best disjoint sets in a hand
 * ---------------------------------------------------------------- */

/**
 * A meld the planner may lay. Slots are in the order the engine
 * expects (runs low to high); 'joker' slots are filled with real joker
 * card ids when the action is built.
 */
interface MeldTemplate {
  type: 'group' | 'run'
  slots: (number | 'joker')[]
  naturalIds: number[]
  jokersNeeded: number
  /** Engine meld value (jokers count as the rank they represent). */
  value: number
}

/** A chosen set of disjoint melds and what the hand keeps. */
export interface MeldPlan {
  melds: MeldTemplate[]
  /** Sum of the melds' engine values (come-down threshold metric). */
  totalValue: number
  /** Natural cards consumed across all melds. */
  usedNaturalIds: Set<number>
  jokersUsed: number
  /** Cards of the hand the plan does not table. */
  leftovers: Card[]
}

interface PlanOptions {
  /** Natural card that must appear in one of the chosen melds. */
  mustUseCardId?: number
  /** Require at least one joker to be tabled (joker obligations). */
  mustUseJoker?: boolean
  /** Minimum total meld value (the come-down threshold). */
  minTotalValue?: number
  /** Cards that must stay in hand (1: keep a card to discard). */
  keepAtLeast: number
}

/** Search safety valve; hands are small so this is rarely reached. */
const MAX_SEARCH_NODES = 50_000

/**
 * Every meld shape the given cards could form. Groups pick one
 * representative card per suit; runs prefer the last duplicate copy so
 * groups and runs contend for different physical cards when the hand
 * holds duplicates.
 */
function candidateMelds(cards: Card[]): MeldTemplate[] {
  const jokersAvailable = cards.filter((card) => card.isJoker).length
  const templates: MeldTemplate[] = []

  // rank -> suit -> physical copies of that card in hand
  const copies = new Map<string, Card[]>()
  for (const card of cards) {
    if (card.isJoker || card.rank === null || card.suit === null) {
      continue
    }
    const key = `${String(card.rank)}:${card.suit}`
    copies.set(key, [...(copies.get(key) ?? []), card])
  }

  // Groups: 3-4 cards of one rank across distinct suits, jokers filling
  for (const rank of RANKS) {
    const suited: Card[] = []
    for (const suit of SUITS) {
      const copy = copies.get(`${String(rank)}:${suit}`)?.[0]
      if (copy) {
        suited.push(copy)
      }
    }
    for (let mask = 1; mask < 1 << suited.length; mask++) {
      const chosen = suited.filter((_, index) => mask & (1 << index))
      for (let jokers = 0; jokers <= Math.min(jokersAvailable, 4 - chosen.length); jokers++) {
        const size = chosen.length + jokers
        if (size < 3 || size > 4) {
          continue
        }
        templates.push({
          type: 'group',
          slots: [...chosen.map((card) => card.id), ...Array<'joker'>(jokers).fill('joker')],
          naturalIds: chosen.map((card) => card.id),
          jokersNeeded: jokers,
          value: rankValue(rank) * size,
        })
      }
    }
  }

  // Runs: 3+ consecutive ranks of one suit, jokers filling gaps/ends
  for (const suit of SUITS) {
    for (let start = 0; start < RANKS.length; start++) {
      for (let end = start + 2; end < RANKS.length; end++) {
        const slots: (number | 'joker')[] = []
        const naturalIds: number[] = []
        let jokersNeeded = 0
        let value = 0
        for (let index = start; index <= end; index++) {
          const available = copies.get(`${String(RANKS[index])}:${suit}`)
          const copy = available?.[available.length - 1]
          if (copy) {
            slots.push(copy.id)
            naturalIds.push(copy.id)
          } else {
            slots.push('joker')
            jokersNeeded += 1
          }
          value += rankValue(RANKS[index])
        }
        if (naturalIds.length === 0 || jokersNeeded > jokersAvailable) {
          continue
        }
        templates.push({ type: 'run', slots, naturalIds, jokersNeeded, value })
      }
    }
  }

  return templates
}

/**
 * The best disjoint selection of melds for a hand: maximum total meld
 * value, then more jokers tabled (15 penalty each in hand), then more
 * cards tabled. Returns null only when the options' gates (threshold /
 * required card) cannot be met; without gates the empty plan is a
 * valid result.
 */
export function bestMeldPlan(cards: Card[], options: PlanOptions): MeldPlan | null {
  const candidates = candidateMelds(cards).sort((a, b) => b.value - a.value)
  const jokerIds = cards.filter((card) => card.isJoker).map((card) => card.id)
  const maxUsable = cards.length - options.keepAtLeast

  // Value still reachable from candidate i on, for pruning
  const suffixValue: number[] = Array(candidates.length + 1).fill(0)
  for (let index = candidates.length - 1; index >= 0; index--) {
    suffixValue[index] = suffixValue[index + 1] + candidates[index].value
  }

  let nodes = 0
  let best: { melds: MeldTemplate[]; total: number; jokers: number; used: number } | null = null

  const satisfiesGates = (melds: MeldTemplate[], total: number, jokers: number): boolean => {
    if (options.minTotalValue !== undefined && total < options.minTotalValue) {
      return false
    }
    if (options.mustUseJoker && jokers === 0) {
      return false
    }
    if (
      options.mustUseCardId !== undefined &&
      !melds.some((meld) => meld.naturalIds.includes(options.mustUseCardId as number))
    ) {
      return false
    }
    return true
  }

  const consider = (melds: MeldTemplate[], total: number, jokers: number, used: number): void => {
    if (!satisfiesGates(melds, total, jokers)) {
      return
    }
    if (
      !best ||
      total > best.total ||
      (total === best.total && jokers > best.jokers) ||
      (total === best.total && jokers === best.jokers && used > best.used)
    ) {
      best = { melds: [...melds], total, jokers, used }
    }
  }

  const usedIds = new Set<number>()
  const chosen: MeldTemplate[] = []

  const search = (index: number, total: number, jokersLeft: number, used: number): void => {
    if (nodes++ > MAX_SEARCH_NODES) {
      return
    }
    consider(chosen, total, jokerIds.length - jokersLeft, used)
    if (index >= candidates.length) {
      return
    }
    // Even taking every remaining candidate cannot beat the best total
    if (best && total + suffixValue[index] < (best as { total: number }).total) {
      return
    }

    for (let next = index; next < candidates.length; next++) {
      const candidate = candidates[next]
      if (
        candidate.jokersNeeded > jokersLeft ||
        used + candidate.slots.length > maxUsable ||
        candidate.naturalIds.some((id) => usedIds.has(id))
      ) {
        continue
      }
      for (const id of candidate.naturalIds) {
        usedIds.add(id)
      }
      chosen.push(candidate)
      search(
        next + 1,
        total + candidate.value,
        jokersLeft - candidate.jokersNeeded,
        used + candidate.slots.length
      )
      chosen.pop()
      for (const id of candidate.naturalIds) {
        usedIds.delete(id)
      }
    }
  }

  search(0, 0, jokerIds.length, 0)

  if (!best) {
    return null
  }
  const found = best as { melds: MeldTemplate[]; total: number; jokers: number; used: number }
  const usedNaturalIds = new Set(found.melds.flatMap((meld) => meld.naturalIds))
  const usedJokerIds = new Set(jokerIds.slice(0, found.jokers))
  return {
    melds: found.melds,
    totalValue: found.total,
    usedNaturalIds,
    jokersUsed: found.jokers,
    leftovers: cards.filter((card) => !usedNaturalIds.has(card.id) && !usedJokerIds.has(card.id)),
  }
}

/**
 * Turns a plan into the card-id lists `layMelds` expects, assigning
 * real joker ids to joker slots. `preferredJokerId` (a joker under a
 * table-first obligation) is assigned before any other joker.
 */
function materializeMelds(plan: MeldPlan, hand: Card[], preferredJokerId?: number): number[][] {
  const jokerIds = hand.filter((card) => card.isJoker).map((card) => card.id)
  if (preferredJokerId !== undefined) {
    jokerIds.sort((a, b) => (a === preferredJokerId ? -1 : b === preferredJokerId ? 1 : 0))
  }
  let nextJoker = 0
  return plan.melds.map((meld) =>
    meld.slots.map((slot) => (slot === 'joker' ? jokerIds[nextJoker++] : slot))
  )
}

/* -------------------------------------------------------------------
 * Table reading helpers (public information only)
 * ---------------------------------------------------------------- */

/**
 * Whether a card could be added to any tabled meld right now.
 */
function fitsAnyTabledMeld(card: Card, melds: TabledMeld[]): boolean {
  for (const meld of melds) {
    for (const runEnd of ['high', 'low'] as const) {
      try {
        resolveGoer(meld, card, runEnd)
        return true
      } catch (error) {
        if (!(error instanceof MeldError)) {
          throw error
        }
      }
    }
  }
  return false
}

/**
 * Whether another copy of this card is already visibly out of play —
 * face up in the discard pile or inside a tabled meld.
 */
function copyVisiblyDead(card: Card, state: GameState): boolean {
  if (card.isJoker) {
    return false
  }
  const matches = (other: Card): boolean =>
    !other.isJoker && other.rank === card.rank && other.suit === card.suit && other.id !== card.id
  return (
    state.discardPile.some(matches) ||
    state.melds.some((meld) => meld.cards.some((meldCard) => matches(meldCard.card)))
  )
}

/** Opponents of the bot who are still in the game. */
function opponents(state: GameState, botUserId: number): PlayerState[] {
  return state.players.filter((player) => player.userId !== botUserId && !player.eliminated)
}

/* -------------------------------------------------------------------
 * Discard choice
 * ---------------------------------------------------------------- */

/**
 * Picks the card to throw. Easy dumps the highest penalty (or a random
 * card 3 times in 10); medium keeps pairs and run drafts; hard also
 * avoids feeding tabled melds opponents could use and prefers visibly
 * dead cards once an opponent is close to going out.
 */
function chooseDiscard(
  candidates: Card[],
  state: GameState,
  botUserId: number,
  difficulty: BotDifficulty,
  rng: Rng
): number {
  const nonJokers = candidates.filter((card) => !card.isJoker)
  const pool = nonJokers.length > 0 ? nonJokers : candidates
  if (pool.length === 1) {
    return pool[0].id
  }

  if (difficulty === 'easy') {
    if (rng() < 0.3) {
      return pool[Math.floor(rng() * pool.length)].id
    }
    return pool.reduce((worst, card) => (cardPenalty(card) > cardPenalty(worst) ? card : worst)).id
  }

  const rivals = opponents(state, botUserId)
  const anyOpponentDown = rivals.some((player) => player.hasComeDown)
  const endgame = rivals.some((player) => player.hand.length <= 3)

  let bestId = pool[0].id
  let bestScore = Number.NEGATIVE_INFINITY
  for (const card of pool) {
    // Higher score = better to throw away
    let score = cardPenalty(card)
    for (const other of candidates) {
      if (other.id === card.id || other.isJoker || card.isJoker) {
        continue
      }
      if (other.rank === card.rank) {
        score -= other.suit === card.suit ? 1 : 6
      } else if (
        other.suit === card.suit &&
        other.rank !== null &&
        card.rank !== null &&
        Math.abs(rankIndex(other.rank) - rankIndex(card.rank)) <= 2
      ) {
        score -= Math.abs(rankIndex(other.rank) - rankIndex(card.rank)) === 1 ? 5 : 2
      }
    }
    if (difficulty === 'hard') {
      if (anyOpponentDown && fitsAnyTabledMeld(card, state.melds)) {
        score -= 8
      }
      if (endgame && copyVisiblyDead(card, state)) {
        score += 4
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestId = card.id
    }
  }
  return bestId
}

/* -------------------------------------------------------------------
 * The decision function
 * ---------------------------------------------------------------- */

/**
 * The next action for a bot that must act: a buy-in decision on round
 * end, a draw choice, or one acting-phase step (lay, go-er, joker
 * reclaim, discard). Planning is deterministic; rng only drives the
 * mistakes lower difficulties are allowed to make.
 */
export function decideBotAction(
  state: GameState,
  botUserId: number,
  difficulty: BotDifficulty,
  rng: Rng
): GameAction {
  if (state.phase === 'roundEnd') {
    // Bots always take the buy-in they are offered
    return { type: 'buyIn', accept: true }
  }

  const me = playerState(state, botUserId)
  const threshold = state.rules.comeDownThreshold

  if (state.phase === 'awaitingDraw') {
    const top = state.discardPile[state.discardPile.length - 1]
    if (top && wantsTopDiscard(me, top, threshold, difficulty, rng)) {
      return { type: 'takeDiscard' }
    }
    return { type: 'draw' }
  }

  // Acting phase. Obligations first: a taken discard or reclaimed
  // joker must be tabled in a new set before anything else.
  if (me.pendingDiscardCardId !== null) {
    const plan = bestMeldPlan(me.hand, {
      mustUseCardId: me.pendingDiscardCardId,
      minTotalValue: me.hasComeDown ? undefined : threshold,
      keepAtLeast: 1,
    })
    if (plan && plan.melds.length > 0) {
      return { type: 'layMelds', melds: materializeMelds(plan, me.hand) }
    }
    // The take turned out not to work — put it back and draw instead
    return { type: 'returnDiscard' }
  }
  if (me.pendingJokerCardId !== null) {
    const plan = bestMeldPlan(me.hand, { mustUseJoker: true, keepAtLeast: 1 })
    if (plan && plan.melds.length > 0) {
      return {
        type: 'layMelds',
        melds: materializeMelds(plan, me.hand, me.pendingJokerCardId),
      }
    }
    // Unreachable in practice: the reclaim is only made once the new
    // set is verified. Fall through so the runner's fallback recovers.
  }

  // Lay melds when worthwhile
  const plan = bestMeldPlan(me.hand, {
    minTotalValue: me.hasComeDown ? undefined : threshold,
    keepAtLeast: 1,
  })
  if (plan && plan.melds.length > 0 && shouldLayNow(state, me, plan, difficulty, rng)) {
    return { type: 'layMelds', melds: materializeMelds(plan, me.hand) }
  }

  // Reclaim a tabled joker (hard only) when it strictly reduces the
  // penalty left in hand
  if (difficulty === 'hard' && me.hasComeDown) {
    const reclaim = findJokerReclaim(state, me)
    if (reclaim) {
      return reclaim
    }
  }

  // Add go-ers to tabled sets once down
  if (me.hasComeDown && me.hand.length > 1 && !(difficulty === 'easy' && rng() < 0.5)) {
    const goer = findGoer(state, me, difficulty)
    if (goer) {
      return goer
    }
  }

  // Discard, protecting the cards the current best plan wants to keep
  const protection = bestMeldPlan(me.hand, { keepAtLeast: 1 })
  const candidates =
    protection && protection.leftovers.length > 0 && protection.leftovers.length < me.hand.length
      ? protection.leftovers
      : me.hand
  return {
    type: 'discard',
    cardId: chooseDiscard(candidates, state, me.userId, difficulty, rng),
  }
}

/**
 * Whether to take the top discard. The engine requires it be tabled in
 * a new set immediately (with the full come-down when not yet down),
 * so this asks the planner whether such a lay exists. Easy only
 * bothers to look 3 times in 10.
 */
function wantsTopDiscard(
  me: PlayerState,
  top: Card,
  threshold: number,
  difficulty: BotDifficulty,
  rng: Rng
): boolean {
  if (difficulty === 'easy' && rng() >= 0.3) {
    return false
  }
  const plan = bestMeldPlan([...me.hand, top], {
    mustUseCardId: top.id,
    minTotalValue: me.hasComeDown ? undefined : threshold,
    keepAtLeast: 1,
  })
  return plan !== null && plan.melds.length > 0
}

/**
 * Whether to lay the planned melds this turn. Laying all but one card
 * is (almost) always taken — before coming down that wins the round
 * with a kalooki. Hard sometimes holds a near-complete hand back to
 * chase the kalooki; easy dawdles at random.
 */
function shouldLayNow(
  state: GameState,
  me: PlayerState,
  plan: MeldPlan,
  difficulty: BotDifficulty,
  rng: Rng
): boolean {
  const leftoverCount = plan.leftovers.length
  if (leftoverCount === 1) {
    // Going out this turn — only easy can fumble it
    return difficulty === 'easy' ? rng() < 0.9 : true
  }

  if (difficulty === 'easy') {
    return rng() < 0.7
  }
  if (difficulty === 'hard' && !me.hasComeDown && leftoverCount === 2) {
    // Two cards short of a kalooki: hold while it looks safe
    const rivals = opponents(state, me.userId)
    const safe =
      rivals.every((player) => !player.hasComeDown && player.hand.length > 5) &&
      state.deck.length > 40
    if (safe) {
      return false
    }
  }
  return true
}

/**
 * A go-er to play, if any card in hand fits a tabled meld. Medium and
 * hard shed the highest-penalty fitting card; easy plays the first it
 * notices. Jokers are never spent as go-ers by medium/hard (a joker in
 * hand is 15 penalty, but tabling it inside a new set keeps it working
 * — as a go-er it can never be reclaimed by the bot later anyway; easy
 * happily wastes it).
 */
function findGoer(state: GameState, me: PlayerState, difficulty: BotDifficulty): GameAction | null {
  let best: { action: GameAction; penalty: number } | null = null
  for (const card of me.hand) {
    if (card.isJoker && difficulty !== 'easy') {
      continue
    }
    for (const meld of state.melds) {
      for (const runEnd of ['high', 'low'] as const) {
        try {
          resolveGoer(meld, card, runEnd)
        } catch (error) {
          if (!(error instanceof MeldError)) {
            throw error
          }
          continue
        }
        const action: GameAction = { type: 'goer', meldId: meld.id, cardId: card.id, runEnd }
        if (difficulty === 'easy') {
          return action
        }
        if (!best || cardPenalty(card) > best.penalty) {
          best = { action, penalty: cardPenalty(card) }
        }
      }
    }
  }
  return best?.action ?? null
}

/**
 * A joker reclaim that pays off: the hand holds every natural
 * replacement a tabled joker needs, the freed joker can be tabled in a
 * new set at once, and doing so strictly lowers the penalty left in
 * hand afterwards.
 */
function findJokerReclaim(state: GameState, me: PlayerState): GameAction | null {
  const currentPenalty = me.hand.reduce((sum, card) => sum + cardPenalty(card), 0)

  for (const meld of state.melds) {
    for (const meldCard of meld.cards) {
      if (!meldCard.card.isJoker) {
        continue
      }
      let needs: ReturnType<typeof jokerReplacementNeeds>
      try {
        needs = jokerReplacementNeeds(meld, meldCard.card.id)
      } catch (error) {
        if (!(error instanceof MeldError)) {
          throw error
        }
        continue
      }

      // Match each needed rank+suit to a distinct card in hand
      const replacementIds: number[] = []
      const available = [...me.hand]
      const covered = needs.every((need) => {
        const index = available.findIndex(
          (card) => !card.isJoker && card.rank === need.rank && card.suit === need.suit
        )
        if (index === -1) {
          return false
        }
        replacementIds.push(available[index].id)
        available.splice(index, 1)
        return true
      })
      if (!covered) {
        continue
      }

      // Simulate: replacements leave the hand, the joker joins it, and
      // the joker must be tabled in a new set this turn
      const simulated = [
        ...me.hand.filter((card) => !replacementIds.includes(card.id)),
        meldCard.card,
      ]
      const plan = bestMeldPlan(simulated, { mustUseJoker: true, keepAtLeast: 1 })
      if (!plan || plan.melds.length === 0) {
        continue
      }
      const afterPenalty = plan.leftovers.reduce((sum, card) => sum + cardPenalty(card), 0)
      if (afterPenalty < currentPenalty) {
        return {
          type: 'takeJoker',
          meldId: meld.id,
          jokerCardId: meldCard.card.id,
          replacementCardIds: replacementIds,
        }
      }
    }
  }
  return null
}
