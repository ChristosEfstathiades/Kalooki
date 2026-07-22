import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import type ChatMessage from '#models/chat_message'
import Group from '#models/group'
import GroupMember from '#models/group_member'
import MessageReport from '#models/message_report'
import ModerationAction from '#models/moderation_action'
import NewsItem from '#models/news_item'
import User from '#models/user'
import { postChatMessage, resetChatRateLimits } from '#services/chat_service'
import { resetSiteSettingsCache } from '#services/site_settings_service'
import testUtils from '@adonisjs/core/services/test_utils'
import type { UserRole } from '#services/role_service'

/**
 * Reads one response's payload. The generated registry types `body()`
 * as a union across every route sharing a URL pattern (GET and POST on
 * /admin/news, say), so the shape is named at the call site — the same
 * approach the other functional specs take.
 */
function payload<TData>(response: { body(): unknown }): TData {
  return (response.body() as { data: TData }).data
}

/**
 * Creates a user at a given authorization level, with a valid password
 * for auth-client logins.
 */
async function makeUser(username: string, role: UserRole = 'player'): Promise<User> {
  return User.create({
    username,
    email: `${username}@example.com`,
    password: 'Kalooki!23',
    role,
  })
}

/**
 * Files one report against a message, as one reporter.
 */
async function report(message: ChatMessage, reporter: User): Promise<MessageReport> {
  return MessageReport.create({ messageId: message.id, reporterId: reporter.id })
}

