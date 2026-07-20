import { test } from '@japa/runner'
import { resetPresence, trackConnection } from '#services/presence_service'

test.group('Online player count', (group) => {
  group.each.setup(() => {
    resetPresence()
    return () => resetPresence()
  })

  test('is readable without signing in', async ({ client, assert }) => {
    const response = await client.get('/api/v1/presence')
    response.assertStatus(200)
    assert.equal((response.body() as { data: { online: number } }).data.online, 0)
  })

  test('counts each connected user once', async ({ client, assert }) => {
    trackConnection(1)
    // Same player, second tab
    trackConnection(1)
    trackConnection(2)

    const response = await client.get('/api/v1/presence')
    assert.equal((response.body() as { data: { online: number } }).data.online, 2)
  })
})
