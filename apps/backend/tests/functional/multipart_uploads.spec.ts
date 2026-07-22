import { readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * The API has no upload endpoints, so no route should ever spool a file
 * to disk (AUDIT.md S9). The body parser runs ahead of the per-route
 * auth and throttle middleware, so before this was disabled an
 * unauthenticated request to any route could write 20 MB to the system
 * tmp directory and leave it there.
 */
const PAYLOAD = Buffer.alloc(64 * 1024, 'k')

/**
 * The names of the files sitting directly in the system tmp directory.
 * Auto-processed uploads land here under a random UUID.
 */
async function tmpDirectoryEntries(): Promise<Set<string>> {
  return new Set(await readdir(tmpdir()))
}

test.group('Multipart uploads are not accepted', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('an unauthenticated multipart request writes nothing to disk', async ({
    client,
    assert,
  }) => {
    const before = await tmpDirectoryEntries()

    // Rejected on credentials, but the body is parsed long before that
    const response = await client
      .post('/api/v1/auth/login')
      .fields({ identifier: 'nobody@example.com', password: 'Kalooki!23' })
      .file('junk', PAYLOAD, { filename: 'junk.bin' })

    assert.notEqual(response.status(), 200)

    const after = await tmpDirectoryEntries()
    const created = [...after].filter((entry) => !before.has(entry))
    assert.deepEqual(created, [], 'a multipart request left a file in the system tmp directory')
  })
})
