import { test } from '@japa/runner'
import {
  CLASSIC_RULES,
  GameError,
  UNLIMITED_BUY_INS,
  activePlayers,
  createGame,
  decideBuyIn,
  discard,
  drawFromDeck,
  layMelds,
  addGoer,
  playerState,
  removePlayer,
  returnDiscard,
  takeDiscard,
  takeJoker,
} from '#services/game/engine'
import type { GameRules, GameState } from '#services/game/engine'
import type { Card, Rank, Rng, Suit } from '#services/game/cards'

/** Deterministic rng: always picks the first option / no-op shuffles. */
const rng: Rng = () => 0

let nextId = 1000

function card(rank: Rank, suit: Suit): Card {
  return { id: nextId++, isJoker: false, rank, suit }
}

function joker(): Card {
  return { id: nextId++, isJoker: true, rank: null, suit: null }
}

/**
 * Fresh 2-4 player classic game. Player user ids are 1..n.
 */
function makeGame(playerCount = 2): GameState {
  return createGame(
    Array.from({ length: playerCount }, (_, index) => index + 1),
    CLASSIC_RULES,
    rng
  )
}

/**
 * Puts the game in a controlled turn state: the given user is current,
 * has drawn already (phase 'acting'), and holds exactly these cards.
 */
function setTurn(state: GameState, userId: number, hand: Card[]): void {
  state.currentPlayerIndex = state.players.findIndex((player) => player.userId === userId)
  state.phase = 'acting'
  const player = playerState(state, userId)
  player.hand = hand
}

/** A 40+ point come-down: three kings and three queens (60 points). */
function comeDownHand(): Card[] {
  return [
    card('K', 'hearts'),
    card('K', 'clubs'),
    card('K', 'spades'),
    card('Q', 'hearts'),
    card('Q', 'clubs'),
    card('Q', 'spades'),
    card(2, 'hearts'),
  ]
}

test.group('Engine — setup and turns', () => {
  test('deals 13 cards each from the classic 106-card pile', ({ assert }) => {
    const state = makeGame(4)
    for (const player of state.players) {
      assert.lengthOf(player.hand, 13)
    }
    assert.lengthOf(state.deck, 106 - 4 * 13)
    assert.lengthOf(state.discardPile, 0)
    assert.equal(state.phase, 'awaitingDraw')
  })

  test('rejects fewer than 2 or more than 6 players', ({ assert }) => {
    assert.throws(() => createGame([1], CLASSIC_RULES, rng), GameError)
    assert.throws(() => createGame([1, 2, 3, 4, 5, 6, 7], CLASSIC_RULES, rng), GameError)
  })

  test('drawing out of turn or twice is rejected', ({ assert }) => {
    const state = makeGame(2)
    const current = state.players[state.currentPlayerIndex].userId
    const other = state.players.find((player) => player.userId !== current)?.userId as number

    assert.throws(() => drawFromDeck(state, other, rng), GameError)

    drawFromDeck(state, current, rng)
    assert.equal(playerState(state, current).hand.length, 14)
    assert.throws(() => drawFromDeck(state, current, rng), GameError)
  })

  test('discarding passes the turn to the next player', ({ assert }) => {
    const state = makeGame(3)
    const current = state.players[state.currentPlayerIndex].userId
    const drawn = drawFromDeck(state, current, rng)
    discard(state, current, drawn.id, rng)

    assert.equal(state.phase, 'awaitingDraw')
    assert.notEqual(state.players[state.currentPlayerIndex].userId, current)
    assert.equal(state.discardPile.length, 1)
  })
})

