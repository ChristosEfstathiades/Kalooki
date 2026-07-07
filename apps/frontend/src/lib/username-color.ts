/**
 * Fixed palette of readable colours for the dark chat background,
 * matching the set Twitch assigns chat usernames from. Also the set
 * of colours offered on the settings page (must match the backend's
 * copy in app/services/chat_service.ts).
 */
export const USERNAME_COLORS = [
  '#FF0000', // Red
  '#6495ED', // CornflowerBlue
  '#008000', // Green
  '#B22222', // Firebrick
  '#FF7F50', // Coral
  '#9ACD32', // YellowGreen
  '#FF4500', // OrangeRed
  '#2E8B57', // SeaGreen
  '#DAA520', // GoldenRod
  '#D2691E', // Chocolate
  '#5F9EA0', // CadetBlue
  '#1E90FF', // DodgerBlue
  '#FF69B4', // HotPink
  '#8A2BE2', // BlueViolet
  '#00FF7F', // SpringGreen
] as const

export type UsernameColor = (typeof USERNAME_COLORS)[number]

/**
 * Deterministically maps a username to one of a fixed palette of
 * colours (Twitch-style), so a given user always shows in the same
 * colour across sessions and channels.
 *
 * Uses FNV-1a rather than a multiply-by-31 hash: with a 15-colour
 * palette, 31 ≡ 1 (mod 15), so every power of 31 collapses to 1 and
 * the simpler hash degenerates to "sum of character codes" —
 * character order stops mattering and anagram usernames collide.
 * FNV-1a's XOR/multiply mixing avoids that.
 */
export function usernameColor(username: string): UsernameColor {
  let hash = 0x811c9dc5
  for (let i = 0; i < username.length; i++) {
    hash ^= username.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return USERNAME_COLORS[(hash >>> 0) % USERNAME_COLORS.length]
}

/**
 * CSS colour for rendering a chat name in the current theme. The
 * palette is tuned for dark backgrounds, so the light theme mixes in
 * black via --chat-color-shade (0% in dark mode, see styles.css) to
 * keep pale colours like SpringGreen readable on white.
 */
export function chatNameColor(color: string): string {
  return `color-mix(in srgb, ${color}, black var(--chat-color-shade))`
}
