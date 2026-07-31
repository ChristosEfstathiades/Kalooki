import { readFileSync } from 'node:fs'

/**
 * The moderation wordlists, loaded from `resources/wordlist.json`.
 *
 * That file is deliberately untracked (see the .gitignore entry): the
 * words a filter looks for do not belong in a public repository, and
 * keeping them out means the list can be tightened without a commit
 * that reads like abuse. `resources/wordlist.example.json` is tracked
 * in its place and documents every list.
 *
 * A missing file is fatal, the same way a missing .env is. Booting
 * without it would leave every chat and every signup unfiltered, and a
 * server that will not start is a much louder failure than one quietly
 * letting slurs through.
 *
 * `#services/profanity_filter` and `#services/username_filter` hold the
 * matching rules; this module only reads the data they work from.
 */

/** One list per rule. `resources/wordlist.example.json` describes each. */
export interface Wordlist {
  /** Masked in chat, refused in usernames. */
  blocked: string[]
  /** The subset of `blocked` matched anywhere, not only as whole words. */
  severe: string[]
  /** Innocent words containing a `severe` word, spared in chat. */
  clean: string[]
  /** Refused in usernames but not masked in chat. */
  usernameOnly: string[]
  /** Innocent words containing a blocked word, allowed in usernames. */
  usernameClean: string[]
}

const WORDLIST_URL = new URL('../../resources/wordlist.json', import.meta.url)

/** Where to look when the file turns out to be missing or malformed. */
const EXAMPLE_FILE = 'apps/backend/resources/wordlist.example.json'

/**
 * One list, lowercased and trimmed because every rule matches against
 * lowercased text. Anything that is not a list of strings is a mistake
 * worth stopping for rather than silently reading as empty.
 */
function readWordList(source: Record<string, unknown>, name: string): string[] {
  const value = source[name]

  if (!Array.isArray(value)) {
    throw new Error(
      `Moderation wordlist: "${name}" is missing or is not an array. See ${EXAMPLE_FILE}`
    )
  }

  const words: string[] = []

  for (const entry of value) {
    if (typeof entry !== 'string') {
      throw new Error(`Moderation wordlist: "${name}" must contain only strings`)
    }

    const word = entry.trim().toLowerCase()

    if (word.length > 0) {
      words.push(word)
    }
  }

  return words
}

/**
 * Reads and validates `resources/wordlist.json`. Every failure names the
 * file and what was wrong with it: this runs at boot, where a vague
 * error costs whoever set the server up an afternoon.
 */
function loadWordlist(): Wordlist {
  let contents: string

  try {
    contents = readFileSync(WORDLIST_URL, 'utf8')
  } catch (error) {
    throw new Error(
      `Moderation wordlist not found at apps/backend/resources/wordlist.json. ` +
        `It is untracked on purpose: copy ${EXAMPLE_FILE} to resources/wordlist.json ` +
        `and fill it in.`,
      { cause: error }
    )
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(contents)
  } catch (error) {
    throw new Error(
      `Moderation wordlist at apps/backend/resources/wordlist.json is not valid JSON`,
      { cause: error }
    )
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `Moderation wordlist at apps/backend/resources/wordlist.json must be a JSON object. ` +
        `See ${EXAMPLE_FILE}`
    )
  }

  const source = parsed as Record<string, unknown>
  const loaded: Wordlist = {
    blocked: readWordList(source, 'blocked'),
    severe: readWordList(source, 'severe'),
    clean: readWordList(source, 'clean'),
    usernameOnly: readWordList(source, 'usernameOnly'),
    usernameClean: readWordList(source, 'usernameClean'),
  }

  // A word matched anywhere but absent from the main list would be
  // caught inside other words and missed on its own, which is nobody's
  // intent, and much more likely a typo in one of the two lists.
  const orphan = loaded.severe.find((word) => !loaded.blocked.includes(word))

  if (orphan !== undefined) {
    throw new Error(
      `Moderation wordlist: "${orphan}" is in "severe" but not in "blocked". ` +
        `Every severe word has to be a blocked word too.`
    )
  }

  return loaded
}

/** The lists as loaded at boot. Read once; the file is not watched. */
export const WORDLIST = loadWordlist()
