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

router.get('/', () => {
  return { hello: 'world' }
})

router.get('/uploads/avatars/:filename', [controllers.Avatars, 'show']).as('avatars.show')

router
  .group(() => {
    router
      .group(() => {
        router.post('signup', [controllers.NewAccount, 'store'])
        router.post('login', [controllers.AccessTokens, 'store'])
      })
      .prefix('auth')
      .as('auth')

    router
      .group(() => {
        router.get('profile', [controllers.Profile, 'show'])
        router.post('logout', [controllers.AccessTokens, 'destroy'])
      })
      .prefix('account')
      .as('profile')
      .use(middleware.auth())

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
        router.post('chat/messages/:id/report', [controllers.ChatMessages, 'report'])
      })
      .as('social')
      .use(middleware.auth())
  })
  .prefix('/api/v1')
