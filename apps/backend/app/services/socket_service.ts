import { Server } from 'socket.io'
import { DateTime } from 'luxon'
import { Secret } from '@adonisjs/core/helpers'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import ScheduledGame from '#models/scheduled_game'
import User from '#models/user'
import { groupIdsOf, isGroupMember } from '#services/group_service'
import { assertMatchChatAccess, postChatMessage } from '#services/chat_service'
import { friendIdsOf } from '#services/friendship_service'
import { isBanned } from '#services/role_service'
import {
  onlineCount,
  resetPresence,
  trackConnection,
  trackDisconnection,
  userRoom,
} from '#services/presence_service'
import {
  configureScheduledLobbyStore,
  onMatchFinished,
  restoreScheduledLobby,
} from '#services/game/match_service'
import { bindGameHandlers, bindMatchEmitter } from '#services/game/socket_bindings'
import { chatMessageShape } from '#transformers/chat_message_transformer'
import type { Socket } from 'socket.io'
import type { Server as NodeHttpServer } from 'node:http'
import type { ChatChannel } from '#services/chat_service'
import type { GameRules } from '#services/game/engine'

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
  if (channel.type === 'group') {
    return `chat:group:${channel.groupId}`
  }
  if (channel.type === 'match') {
    return `chat:match:${channel.matchId}`
  }
  return 'chat:global'
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
  const { channel, groupId, matchId } = payload as {
    channel?: unknown
    groupId?: unknown
    matchId?: unknown
  }
  if (channel === 'global') {
    return { type: 'global' }
  }
  if (channel === 'group' && typeof groupId === 'number' && Number.isInteger(groupId)) {
    return { type: 'group', groupId }
  }
  if (channel === 'match' && typeof matchId === 'string' && matchId !== '') {
    return { type: 'match', matchId }
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

  bindMatchEmitter(io)
  wireScheduledLobbyPersistence()

  // A game's chat closes with the game: kick every socket out of the
  // room so nobody receives (or can be sent) further messages.
  onMatchFinished((match) => {
    io?.in(chatRoom({ type: 'match', matchId: match.id })).socketsLeave(
      chatRoom({ type: 'match', matchId: match.id })
    )
  })

  io.on('connection', (socket) => {
    void joinAuthorizedRooms(socket)
    bindGameHandlers(io as Server, socket, socketUser(socket))
    trackPresence(socket)

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
 * Drops every live connection belonging to a user, with a reason the
 * client can show. Used when an account is banned so the ban takes
 * effect immediately rather than at the next page load.
 */
export function disconnectUser(userId: number, reason: string): void {
  if (!io) {
    return
  }
  for (const socket of io.sockets.sockets.values()) {
    const user = socket.data.user as User | undefined
    if (user?.id === userId) {
      socket.emit('session:revoked', { reason })
      socket.disconnect(true)
    }
  }
}

/**
 * Tells a channel's room that a message was removed by a moderator, so
 * it disappears for everyone currently watching without a refresh.
 */
export function broadcastMessageDeleted(channel: ChatChannel, messageId: number): void {
  io?.to(chatRoom(channel)).emit('chat:message-deleted', {
    channel: channel.type,
    groupId: channel.type === 'group' ? channel.groupId : null,
    matchId: channel.type === 'match' ? channel.matchId : null,
    messageId,
  })
}

/**
 * Closes the Socket.IO server (used on app shutdown).
 */
export async function closeSocketServer(): Promise<void> {
  if (countBroadcastTimer) {
    clearTimeout(countBroadcastTimer)
    countBroadcastTimer = null
  }
  resetPresence()
  if (io) {
    await io.close()
    io = null
  }
}

/**
 * Bursts of connects and disconnects (a deploy, a flaky network) are
 * collapsed into one broadcast on this interval rather than one emit
 * per socket.
 */
const COUNT_BROADCAST_DELAY_MS = 1000

let countBroadcastTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Counts a socket toward its user's presence and tells the rest of the
 * site about it: everyone sees the online total, and the user's friends
 * see them switch between online and offline. Several tabs count as one
 * online player, so only the first and last socket move the needle.
 */
function trackPresence(socket: Socket): void {
  const user = socketUser(socket)

  if (trackConnection(user.id)) {
    scheduleOnlineCountBroadcast()
    void broadcastFriendPresence(user.id, true)
  }

  // Counted first, so the arriving player sees themselves in the total
  // rather than waiting for the next broadcast
  socket.emit('presence:count', { count: onlineCount() })

  socket.on('disconnect', () => {
    if (trackDisconnection(user.id)) {
      scheduleOnlineCountBroadcast()
      void broadcastFriendPresence(user.id, false)
    }
  })
}

/**
 * Queues an online-total broadcast to every connected socket, at most
 * one per COUNT_BROADCAST_DELAY_MS.
 */
function scheduleOnlineCountBroadcast(): void {
  if (countBroadcastTimer) {
    return
  }
  countBroadcastTimer = setTimeout(() => {
    countBroadcastTimer = null
    io?.emit('presence:count', { count: onlineCount() })
  }, COUNT_BROADCAST_DELAY_MS)
  // Never hold the process open just to announce a count
  countBroadcastTimer.unref?.()
}

/**
 * Tells a user's friends that they came online or went offline. Only
 * their friends are told, so presence is never broadcast to strangers.
 */
async function broadcastFriendPresence(userId: number, online: boolean): Promise<void> {
  try {
    const friendIds = await friendIdsOf(userId)
    if (friendIds.length === 0) {
      return
    }
    io?.to(friendIds.map(userRoom)).emit('presence:friend', { userId, online })
  } catch (error) {
    logger.error({ err: error }, 'Failed to broadcast friend presence')
  }
}

/**
 * Backs the match service's scheduled lobbies with the database and
 * restores pending schedules from earlier runs, so a game planned
 * hours ahead survives a server restart (live lobbies do not).
 */
function wireScheduledLobbyPersistence(): void {
  configureScheduledLobbyStore({
    save: (entry) => {
      ScheduledGame.updateOrCreate(
        { groupId: entry.groupId },
        {
          ownerUserId: entry.ownerId,
          rules: JSON.stringify(entry.rules),
          opensAt: DateTime.fromMillis(entry.opensAt),
        }
      ).catch((error: unknown) => {
        logger.error({ err: error }, 'Failed to persist scheduled game')
      })
    },
    remove: (groupId) => {
      ScheduledGame.query()
        .where('groupId', groupId)
        .delete()
        .catch((error: unknown) => {
          logger.error({ err: error }, 'Failed to delete scheduled game')
        })
    },
  })

  ScheduledGame.all()
    .then((scheduled) => {
      for (const entry of scheduled) {
        restoreScheduledLobby({
          groupId: entry.groupId,
          ownerId: entry.ownerUserId,
          rules: JSON.parse(entry.rules) as GameRules,
          opensAt: entry.opensAt.toMillis(),
        })
      }
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, 'Failed to restore scheduled games')
    })
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
  const user = await User.find(accessToken.tokenableId)
  // Banned accounts get no realtime connection at all.
  return user && !isBanned(user) ? user : null
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
      matchId: channel.type === 'match' ? channel.matchId : null,
      message: chatMessageShape(message),
    })
    ack?.({ ok: true })
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Could not send the message'
    ack?.({ ok: false, error: messageText })
  }
}

