import { WORDLIST } from '#services/wordlist'
import { LETTER_LOOKALIKES } from '#services/profanity_filter'

/**
 * Fixtures for the moderation specs, derived from the configured
 * wordlist instead of written out. The words live in
 * `resources/wordlist.json` and deliberately never reach the repository
 * (see `#services/wordlist`), so a spec that hardcoded one would put it
 * straight back. Deriving them also means these tests keep testing the
 * rules against whatever list an installation actually runs.
 */

/** Fails loudly at import: an empty list means a misconfigured wordlist. */
function requireWord(words: string[], list: string, minLength = 1): string {
  const candidates = words
    .filter((word) => word.length >= minLength)
    .sort((first, second) => first.length - second.length)
  const [word] = candidates

  if (word === undefined) {
    throw new Error(
      `The moderation wordlist has no "${list}" entry of at least ${minLength} characters, ` +
        `so the filter specs have nothing to test with.`
    )
  }

  return word
}

/** The shortest listed word, kept short so decorated forms stay in bounds. */
export const BLOCKED_WORD = requireWord(WORDLIST.blocked, 'blocked')

/**
 * A listed word long enough for the username filter to catch inside a
 * longer name: the shortest words there have to stand alone.
 */
export const EMBEDDABLE_BLOCKED_WORD = requireWord(WORDLIST.blocked, 'blocked', 4)

/** A word matched anywhere in the text, not only as a whole word. */
export const SEVERE_WORD = requireWord(WORDLIST.severe, 'severe')

/** An ordinary word that contains a severe word and has to survive. */
export const SPARED_WORD = requireWord(WORDLIST.clean, 'clean')

/** A word refused in usernames but not masked in chat. */
export const USERNAME_ONLY_WORD = requireWord(WORDLIST.usernameOnly, 'usernameOnly')

/**
 * A listed word starting with "f", for the "ph" spelling. Null when the
 * configured list has none, which the specs check rather than assume.
 */
export const PH_SPELLABLE_WORD =
  WORDLIST.blocked.find((word) => word.startsWith('f') && word.length >= 4) ?? null

/** The same word with "ph" in place of its leading f. */
export function withPhSpelling(word: string): string {
  return `ph${word.slice(1)}`
}

/**
 * Every letter swapped for something that reads as it without being it,
 * including the symbols. Letters with no stand-in are left as they are.
 */
export function withLookalikes(word: string): string {
  return [...word]
    .map((letter) => {
      const lookalikes = LETTER_LOOKALIKES[letter]
      return lookalikes === undefined ? letter : lookalikes[lookalikes.length - 1]
    })
    .join('')
}

/**
 * The same, but only the stand-ins a username may contain, since the
 * charset rule would reject a symbol before the filter ever saw it.
 */
export function withAlphanumericLookalikes(word: string): string {
  return [...word]
    .map((letter) => {
      const lookalikes = LETTER_LOOKALIKES[letter] ?? ''
      return (
        [...lookalikes].find((option) => option !== letter && /[a-z0-9]/.test(option)) ?? letter
      )
    })
    .join('')
}

/** The letters of a word spaced out by punctuation. */
export function withSeparators(word: string, separator = '.'): string {
  return [...word].join(separator)
}

/** The word with its second letter doubled. */
export function withRepeatedLetter(word: string): string {
  return `${word.slice(0, 2)}${word.slice(1)}`
}

/** Two words run together with nothing between them. */
export function glued(first: string, second: string): string {
  return `${first}${second}`
}

/** The word buried in letters, where a word boundary cannot see it. */
export function embedded(word: string): string {
  return `xx${word}xx`
}

/** The word in fullwidth forms, which normalization has to fold back. */
export function fullwidth(word: string): string {
  return [...word]
    .map((character) => String.fromCodePoint((character.codePointAt(0) ?? 0) + 0xfee0))
    .join('')
}

/** The word with a zero-width space hidden inside it. */
export function withHiddenJoin(word: string): string {
  const zeroWidthSpace = String.fromCharCode(0x200b)
  return `${word.slice(0, 2)}${zeroWidthSpace}${word.slice(2)}`
}

/**
 * A few of the characters that imitate a latin letter, kept here as its
 * own fixture rather than read from the filter, so a letter dropped from
 * the filter's own list shows up as a failing test.
 */
const BORROWED_LETTERS: Record<string, string> = {
  a: 'а', // Cyrillic а
  c: 'с', // Cyrillic с
  e: 'е', // Cyrillic е
  i: 'і', // Cyrillic і
  o: 'о', // Cyrillic о
  p: 'р', // Cyrillic р
  s: 'ѕ', // Cyrillic ѕ
  t: 'т', // Cyrillic т
}

/** The word with any letter that has one swapped for a borrowed twin. */
export function withBorrowedLetters(word: string): string {
  return [...word].map((letter) => BORROWED_LETTERS[letter] ?? letter).join('')
}

/** A mask of asterisks the same length as the text it covers. */
export function maskOf(text: string): string {
  return '*'.repeat(text.length)
}
