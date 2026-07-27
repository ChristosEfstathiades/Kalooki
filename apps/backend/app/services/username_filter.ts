import { BLOCKED_WORDS } from '#services/profanity_filter'

/**
 * Username filtering at signup, item 6 of Developer/Chat-Moderation.md.
 *
 * Two separate refusals live here, and they are different problems:
 * `findBlockedWordInUsername` catches profanity and slurs, while
 * `isReservedUsername` catches names that impersonate the site or its
 * staff. They match by different rules, described above each.
 *
 * A username is not a message. Chat masks a bad word and moves on; a
 * username is permanent, sits on every message the account ever sends,
 * and appears in lobbies and the leaderboard, so this rejects instead.
 *
 * Profanity is matched by substring rather than by word boundary,
 * because a username has no spaces to bound anything — "xXfuckXx" is the
 * whole reason this exists. Substring matching brings the Scunthorpe
 * problem with it, which ALLOWED_WORDS below buys back for the
 * collisions that actually happen. The trade favours catching the abuse:
 * a false positive costs someone one attempt at a name and the error
 * says so, while a miss is a slur on screen for the life of the account.
 */

/**
 * Words rejected in usernames but not masked in chat. Chat censors what
 * people say in the moment; a name is a label worn permanently, so the
 * bar for it is lower. Kept separate from BLOCKED_WORDS so adding to it
 * cannot quietly change what chat masks.
 */
const USERNAME_ONLY_BLOCKED_WORDS = [
  'penis',
  'vagina',
  'cock',
  'dick',
  'anus',
  'wank',
  'jizz',
  'bollocks',
  'bastard',
  'rape',
  'rapist',
  'pedo',
  'paedo',
  'nazi',
  'hitler',
]

/**
 * Innocent words that contain a blocked word. These are cut out of the
 * name before the blocked list is scanned, so "raccoon" is clean while
 * "coon" on its own is not. Plurals and suffixes need no entry: cutting
 * "grape" out of "grapes" leaves an "s" behind, which matches nothing.
 *
 * Add to this when a real player reports a false positive — guessing at
 * the whole of English here is not the job.
 */
const ALLOWED_WORDS = [
  'scunthorpe', // cunt
  'shiitake', // shit
  'prickle', // prick
  'prickly',
  'prickett',
  'montenegro', // negro
  'negroni',
  'raccoon', // coon
  'racoon',
  'cocoon',
  'tycoon',
  'spice', // spic
  'spicy',
  'aspic',
  'suspicious',
  'auspicious',
  'conspicuous',
  'pakistan', // paki
  'peacock', // cock
  'cockpit',
  'cocktail',
  'cockney',
  'cocker',
  'cockatoo',
  'cockroach',
  'shuttlecock',
  'woodcock',
  'gamecock',
  // Surnames ending in "-cock" are a large family; these are the common
  // ones, and the rest is what the "add it when reported" note is for.
  'cockburn',
  'hitchcock',
  'hancock',
  'babcock',
  'alcock',
  'adcock',
  'wilcock',
  'dickens', // dick
  'dickinson',
  'dickerson',
  'dickson',
  'dickie',
  'uranus', // anus
  'janus',
  'grape', // rape
  'drape',
  'scrape',
  'trapeze',
  'therapist', // rapist
  'therapeutic',
  'torpedo', // pedo
  'speedo',
  'pedometer',
  'nazir', // nazi
]

/**
 * Characters that read as a letter without being one. Both directions
 * of the i/l pair are listed because either can stand in for the other
 * ("s1ut" wants an l, "n1gger" wants an i) and a character class costs
 * nothing to widen. Deliberately absent: z for s, which would make the
 * perfectly ordinary names "Nasir" and "Nasi" read as a slur.
 */
const LOOKALIKE_CHARACTERS: Record<string, string> = {
  a: 'a4',
  b: 'b8',
  e: 'e3',
  g: 'g69',
  i: 'i1l',
  l: 'l1i',
  o: 'o0',
  s: 's5',
  t: 't7',
  u: 'uv',
}

/**
 * Words this short must stand alone or be fenced by something that is
 * not a letter. "wog" and "fag" are real slurs, but as substrings they
 * live inside "showgirl", "twogames" and "Fagan" — three letters buried
 * in a longer name are innocent far more often than not. So "fag69" is
 * rejected and "Fagan" is not, at the cost of missing "fagboy".
 */
const DELIMITED_WORD_MAX_LENGTH = 3

/**
 * The regex source for one word: every letter widened to its lookalikes,
 * repeats allowed ("fuuuck"), and underscores allowed between letters
 * ("f_u_c_k"), since underscore is the only separator a username may
 * contain.
 */
function wordPatternSource(word: string): string {
  return [...word].map((letter) => `[${LOOKALIKE_CHARACTERS[letter] ?? letter}]+`).join('_*')
}

/**
 * Wraps a short word so it only matches when no letter sits against it.
 * Digits stay outside the fence on purpose: "fag69" is the name we are
 * here for, and its trailing digits are not a word.
 */
function delimit(source: string): string {
  return `(?<![a-z])(?:${source})(?![a-z])`
}

/**
 * One pattern per word rather than a single alternation, so the caller
 * can be told which word matched. None of these carry the "g" flag —
 * they are used with `.test()`, and a global regex there is stateful
 * through `lastIndex` (see Developer/Chat-Moderation.md).
 */
const blockedPatterns = [...BLOCKED_WORDS, ...USERNAME_ONLY_BLOCKED_WORDS].map((word) => {
  const source = wordPatternSource(word)
  return {
    word,
    pattern: new RegExp(word.length <= DELIMITED_WORD_MAX_LENGTH ? delimit(source) : source),
  }
})