test.group('Engine — coming down and melding', () => {
  test('coming down below the threshold is rejected', ({ assert }) => {
    const state = makeGame(2)
    const userId = state.players[state.currentPlayerIndex].userId
    const low = [card(2, 'hearts'), card(2, 'clubs'), card(2, 'spades'), card(9, 'hearts')]
    setTurn(state, userId, low)

    assert.throws(
      () => layMelds(state, userId, [[low[0].id, low[1].id, low[2].id]]),
      /Coming down needs sets worth 40\+/
    )
  })

  test('coming down with 40+ across multiple sets works', ({ assert }) => {
    const state = makeGame(2)
    const userId = state.players[state.currentPlayerIndex].userId
    const hand = comeDownHand()
    setTurn(state, userId, hand)

    layMelds(state, userId, [
      [hand[0].id, hand[1].id, hand[2].id],
      [hand[3].id, hand[4].id, hand[5].id],
    ])

    const player = playerState(state, userId)
    assert.isTrue(player.hasComeDown)
    assert.lengthOf(state.melds, 2)
    assert.lengthOf(player.hand, 1)
  })

  test('after coming down, low-value sets may be laid', ({ assert }) => {
    const state = makeGame(2)
    const userId = state.players[state.currentPlayerIndex].userId
    const low = [card(2, 'hearts'), card(2, 'clubs'), card(2, 'spades'), card(9, 'hearts')]
    setTurn(state, userId, low)
    playerState(state, userId).hasComeDown = true

    layMelds(state, userId, [[low[0].id, low[1].id, low[2].id]])
    assert.lengthOf(state.melds, 1)
  })

  test('you must keep a card to discard', ({ assert }) => {
    const state = makeGame(2)
    const userId = state.players[state.currentPlayerIndex].userId
    const hand = [card('K', 'hearts'), card('K', 'clubs'), card('K', 'spades')]
    setTurn(state, userId, hand)
    playerState(state, userId).hasComeDown = true

    assert.throws(
      () => layMelds(state, userId, [[hand[0].id, hand[1].id, hand[2].id]]),
      /keep a card to discard/
    )
  })

  test('go-ers require having come down', ({ assert }) => {
    const state = makeGame(2)
    const userId = state.players[state.currentPlayerIndex].userId
    const hand = comeDownHand()
    setTurn(state, userId, hand)
    layMelds(state, userId, [
      [hand[0].id, hand[1].id, hand[2].id],
      [hand[3].id, hand[4].id, hand[5].id],
    ])

    // Complete the kings group with the fourth king
    const fourthKing = card('K', 'diamonds')
    const player = playerState(state, userId)
    player.hand.push(fourthKing)
    addGoer(state, userId, { meldId: state.melds[0].id, cardId: fourthKing.id })
    assert.lengthOf(state.melds[0].cards, 4)

    // The other player has not come down and cannot add go-ers
    const otherId = state.players.find((candidate) => candidate.userId !== userId)?.userId as number
    const otherKing = card('K', 'diamonds')
    playerState(state, otherId).hand.push(otherKing)
    state.currentPlayerIndex = state.players.findIndex((player2) => player2.userId === otherId)
    assert.throws(
      () => addGoer(state, otherId, { meldId: state.melds[0].id, cardId: otherKing.id }),
      /after coming down/
    )
  })
})

test.group('Engine — the discard pile', () => {
  test('a taken discard must be tabled before discarding', ({ assert }) => {
    const state = makeGame(2)
    const userId = state.players[state.currentPlayerIndex].userId

    // Seed the pile with a king and give the player 40+ around it
    const kingOnPile = card('K', 'diamonds')
    state.discardPile = [kingOnPile]
    const hand = [
      card('K', 'hearts'),
      card('K', 'clubs'),
      card('Q', 'hearts'),
      card('Q', 'clubs'),
      card('Q', 'spades'),
      card(2, 'hearts'),
    ]
    playerState(state, userId).hand = hand

    takeDiscard(state, userId)
    assert.equal(playerState(state, userId).pendingDiscardCardId, kingOnPile.id)

    // Discarding before tabling the taken card is blocked
    assert.throws(() => discard(state, userId, hand[5].id, rng), /must be tabled/)

    // Using it in the come-down clears the obligation
    layMelds(state, userId, [
      [hand[0].id, hand[1].id, kingOnPile.id],
      [hand[2].id, hand[3].id, hand[4].id],
    ])
    discard(state, userId, hand[5].id, rng)
    assert.equal(state.phase, 'awaitingDraw')
  })

  test('a taken discard cannot be used as a go-er', ({ assert }) => {
    const state = makeGame(2)
    const userId = state.players[state.currentPlayerIndex].userId
    const hand = [...comeDownHand(), card(3, 'clubs')]
    setTurn(state, userId, hand)
    layMelds(state, userId, [
      [hand[0].id, hand[1].id, hand[2].id],
      [hand[3].id, hand[4].id, hand[5].id],
    ])
    // Keeps a card in hand so the discard does not end the round
    discard(state, userId, hand[6].id, rng)

    // Other player takes that discard; it may not be placed as a go-er
    const otherId = state.players[state.currentPlayerIndex].userId
    const other = playerState(state, otherId)
    other.hasComeDown = true
    const taken = takeDiscard(state, otherId)
    assert.throws(
      () => addGoer(state, otherId, { meldId: state.melds[0].id, cardId: taken.id }),
      /cannot be used as a go-er/
    )
  })

  test('a taken discard can be returned before acting', ({ assert }) => {
    const state = makeGame(2)
    const userId = state.players[state.currentPlayerIndex].userId
    state.discardPile = [card(5, 'hearts')]

    const taken = takeDiscard(state, userId)
    returnDiscard(state, userId)

    assert.equal(state.phase, 'awaitingDraw')
    assert.equal(state.discardPile[state.discardPile.length - 1]?.id, taken.id)
    assert.isNull(playerState(state, userId).pendingDiscardCardId)
  })
})

