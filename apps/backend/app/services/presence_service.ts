/**
 * In-memory presence: which users currently hold at least one open
 * socket, and how many there are in total. Presence is derived from
 * live Socket.IO connections (docs/Architecture.md), so it needs no
 * persistence — a restart drops every connection and the map with it.
 *
 * Users are counted, not sockets: several tabs are one online player.
 */
const socketCountByUser = new Map<number, number>()

/**
 * The room every one of a user's sockets joins, used to reach all of
 * that user's tabs at once.
 */
export function userRoom(userId: number): string {
  return `user:${userId}`
}

/**
 * Records a new connection for a user. Returns true when this was the
 * user's first socket, i.e. they just came online.
 */
export function trackConnection(userId: number): boolean {
  const openSockets = socketCountByUser.get(userId) ?? 0
  socketCountByUser.set(userId, openSockets + 1)
  return openSockets === 0
}

/**
 * Records a closed connection for a user. Returns true when it was
 * their last socket, i.e. they just went offline.
 */
export function trackDisconnection(userId: number): boolean {
  const openSockets = socketCountByUser.get(userId) ?? 0
  if (openSockets <= 1) {
    socketCountByUser.delete(userId)
    return openSockets === 1
  }
  socketCountByUser.set(userId, openSockets - 1)
  return false
}

/**
 * Whether the user has at least one open connection.
 */
export function isOnline(userId: number): boolean {
  return socketCountByUser.has(userId)
}

/**
 * The ids of every user currently connected.
 */
export function onlineUserIds(): number[] {
  return [...socketCountByUser.keys()]
}

/**
 * How many distinct users are currently connected.
 */
export function onlineCount(): number {
  return socketCountByUser.size
}

/**
 * Forgets every tracked connection. Used when the socket server shuts
 * down and by tests that assert on presence.
 */
export function resetPresence(): void {
  socketCountByUser.clear()
}
