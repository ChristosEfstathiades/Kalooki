import { test } from '@japa/runner'
import {
  MeldError,
  jokerReplacementNeeds,
  meldValue,
  resolveGoer,
  resolveMeld,
} from '#services/game/melds'
import type { Card, Rank, Suit } from '#services/game/cards'

let nextId = 1

/**
 * Builds a natural card with a unique id.
 */
function card(rank: Rank, suit: Suit): Card {
  return { id: nextId++, isJoker: false, rank, suit }
}

/**
 * Builds a joker with a unique id.
 */
function joker(): Card {
  return { id: nextId++, isJoker: true, rank: null, suit: null }
}

test.group('Melds — groups', () => {
  test('accepts 3 and 4 of a kind in different suits', ({ assert }) => {
    const three = resolveMeld([card(10, 'hearts'), card(10, 'clubs'), card(10, 'spades')])
    assert.equal(three.type, 'group')

    const four = resolveMeld([
      card('K', 'hearts'),
      card('K', 'clubs'),
      card('K', 'spades'),
      card('K', 'diamonds'),
    ])
    assert.equal(four.type, 'group')
  })

  test('rejects two cards of the same suit in a group', ({ assert }) => {
    assert.throws(
      () => resolveMeld([card(10, 'hearts'), card(10, 'hearts'), card(10, 'spades')]),
      MeldError
    )
  })

  test('rejects groups of more than 4 cards', ({ assert }) => {
    assert.throws(() =>
      resolveMeld([
        card(9, 'hearts'),
        card(9, 'clubs'),
        card(9, 'spades'),
        card(9, 'diamonds'),
        joker(),
      ])
    )
  })

  test('jokers stand in with an open suit', ({ assert }) => {
    const meld = resolveMeld([card(7, 'hearts'), card(7, 'clubs'), joker()])
    assert.equal(meld.type, 'group')
    const jokerCard = meld.cards.find((meldCard) => meldCard.card.isJoker)
    assert.equal(jokerCard?.rank, 7)
    assert.isNull(jokerCard?.suit)
  })
})

test.group('Melds — runs', () => {
  test('accepts consecutive same-suit cards, 2-3-4 up to Q-K-A', ({ assert }) => {
    const low = resolveMeld([card(2, 'hearts'), card(3, 'hearts'), card(4, 'hearts')])
    assert.equal(low.type, 'run')

    const high = resolveMeld([card('Q', 'spades'), card('K', 'spades'), card('A', 'spades')])
    assert.equal(high.type, 'run')
  })

  test('rejects ace-low runs (A-2-3)', ({ assert }) => {
    // Submitted in sequence order with the ace first, the anchor pins
    // A at position 0, pushing the run past the top of the rank order
    assert.throws(
      () => resolveMeld([card('A', 'hearts'), card(2, 'hearts'), card(3, 'hearts')]),
      MeldError
    )
  })

  test('rejects mixed suits and gaps', ({ assert }) => {
    assert.throws(
      () => resolveMeld([card(5, 'hearts'), card(6, 'clubs'), card(7, 'hearts')]),
      MeldError
    )
    assert.throws(
      () => resolveMeld([card(5, 'hearts'), card(7, 'hearts'), card(9, 'hearts')]),
      MeldError
    )
  })

  test('infers what a joker in a run represents from its position', ({ assert }) => {
    const meld = resolveMeld([card(5, 'diamonds'), joker(), card(7, 'diamonds')])
    const jokerCard = meld.cards.find((meldCard) => meldCard.card.isJoker)
    assert.equal(jokerCard?.rank, 6)
    assert.equal(jokerCard?.suit, 'diamonds')
  })

  test('rejects a run whose joker would sit outside the bounds', ({ assert }) => {
    // Joker before the 2 would have to be an ace-low
    assert.throws(() => resolveMeld([joker(), card(2, 'clubs'), card(3, 'clubs')]), MeldError)
    // Joker after the ace goes past the top
    assert.throws(() => resolveMeld([card('K', 'clubs'), card('A', 'clubs'), joker()]), MeldError)
  })

  test('runs longer than 4 cards are allowed', ({ assert }) => {
    const meld = resolveMeld([
      card(4, 'spades'),
      card(5, 'spades'),
      joker(),
      card(7, 'spades'),
      card(8, 'spades'),
    ])
    assert.equal(meld.type, 'run')
    assert.lengthOf(meld.cards, 5)
  })
})

