import { WORDLIST } from '#services/wordlist'

/**
 * Chat censorship (docs/features.md): offending words are masked but the
 * message is still posted, with particular emphasis on preventing racial
 * abuse. The words themselves are not in this repository; they load from
 * `resources/wordlist.json` through `#services/wordlist`, so everything
 * here is matching rules over data supplied at boot.
 *
 * Nothing is compared literally. A filter that only knows the correct
 * spelling of a word only stops the people who are not trying, so a
 * message is first folded onto plain lowercase latin (accents, borrowed
 * alphabets, fullwidth and zero-width characters all go), and is then
 * matched by patterns that read digits and symbols as the letters they
 * stand in for, tolerate repeated letters and punctuation between
 * letters, and let one blocked word run straight into the next.
 *
 * Two rules share that machinery, because the words do not all carry the
 * same risk:
 *
 * - The `blocked` list is matched as whole words, fenced off by anything
 *   that is not a letter, so an ordinary word which happens to contain
 *   one is left alone. Separators between letters are tolerated here,
 *   which is safe because the fence means the first letter still has to
 *   start a word.
 * - The `severe` list is matched anywhere, fence or no fence, so padding
 *   a word out with letters cannot hide it. That gives up the fence's
 *   protection, so the ordinary words which collide with one are in the
 *   `clean` list and are cut out of the message before matching.
 */

/**
 * Endings a listed word may carry and still be that word. A plural is
 * the cheapest evasion there is, and the mask reads better covering the
 * whole word than leaving a lone "s" behind.
 */
const WORD_SUFFIXES = ['ers', 'ies', 'ing', 'es', 'ed', 'er', 'in', 's', 'y', 'z']

/**
 * Characters that read as a letter without being one. Both directions of
 * the i/l pair are listed because either can stand in for the other, and
 * a character class costs nothing to widen. Deliberately absent: z for
 * s, which would make some perfectly ordinary names read as a slur.
 *
 * Exported so `#services/username_filter` widens letters the same way
 * and a substitution guarded against here is guarded against there.
 */
export const LETTER_LOOKALIKES: Record<string, string> = {
  a: 'a4@',
  b: 'b8',
  c: 'c(',
  e: 'e3',
  g: 'g69',
  i: 'i1l!|',
  l: 'l1i!|',
  o: 'o0',
  s: 's5$',
  t: 't7+',
  u: 'uv',
}

/**
 * Spellings of a letter that take more than one character. "ph" for f is
 * the only one that earns its keep, and no listed word contains "ph"
 * itself, so nothing else shifts.
 */
const LETTER_SPELLINGS: Record<string, string[]> = {
  f: ['ph'],
}

/**
 * Characters from another alphabet used to spell a latin word, mapped to
 * the letter each one imitates. This is the substitution NFKD
 * normalization cannot undo, since a Cyrillic "a" is a legitimately
 * different letter that merely looks identical, and it is written as
 * escapes for the same reason: nobody can tell these apart from ASCII by
 * eye, in a code review least of all.
 */
const HOMOGLYPH_SOURCES: Record<string, string> = {
  a: '\u0430\u03b1', // Cyrillic, Greek alpha
  b: '\u0432\u03b2', // Cyrillic, Greek beta
  c: '\u0441\u03f2', // Cyrillic, Greek lunate sigma
  d: '\u0501', // Cyrillic komi de
  e: '\u0435\u03b5', // Cyrillic, Greek epsilon
  g: '\u0261', // Latin script g
  h: '\u043d', // Cyrillic en
  i: '\u0456\u03b9\u0269', // Cyrillic, Greek iota, Latin iota
  j: '\u0458', // Cyrillic je
  k: '\u043a\u03ba', // Cyrillic, Greek kappa
  m: '\u043c', // Cyrillic em
  o: '\u043e\u03bf', // Cyrillic, Greek omicron
  p: '\u0440\u03c1', // Cyrillic er, Greek rho
  s: '\u0455', // Cyrillic dze
  t: '\u0442\u03c4', // Cyrillic, Greek tau
  u: '\u03c5\u1d1c', // Greek upsilon, Latin small capital
  v: '\u03bd', // Greek nu
  x: '\u0445', // Cyrillic ha
  y: '\u0443', // Cyrillic u, which is shaped like a y
}