test.group('Engine — jokers', () => {
  test('taking a group joker needs every missing natural; it must then be tabled', ({ assert }) => {
    const state = makeGame(2)
    const userId = state.players[state.currentPlayerIndex].userId

    // A tabled group: 10 of diamonds + 10 of spades + joker
    const tabledJoker = joker()
    const tenD = card(10, 'diamonds')
    const tenS = card(10, 'spades')
    state.melds = [
      {
        id: 1,
        ownerUserId: 99,
        type: 'group',
        cards: [
          { card: tenD, rank: 10, suit: 'diamonds' },
          { card: tenS, rank: 10, suit: 'spades' },
          { card: tabledJoker, rank: 10, suit: null },
        ],
      },
    ]
    state.nextMeldId = 2

    const tenH = card(10, 'hearts')
    const tenC = card(10, 'clubs')
    const nineH = card(9, 'hearts')
    const nineC = card(9, 'clubs')
    const two = card(2, 'spades')
    setTurn(state, userId, [tenH, tenC, nineH, nineC, two])
    playerState(state, userId).hasComeDown = true

    // One replacement is not enough under the stricter default rule
    assert.throws(
      () =>
        takeJoker(state, userId, {
          meldId: 1,
          jokerCardId: tabledJoker.id,
          replacementCardIds: [tenH.id],
        }),
      GameError
    )

    takeJoker(state, userId, {
      meldId: 1,
      jokerCardId: tabledJoker.id,
      replacementCardIds: [tenH.id, tenC.id],
    })

    const player = playerState(state, userId)
    assert.equal(player.pendingJokerCardId, tabledJoker.id)
    assert.lengthOf(state.melds[0].cards, 4)

    // Discarding with the joker still in hand is blocked
    assert.throws(() => discard(state, userId, two.id, rng), /joker you took must be tabled/)

    // Table it in a new set (9-9-joker group), then discard
    layMelds(state, userId, [[nineH.id, nineC.id, tabledJoker.id]])
    discard(state, userId, two.id, rng)
    assert.equal(state.phase, 'awaitingDraw')
  })

  test('taking a joker requires having come down', ({ assert }) => {
    const state = makeGame(2)
    const userId = state.players[state.currentPlayerIndex].userId
    const tabledJoker = joker()
    state.melds = [
      {
        id: 1,
        ownerUserId: 99,
        type: 'group',
        cards: [
          { card: card(10, 'diamonds'), rank: 10, suit: 'diamonds' },
          { card: card(10, 'spades'), rank: 10, suit: 'spades' },
          { card: tabledJoker, rank: 10, suit: null },
        ],
      },
    ]
    const tenH = card(10, 'hearts')
    const tenC = card(10, 'clubs')
    setTurn(state, userId, [tenH, tenC, card(2, 'clubs')])

    assert.throws(
      () =>
        takeJoker(state, userId, {
          meldId: 1,
          jokerCardId: tabledJoker.id,
          replacementCardIds: [tenH.id, tenC.id],
        }),
      /after coming down/
    )
  })
})