test.group('Admin | report queue', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => resetChatRateLimits())
  group.each.setup(() => resetSiteSettingsCache())

  test('the queue is admin-only', async ({ client }) => {
    const mod = await makeUser('mod', 'moderator')

    const anonymous = await client.get('/api/v1/admin/reports')
    anonymous.assertStatus(401)

    const asModerator = await client.get('/api/v1/admin/reports').loginAs(mod)
    asModerator.assertStatus(403)
  })

  test('reports are grouped per message and sorted by count or recency', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('boss', 'admin')
    const alice = await makeUser('alice')
    const bob = await makeUser('bob')
    const carol = await makeUser('carol')

    const popular = await postChatMessage(alice, { type: 'global' }, 'the widely hated message')
    resetChatRateLimits()
    const lonely = await postChatMessage(alice, { type: 'global' }, 'the mildly annoying one')

    await report(popular, bob)
    await report(popular, carol)
    await report(lonely, bob)

    const byCount = await client
      .get('/api/v1/admin/reports')
      .qs({ sort: 'most-reported' })
      .loginAs(admin)
    byCount.assertStatus(200)

    const entries = byCount.body().data.reports
    assert.lengthOf(entries, 2)
    assert.equal(entries[0].messageId, popular.id)
    assert.equal(entries[0].reportCount, 2)
    assert.equal(entries[0].openCount, 2)
    assert.isFalse(entries[0].isResolved)
    assert.equal(entries[0].author?.username, 'alice')
    assert.lengthOf(entries[0].reports, 2)

    const oldest = await client.get('/api/v1/admin/reports').qs({ sort: 'oldest' }).loginAs(admin)
    assert.equal(oldest.body().data.reports[0].messageId, popular.id)
  })

  test('a message can be searched for by body or by its author', async ({ client, assert }) => {
    const admin = await makeUser('boss', 'admin')
    const alice = await makeUser('alice')
    const bob = await makeUser('bob')

    const message = await postChatMessage(alice, { type: 'global' }, 'a distinctive phrase')
    await report(message, bob)

    const byBody = await client
      .get('/api/v1/admin/reports')
      .qs({ search: 'distinctive' })
      .loginAs(admin)
    assert.lengthOf(byBody.body().data.reports, 1)

    const byAuthor = await client.get('/api/v1/admin/reports').qs({ search: 'alic' }).loginAs(admin)
    assert.lengthOf(byAuthor.body().data.reports, 1)

    const noMatch = await client
      .get('/api/v1/admin/reports')
      .qs({ search: 'nothing like it' })
      .loginAs(admin)
    assert.lengthOf(noMatch.body().data.reports, 0)
  })

  test('resolving closes every open report on the message and audits the decision', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('boss', 'admin')
    const alice = await makeUser('alice')
    const bob = await makeUser('bob')
    const carol = await makeUser('carol')

    const message = await postChatMessage(alice, { type: 'global' }, 'reported twice')
    await report(message, bob)
    await report(message, carol)

    const response = await client
      .post(`/api/v1/admin/reports/messages/${message.id}/resolve`)
      .json({ outcome: 'dismissed', note: 'nothing wrong with it' })
      .loginAs(admin)

    response.assertStatus(200)
    assert.equal(response.body().data.resolvedCount, 2)

    const open = await MessageReport.query().where('messageId', message.id).whereNull('resolvedAt')
    assert.lengthOf(open, 0)

    const resolved = await MessageReport.query().where('messageId', message.id)
    assert.equal(resolved[0].outcome, 'dismissed')
    assert.equal(resolved[0].resolvedBy, admin.id)

    const audit = await ModerationAction.query().where('action', 'report.resolve').first()
    assert.isNotNull(audit)
    assert.equal(audit?.targetUserId, alice.id)

    // The default view is open reports, so a resolved one drops out
    const openQueue = await client.get('/api/v1/admin/reports').loginAs(admin)
    assert.lengthOf(openQueue.body().data.reports, 0)

    const resolvedQueue = await client
      .get('/api/v1/admin/reports')
      .qs({ status: 'resolved' })
      .loginAs(admin)
    assert.lengthOf(resolvedQueue.body().data.reports, 1)
  })

  test('resolving twice is not an error, and a resolution can be reopened', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('boss', 'admin')
    const alice = await makeUser('alice')
    const bob = await makeUser('bob')

    const message = await postChatMessage(alice, { type: 'global' }, 'reported once')
    await report(message, bob)

    await client
      .post(`/api/v1/admin/reports/messages/${message.id}/resolve`)
      .json({ outcome: 'actioned' })
      .loginAs(admin)

    const again = await client
      .post(`/api/v1/admin/reports/messages/${message.id}/resolve`)
      .json({ outcome: 'actioned' })
      .loginAs(admin)
    again.assertStatus(200)
    assert.equal(again.body().data.resolvedCount, 0)

    const reopened = await client
      .delete(`/api/v1/admin/reports/messages/${message.id}/resolve`)
      .loginAs(admin)
    reopened.assertStatus(200)
    assert.equal(reopened.body().data.reopenedCount, 1)

    const openCount = await client.get('/api/v1/admin/reports/open-count').loginAs(admin)
    assert.equal(openCount.body().data.openReports, 1)
  })

  test('the offenders list ranks authors by how many reports they draw', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('boss', 'admin')
    const noisy = await makeUser('noisy')
    const quiet = await makeUser('quiet')
    const bob = await makeUser('bob')
    const carol = await makeUser('carol')

    const first = await postChatMessage(noisy, { type: 'global' }, 'first offence')
    resetChatRateLimits()
    const second = await postChatMessage(noisy, { type: 'global' }, 'second offence')
    const onlyOnce = await postChatMessage(quiet, { type: 'global' }, 'one slip')

    await report(first, bob)
    await report(first, carol)
    await report(second, bob)
    await report(onlyOnce, bob)

    const response = await client.get('/api/v1/admin/reports/authors').loginAs(admin)
    response.assertStatus(200)

    const authors = response.body().data.authors
    assert.equal(authors[0].username, 'noisy')
    assert.equal(authors[0].totalReports, 3)
    assert.equal(authors[0].reportedMessages, 2)
    assert.equal(authors[0].openReports, 3)
    assert.equal(authors[1].username, 'quiet')
  })
})

