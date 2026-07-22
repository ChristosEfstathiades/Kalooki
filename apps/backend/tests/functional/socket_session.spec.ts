import { createServer } from 'node:http'
import { test } from '@japa/runner'
import { io as connectClient } from 'socket.io-client'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import { mintAccessToken } from '#services/access_token_service'
import { bootSocketServer, closeSocketServer } from '#services/socket_service'
import type { Server as NodeHttpServer } from 'node:http'
import type { Socket } from 'socket.io-client'

/**
 * Sockets authenticate once, at handshake, so revoking a token has to
 * close the connections it already opened (AUDIT.md S4). These tests run
 * the socket server on its own throwaway HTTP server: closing a
 * Socket.IO server also closes the HTTP server it is attached to, which
 * would take the shared test server down with it.
 */
const SOCKET_TIMEOUT_MS = 5000

let socketServer: NodeHttpServer | null = null
const openSockets: Socket[] = []

/**
 * The address the test's Socket.IO server is listening on.
 */
function socketBaseUrl(): string {
  const address = socketServer?.address()
  if (!address || typeof address === 'string') {
    throw new Error('The socket test server is not listening on a TCP port')
  }
  return `http://127.0.0.1:${address.port}`
}

/**
 * Rejects a pending socket expectation once it has clearly failed to
 * happen, so a broken assertion fails the test instead of hanging it.
 */
function withTimeout<T>(
  description: string,
  work: (settle: (value: T) => void, fail: (error: Error) => void) => void
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${description}`)),
      SOCKET_TIMEOUT_MS
    )
    work(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

/**
 * Opens a client connection without waiting for the handshake result.
 */
function openSocket(token: string): Socket {
  const socket = connectClient(socketBaseUrl(), {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  })
  openSockets.push(socket)
  return socket
}

/**
 * Opens an authenticated client connection and waits for the handshake.
 */
async function connectAs(token: string): Promise<Socket> {
  const socket = openSocket(token)

  await withTimeout<void>('the socket to connect', (settle, fail) => {
    socket.once('connect', () => settle())
    socket.once('connect_error', (error: Error) => fail(error))
  })

  return socket
}

/**
 * Resolves with the reason the server gave for ending the session.
 */
function revocationReason(socket: Socket): Promise<string> {
  return withTimeout<string>('the session to be revoked', (settle) => {
    socket.once('session:revoked', (payload: { reason: string }) => settle(payload.reason))
  })
}

/**
 * Resolves once the server has actually closed the connection.
 */
function disconnection(socket: Socket): Promise<void> {
  return withTimeout<void>('the socket to be disconnected', (settle) => {
    socket.once('disconnect', () => settle())
  })
}

/**
 * A user with a known password, plus a freshly minted access token.
 */
async function playerWithToken(username: string): Promise<{ user: User; token: string }> {
  const user = await User.create({
    username,
    email: `${username}@example.com`,
    password: 'Kalooki!23',
  })
  return { user, token: await mintAccessToken(user) }
}

test.group('Socket sessions end with their token', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  group.setup(async () => {
    socketServer = createServer()
    await new Promise<void>((resolve) => {
      socketServer?.listen(0, '127.0.0.1', resolve)
    })
    bootSocketServer(socketServer)

    return async () => {
      await closeSocketServer()
      socketServer = null
    }
  })

  group.each.teardown(() => {
    for (const socket of openSockets.splice(0)) {
      socket.disconnect()
    }
  })

  test('signing out drops the live sockets opened with that token', async ({ client, assert }) => {
    const { token } = await playerWithToken('socket_logout')
    const socket = await connectAs(token)
    const revoked = revocationReason(socket)
    const dropped = disconnection(socket)

    const response = await client.post('/api/v1/account/logout').bearerToken(token)
    response.assertStatus(200)

    assert.equal(await revoked, 'You have been signed out.')
    await dropped
    assert.isFalse(socket.connected)
  })

  test('signing out on one device leaves the other sessions connected', async ({
    client,
    assert,
  }) => {
    const { user, token } = await playerWithToken('socket_two_devices')
    const otherToken = await mintAccessToken(user)
    const socket = await connectAs(token)
    const otherSocket = await connectAs(otherToken)
    const dropped = disconnection(socket)

    await client.post('/api/v1/account/logout').bearerToken(token)

    // The server disconnects every match in one pass, so if this token's
    // sockets are gone and the other's is not, the filter held
    await dropped
    assert.isTrue(otherSocket.connected)
  })

  test('signing out leaves other players connected', async ({ client, assert }) => {
    const { token } = await playerWithToken('socket_leaver')
    const bystander = await playerWithToken('socket_bystander')
    const socket = await connectAs(token)
    const bystanderSocket = await connectAs(bystander.token)
    const dropped = disconnection(socket)

    await client.post('/api/v1/account/logout').bearerToken(token)

    await dropped
    assert.isTrue(bystanderSocket.connected)
  })

  test('deleting an account drops every one of its sockets', async ({ client, assert }) => {
    const { user, token } = await playerWithToken('socket_deleter')
    const otherToken = await mintAccessToken(user)
    const socket = await connectAs(token)
    const otherSocket = await connectAs(otherToken)
    const revoked = revocationReason(otherSocket)
    const bothDropped = Promise.all([disconnection(socket), disconnection(otherSocket)])

    const response = await client.delete('/api/v1/account').bearerToken(token)
    response.assertStatus(200)

    assert.equal(await revoked, 'Your account has been deleted.')
    await bothDropped
  })

  test('a revoked token cannot open a new socket', async ({ client, assert }) => {
    const { token } = await playerWithToken('socket_revoked')
    await client.post('/api/v1/account/logout').bearerToken(token)

    const socket = openSocket(token)

    const error = await withTimeout<Error>('the handshake to be rejected', (settle) => {
      socket.once('connect_error', (connectError: Error) => settle(connectError))
    })
    assert.equal(error.message, 'Authentication required')
  })
})