/**
 * Longest first, because alternation takes whichever branch matches
 * first at a position. Where one allowed word is a prefix of another
 * ("cocker" inside a future "cockerel") the short branch would win and
 * leave the tail of the long one in the name — usually harmless, but
 * not something to leave to the order someone happened to type.
 */
const allowedPattern = new RegExp(
  [...ALLOWED_WORDS]
    .sort((first, second) => second.length - first.length)
    .map(wordPatternSource)
    .join('|'),
  'g'
)

/**
 * The form a username is matched in: lowercased, with "ph" read as "f"
 * so "phuck" does not walk past a list that only knows "fuck". No
 * blocked or allowed word contains "ph", so nothing else shifts.
 */
function normalizeForMatching(username: string): string {
  return username.toLowerCase().replace(/ph/g, 'f')
}

/**
 * The first blocked word a username contains, or null when it is clean.
 * Returns the word rather than a boolean so callers can log what tripped
 * the filter without repeating the scan — the player is never told.
 */
export function findBlockedWordInUsername(username: string): string | null {
  // A space cannot appear in a username, so it fences off what is cut
  // out and two innocent halves can never be joined into a blocked word.
  const normalized = normalizeForMatching(username).replace(allowedPattern, ' ')

  for (const { word, pattern } of blockedPatterns) {
    if (pattern.test(normalized)) {
      return word
    }
  }

  return null
}

/**
 * Reserved names: impersonation rather than abuse, so they are matched
 * differently. A MOD or ADMIN badge beside the name is the only
 * legitimate mark of authority on the site (docs/features.md), and a
 * username must never be able to claim one.
 *
 * These are compared against the *whole* name, not searched for inside
 * it. "admin" is refused and "Badminton" is not; "Kalooki" is refused
 * and "KalookiKing" is not, because a fan naming themselves after the
 * game is the opposite of a problem.
 */
const RESERVED_NAMES = [
  'admin',
  'admins',
  'administrator',
  'administration',
  'moderator',
  'moderators',
  'mod',
  'mods',
  'staff',
  'team',
  'support',
  'help',
  'helpdesk',
  'contact',
  'system',
  'server',
  'root',
  'owner',
  'official',
  'bot',
  'bots',
  'guest',
  'anonymous',
  'deleted',
  'kalooki',
  'kalookionline',
  // The practice-match opponents, kept in step with BOT_USERNAMES in
  // #services/game/bot_users. A human wearing one of these at a table is
  // the same confusion as one wearing "admin", and ensureBotUser already
  // has to work around a human having taken the name.
  'rustybot',
  'sparkbot',
  'zippybot',
  'cogbot',
]

/**
 * Refused anywhere inside a name rather than only as the whole of it,
 * because no ordinary word contains them: "TheModerator" claims exactly
 * as much authority as "Moderator" does.
 */
const RESERVED_SUBSTRINGS = ['moderator', 'administrator']

/** The site's own name, which on its own is fine to be a fan of. */
const SITE_WORDS = ['kalooki']

/**
 * Words that claim authority. Most are ordinary English on their own, so
 * they only count against a name that also carries the site's name:
 * "KalookiAdmin" and "Mod_Kalooki" are refused, "ModernPlayer" is not.
 * The over-block that buys ("Kalooki_Modern") is a name nobody is owed.
 */
const STAFF_WORDS = ['admin', 'mod', 'staff', 'team', 'support', 'help', 'official']

/**
 * Characters folded onto one representative before reserved names are
 * compared. Unlike the profanity patterns, which widen each letter into
 * the set of things that could stand for it, this narrows many spellings
 * to one — the right shape for equality. Both sides of every comparison
 * are folded, so "l" and "i" collapsing together is consistent rather
 * than wrong: "admln", "adm1n" and "admin" all end up the same string.
 */
const CONFUSABLE_CHARACTERS: Record<string, string> = {
  '4': 'a',
  '8': 'b',
  '3': 'e',
  '6': 'g',
  '9': 'g',
  '1': 'i',
  '0': 'o',
  '5': 's',
  '7': 't',
  'l': 'i',
  'v': 'u',
}

/**
 * The form a name is compared in: lowercased, underscores dropped
 * ("a_d_m_i_n"), lookalikes folded, and runs of one character collapsed
 * ("aaadmin", "moddd").
 */
function canonicalize(text: string): string {
  return [...text.toLowerCase().replace(/_/g, '')]
    .map((character) => CONFUSABLE_CHARACTERS[character] ?? character)
    .join('')
    .replace(/(.)\1+/g, '$1')
}

/**
 * Both readings of a name, because a digit is ambiguous: in "adm1n" it
 * stands for a letter, in "admin123" it is decoration. Folding handles
 * the first, stripping digits off the ends handles the second, and a
 * name is reserved if either reading says so.
 */
function canonicalReadings(username: string): string[] {
  return [canonicalize(username), canonicalize(username.replace(/^\d+|\d+$/g, ''))]
}

const reservedNames = new Set(RESERVED_NAMES.map(canonicalize))
const reservedSubstrings = RESERVED_SUBSTRINGS.map(canonicalize)
const siteWords = SITE_WORDS.map(canonicalize)
const staffWords = STAFF_WORDS.map(canonicalize)

/**
 * Whether a username impersonates the site, a staff role or a bot.
 */
export function isReservedUsername(username: string): boolean {
  return canonicalReadings(username).some(
    (reading) =>
      reservedNames.has(reading) ||
      reservedSubstrings.some((word) => reading.includes(word)) ||
      (siteWords.some((word) => reading.includes(word)) &&
        staffWords.some((word) => reading.includes(word)))
  )
}