test.group('Melds — values', () => {
  test('jokers count as the card they represent', ({ assert }) => {
    // J Q + joker-as-K = 10 + 10 + 10
    const run = resolveMeld([card('J', 'hearts'), card('Q', 'hearts'), joker()])
    assert.equal(meldValue(run), 30)

    // Aces count 11: A A + joker in a group of aces = 33
    const group = resolveMeld([card('A', 'hearts'), card('A', 'clubs'), joker()])
    assert.equal(meldValue(group), 33)
  })
})

test.group('Melds — go-ers', () => {
  test('extends a run at either end', ({ assert }) => {
    const run = resolveMeld([card(5, 'hearts'), card(6, 'hearts'), card(7, 'hearts')])
    const high = resolveGoer(run, card(8, 'hearts'), 'high')
    assert.equal(high.cards[high.cards.length - 1].rank, 8)

    const low = resolveGoer(run, card(4, 'hearts'), 'low')
    assert.equal(low.cards[0].rank, 4)
  })

  test('rejects extending past the bounds or with the wrong card', ({ assert }) => {
    const top = resolveMeld([card('Q', 'clubs'), card('K', 'clubs'), card('A', 'clubs')])
    assert.throws(() => resolveGoer(top, card(2, 'clubs'), 'high'), MeldError)

    const run = resolveMeld([card(5, 'hearts'), card(6, 'hearts'), card(7, 'hearts')])
    assert.throws(() => resolveGoer(run, card(9, 'hearts'), 'high'), MeldError)
    assert.throws(() => resolveGoer(run, card(8, 'spades'), 'high'), MeldError)
  })

  test('turns a group of 3 into 4, rejecting duplicate suits and a 5th card', ({ assert }) => {
    const group = resolveMeld([card(9, 'hearts'), card(9, 'clubs'), card(9, 'spades')])
    const extended = resolveGoer(group, card(9, 'diamonds'))
    assert.lengthOf(extended.cards, 4)

    assert.throws(() => resolveGoer(group, card(9, 'hearts')), MeldError)
    assert.throws(() => resolveGoer(extended, joker()), MeldError)
  })

  test('a joker can be a go-er and takes the represented value', ({ assert }) => {
    const run = resolveMeld([card(5, 'hearts'), card(6, 'hearts'), card(7, 'hearts')])
    const extended = resolveGoer(run, joker(), 'high')
    const added = extended.cards[extended.cards.length - 1]
    assert.isTrue(added.card.isJoker)
    assert.equal(added.rank, 8)
    assert.equal(added.suit, 'hearts')
  })
})

test.group('Melds — taking jokers', () => {
  test('a run joker needs its exact natural card', ({ assert }) => {
    const run = resolveMeld([card(5, 'diamonds'), joker(), card(7, 'diamonds')])
    const needs = jokerReplacementNeeds(run, run.cards[1].card.id)
    assert.deepEqual(needs, [{ rank: 6, suit: 'diamonds' }])
  })

  test('a group joker needs every missing suit (default stricter rule)', ({ assert }) => {
    const meld = resolveMeld([card(10, 'diamonds'), card(10, 'spades'), joker()])
    const jokerId = meld.cards.find((meldCard) => meldCard.card.isJoker)?.card.id as number
    const needs = jokerReplacementNeeds(meld, jokerId)
    assert.lengthOf(needs, 2)
    assert.sameDeepMembers(needs, [
      { rank: 10, suit: 'hearts' },
      { rank: 10, suit: 'clubs' },
    ])
  })

  test('a joker in a group of 4 needs only the last natural', ({ assert }) => {
    const meld = resolveMeld([
      card(10, 'diamonds'),
      card(10, 'spades'),
      card(10, 'hearts'),
      joker(),
    ])
    const jokerId = meld.cards.find((meldCard) => meldCard.card.isJoker)?.card.id as number
    const needs = jokerReplacementNeeds(meld, jokerId)
    assert.deepEqual(needs, [{ rank: 10, suit: 'clubs' }])
  })
})
