import { test } from '@japa/runner'
import {
  isOnline,
  onlineCount,
  onlineUserIds,
  resetPresence,
  trackConnection,
  trackDisconnection,
  userRoom,
} from '#services/presence_service'

test.group('Presence tracking', (group) => {
  group.each.setup(() => resetPresence())

  test('a first connection brings a user online', ({ assert }) => {
    assert.isTrue(trackConnection(7))
    assert.isTrue(isOnline(7))
    assert.equal(onlineCount(), 1)
  })

  test('extra tabs do not change the count', ({ assert }) => {
    trackConnection(7)

    // A second tab is the same online player
    assert.isFalse(trackConnection(7))
    assert.equal(onlineCount(), 1)

    // Closing one tab leaves them online
    assert.isFalse(trackDisconnection(7))
    assert.isTrue(isOnline(7))
    assert.equal(onlineCount(), 1)

    assert.isTrue(trackDisconnection(7))
    assert.isFalse(isOnline(7))
    assert.equal(onlineCount(), 0)
  })

  test('counts users, not sockets', ({ assert }) => {
    trackConnection(1)
    trackConnection(2)
    trackConnection(2)
    trackConnection(3)

    assert.equal(onlineCount(), 3)
    assert.deepEqual(onlineUserIds().sort(), [1, 2, 3])
  })

  test('an unknown disconnect never reports going offline', ({ assert }) => {
    assert.isFalse(trackDisconnection(99))
    assert.equal(onlineCount(), 0)
  })

  test('names one room per user', ({ assert }) => {
    assert.equal(userRoom(42), 'user:42')
  })
})