test.group('Admin | chat browser', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => resetChatRateLimits())

  test('private group chats are never searchable', async ({ client, assert }) => {
    const admin = await makeUser('boss', 'admin')
    const alice = await makeUser('alice')
    const regulars = await Group.create({ name: 'The Regulars', ownerId: alice.id })
    await GroupMember.create({ groupId: regulars.id, userId: alice.id })

    await postChatMessage(alice, { type: 'global' }, 'a public remark')
    resetChatRateLimits()
    await postChatMessage(alice, { type: 'group', groupId: regulars.id }, 'a private remark')

    const response = await client.get('/api/v1/admin/chat/messages').loginAs(admin)
    response.assertStatus(200)

    const bodies = response.body().data.messages.map((message: { body: string }) => message.body)
    assert.include(bodies, 'a public remark')
    assert.notInclude(bodies, 'a private remark')
  })

  test('messages filter by author, text and reported state', async ({ client, assert }) => {
    const admin = await makeUser('boss', 'admin')
    const alice = await makeUser('alice')
    const bob = await makeUser('bob')

    const reported = await postChatMessage(alice, { type: 'global' }, 'the reported line')
    resetChatRateLimits()
    await postChatMessage(bob, { type: 'global' }, 'an innocent line')
    await report(reported, bob)

    const byAuthor = await client
      .get('/api/v1/admin/chat/messages')
      .qs({ username: 'alice' })
      .loginAs(admin)
    assert.lengthOf(byAuthor.body().data.messages, 1)
    assert.equal(byAuthor.body().data.messages[0].reportCount, 1)

    const byText = await client
      .get('/api/v1/admin/chat/messages')
      .qs({ search: 'innocent' })
      .loginAs(admin)
    assert.lengthOf(byText.body().data.messages, 1)

    const reportedOnly = await client
      .get('/api/v1/admin/chat/messages')
      .qs({ reportedOnly: true })
      .loginAs(admin)
    assert.lengthOf(reportedOnly.body().data.messages, 1)
    assert.equal(reportedOnly.body().data.messages[0].id, reported.id)
  })

  test('deleted messages are hidden unless asked for', async ({ client, assert }) => {
    const admin = await makeUser('boss', 'admin')
    const alice = await makeUser('alice')
    const message = await postChatMessage(alice, { type: 'global' }, 'since removed')

    await client.delete(`/api/v1/moderation/messages/${message.id}`).loginAs(admin)

    const byDefault = await client.get('/api/v1/admin/chat/messages').loginAs(admin)
    assert.lengthOf(byDefault.body().data.messages, 0)

    const including = await client
      .get('/api/v1/admin/chat/messages')
      .qs({ includeDeleted: true })
      .loginAs(admin)
    assert.lengthOf(including.body().data.messages, 1)
    assert.isNotNull(including.body().data.messages[0].deletedAt)
  })
})

test.group('Admin | user dossier', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => resetChatRateLimits())

  test('the dossier gathers chat, reports and moderation history', async ({ client, assert }) => {
    const admin = await makeUser('boss', 'admin')
    const alice = await makeUser('alice')
    const bob = await makeUser('bob')

    const message = await postChatMessage(alice, { type: 'global' }, 'a reported remark')
    await report(message, bob)
    await client
      .post(`/api/v1/moderation/users/${alice.id}/mute`)
      .json({ durationMinutes: 60, reason: 'language' })
      .loginAs(admin)

    const response = await client.get(`/api/v1/admin/users/${alice.id}`).loginAs(admin)
    response.assertStatus(200)

    const dossier = response.body().data
    assert.equal(dossier.user.username, 'alice')
    assert.isTrue(dossier.user.isMuted)
    assert.equal(dossier.reports.reportsAgainst, 1)
    assert.equal(dossier.reports.openReportsAgainst, 1)
    assert.equal(dossier.reports.messagesPosted, 1)
    assert.lengthOf(dossier.recentMessages, 1)
    assert.equal(dossier.actionsReceived[0].action, 'user.mute')
    assert.lengthOf(dossier.actionsTaken, 0)
  })

  test('an unknown account is a 404', async ({ client }) => {
    const admin = await makeUser('boss', 'admin')

    const response = await client.get('/api/v1/admin/users/999999').loginAs(admin)
    response.assertStatus(404)
  })
})