/** Inverted once at load, since matching needs imitation to letter. */
const HOMOGLYPHS: Record<string, string> = Object.fromEntries(
  Object.entries(HOMOGLYPH_SOURCES).flatMap(([letter, imitations]) =>
    [...imitations].map((character): [string, string] => [character, letter])
  )
)

/**
 * Characters dropped outright: combining marks left over from
 * decomposing an accent, and the invisible formatting characters that
 * would otherwise let someone cut a word in half where nobody can
 * see the join.
 */
const IGNORED_CHARACTERS = /[\p{M}\p{Cf}\u00ad\u200b-\u200f\u2060]/gu

/**
 * Characters allowed between the letters of a word. Deliberately
 * disjoint from LETTER_LOOKALIKES: a character that could be read as
 * either a separator or a letter gives the regex two ways to match the
 * same text, which is how a pattern over user input turns into a way to
 * hang the server.
 */
const SEPARATOR_CLASS = '[\\s._\\-,;:\'"/\\\\*~]'

/** How much punctuation may sit between two letters of one word. */
const MAX_SEPARATORS = 3

/**
 * The gap between two letters. The lookahead forces it to swallow every
 * separator it can reach, which leaves exactly one way to match a run
 * of punctuation. Without it, an optional gap nested inside the
 * repeated word group is textbook catastrophic backtracking.
 */
const SEPARATOR_GAP = `(?:${SEPARATOR_CLASS}{1,${MAX_SEPARATORS}}(?!${SEPARATOR_CLASS}))?`

/**
 * Stands in for a pattern built from an empty list. An alternation of
 * nothing matches the empty string everywhere, which would mask every
 * character of every message.
 */
const NEVER_MATCHES = /(?!)/g

/** Escapes the characters that carry meaning inside a character class. */
function escapeForCharacterClass(characters: string): string {
  return characters.replace(/[\\\]^-]/g, '\\$&')
}

/**
 * The character class matching one letter and everything that can stand
 * in for it.
 */
export function letterCharacterClass(letter: string): string {
  return `[${escapeForCharacterClass(LETTER_LOOKALIKES[letter] ?? letter)}]`
}

/**
 * One word as a regex source: every letter widened to its lookalikes,
 * repeated letters allowed, and, when `separators` is set, punctuation
 * or spaces tolerated between the letters.
 */
function wordSource(word: string, separators: boolean): string {
  const letters = [...word].map((letter) => {
    const repeated = `${letterCharacterClass(letter)}+`
    const spellings = LETTER_SPELLINGS[letter]
    return spellings ? `(?:${repeated}|${spellings.join('|')})` : repeated
  })
  return letters.join(separators ? SEPARATOR_GAP : '')
}

/**
 * Longest first, because alternation takes whichever branch matches
 * first at a position. Where one listed word starts with another, the
 * short branch would win and the mask would stop partway through the
 * word actually written.
 */
function byLengthDescending(first: string, second: string): number {
  return second.length - first.length
}

function wordAlternation(words: string[], separators: boolean): string {
  return [...words]
    .sort(byLengthDescending)
    .map((word) => wordSource(word, separators))
    .join('|')
}

/** An optional ending, widened the same way the words are. */
const SUFFIX_GROUP = `(?:${wordAlternation(WORD_SUFFIXES, false)})?`

/**
 * Listed words as words: nothing but a non-letter either side, one or
 * more of them running together, and an optional ending. Repeating the
 * group is what closes the hole a word boundary leaves, since a boundary
 * cannot see a listed word with another one jammed against it.
 */