/**
 * Joins a chat room after connection time: a group chat (e.g. the user
 * just accepted an invite) or a live game's chat. Access is re-checked
 * server-side either way.
 */
async function handleChatSubscribe(socket: Socket, payload: unknown, ack?: SendAck): Promise<void> {
  const { groupId, matchId } = (payload ?? {}) as { groupId?: unknown; matchId?: unknown }

  try {
    const user = socketUser(socket)

    if (typeof matchId === 'string' && matchId !== '') {
      assertMatchChatAccess(matchId, user.id)
      await socket.join(chatRoom({ type: 'match', matchId }))
      ack?.({ ok: true })
      return
    }

    if (typeof groupId !== 'number' || !Number.isInteger(groupId)) {
      ack?.({ ok: false, error: 'Malformed subscribe request' })
      return
    }
    if (!(await isGroupMember(groupId, user.id))) {
      ack?.({ ok: false, error: 'Group not found' })
      return
    }
    await socket.join(chatRoom({ type: 'group', groupId }))
    ack?.({ ok: true })
  } catch (error) {
    if (error instanceof Exception && error.code === 'E_MATCH_CHAT_NOT_FOUND') {
      ack?.({ ok: false, error: 'Match chat not found' })
      return
    }
    logger.error({ err: error }, 'chat:subscribe failed')
    ack?.({ ok: false, error: 'Could not join the chat' })
  }
}