test.group('Engine — scoring, buy-ins, and winning', () => {
  test('calling up scores everyone else, jokers costing 15', ({ assert }) => {
    const state = makeGame(3)
    const userId = state.players[state.currentPlayerIndex].userId
    const others = state.players.filter((player) => player.userId !== userId)

    setTurn(state, userId, [card(2, 'hearts')])
    others[0].hand = [card('A', 'hearts'), joker()] // 11 + 15
    others[1].hand = [card(9, 'clubs'), card('J', 'spades')] // 9 + 10

    discard(state, userId, playerState(state, userId).hand[0].id, rng)

    assert.lengthOf(state.roundResults, 1)
    const result = state.roundResults[0]
    assert.equal(result.winnerUserId, userId)
    assert.equal(result.penalties[userId], 0)
    assert.equal(result.penalties[others[0].userId], 26)
    assert.equal(result.penalties[others[1].userId], 19)

    // Next round dealt automatically
    assert.equal(state.roundNumber, 2)
    assert.equal(state.phase, 'awaitingDraw')
    assert.lengthOf(playerState(state, userId).hand, 13)
  })

  test('busting the limit with 3+ players offers a buy-in at the highest surviving score', ({
    assert,
  }) => {
    const state = makeGame(3)
    const userId = state.players[state.currentPlayerIndex].userId
    const others = state.players.filter((player) => player.userId !== userId)

    others[0].score = 140
    others[0].hand = [card('A', 'hearts')] // 140 + 11 = 151 → bust
    others[1].score = 100
    others[1].hand = [card(5, 'hearts')] // 105
    setTurn(state, userId, [card(2, 'hearts')])

    discard(state, userId, playerState(state, userId).hand[0].id, rng)

    assert.equal(state.phase, 'roundEnd')
    assert.deepEqual(state.pendingBuyIns, [others[0].userId])

    decideBuyIn(state, others[0].userId, true, rng)
    assert.equal(others[0].score, 105)
    assert.equal(others[0].buyInsUsed, 1)
    assert.isFalse(others[0].eliminated)
    assert.equal(state.phase, 'awaitingDraw')
  })

  test('declining the buy-in eliminates; a second bust has no buy-in left', ({ assert }) => {
    const state = makeGame(3)
    const userId = state.players[state.currentPlayerIndex].userId
    const others = state.players.filter((player) => player.userId !== userId)

    others[0].score = 160
    others[0].buyInsUsed = 1 // classic allows exactly one
    others[0].hand = []
    others[0].score = 151
    others[1].hand = [card(5, 'hearts')]
    setTurn(state, userId, [card(2, 'hearts')])

    discard(state, userId, playerState(state, userId).hand[0].id, rng)

    assert.isTrue(others[0].eliminated)
    assert.lengthOf(activePlayers(state), 2)
  })

  test('with 2 players no buy-in is offered and the game ends', ({ assert }) => {
    const state = makeGame(2)
    const userId = state.players[state.currentPlayerIndex].userId
    const other = state.players.find((player) => player.userId !== userId)
    if (!other) {
      throw new Error('expected a second player')
    }

    other.score = 145
    other.hand = [card('K', 'hearts')] // 145 + 10 = 155 → bust, no buy-in
    setTurn(state, userId, [card(2, 'hearts')])

    discard(state, userId, playerState(state, userId).hand[0].id, rng)

    assert.isTrue(other.eliminated)
    assert.equal(state.phase, 'finished')
    assert.equal(state.winnerUserId, userId)
  })
})

/** Classic rules plus the example-scoresheet chip amounts. */
const STAKED_RULES: GameRules = {
  ...CLASSIC_RULES,
  stakes: { stake: 4, rebuy: 4, kalooki: 2, call: 1 },
}

/**
 * Fresh staked game (rule overrides allowed). Player user ids are 1..n.
 */
function makeStakedGame(playerCount: number, overrides: Partial<GameRules> = {}): GameState {
  return createGame(
    Array.from({ length: playerCount }, (_, index) => index + 1),
    { ...STAKED_RULES, ...overrides },
    rng
  )
}

/**
 * Thirteen cards in three valid sets (4 kings, 4 queens, 2-6 hearts
 * run) — a hand that can call kalooki in one turn.
 */