test.group('Admin | news', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('published items reach the public endpoint and drafts do not', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('boss', 'admin')

    const published = await client
      .post('/api/v1/admin/news')
      .json({ body: 'Table chat is now live.', isPublished: true })
      .loginAs(admin)
    published.assertStatus(200)

    await client
      .post('/api/v1/admin/news')
      .json({ body: 'Not ready to announce yet.', isPublished: false })
      .loginAs(admin)

    const publicNews = await client.get('/api/v1/site/news')
    publicNews.assertStatus(200)
    const bodies = publicNews.body().data.news.map((item: { body: string }) => item.body)
    assert.include(bodies, 'Table chat is now live.')
    assert.notInclude(bodies, 'Not ready to announce yet.')

    // The table ships with one seeded welcome item, so the admin list
    // holds it plus the two written here
    const adminNews = await client.get('/api/v1/admin/news').loginAs(admin)
    const adminBodies = payload<{ news: { body: string }[] }>(adminNews).news.map(
      (item) => item.body
    )
    assert.include(adminBodies, 'Table chat is now live.')
    assert.include(adminBodies, 'Not ready to announce yet.')
  })

  test('pinned items sort above newer ones', async ({ client, assert }) => {
    const admin = await makeUser('boss', 'admin')

    await NewsItem.create({
      body: 'An old but important notice.',
      publishedAt: DateTime.now().minus({ days: 30 }),
      isPublished: true,
      isPinned: true,
    })
    await NewsItem.create({
      body: 'A fresh but ordinary update.',
      publishedAt: DateTime.now(),
      isPublished: true,
      isPinned: false,
    })

    const response = await client.get('/api/v1/site/news')
    assert.equal(
      payload<{ news: { body: string }[] }>(response).news[0].body,
      'An old but important notice.'
    )

    const adminList = await client.get('/api/v1/admin/news').loginAs(admin)
    assert.isTrue(payload<{ news: { isPinned: boolean }[] }>(adminList).news[0].isPinned)
  })

  test('an item can be edited and deleted, and both are audited', async ({ client, assert }) => {
    const admin = await makeUser('boss', 'admin')

    const created = await client
      .post('/api/v1/admin/news')
      .json({ body: 'First draft of the notice.' })
      .loginAs(admin)
    const id = payload<{ item: { id: number } }>(created).item.id

    const updated = await client
      .patch(`/api/v1/admin/news/${id}`)
      .json({ body: 'Corrected notice.', isPinned: true })
      .loginAs(admin)
    updated.assertStatus(200)
    const edited = payload<{ item: { body: string; isPinned: boolean } }>(updated).item
    assert.equal(edited.body, 'Corrected notice.')
    assert.isTrue(edited.isPinned)

    const removed = await client.delete(`/api/v1/admin/news/${id}`).loginAs(admin)
    removed.assertStatus(200)
    assert.isNull(await NewsItem.find(id))

    const actions = await ModerationAction.query().whereIn('action', [
      'news.create',
      'news.update',
      'news.delete',
    ])
    assert.lengthOf(actions, 3)
  })

  test('news editing is admin-only', async ({ client }) => {
    const mod = await makeUser('mod', 'moderator')

    const response = await client
      .post('/api/v1/admin/news')
      .json({ body: 'Should not be allowed.' })
      .loginAs(mod)
    response.assertStatus(403)
  })
})

