import { test } from '@japa/runner'
import { bestMeldPlan, decideBotAction } from '#services/game/bot'
import {
  CLASSIC_RULES,
  addGoer,
  createGame,
  decideBuyIn,
  discard,
  drawFromDeck,
  layMelds,
  returnDiscard,
  takeDiscard,
  takeJoker,
} from '#services/game/engine'
import type { BotDifficulty } from '#services/game/bot'
import type { Card, Rank, Rng, Suit } from '#services/game/cards'
import type { GameState } from '#services/game/engine'
import type { GameAction } from '#services/game/match_service'

/** Deterministic rng for reproducible games. */
function lcg(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

let nextCardId = 1

function card(rank: Rank, suit: Suit): Card {
  return { id: nextCardId++, isJoker: false, rank, suit }
}

function joker(): Card {
  return { id: nextCardId++, isJoker: true, rank: null, suit: null }
}

/**
 * A hand-rolled single-round state where it is player 1's turn to
 * draw. Deck cards are junk so draws never surprise the assertions.
 */
function stateWithHands(hands: Card[][], discardPile: Card[]): GameState {
  return {
    rules: CLASSIC_RULES,
    players: hands.map((hand, index) => ({
      userId: index + 1,
      hand,
      hasComeDown: false,
      score: 0,
      buyInsUsed: 0,
      chips: 0,
      comeDownAtTurnStart: null,
      eliminated: false,
      removed: false,
      pendingDiscardCardId: null,
      pendingJokerCardId: null,
    })),
    deck: [card(2, 'hearts'), card(4, 'spades'), card(6, 'diamonds'), card(8, 'clubs')],
    discardPile,
    melds: [],
    nextMeldId: 1,
    currentPlayerIndex: 0,
    dealerIndex: hands.length - 1,
    phase: 'awaitingDraw',
    roundNumber: 1,
    roundResults: [],
    pendingBuyIns: [],
    winnerUserId: null,
  }
}

/**
 * Applies a bot-chosen action through the real engine, so any illegal
 * choice throws.
 */
function applySimAction(state: GameState, userId: number, action: GameAction, rng: Rng): void {
  switch (action.type) {
    case 'draw':
      drawFromDeck(state, userId, rng)
      return
    case 'takeDiscard':
      takeDiscard(state, userId)
      return
    case 'returnDiscard':
      returnDiscard(state, userId)
      return
    case 'layMelds':
      layMelds(state, userId, action.melds)
      return
    case 'goer':
      addGoer(state, userId, action)
      return
    case 'takeJoker':
      takeJoker(state, userId, action)
      return
    case 'discard':
      discard(state, userId, action.cardId, rng)
      return
    case 'buyIn':
      decideBuyIn(state, userId, action.accept, rng)
      return
    default:
      throw new Error(`Bots should never choose action "${action.type}"`)
  }
}

/**
 * Plays a full 3-player game with every seat driven by the bot at the
 * given difficulty. Returns the finished state; throws if any bot
 * move is illegal or the game fails to finish.
 */
function playFullGame(difficulty: BotDifficulty, seed: number): GameState {
  const rng = lcg(seed)
  // A lower score limit keeps the simulated games short
  const state = createGame([1, 2, 3], { ...CLASSIC_RULES, scoreLimit: 60 }, rng)

  for (let step = 0; step < 30_000; step++) {
    if (state.phase === 'finished') {
      return state
    }
    const actor =
      state.phase === 'roundEnd'
        ? state.pendingBuyIns[0]
        : state.players[state.currentPlayerIndex].userId
    const action = decideBotAction(state, actor, difficulty, rng)
    applySimAction(state, actor, action, rng)
  }
  throw new Error(`The ${difficulty} game did not finish within the step budget`)
}

test.group('Bot meld planning', () => {
  test('finds the best disjoint melds and what stays in hand', ({ assert }) => {
    const kings = [card('K', 'hearts'), card('K', 'diamonds'), card('K', 'clubs')]
    const run = [card(5, 'hearts'), card(6, 'hearts'), card(7, 'hearts')]
    const junk = card(2, 'clubs')
    const hand = [...kings, ...run, junk]

    const plan = bestMeldPlan(hand, { keepAtLeast: 1 })
    assert.isNotNull(plan)
    assert.equal(plan?.totalValue, 48)
    assert.lengthOf(plan?.melds ?? [], 2)
    assert.deepEqual(
      plan?.leftovers.map((leftover) => leftover.id),
      [junk.id]
    )
  })

  test('gates on the come-down threshold and a required card', ({ assert }) => {
    const hand = [
      card('K', 'hearts'),
      card('K', 'diamonds'),
      card('K', 'clubs'),
      card(5, 'hearts'),
      card(6, 'hearts'),
      card(7, 'hearts'),
      card(2, 'clubs'),
    ]

    assert.isNull(bestMeldPlan(hand, { keepAtLeast: 1, minTotalValue: 60 }))
    // The junk two of clubs cannot be part of any meld
    assert.isNull(bestMeldPlan(hand, { keepAtLeast: 1, mustUseCardId: hand[6].id }))
  })

  test('always keeps a card to discard', ({ assert }) => {
    // Fully meldable six cards: laying everything would leave nothing
    const hand = [
      card('K', 'hearts'),
      card('K', 'diamonds'),
      card('K', 'clubs'),
      card(5, 'hearts'),
      card(6, 'hearts'),
      card(7, 'hearts'),
    ]

    const plan = bestMeldPlan(hand, { keepAtLeast: 1 })
    assert.isNotNull(plan)
    // Only one meld fits: the kings outscore the run
    assert.equal(plan?.totalValue, 30)
    assert.lengthOf(plan?.leftovers ?? [], 3)
  })

  test('fills run gaps and short groups with jokers', ({ assert }) => {
    const runPlan = bestMeldPlan(
      [card(5, 'hearts'), card(6, 'hearts'), card(8, 'hearts'), joker(), card(2, 'clubs')],
      { keepAtLeast: 1 }
    )
    assert.equal(runPlan?.totalValue, 5 + 6 + 7 + 8)
    assert.equal(runPlan?.jokersUsed, 1)

    const groupPlan = bestMeldPlan(
      [card(9, 'hearts'), card(9, 'clubs'), joker(), card(2, 'clubs')],
      { keepAtLeast: 1 }
    )
    assert.equal(groupPlan?.totalValue, 27)
    assert.equal(groupPlan?.jokersUsed, 1)
  })
})

test.group('Bot decisions', () => {
  test('takes a useful discard, tables the come-down, then discards', ({ assert }) => {
    const nines = [card(9, 'hearts'), card(9, 'clubs')]
    const kings = [card('K', 'hearts'), card('K', 'diamonds'), card('K', 'clubs')]
    const junk = [
      card(2, 'clubs'),
      card(3, 'hearts'),
      card(4, 'diamonds'),
      card(5, 'clubs'),
      card(6, 'spades'),
      card(7, 'diamonds'),
      card(10, 'spades'),
      card('Q', 'hearts'),
    ]
    const topDiscard = card(9, 'spades')
    const rng = lcg(3)
    const state = stateWithHands(
      [
        [...kings, ...nines, ...junk],
        [card(2, 'diamonds'), card(3, 'spades'), card(4, 'clubs')],
      ],
      [topDiscard]
    )

    // Easy rarely even looks at the discard pile (rng 0.9 >= 0.3)
    assert.deepEqual(
      decideBotAction(state, 1, 'easy', () => 0.9),
      { type: 'draw' }
    )

    // Medium sees kings + nines-with-the-discard clear the threshold
    const take = decideBotAction(state, 1, 'medium', rng)
    assert.equal(take.type, 'takeDiscard')
    applySimAction(state, 1, take, rng)

    // The taken card must now be tabled with the full come-down
    const lay = decideBotAction(state, 1, 'medium', rng)
    assert.equal(lay.type, 'layMelds')
    applySimAction(state, 1, lay, rng)

    const me = state.players[0]
    assert.isTrue(me.hasComeDown)
    assert.isNull(me.pendingDiscardCardId)
    assert.lengthOf(state.melds, 2)
    assert.isTrue(
      state.melds.some((meld) => meld.cards.some((meldCard) => meldCard.card.id === topDiscard.id))
    )

    // Nothing else melds, no go-er fits: the turn ends on a discard of
    // one of the highest-penalty junk cards
    const finish = decideBotAction(state, 1, 'medium', rng)
    assert.equal(finish.type, 'discard')
    if (finish.type === 'discard') {
      const thrown = junk.filter((junkCard) => ['Q', 10].includes(junkCard.rank as Rank | string))
      assert.include(
        thrown.map((junkCard) => junkCard.id),
        finish.cardId
      )
    }
  })

  test('easy bots play a full game to completion', ({ assert }) => {
    const state = playFullGame('easy', 101)
    assert.equal(state.phase, 'finished')
    assert.isNotNull(state.winnerUserId)
    assert.isAtLeast(state.roundResults.length, 1)
  }).timeout(60_000)

  test('medium bots play a full game to completion', ({ assert }) => {
    const state = playFullGame('medium', 202)
    assert.equal(state.phase, 'finished')
    assert.isNotNull(state.winnerUserId)
    assert.isAtLeast(state.roundResults.length, 1)
  }).timeout(60_000)

  test('hard bots play a full game to completion', ({ assert }) => {
    const state = playFullGame('hard', 303)
    assert.equal(state.phase, 'finished')
    assert.isNotNull(state.winnerUserId)
    assert.isAtLeast(state.roundResults.length, 1)
  }).timeout(60_000)
})
