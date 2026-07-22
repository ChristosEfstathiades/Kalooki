/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { apiThrottle, authThrottle } from '#start/limiter'

router.get('/', () => {
  return { hello: 'world' }
})

router
  .group(() => {
    router
      .group(() => {
        router.post('signup', [controllers.NewAccount, 'store'])
        router.post('login', [controllers.AccessTokens, 'store'])
      })
      .prefix('auth')
      .as('auth')
      .use(authThrottle)

    // Public: the online player count is shown on the welcome page too,
    // before anyone has signed in.
    router.get('presence', [controllers.Presence, 'index']).use(apiThrottle)

    // Public: admin-managed site content. The announcement banner shows
    // on the welcome page before sign in, and the news panel is read
    // straight after it.
    router
      .group(() => {
        router.get('/', [controllers.Site, 'status'])
        router.get('news', [controllers.Site, 'news'])
      })
      .prefix('site')
      .as('site')
      .use(apiThrottle)

    router
      .group(() => {
        router.get('profile', [controllers.Profile, 'show'])
        router.patch('profile', [controllers.Profile, 'update'])
        router.post('logout', [controllers.AccessTokens, 'destroy'])
        router.delete('/', [controllers.AccountDeletion, 'destroy'])
      })
      .prefix('account')
      .as('profile')
      .use([middleware.auth(), apiThrottle])

    router
      .group(() => {
        router.get('friends', [controllers.Friends, 'index'])
        router.delete('friends/:userId', [controllers.Friends, 'destroy'])
        router.get('friend-requests', [controllers.FriendRequests, 'index'])
        router.post('friend-requests', [controllers.FriendRequests, 'store'])
        router.post('friend-requests/:id/accept', [controllers.FriendRequests, 'accept'])
        router.delete('friend-requests/:id', [controllers.FriendRequests, 'destroy'])

        router.get('groups', [controllers.Groups, 'index'])
        router.post('groups', [controllers.Groups, 'store'])
        router.get('groups/:id', [controllers.Groups, 'show'])
        router.post('groups/:id/transfer', [controllers.Groups, 'transfer'])
        router.delete('groups/:id', [controllers.Groups, 'destroy'])
        router.post('groups/:groupId/invites', [controllers.GroupInvites, 'store'])
        router.delete('groups/:groupId/members/:userId', [controllers.GroupMembers, 'destroy'])
        router.get('group-invites', [controllers.GroupInvites, 'index'])
        router.post('group-invites/:id/accept', [controllers.GroupInvites, 'accept'])
        router.delete('group-invites/:id', [controllers.GroupInvites, 'destroy'])

        router.get('chat/global/messages', [controllers.ChatMessages, 'global'])
        router.get('groups/:groupId/messages', [controllers.ChatMessages, 'group'])
        router.get('matches/:matchId/messages', [controllers.ChatMessages, 'match'])
        router.post('chat/messages/:id/report', [controllers.ChatMessages, 'report'])

        router.get('matches', [controllers.Matches, 'index'])
        router.get('leaderboard', [controllers.Leaderboard, 'index'])
      })
      .as('social')
      .use([middleware.auth(), apiThrottle])

    // Moderator tools, used by the inline controls on the player site
    // and by the admin app. The service layer also checks that the
    // acting user outranks the target.
    router
      .group(() => {
        router.get('users/:userId', [controllers.Moderation, 'showUser'])
        router.delete('messages/:id', [controllers.Moderation, 'destroyMessage'])
        router.post('users/:userId/ban', [controllers.Moderation, 'ban'])
        router.delete('users/:userId/ban', [controllers.Moderation, 'unban'])
        router.post('users/:userId/mute', [controllers.Moderation, 'mute'])
        router.delete('users/:userId/mute', [controllers.Moderation, 'unmute'])
      })
      .prefix('moderation')
      .as('moderation')
      .use([middleware.auth(), middleware.role('moderator'), apiThrottle])

    // Admin-only endpoints backing admin.{domain}.
    router
      .group(() => {
        router.get('users', [controllers.Admin, 'listUsers'])
        router.get('users/:userId', [controllers.Admin, 'showUser'])
        router.patch('users/:userId/role', [controllers.Admin, 'updateUserRole'])
        router.get('moderation-actions', [controllers.Admin, 'listModerationActions'])

        router.get('metrics', [controllers.AdminMetrics, 'index'])

        router.get('reports', [controllers.AdminReports, 'index'])
        router.get('reports/authors', [controllers.AdminReports, 'authors'])
        router.get('reports/open-count', [controllers.AdminReports, 'openCount'])
        router.post('reports/messages/:messageId/resolve', [controllers.AdminReports, 'resolve'])
        router.delete('reports/messages/:messageId/resolve', [controllers.AdminReports, 'reopen'])

        router.get('chat/messages', [controllers.AdminChat, 'index'])

        router.get('news', [controllers.AdminNews, 'index'])
        router.post('news', [controllers.AdminNews, 'store'])
        router.patch('news/:id', [controllers.AdminNews, 'update'])
        router.delete('news/:id', [controllers.AdminNews, 'destroy'])

        router.get('settings', [controllers.AdminSettings, 'show'])
        router.patch('settings/flags', [controllers.AdminSettings, 'updateFlags'])
        router.post('settings/announcement', [controllers.AdminSettings, 'announce'])
        router.delete('settings/announcement', [controllers.AdminSettings, 'clearAnnouncement'])
        router.post('settings/notice', [controllers.AdminSettings, 'notice'])

        router.post('stats/leaderboard/rebuild', [controllers.AdminStats, 'rebuildLeaderboard'])
        router.patch('stats/users/:userId/exclusion', [controllers.AdminStats, 'setExclusion'])
        router.delete('stats/users/:userId', [controllers.AdminStats, 'wipe'])
      })
      .prefix('admin')
      .as('admin')
      .use([middleware.auth(), middleware.role('admin'), apiThrottle])
  })
  .prefix('/api/v1')
