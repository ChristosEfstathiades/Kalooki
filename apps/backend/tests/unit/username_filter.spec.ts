import { test } from '@japa/runner'
import { WORDLIST } from '#services/wordlist'
import { findBlockedWordInUsername, isReservedUsername } from '#services/username_filter'
import {
  EMBEDDABLE_BLOCKED_WORD,
  PH_SPELLABLE_WORD,
  USERNAME_ONLY_WORD,
  withAlphanumericLookalikes,
  withPhSpelling,
  withRepeatedLetter,
  withSeparators,
} from '#tests/helpers/wordlist'

/**
 * The words are read from the configured wordlist rather than written
 * into the spec, since they are not kept in the repository. See
 * `#tests/helpers/wordlist`.
 */
const [firstBlockedWord] = WORDLIST.blocked
const shortBlockedWord = WORDLIST.blocked.find((word) => word.length <= 3) ?? null

test.group('Username filter', () => {
  test('blocks a listed word anywhere in the name', ({ assert }) => {
    // The first entry is the first pattern tried, so it is the one case
    // where the word that comes back is known.
    assert.equal(findBlockedWordInUsername(firstBlockedWord), firstBlockedWord)
    assert.isNotNull(findBlockedWordInUsername(`xX${EMBEDDABLE_BLOCKED_WORD}Xx`))
    assert.isNotNull(findBlockedWordInUsername(`Kalooki${EMBEDDABLE_BLOCKED_WORD}99`))
  })

  test('blocks every word on the list', ({ assert }) => {
    for (const word of [...WORDLIST.blocked, ...WORDLIST.usernameOnly]) {
      assert.isNotNull(findBlockedWordInUsername(word), `${word} should be blocked`)
    }
  })

  test('is case-insensitive', ({ assert }) => {
    assert.isNotNull(findBlockedWordInUsername(EMBEDDABLE_BLOCKED_WORD.toUpperCase()))
  })

  test('sees through lookalike characters', ({ assert }) => {
    const disguised = withAlphanumericLookalikes(EMBEDDABLE_BLOCKED_WORD)

    assert.notEqual(disguised, EMBEDDABLE_BLOCKED_WORD, 'expected a disguise to test')
    assert.isNotNull(findBlockedWordInUsername(disguised))
  })

  test('sees through underscores and repeated letters', ({ assert }) => {
    assert.isNotNull(findBlockedWordInUsername(withSeparators(EMBEDDABLE_BLOCKED_WORD, '_')))
    assert.isNotNull(findBlockedWordInUsername(withRepeatedLetter(EMBEDDABLE_BLOCKED_WORD)))
  })

  test('sees through the ph spelling', ({ assert }) => {
    // Only meaningful for a word starting with f.
    if (PH_SPELLABLE_WORD === null) {
      return
    }

    assert.isNotNull(findBlockedWordInUsername(`${withPhSpelling(PH_SPELLABLE_WORD)}_you`))
  })

  test('blocks words a username needs but chat only masks', ({ assert }) => {
    assert.isNotNull(findBlockedWordInUsername(USERNAME_ONLY_WORD))
    assert.isNotNull(findBlockedWordInUsername(`Big${USERNAME_ONLY_WORD}69`))
  })

  test('leaves ordinary names alone', ({ assert }) => {
    for (const username of [
      'player_one',
      'KalookiKing',
      'Nigeria_92',
      'Nasir',
      'Magnus',
      'Card_Shark',
    ]) {
      assert.isNull(findBlockedWordInUsername(username), `${username} should be allowed`)
    }
  })

  test('ordinary words containing a listed word are allowed', ({ assert }) => {
    for (const word of WORDLIST.usernameClean) {
      assert.isNull(findBlockedWordInUsername(word), `${word} should be allowed`)
      assert.isNull(findBlockedWordInUsername(`${word}_99`), `${word}_99 should be allowed`)
    }
  })

  test('three-letter words must stand alone', ({ assert }) => {
    // Three letters buried in a longer name are innocent far more often
    // than not, so those only count when nothing but a letter fences them.
    if (shortBlockedWord === null) {
      return
    }

    assert.isNotNull(findBlockedWordInUsername(shortBlockedWord))
    assert.isNotNull(findBlockedWordInUsername(`xX_${shortBlockedWord}_Xx`))
    assert.isNotNull(findBlockedWordInUsername(`${shortBlockedWord}69`))

    assert.isNull(findBlockedWordInUsername(`xx${shortBlockedWord}xx`))
  })

  test('cutting out an allowed word cannot join a blocked one', ({ assert }) => {
    // An allowed word is replaced by a space rather than removed, so the
    // letters either side of it can never be read as one word.
    const pair = WORDLIST.usernameClean.flatMap((allowed) => {
      const listed = [...WORDLIST.blocked, ...WORDLIST.usernameOnly].find(
        (word) => word.length > 3 && allowed.includes(word)
      )
      return listed === undefined ? [] : [{ allowed, listed }]
    })[0]

    if (pair === undefined) {
      return
    }

    assert.isNotNull(findBlockedWordInUsername(`${pair.allowed}${pair.listed}`))
  })
})

test.group('Reserved usernames', () => {
  test('reserves staff and site names', ({ assert }) => {
    for (const username of [
      'admin',
      'ADMIN',
      'Moderator',
      'mods',
      'staff',
      'support',
      'system',
      'official',
      'Kalooki',
      'KalookiOnline',
      'RustyBot',
    ]) {
      assert.isTrue(isReservedUsername(username), `${username} should be reserved`)
    }
  })

  test('sees through decoration and lookalikes', ({ assert }) => {
    assert.isTrue(isReservedUsername('adm1n'))
    assert.isTrue(isReservedUsername('admln'))
    assert.isTrue(isReservedUsername('a_d_m_i_n'))
    assert.isTrue(isReservedUsername('admin123'))
    assert.isTrue(isReservedUsername('_admin_'))
    assert.isTrue(isReservedUsername('M0der4t0r'))
    assert.isTrue(isReservedUsername('moddd'))
    assert.isTrue(isReservedUsername('KAL00KI'))

    // The site name with a number stuck on it is the same shape as
    // "admin123", so it goes the same way. "KalookiKing" is still free.
    assert.isTrue(isReservedUsername('Kalooki99'))
  })

  test('reserves the long staff words anywhere in a name', ({ assert }) => {
    assert.isTrue(isReservedUsername('TheModerator'))
    assert.isTrue(isReservedUsername('Site_Administrator'))
  })

  test('reserves the site name paired with a staff word', ({ assert }) => {
    assert.isTrue(isReservedUsername('KalookiAdmin'))
    assert.isTrue(isReservedUsername('Mod_Kalooki'))
    assert.isTrue(isReservedUsername('kalooki_support'))
  })

  test('leaves ordinary names that merely contain one alone', ({ assert }) => {
    for (const username of [
      'Badminton',
      'KalookiKing',
      'Kalooki_Fan_92',
      'Modern_Man',
      'Model_T',
      'RootBeer',
      'Teammate',
      'Helper',
      'Supportive',
      'Bobby',
      'player_one',
    ]) {
      assert.isFalse(isReservedUsername(username), `${username} should be allowed`)
    }
  })
})