function kalookiHand(): Card[][] {
  return [
    [card('K', 'hearts'), card('K', 'clubs'), card('K', 'spades'), card('K', 'diamonds')],
    [card('Q', 'hearts'), card('Q', 'clubs'), card('Q', 'spades'), card('Q', 'diamonds')],
    [card(2, 'hearts'), card(3, 'hearts'), card(4, 'hearts'), card(5, 'hearts'), card(6, 'hearts')],
  ]
}

test.group('Engine — play money', () => {
  test('each round the caller collects the call amount from every other active player', ({
    assert,
  }) => {
    const state = makeStakedGame(3)
    const userId = state.players[state.currentPlayerIndex].userId
    const others = state.players.filter((player) => player.userId !== userId)
    others[0].hand = [card(5, 'hearts')]
    others[1].hand = [card(9, 'clubs')]
    setTurn(state, userId, [card(2, 'hearts')])

    discard(state, userId, playerState(state, userId).hand[0].id, rng)

    const result = state.roundResults[0]
    assert.isFalse(result.calledKalooki)
    assert.equal(result.chips[userId], 2)
    assert.equal(result.chips[others[0].userId], -1)
    assert.equal(result.chips[others[1].userId], -1)
    assert.equal(playerState(state, userId).chips, 2)
    assert.equal(others[0].chips, -1)
  })

  test('calling with all thirteen in one turn pays the kalooki amount instead', ({ assert }) => {
    const state = makeStakedGame(3)
    const userId = state.players[state.currentPlayerIndex].userId
    const melds = kalookiHand()
    playerState(state, userId).hand = melds.flat()

    const drawn = drawFromDeck(state, userId, rng)
    layMelds(
      state,
      userId,
      melds.map((meld) => meld.map((meldCard) => meldCard.id))
    )
    discard(state, userId, drawn.id, rng)

    const result = state.roundResults[0]
    assert.isTrue(result.calledKalooki)
    assert.equal(result.chips[userId], 4)
    assert.equal(playerState(state, userId).chips, 4)
    for (const other of state.players.filter((player) => player.userId !== userId)) {
      assert.equal(other.chips, -2)
    }
  })

  test('a player who came down on an earlier turn does not call a kalooki', ({ assert }) => {
    const state = makeStakedGame(2)
    const userId = state.players[state.currentPlayerIndex].userId
    const player = playerState(state, userId)
    player.hasComeDown = true
    player.hand = [card(2, 'hearts'), card(2, 'clubs')]
    state.phase = 'awaitingDraw'

    const drawn = drawFromDeck(state, userId, rng)
    discard(state, userId, drawn.id, rng)
    // Next turn: come-down happened before, so calling is a plain call
    state.currentPlayerIndex = state.players.findIndex((candidate) => candidate.userId === userId)
    state.phase = 'awaitingDraw'
    const drawnAgain = drawFromDeck(state, userId, rng)
    playerState(state, userId).hand = [drawnAgain]
    discard(state, userId, drawnAgain.id, rng)

    const result = state.roundResults[0]
    assert.isFalse(result.calledKalooki)
    assert.equal(result.chips[userId], 1)
  })

  test('eliminated players stop paying round money', ({ assert }) => {
    const state = makeStakedGame(3)
    const userId = state.players[state.currentPlayerIndex].userId
    const others = state.players.filter((player) => player.userId !== userId)
    others[0].eliminated = true
    others[0].hand = []
    others[1].hand = [card(9, 'clubs')]
    setTurn(state, userId, [card(2, 'hearts')])

    discard(state, userId, playerState(state, userId).hand[0].id, rng)

    const result = state.roundResults[0]
    assert.equal(result.chips[userId], 1)
    assert.notProperty(result.chips, String(others[0].userId))
    assert.equal(others[0].chips, 0)
  })

  test('the winner collects every stake and buy-in at the end', ({ assert }) => {
    const state = makeStakedGame(3)
    const userId = state.players[state.currentPlayerIndex].userId
    const others = state.players.filter((player) => player.userId !== userId)
    others[0].buyInsUsed = 1

    removePlayer(state, others[0].userId, rng)
    removePlayer(state, others[1].userId, rng)

    assert.equal(state.phase, 'finished')
    assert.equal(state.winnerUserId, userId)
    // Loser stakes (4 + 4) plus one buy-in (4)
    assert.equal(playerState(state, userId).chips, 12)
    assert.equal(others[0].chips, -8)
    assert.equal(others[1].chips, -4)
    const total = state.players.reduce((sum, player) => sum + player.chips, 0)
    assert.equal(total, 0)
  })

  test("the winner's own buy-in costs them nothing", ({ assert }) => {
    const state = makeStakedGame(2)
    const userId = state.players[state.currentPlayerIndex].userId
    const other = state.players.find((player) => player.userId !== userId)
    if (!other) {
      throw new Error('expected a second player')
    }
    playerState(state, userId).buyInsUsed = 1

    removePlayer(state, other.userId, rng)

    assert.equal(state.winnerUserId, userId)
    assert.equal(playerState(state, userId).chips, 4)
    assert.equal(other.chips, -4)
  })

  test('without stakes no chips ever move', ({ assert }) => {
    const state = makeGame(2)
    const userId = state.players[state.currentPlayerIndex].userId
    const other = state.players.find((player) => player.userId !== userId)
    if (!other) {
      throw new Error('expected a second player')
    }
    other.hand = [card(5, 'hearts')]
    setTurn(state, userId, [card(2, 'hearts')])

    discard(state, userId, playerState(state, userId).hand[0].id, rng)

    assert.deepEqual(state.roundResults[0].chips, {})
    assert.equal(playerState(state, userId).chips, 0)
  })
})

