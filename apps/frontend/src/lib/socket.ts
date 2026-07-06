import { io } from 'socket.io-client'
import { apiBaseUrl } from '#/lib/api'
import { getStoredToken } from '#/lib/auth-token'
import type { Socket } from 'socket.io-client'

/**
 * Singleton Socket.IO connection to the backend. The handshake carries
 * the API token (docs/Architecture.md); the auth callback re-reads it
 * on every reconnect attempt so a fresh signin is picked up.
 */
let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(apiBaseUrl, {
      auth: (setAuth) => setAuth({ token: getStoredToken() }),
    })
  }
  return socket
}

/**
 * Tears the connection down, e.g. on sign-out.
 */
export function closeSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