function guardedPattern(words: string[]): RegExp {
  if (words.length === 0) {
    return NEVER_MATCHES
  }

  return new RegExp(`(?<![a-z])(?:${wordAlternation(words, true)})+${SUFFIX_GROUP}(?![a-z])`, 'g')
}

/** Words matched wherever they sit, letters either side or not. */
function embeddedPattern(words: string[]): RegExp {
  if (words.length === 0) {
    return NEVER_MATCHES
  }

  return new RegExp(`(?:${wordAlternation(words, false)})+${SUFFIX_GROUP}`, 'g')
}

/** Spared words, matched whole so only the exact word is spared. */
function sparedPattern(words: string[]): RegExp {
  if (words.length === 0) {
    return NEVER_MATCHES
  }

  return new RegExp(`(?<![a-z])(?:${[...words].sort(byLengthDescending).join('|')})(?![a-z])`, 'g')
}

const BLOCKED_PATTERN = guardedPattern(WORDLIST.blocked)
const SEVERE_PATTERN = embeddedPattern(WORDLIST.severe)
const CLEAN_PATTERN = sparedPattern(WORDLIST.clean)

interface NormalizedText {
  /** The message as it is matched: lowercase latin, decoration folded. */
  matchable: string
  /** For each character of `matchable`, its index in `characters`. */
  sourceIndexes: number[]
  /** The original message by code point: the unit the mask writes in. */
  characters: string[]
}

/**
 * Folds one character onto the plain latin it imitates: accented and
 * fullwidth forms decompose, combining marks and invisible formatting
 * characters vanish, and letters borrowed from another alphabet are
 * mapped across. Returns a string because one character can fold to
 * several (a ligature) or to none (a zero-width space).
 */
function foldCharacter(character: string): string {
  const decomposed = character.normalize('NFKD').replace(IGNORED_CHARACTERS, '').toLowerCase()
  return [...decomposed].map((part) => HOMOGLYPHS[part] ?? part).join('')
}

/**
 * The message in matchable form, plus the map back to the characters it
 * came from. Folding changes the length, so a match cannot be masked by
 * its own offsets. Every matchable character remembers which original
 * character produced it, and that is what the mask is written over.
 */
function normalizeForMatching(text: string): NormalizedText {
  const characters = [...text]
  const sourceIndexes: number[] = []
  let matchable = ''

  characters.forEach((character, index) => {
    for (const folded of foldCharacter(character)) {
      matchable += folded
      sourceIndexes.push(index)
    }
  })

  return { matchable, sourceIndexes, characters }
}

/** Overwrites a span of the original characters with asterisks. */
function maskRange(characters: string[], from: number, to: number): void {
  for (let index = from; index <= to; index += 1) {
    characters[index] = '*'
  }
}

export interface CensorResult {
  text: string
  wasCensored: boolean
}

/**
 * Masks blocked words with asterisks, preserving length so the message
 * still reads naturally. Returns whether anything was masked.
 */
export function censorMessage(text: string): CensorResult {
  const { matchable, sourceIndexes, characters } = normalizeForMatching(text)
  // Blanking with spaces keeps every offset lined up with the original.
  const scanned = matchable.replace(CLEAN_PATTERN, (word) => ' '.repeat(word.length))
  const masked = [...characters]
  let wasCensored = false

  for (const pattern of [BLOCKED_PATTERN, SEVERE_PATTERN]) {
    // These are module-level and carry `lastIndex` between calls, so a
    // run has to start from a known position rather than from wherever
    // the previous message happened to stop.
    pattern.lastIndex = 0
    let match = pattern.exec(scanned)
    while (match !== null) {
      wasCensored = true
      const from = sourceIndexes[match.index]
      const to = sourceIndexes[match.index + match[0].length - 1]
      maskRange(masked, from, to)
      match = pattern.exec(scanned)
    }
  }

  return { text: masked.join(''), wasCensored }
}
