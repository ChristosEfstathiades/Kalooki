import { test } from '@japa/runner'
import { censorMessage } from '#services/profanity_filter'
import {
  BLOCKED_WORD,
  PH_SPELLABLE_WORD,
  SEVERE_WORD,
  SPARED_WORD,
  embedded,
  fullwidth,
  glued,
  maskOf,
  withBorrowedLetters,
  withHiddenJoin,
  withLookalikes,
  withPhSpelling,
  withRepeatedLetter,
  withSeparators,
} from '#tests/helpers/wordlist'

test.group('Profanity filter', () => {
  test('masks a blocked word preserving length', ({ assert }) => {
    const result = censorMessage(`what the ${BLOCKED_WORD} is this`)

    assert.equal(result.text, `what the ${maskOf(BLOCKED_WORD)} is this`)
    assert.isTrue(result.wasCensored)
  })

  test('is case-insensitive', ({ assert }) => {
    const result = censorMessage(`${BLOCKED_WORD.toUpperCase()} happens`)

    assert.equal(result.text, `${maskOf(BLOCKED_WORD)} happens`)
    assert.isTrue(result.wasCensored)
  })

  test('masks every occurrence', ({ assert }) => {
    const mask = maskOf(BLOCKED_WORD)
    const result = censorMessage(`${BLOCKED_WORD} ${BLOCKED_WORD} ${BLOCKED_WORD.toUpperCase()}`)

    assert.equal(result.text, `${mask} ${mask} ${mask}`)
  })

  test('masks words run together with no space between them', ({ assert }) => {
    // A word boundary cannot see the second word here, which is the
    // whole reason the pattern repeats instead of relying on \b.
    const together = glued(SEVERE_WORD, BLOCKED_WORD)
    const result = censorMessage(together)

    assert.equal(result.text, maskOf(together))
    assert.isTrue(result.wasCensored)
  })

  test('sees through digits and symbols standing in for letters', ({ assert }) => {
    const disguised = withLookalikes(BLOCKED_WORD)
    const result = censorMessage(disguised)

    assert.equal(result.text, maskOf(disguised))
    assert.isTrue(result.wasCensored)
  })

  test('sees through repeated letters', ({ assert }) => {
    const stretched = withRepeatedLetter(BLOCKED_WORD)

    assert.equal(censorMessage(stretched).text, maskOf(stretched))
  })

  test('sees through separators between the letters', ({ assert }) => {
    for (const separator of ['.', '-', ' ']) {
      const spaced = withSeparators(BLOCKED_WORD, separator)

      assert.equal(censorMessage(spaced).text, maskOf(spaced), `failed on "${separator}"`)
    }
  })

  test('sees through a plural', ({ assert }) => {
    const plural = `${BLOCKED_WORD}s`

    assert.equal(censorMessage(plural).text, maskOf(plural))
  })

  test('sees through the ph spelling', ({ assert }) => {
    // Only meaningful for a word starting with f; a wordlist without one
    // has nothing to spell that way.
    if (PH_SPELLABLE_WORD === null) {
      return
    }

    const spelled = withPhSpelling(PH_SPELLABLE_WORD)

    assert.isTrue(censorMessage(spelled).wasCensored)
  })

  test('sees through letters borrowed from other alphabets', ({ assert }) => {
    const borrowed = withBorrowedLetters(BLOCKED_WORD)

    assert.notEqual(borrowed, BLOCKED_WORD, 'expected a borrowed letter to test')
    assert.isTrue(censorMessage(borrowed).wasCensored)
    assert.isTrue(censorMessage(fullwidth(BLOCKED_WORD)).wasCensored)
    assert.isTrue(censorMessage(withHiddenJoin(BLOCKED_WORD)).wasCensored)
  })

  test('masks a severe word padded out with letters', ({ assert }) => {
    // Severe words are matched anywhere, so wrapping one in letters
    // cannot hide it. Only the word itself is masked.
    const result = censorMessage(embedded(SEVERE_WORD))

    assert.equal(result.text, `xx${maskOf(SEVERE_WORD)}xx`)
    assert.isTrue(result.wasCensored)
  })

  test('leaves ordinary words that contain a listed one alone', ({ assert }) => {
    const result = censorMessage(`the ${SPARED_WORD} was fine`)

    assert.equal(result.text, `the ${SPARED_WORD} was fine`)
    assert.isFalse(result.wasCensored)
  })

  test('leaves clean messages untouched', ({ assert }) => {
    const result = censorMessage('good game, well played!')

    assert.equal(result.text, 'good game, well played!')
    assert.isFalse(result.wasCensored)
  })

  test('leaves ordinary chat untouched', ({ assert }) => {
    // Ordinary English is where a filter this permissive can go wrong, so
    // the phrases below are the collisions worth guarding: a word that
    // starts where a listed one would, or letters that line up across a
    // space once separators are allowed between them.
    for (const message of [
      'gg wp',
      'your turn mate',
      'unlucky, I had the joker',
      'discard and draw',
      'thanks for the game',
      'that was a lucky meld',
      'account balance',
      'panic until then',
      'a discount on the viscount',
      'if u can keep it',
      'the class assessments',
      'a cunning plan',
      'in the circumstances',
      'flag it up',
      'passing the buck',
      'switch to my turn',
      'stitches and pitches',
      'basement bassist',
      'harass nobody',
      'analysis and documents',
      'therapeutic grapes',
      'off again, on again',
    ]) {
      assert.isFalse(censorMessage(message).wasCensored, `${message} should be clean`)
    }
  })

  test('finishes quickly on input built to make it backtrack', ({ assert }) => {
    const punctuated = withSeparators(BLOCKED_WORD, '...').repeat(30).slice(0, 500)
    const started = performance.now()

    censorMessage(punctuated)
    censorMessage(BLOCKED_WORD.repeat(100).slice(0, 500))
    censorMessage('.'.repeat(500))

    assert.isBelow(performance.now() - started, 250)
  })
})
