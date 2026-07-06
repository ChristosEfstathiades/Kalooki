import { test } from '@japa/runner'
import User from '#models/user'
import FriendRequest from '#models/friend_request'
import { areFriends, createFriendship } from '#services/friendship_service'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * Creates a user with a valid password for auth-client logins.
 */
async function makeUser(username: string): Promise<User> {
  return User.create({
    username,
    email: `${username}@example.com`,
    password: 'Kalooki!23',
  })
}

interface PublicUserBody {
  id: number
  username: string
}

/**
 * Narrows a response body's data. The typed test client unions the
 * response shapes of routes that share a pattern across HTTP methods
 * (e.g. GET and POST /friend-requests), so member access needs a cast.
 */
function dataOf<T>(response: { body: () => unknown }): T {
  return (response.body() as { data: T }).data
}

test.group('Friend requests', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('requires authentication', async ({ client }) => {
    const response = await client.get('/api/v1/friend-requests')
    response.assertStatus(401)
  })

  test('sends a request by exact username', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    await makeUser('bobby')

    const response = await client
      .post('/api/v1/friend-requests')
      .json({ username: 'bobby' })
      .loginAs(alice)

    response.assertStatus(200)
    const sentRequest = dataOf<{ request: { recipient: PublicUserBody } }>(response).request
    assert.equal(sentRequest.recipient.username, 'bobby')
    assert.notProperty(sentRequest.recipient, 'email')
  })

  test('matches usernames exactly, never partially', async ({ client }) => {
    const alice = await makeUser('alice')
    await makeUser('player_one')

    // A prefix must not match
    const partial = await client
      .post('/api/v1/friend-requests')
      .json({ username: 'player' })
      .loginAs(alice)
    partial.assertStatus(404)

    // Underscores are literal characters, not single-character wildcards
    await makeUser('playerXone')
    const wildcard = await client
      .post('/api/v1/friend-requests')
      .json({ username: 'player_one' })
      .loginAs(alice)
    wildcard.assertStatus(200)
    wildcard.assertBodyContains({ data: { request: { recipient: { username: 'player_one' } } } })
  })

  test('rejects self, duplicate, reverse, and already-friends requests', async ({ client }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const carol = await makeUser('carol')

    const self = await client
      .post('/api/v1/friend-requests')
      .json({ username: 'alice' })
      .loginAs(alice)
    self.assertStatus(400)

    await client.post('/api/v1/friend-requests').json({ username: 'bobby' }).loginAs(alice)
    const duplicate = await client
      .post('/api/v1/friend-requests')
      .json({ username: 'bobby' })
      .loginAs(alice)
    duplicate.assertStatus(409)

    const reverse = await client
      .post('/api/v1/friend-requests')
      .json({ username: 'alice' })
      .loginAs(bobby)
    reverse.assertStatus(409)

    await createFriendship(alice.id, carol.id)
    const alreadyFriends = await client
      .post('/api/v1/friend-requests')
      .json({ username: 'carol' })
      .loginAs(alice)
    alreadyFriends.assertStatus(409)
  })

  test('recipient can accept, making both users friends', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    await client.post('/api/v1/friend-requests').json({ username: 'bobby' }).loginAs(alice)

    const incoming = await client.get('/api/v1/friend-requests').loginAs(bobby)
    const requestId = dataOf<{ incoming: { id: number }[] }>(incoming).incoming[0].id

    const accept = await client.post(`/api/v1/friend-requests/${requestId}/accept`).loginAs(bobby)
    accept.assertStatus(200)
    assert.equal(accept.body().data.friend.username, 'alice')

    assert.isTrue(await areFriends(alice.id, bobby.id))
    assert.isNull(await FriendRequest.find(requestId))
  })

  test('only the recipient can accept', async ({ client }) => {
    const alice = await makeUser('alice')
    await makeUser('bobby')
    const sent = await client
      .post('/api/v1/friend-requests')
      .json({ username: 'bobby' })
      .loginAs(alice)
    const requestId = dataOf<{ request: { id: number } }>(sent).request.id

    const bySender = await client.post(`/api/v1/friend-requests/${requestId}/accept`).loginAs(alice)
    bySender.assertStatus(404)
  })

  test('sender can cancel and recipient can decline; strangers cannot', async ({
    client,
    assert,
  }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    const carol = await makeUser('carol')

    const sent = await client
      .post('/api/v1/friend-requests')
      .json({ username: 'bobby' })
      .loginAs(alice)
    const requestId = dataOf<{ request: { id: number } }>(sent).request.id

    const byStranger = await client.delete(`/api/v1/friend-requests/${requestId}`).loginAs(carol)
    byStranger.assertStatus(404)

    const cancel = await client.delete(`/api/v1/friend-requests/${requestId}`).loginAs(alice)
    cancel.assertStatus(200)
    assert.isNull(await FriendRequest.find(requestId))

    const sentAgain = await client
      .post('/api/v1/friend-requests')
      .json({ username: 'bobby' })
      .loginAs(alice)
    const secondId = dataOf<{ request: { id: number } }>(sentAgain).request.id
    const decline = await client.delete(`/api/v1/friend-requests/${secondId}`).loginAs(bobby)
    decline.assertStatus(200)
    assert.isFalse(await areFriends(alice.id, bobby.id))
  })
})

test.group('Friends list', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('lists friends without private fields', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    await createFriendship(alice.id, bobby.id)

    const response = await client.get('/api/v1/friends').loginAs(alice)
    response.assertStatus(200)
    const friends = response.body().data.friends
    assert.lengthOf(friends, 1)
    assert.equal(friends[0].username, 'bobby')
    assert.notProperty(friends[0], 'email')
  })

  test('removal is mutual and silent', async ({ client, assert }) => {
    const alice = await makeUser('alice')
    const bobby = await makeUser('bobby')
    await createFriendship(alice.id, bobby.id)

    const remove = await client.delete(`/api/v1/friends/${bobby.id}`).loginAs(alice)
    remove.assertStatus(200)

    const aliceFriends = await client.get('/api/v1/friends').loginAs(alice)
    assert.lengthOf(aliceFriends.body().data.friends, 0)
    const bobbyFriends = await client.get('/api/v1/friends').loginAs(bobby)
    assert.lengthOf(bobbyFriends.body().data.friends, 0)
  })
})