test.group('Admin | site settings', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => resetSiteSettingsCache())
  group.each.teardown(() => resetSiteSettingsCache())

  test('flags default to everything enabled', async ({ client, assert }) => {
    const response = await client.get('/api/v1/site')
    response.assertStatus(200)

    const flags = response.body().data.flags
    assert.isFalse(flags.maintenanceMode)
    assert.isTrue(flags.signupsEnabled)
    assert.isTrue(flags.publicMatchmakingEnabled)
    assert.isTrue(flags.practiceGamesEnabled)
    assert.isNull(response.body().data.announcement)
  })

  test('closing signups refuses new accounts', async ({ client }) => {
    const admin = await makeUser('boss', 'admin')

    await client
      .patch('/api/v1/admin/settings/flags')
      .json({ signupsEnabled: false })
      .loginAs(admin)
    resetSiteSettingsCache()

    const signup = await client.post('/api/v1/auth/signup').json({
      username: 'latecomer',
      email: 'latecomer@example.com',
      password: 'Kalooki!23',
      passwordConfirmation: 'Kalooki!23',
    })
    signup.assertStatus(503)
  })

  test('maintenance mode closes the API to players but not to admins', async ({ client }) => {
    const admin = await makeUser('boss', 'admin')
    const alice = await makeUser('alice')

    await client
      .patch('/api/v1/admin/settings/flags')
      .json({ maintenanceMode: true })
      .loginAs(admin)
    resetSiteSettingsCache()

    const asPlayer = await client.get('/api/v1/leaderboard').loginAs(alice)
    asPlayer.assertStatus(503)

    // Admins keep working, which is how maintenance mode gets lifted
    const asAdmin = await client.get('/api/v1/admin/settings').loginAs(admin)
    asAdmin.assertStatus(200)

    const lifted = await client
      .patch('/api/v1/admin/settings/flags')
      .json({ maintenanceMode: false })
      .loginAs(admin)
    lifted.assertStatus(200)
    resetSiteSettingsCache()

    const backUp = await client.get('/api/v1/leaderboard').loginAs(alice)
    backUp.assertStatus(200)
  })

  test('an announcement is published, read back publicly, and cleared', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('boss', 'admin')

    const published = await client
      .post('/api/v1/admin/settings/announcement')
      .json({ body: 'Server restarting in 10 minutes.', tone: 'warning', durationMinutes: 30 })
      .loginAs(admin)
    published.assertStatus(200)
    resetSiteSettingsCache()

    const publicStatus = await client.get('/api/v1/site')
    const banner = payload<{
      announcement: { body: string; tone: string; postedByUsername: string } | null
    }>(publicStatus).announcement
    assert.equal(banner?.body, 'Server restarting in 10 minutes.')
    assert.equal(banner?.tone, 'warning')
    assert.equal(banner?.postedByUsername, 'boss')

    await client.delete('/api/v1/admin/settings/announcement').loginAs(admin)
    resetSiteSettingsCache()

    const afterClear = await client.get('/api/v1/site')
    assert.isNull(afterClear.body().data.announcement)

    const audits = await ModerationAction.query().whereIn('action', [
      'site.announce',
      'site.announce.clear',
      'site.flags',
    ])
    assert.isAtLeast(audits.length, 2)
  })

  test('settings are admin-only', async ({ client }) => {
    const mod = await makeUser('mod', 'moderator')

    const response = await client
      .patch('/api/v1/admin/settings/flags')
      .json({ maintenanceMode: true })
      .loginAs(mod)
    response.assertStatus(403)
  })
})

test.group('Admin | stats tools', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('excluding an account hides it from the board without touching its history', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('boss', 'admin')
    const cheat = await makeUser('cheat')

    const excluded = await client
      .patch(`/api/v1/admin/stats/users/${cheat.id}/exclusion`)
      .json({ excluded: true, reason: 'inflated record' })
      .loginAs(admin)
    excluded.assertStatus(200)
    assert.isTrue(excluded.body().data.user.excludedFromLeaderboard)

    await cheat.refresh()
    assert.isTrue(Boolean(cheat.excludedFromLeaderboard))

    // Excluding twice is a conflict, not a silent no-op
    const again = await client
      .patch(`/api/v1/admin/stats/users/${cheat.id}/exclusion`)
      .json({ excluded: true })
      .loginAs(admin)
    again.assertStatus(409)

    const restored = await client
      .patch(`/api/v1/admin/stats/users/${cheat.id}/exclusion`)
      .json({ excluded: false })
      .loginAs(admin)
    restored.assertStatus(200)

    const audits = await ModerationAction.query().where('action', 'stats.reset')
    assert.lengthOf(audits, 2)
  })

  test('the leaderboard can be rebuilt on demand', async ({ client, assert }) => {
    const admin = await makeUser('boss', 'admin')

    const response = await client.post('/api/v1/admin/stats/leaderboard/rebuild').loginAs(admin)
    response.assertStatus(200)
    assert.isNumber(response.body().data.rankedPlayers)
  })

  test('stats tools are admin-only', async ({ client }) => {
    const mod = await makeUser('mod', 'moderator')
    const alice = await makeUser('alice')

    const response = await client
      .delete(`/api/v1/admin/stats/users/${alice.id}`)
      .json({})
      .loginAs(mod)
    response.assertStatus(403)
  })
})