test.group('Engine — configurable buy-ins', () => {
  test('zero buy-ins eliminates on the first bust', ({ assert }) => {
    const state = makeStakedGame(3, { buyInsPerPlayer: 0 })
    const userId = state.players[state.currentPlayerIndex].userId
    const others = state.players.filter((player) => player.userId !== userId)
    others[0].score = 145
    others[0].hand = [card('K', 'hearts')] // 155 → bust
    others[1].hand = [card(5, 'hearts')]
    setTurn(state, userId, [card(2, 'hearts')])

    discard(state, userId, playerState(state, userId).hand[0].id, rng)

    assert.isTrue(others[0].eliminated)
    assert.lengthOf(state.pendingBuyIns, 0)
  })

  test('unlimited buy-ins keep offering re-entry', ({ assert }) => {
    const state = makeStakedGame(3, { buyInsPerPlayer: UNLIMITED_BUY_INS })
    const userId = state.players[state.currentPlayerIndex].userId
    const others = state.players.filter((player) => player.userId !== userId)
    others[0].score = 145
    others[0].buyInsUsed = 5
    others[0].hand = [card('K', 'hearts')] // 155 → bust
    others[1].hand = [card(5, 'hearts')]
    setTurn(state, userId, [card(2, 'hearts')])

    discard(state, userId, playerState(state, userId).hand[0].id, rng)

    assert.deepEqual(state.pendingBuyIns, [others[0].userId])
    decideBuyIn(state, others[0].userId, true, rng)
    assert.equal(others[0].buyInsUsed, 6)
    assert.isFalse(others[0].eliminated)
  })
})

test.group('Engine — removals', () => {
  test('removing the current player shuffles their hand back and passes the turn', ({ assert }) => {
    const state = makeGame(3)
    const userId = state.players[state.currentPlayerIndex].userId
    const handSize = playerState(state, userId).hand.length
    const deckBefore = state.deck.length

    removePlayer(state, userId, rng)

    assert.isTrue(playerState(state, userId).removed)
    assert.lengthOf(playerState(state, userId).hand, 0)
    assert.equal(state.deck.length, deckBefore + handSize)
    assert.notEqual(state.players[state.currentPlayerIndex].userId, userId)
    assert.equal(state.phase, 'awaitingDraw')
  })

  test('when removals leave one player, they win', ({ assert }) => {
    const state = makeGame(2)
    const userId = state.players[state.currentPlayerIndex].userId
    const other = state.players.find((player) => player.userId !== userId)

    removePlayer(state, userId, rng)

    assert.equal(state.phase, 'finished')
    assert.equal(state.winnerUserId, other?.userId)
  })
})
