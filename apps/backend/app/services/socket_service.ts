import { Server } from 'socket.io'
import { Secret } from '@adonisjs/core/helpers'
import logger from '@adonisjs/core/services/logger'
import User from '#models/user'
import { groupIdsOf, isGroupMember } from '#services/group_service'
import { postChatMessage } from '#services/chat_service'
import { chatMessageShape } from '#transformers/chat_message_transformer'
import type { Socket } from 'socket.io'
import type { Server as NodeHttpServer } from 'node:http'
import type { ChatChannel } from '#services/chat_service'

/**
 * Socket.IO server attached to the AdonisJS HTTP server
 * (docs/Architecture.md). The handshake carries the API token, and a
 * socket only joins rooms it is authorized for, so a client never
 * receives events for groups (or later, games) it doesn't belong to.
 */
let io: Server | null = null

/**
 * The running Socket.IO server, for other modules (e.g. the game
 * engine) to broadcast through. Null until the HTTP server is ready.
 */
export function getSocketServer(): Server | null {
  return io
}

/**
 * The room name for a chat channel.
 */
export function chatRoom(channel: ChatChannel): string {
  return channel.type === 'global' ? 'chat:global' : `chat:group:${channel.groupId}`
}

/**
 * Reads the authenticated user a middleware attached to the socket.
 */
function socketUser(socket: Socket): User {
  return socket.data.user as User
}

/**
 * Parses an untrusted chat:send payload into a channel, or null when
 * the payload is malformed.
 */
function parseChannel(payload: unknown): ChatChannel | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const { channel, groupId } = payload as { channel?: unknown; groupId?: unknown }
  if (channel === 'global') {
    return { type: 'global' }
  }
  if (channel === 'group' && typeof groupId === 'number' && Number.isInteger(groupId)) {
    return { type: 'group', groupId }
  }
  return null
}

type SendAck = (result: { ok: boolean; error?: string }) => void

/**
 * Creates the Socket.IO server on the given HTTP server and wires the
 * chat events. Returns the io instance.
 */
export function bootSocketServer(nodeServer: NodeHttpServer): Server {
  io = new Server(nodeServer, {
    // Mirrors config/cors.ts: open in development, locked down until
    // a production origin allowlist is configured.
    cors: { origin: true, credentials: true },
  })

  io.use((socket, next) => {
    authenticateSocket(socket)
      .then((user) => {
        if (!user) {
          next(new Error('Authentication required'))
          return
        }
        socket.data.user = user
        next()
      })
      .catch(() => next(new Error('Authentication failed')))
  })

  io.on('connection', (socket) => {
    void joinAuthorizedRooms(socket)

    socket.on('chat:send', (payload: unknown, ack?: SendAck) => {
      void handleChatSend(socket, payload, ack)
    })

    socket.on('chat:subscribe', (payload: unknown, ack?: SendAck) => {
      void handleChatSubscribe(socket, payload, ack)
    })
  })

  return io
}

/**
 * Closes the Socket.IO server (used on app shutdown).
 */
export async function closeSocketServer(): Promise<void> {
  if (io) {
    await io.close()
    io = null
  }
}

/**
 * Verifies the handshake token and loads its user, or returns null.
 */
async function authenticateSocket(socket: Socket): Promise<User | null> {
  const token: unknown = socket.handshake.auth.token
  if (typeof token !== 'string' || token === '') {
    return null
  }
  const accessToken = await User.accessTokens.verify(new Secret(token))
  if (!accessToken) {
    return null
  }
  return User.find(accessToken.tokenableId)
}

/**
 * Joins the rooms this socket is allowed in: the global chatroom and
 * one room per group the user belongs to.
 */
async function joinAuthorizedRooms(socket: Socket): Promise<void> {
  const user = socketUser(socket)
  await socket.join(chatRoom({ type: 'global' }))
  const groupIds = await groupIdsOf(user.id)
  await socket.join(groupIds.map((groupId) => chatRoom({ type: 'group', groupId })))
}

/**
 * Validates and stores an incoming chat message, then broadcasts it to
 * the channel's room. The ack tells the sender what happened.
 */
async function handleChatSend(socket: Socket, payload: unknown, ack?: SendAck): Promise<void> {
  const channel = parseChannel(payload)
  const body = (payload as { body?: unknown } | null)?.body

  if (!channel || typeof body !== 'string') {
    ack?.({ ok: false, error: 'Malformed chat message' })
    return
  }

  try {
    const message = await postChatMessage(socketUser(socket), channel, body)
    io?.to(chatRoom(channel)).emit('chat:message', {
      channel: channel.type,
      groupId: channel.type === 'group' ? channel.groupId : null,
      message: chatMessageShape(message),
    })
    ack?.({ ok: true })
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Could not send the message'
    ack?.({ ok: false, error: messageText })
  }
}

/**
 * Joins a group chat room after connection time (e.g. the user just
 * accepted a group invite). Membership is re-checked server-side.
 */
async function handleChatSubscribe(socket: Socket, payload: unknown, ack?: SendAck): Promise<void> {
  const { groupId } = (payload ?? {}) as { groupId?: unknown }
  if (typeof groupId !== 'number' || !Number.isInteger(groupId)) {
    ack?.({ ok: false, error: 'Malformed subscribe request' })
    return
  }

  try {
    const user = socketUser(socket)
    if (!(await isGroupMember(groupId, user.id))) {
      ack?.({ ok: false, error: 'Group not found' })
      return
    }
    await socket.join(chatRoom({ type: 'group', groupId }))
    ack?.({ ok: true })
  } catch (error) {
    logger.error({ err: error }, 'chat:subscribe failed')
    ack?.({ ok: false, error: 'Could not join the group chat' })
  }
}