test.group('Admin | audit log filters', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => resetChatRateLimits())

  test('the log filters by action type and by the username involved', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('boss', 'admin')
    const alice = await makeUser('alice')
    const bob = await makeUser('bob')

    await client
      .post(`/api/v1/moderation/users/${alice.id}/ban`)
      .json({ reason: 'abuse' })
      .loginAs(admin)
    await client
      .post(`/api/v1/moderation/users/${bob.id}/mute`)
      .json({ durationMinutes: 60 })
      .loginAs(admin)

    const all = await client.get('/api/v1/admin/moderation-actions').loginAs(admin)
    all.assertStatus(200)
    assert.lengthOf(all.body().data.actions, 2)
    assert.equal(all.body().data.meta.total, 2)

    const bansOnly = await client
      .get('/api/v1/admin/moderation-actions')
      .qs({ action: 'user.ban' })
      .loginAs(admin)
    assert.lengthOf(bansOnly.body().data.actions, 1)
    assert.equal(bansOnly.body().data.actions[0].targetUsername, 'alice')

    const aboutBob = await client
      .get('/api/v1/admin/moderation-actions')
      .qs({ target: 'bob' })
      .loginAs(admin)
    assert.lengthOf(aboutBob.body().data.actions, 1)

    const byOtherActor = await client
      .get('/api/v1/admin/moderation-actions')
      .qs({ actor: 'nobody' })
      .loginAs(admin)
    assert.lengthOf(byOtherActor.body().data.actions, 0)
  })

  test('a malformed date filter is rejected', async ({ client }) => {
    const admin = await makeUser('boss', 'admin')

    const response = await client
      .get('/api/v1/admin/moderation-actions')
      .qs({ from: 'not-a-date' })
      .loginAs(admin)
    response.assertStatus(422)
  })
})

test.group('Admin | dashboard metrics', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => resetChatRateLimits())

  test('the metrics endpoint counts users, chat and open reports', async ({ client, assert }) => {
    const admin = await makeUser('boss', 'admin')
    const alice = await makeUser('alice')
    const bob = await makeUser('bob')

    const message = await postChatMessage(alice, { type: 'global' }, 'hello everyone')
    await report(message, bob)
    await client.post(`/api/v1/moderation/users/${alice.id}/ban`).loginAs(admin)

    const response = await client.get('/api/v1/admin/metrics').loginAs(admin)
    response.assertStatus(200)

    const metrics = response.body().data
    assert.equal(metrics.users.total, 3)
    assert.equal(metrics.users.newToday, 3)
    assert.equal(metrics.users.banned, 1)
    assert.equal(metrics.users.staff, 1)
    assert.equal(metrics.chat.today, 1)
    assert.equal(metrics.reports.open, 1)
    assert.lengthOf(metrics.trend, 14)
    assert.equal(metrics.trend[metrics.trend.length - 1].signups, 3)
  })

  test('metrics are admin-only', async ({ client }) => {
    const mod = await makeUser('mod', 'moderator')

    const response = await client.get('/api/v1/admin/metrics').loginAs(mod)
    response.assertStatus(403)
  })
})
