/**
 * Chat censorship (docs/features.md): offending words are masked but
 * the message is still posted, with particular emphasis on preventing
 * racial abuse. This is a starter wordlist — extend it (or replace it
 * with a maintained list/service) as moderation needs grow.
 */
const BLOCKED_WORDS = [
  // General profanity
  'fuck',
  'fucking',
  'fucker',
  'motherfucker',
  'shit',
  'bullshit',
  'bitch',
  'cunt',
  'asshole',
  'arsehole',
  'dickhead',
  'wanker',
  'twat',
  'prick',
  'slut',
  'whore',
  // Slurs — racial abuse is the moderation priority
  'nigger',
  'nigga',
  'negro',
  'coon',
  'kike',
  'spic',
  'chink',
  'gook',
  'paki',
  'wog',
  'wetback',
  'faggot',
  'fag',
  'tranny',
  'retard',
]

/**
 * Word-boundary, case-insensitive matcher built once at module load.
 */
const blockedPattern = new RegExp(`\\b(?:${BLOCKED_WORDS.join('|')})\\b`, 'gi')

export interface CensorResult {
  text: string
  wasCensored: boolean
}

/**
 * Masks blocked words with asterisks, preserving length so the message
 * still reads naturally. Returns whether anything was masked.
 */
export function censorMessage(text: string): CensorResult {
  let wasCensored = false
  const censored = text.replace(blockedPattern, (match) => {
    wasCensored = true
    return '*'.repeat(match.length)
  })
  return { text: censored, wasCensored }
}
