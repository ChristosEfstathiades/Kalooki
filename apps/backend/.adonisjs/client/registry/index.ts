/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'auth.new_account.store': {
    methods: ["POST"],
    pattern: '/api/v1/auth/signup',
    tokens: [{"old":"/api/v1/auth/signup","type":0,"val":"api","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['auth.new_account.store']['types'],
  },
  'auth.access_tokens.store': {
    methods: ["POST"],
    pattern: '/api/v1/auth/login',
    tokens: [{"old":"/api/v1/auth/login","type":0,"val":"api","end":""},{"old":"/api/v1/auth/login","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/login","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['auth.access_tokens.store']['types'],
  },
  'presence.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/presence',
    tokens: [{"old":"/api/v1/presence","type":0,"val":"api","end":""},{"old":"/api/v1/presence","type":0,"val":"v1","end":""},{"old":"/api/v1/presence","type":0,"val":"presence","end":""}],
    types: placeholder as Registry['presence.index']['types'],
  },
  'profile.profile.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/account/profile',
    tokens: [{"old":"/api/v1/account/profile","type":0,"val":"api","end":""},{"old":"/api/v1/account/profile","type":0,"val":"v1","end":""},{"old":"/api/v1/account/profile","type":0,"val":"account","end":""},{"old":"/api/v1/account/profile","type":0,"val":"profile","end":""}],
    types: placeholder as Registry['profile.profile.show']['types'],
  },
  'profile.profile.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/account/profile',
    tokens: [{"old":"/api/v1/account/profile","type":0,"val":"api","end":""},{"old":"/api/v1/account/profile","type":0,"val":"v1","end":""},{"old":"/api/v1/account/profile","type":0,"val":"account","end":""},{"old":"/api/v1/account/profile","type":0,"val":"profile","end":""}],
    types: placeholder as Registry['profile.profile.update']['types'],
  },
  'profile.access_tokens.destroy': {
    methods: ["POST"],
    pattern: '/api/v1/account/logout',
    tokens: [{"old":"/api/v1/account/logout","type":0,"val":"api","end":""},{"old":"/api/v1/account/logout","type":0,"val":"v1","end":""},{"old":"/api/v1/account/logout","type":0,"val":"account","end":""},{"old":"/api/v1/account/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['profile.access_tokens.destroy']['types'],
  },
  'profile.account_deletion.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/account',
    tokens: [{"old":"/api/v1/account","type":0,"val":"api","end":""},{"old":"/api/v1/account","type":0,"val":"v1","end":""},{"old":"/api/v1/account","type":0,"val":"account","end":""}],
    types: placeholder as Registry['profile.account_deletion.destroy']['types'],
  },
  'social.friends.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/friends',
    tokens: [{"old":"/api/v1/friends","type":0,"val":"api","end":""},{"old":"/api/v1/friends","type":0,"val":"v1","end":""},{"old":"/api/v1/friends","type":0,"val":"friends","end":""}],
    types: placeholder as Registry['social.friends.index']['types'],
  },
  'social.friends.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/friends/:userId',
    tokens: [{"old":"/api/v1/friends/:userId","type":0,"val":"api","end":""},{"old":"/api/v1/friends/:userId","type":0,"val":"v1","end":""},{"old":"/api/v1/friends/:userId","type":0,"val":"friends","end":""},{"old":"/api/v1/friends/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['social.friends.destroy']['types'],
  },
  'social.friend_requests.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/friend-requests',
    tokens: [{"old":"/api/v1/friend-requests","type":0,"val":"api","end":""},{"old":"/api/v1/friend-requests","type":0,"val":"v1","end":""},{"old":"/api/v1/friend-requests","type":0,"val":"friend-requests","end":""}],
    types: placeholder as Registry['social.friend_requests.index']['types'],
  },
  'social.friend_requests.store': {
    methods: ["POST"],
    pattern: '/api/v1/friend-requests',
    tokens: [{"old":"/api/v1/friend-requests","type":0,"val":"api","end":""},{"old":"/api/v1/friend-requests","type":0,"val":"v1","end":""},{"old":"/api/v1/friend-requests","type":0,"val":"friend-requests","end":""}],
    types: placeholder as Registry['social.friend_requests.store']['types'],
  },
  'social.friend_requests.accept': {
    methods: ["POST"],
    pattern: '/api/v1/friend-requests/:id/accept',
    tokens: [{"old":"/api/v1/friend-requests/:id/accept","type":0,"val":"api","end":""},{"old":"/api/v1/friend-requests/:id/accept","type":0,"val":"v1","end":""},{"old":"/api/v1/friend-requests/:id/accept","type":0,"val":"friend-requests","end":""},{"old":"/api/v1/friend-requests/:id/accept","type":1,"val":"id","end":""},{"old":"/api/v1/friend-requests/:id/accept","type":0,"val":"accept","end":""}],
    types: placeholder as Registry['social.friend_requests.accept']['types'],
  },
  'social.friend_requests.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/friend-requests/:id',
    tokens: [{"old":"/api/v1/friend-requests/:id","type":0,"val":"api","end":""},{"old":"/api/v1/friend-requests/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/friend-requests/:id","type":0,"val":"friend-requests","end":""},{"old":"/api/v1/friend-requests/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['social.friend_requests.destroy']['types'],
  },
  'social.groups.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/groups',
    tokens: [{"old":"/api/v1/groups","type":0,"val":"api","end":""},{"old":"/api/v1/groups","type":0,"val":"v1","end":""},{"old":"/api/v1/groups","type":0,"val":"groups","end":""}],
    types: placeholder as Registry['social.groups.index']['types'],
  },
  'social.groups.store': {
    methods: ["POST"],
    pattern: '/api/v1/groups',
    tokens: [{"old":"/api/v1/groups","type":0,"val":"api","end":""},{"old":"/api/v1/groups","type":0,"val":"v1","end":""},{"old":"/api/v1/groups","type":0,"val":"groups","end":""}],
    types: placeholder as Registry['social.groups.store']['types'],
  },
  'social.groups.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/groups/:id',
    tokens: [{"old":"/api/v1/groups/:id","type":0,"val":"api","end":""},{"old":"/api/v1/groups/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/groups/:id","type":0,"val":"groups","end":""},{"old":"/api/v1/groups/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['social.groups.show']['types'],
  },
  'social.groups.transfer': {
    methods: ["POST"],
    pattern: '/api/v1/groups/:id/transfer',
    tokens: [{"old":"/api/v1/groups/:id/transfer","type":0,"val":"api","end":""},{"old":"/api/v1/groups/:id/transfer","type":0,"val":"v1","end":""},{"old":"/api/v1/groups/:id/transfer","type":0,"val":"groups","end":""},{"old":"/api/v1/groups/:id/transfer","type":1,"val":"id","end":""},{"old":"/api/v1/groups/:id/transfer","type":0,"val":"transfer","end":""}],
    types: placeholder as Registry['social.groups.transfer']['types'],
  },
  'social.groups.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/groups/:id',
    tokens: [{"old":"/api/v1/groups/:id","type":0,"val":"api","end":""},{"old":"/api/v1/groups/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/groups/:id","type":0,"val":"groups","end":""},{"old":"/api/v1/groups/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['social.groups.destroy']['types'],
  },
  'social.group_invites.store': {
    methods: ["POST"],
    pattern: '/api/v1/groups/:groupId/invites',
    tokens: [{"old":"/api/v1/groups/:groupId/invites","type":0,"val":"api","end":""},{"old":"/api/v1/groups/:groupId/invites","type":0,"val":"v1","end":""},{"old":"/api/v1/groups/:groupId/invites","type":0,"val":"groups","end":""},{"old":"/api/v1/groups/:groupId/invites","type":1,"val":"groupId","end":""},{"old":"/api/v1/groups/:groupId/invites","type":0,"val":"invites","end":""}],
    types: placeholder as Registry['social.group_invites.store']['types'],
  },
  'social.group_members.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/groups/:groupId/members/:userId',
    tokens: [{"old":"/api/v1/groups/:groupId/members/:userId","type":0,"val":"api","end":""},{"old":"/api/v1/groups/:groupId/members/:userId","type":0,"val":"v1","end":""},{"old":"/api/v1/groups/:groupId/members/:userId","type":0,"val":"groups","end":""},{"old":"/api/v1/groups/:groupId/members/:userId","type":1,"val":"groupId","end":""},{"old":"/api/v1/groups/:groupId/members/:userId","type":0,"val":"members","end":""},{"old":"/api/v1/groups/:groupId/members/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['social.group_members.destroy']['types'],
  },
  'social.group_invites.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/group-invites',
    tokens: [{"old":"/api/v1/group-invites","type":0,"val":"api","end":""},{"old":"/api/v1/group-invites","type":0,"val":"v1","end":""},{"old":"/api/v1/group-invites","type":0,"val":"group-invites","end":""}],
    types: placeholder as Registry['social.group_invites.index']['types'],
  },
  'social.group_invites.accept': {
    methods: ["POST"],
    pattern: '/api/v1/group-invites/:id/accept',
    tokens: [{"old":"/api/v1/group-invites/:id/accept","type":0,"val":"api","end":""},{"old":"/api/v1/group-invites/:id/accept","type":0,"val":"v1","end":""},{"old":"/api/v1/group-invites/:id/accept","type":0,"val":"group-invites","end":""},{"old":"/api/v1/group-invites/:id/accept","type":1,"val":"id","end":""},{"old":"/api/v1/group-invites/:id/accept","type":0,"val":"accept","end":""}],
    types: placeholder as Registry['social.group_invites.accept']['types'],
  },
  'social.group_invites.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/group-invites/:id',
    tokens: [{"old":"/api/v1/group-invites/:id","type":0,"val":"api","end":""},{"old":"/api/v1/group-invites/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/group-invites/:id","type":0,"val":"group-invites","end":""},{"old":"/api/v1/group-invites/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['social.group_invites.destroy']['types'],
  },
  'social.chat_messages.global': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/chat/global/messages',
    tokens: [{"old":"/api/v1/chat/global/messages","type":0,"val":"api","end":""},{"old":"/api/v1/chat/global/messages","type":0,"val":"v1","end":""},{"old":"/api/v1/chat/global/messages","type":0,"val":"chat","end":""},{"old":"/api/v1/chat/global/messages","type":0,"val":"global","end":""},{"old":"/api/v1/chat/global/messages","type":0,"val":"messages","end":""}],
    types: placeholder as Registry['social.chat_messages.global']['types'],
  },
  'social.chat_messages.group': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/groups/:groupId/messages',
    tokens: [{"old":"/api/v1/groups/:groupId/messages","type":0,"val":"api","end":""},{"old":"/api/v1/groups/:groupId/messages","type":0,"val":"v1","end":""},{"old":"/api/v1/groups/:groupId/messages","type":0,"val":"groups","end":""},{"old":"/api/v1/groups/:groupId/messages","type":1,"val":"groupId","end":""},{"old":"/api/v1/groups/:groupId/messages","type":0,"val":"messages","end":""}],
    types: placeholder as Registry['social.chat_messages.group']['types'],
  },
  'social.chat_messages.match': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/matches/:matchId/messages',
    tokens: [{"old":"/api/v1/matches/:matchId/messages","type":0,"val":"api","end":""},{"old":"/api/v1/matches/:matchId/messages","type":0,"val":"v1","end":""},{"old":"/api/v1/matches/:matchId/messages","type":0,"val":"matches","end":""},{"old":"/api/v1/matches/:matchId/messages","type":1,"val":"matchId","end":""},{"old":"/api/v1/matches/:matchId/messages","type":0,"val":"messages","end":""}],
    types: placeholder as Registry['social.chat_messages.match']['types'],
  },
  'social.chat_messages.report': {
    methods: ["POST"],
    pattern: '/api/v1/chat/messages/:id/report',
    tokens: [{"old":"/api/v1/chat/messages/:id/report","type":0,"val":"api","end":""},{"old":"/api/v1/chat/messages/:id/report","type":0,"val":"v1","end":""},{"old":"/api/v1/chat/messages/:id/report","type":0,"val":"chat","end":""},{"old":"/api/v1/chat/messages/:id/report","type":0,"val":"messages","end":""},{"old":"/api/v1/chat/messages/:id/report","type":1,"val":"id","end":""},{"old":"/api/v1/chat/messages/:id/report","type":0,"val":"report","end":""}],
    types: placeholder as Registry['social.chat_messages.report']['types'],
  },
  'social.matches.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/matches',
    tokens: [{"old":"/api/v1/matches","type":0,"val":"api","end":""},{"old":"/api/v1/matches","type":0,"val":"v1","end":""},{"old":"/api/v1/matches","type":0,"val":"matches","end":""}],
    types: placeholder as Registry['social.matches.index']['types'],
  },
  'social.leaderboard.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/leaderboard',
    tokens: [{"old":"/api/v1/leaderboard","type":0,"val":"api","end":""},{"old":"/api/v1/leaderboard","type":0,"val":"v1","end":""},{"old":"/api/v1/leaderboard","type":0,"val":"leaderboard","end":""}],
    types: placeholder as Registry['social.leaderboard.index']['types'],
  },
  'moderation.moderation.show_user': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/moderation/users/:userId',
    tokens: [{"old":"/api/v1/moderation/users/:userId","type":0,"val":"api","end":""},{"old":"/api/v1/moderation/users/:userId","type":0,"val":"v1","end":""},{"old":"/api/v1/moderation/users/:userId","type":0,"val":"moderation","end":""},{"old":"/api/v1/moderation/users/:userId","type":0,"val":"users","end":""},{"old":"/api/v1/moderation/users/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['moderation.moderation.show_user']['types'],
  },
  'moderation.moderation.destroy_message': {
    methods: ["DELETE"],
    pattern: '/api/v1/moderation/messages/:id',
    tokens: [{"old":"/api/v1/moderation/messages/:id","type":0,"val":"api","end":""},{"old":"/api/v1/moderation/messages/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/moderation/messages/:id","type":0,"val":"moderation","end":""},{"old":"/api/v1/moderation/messages/:id","type":0,"val":"messages","end":""},{"old":"/api/v1/moderation/messages/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['moderation.moderation.destroy_message']['types'],
  },
  'moderation.moderation.ban': {
    methods: ["POST"],
    pattern: '/api/v1/moderation/users/:userId/ban',
    tokens: [{"old":"/api/v1/moderation/users/:userId/ban","type":0,"val":"api","end":""},{"old":"/api/v1/moderation/users/:userId/ban","type":0,"val":"v1","end":""},{"old":"/api/v1/moderation/users/:userId/ban","type":0,"val":"moderation","end":""},{"old":"/api/v1/moderation/users/:userId/ban","type":0,"val":"users","end":""},{"old":"/api/v1/moderation/users/:userId/ban","type":1,"val":"userId","end":""},{"old":"/api/v1/moderation/users/:userId/ban","type":0,"val":"ban","end":""}],
    types: placeholder as Registry['moderation.moderation.ban']['types'],
  },
  'moderation.moderation.unban': {
    methods: ["DELETE"],
    pattern: '/api/v1/moderation/users/:userId/ban',
    tokens: [{"old":"/api/v1/moderation/users/:userId/ban","type":0,"val":"api","end":""},{"old":"/api/v1/moderation/users/:userId/ban","type":0,"val":"v1","end":""},{"old":"/api/v1/moderation/users/:userId/ban","type":0,"val":"moderation","end":""},{"old":"/api/v1/moderation/users/:userId/ban","type":0,"val":"users","end":""},{"old":"/api/v1/moderation/users/:userId/ban","type":1,"val":"userId","end":""},{"old":"/api/v1/moderation/users/:userId/ban","type":0,"val":"ban","end":""}],
    types: placeholder as Registry['moderation.moderation.unban']['types'],
  },
  'moderation.moderation.mute': {
    methods: ["POST"],
    pattern: '/api/v1/moderation/users/:userId/mute',
    tokens: [{"old":"/api/v1/moderation/users/:userId/mute","type":0,"val":"api","end":""},{"old":"/api/v1/moderation/users/:userId/mute","type":0,"val":"v1","end":""},{"old":"/api/v1/moderation/users/:userId/mute","type":0,"val":"moderation","end":""},{"old":"/api/v1/moderation/users/:userId/mute","type":0,"val":"users","end":""},{"old":"/api/v1/moderation/users/:userId/mute","type":1,"val":"userId","end":""},{"old":"/api/v1/moderation/users/:userId/mute","type":0,"val":"mute","end":""}],
    types: placeholder as Registry['moderation.moderation.mute']['types'],
  },
  'moderation.moderation.unmute': {
    methods: ["DELETE"],
    pattern: '/api/v1/moderation/users/:userId/mute',
    tokens: [{"old":"/api/v1/moderation/users/:userId/mute","type":0,"val":"api","end":""},{"old":"/api/v1/moderation/users/:userId/mute","type":0,"val":"v1","end":""},{"old":"/api/v1/moderation/users/:userId/mute","type":0,"val":"moderation","end":""},{"old":"/api/v1/moderation/users/:userId/mute","type":0,"val":"users","end":""},{"old":"/api/v1/moderation/users/:userId/mute","type":1,"val":"userId","end":""},{"old":"/api/v1/moderation/users/:userId/mute","type":0,"val":"mute","end":""}],
    types: placeholder as Registry['moderation.moderation.unmute']['types'],
  },
  'admin.admin.list_users': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/users',
    tokens: [{"old":"/api/v1/admin/users","type":0,"val":"api","end":""},{"old":"/api/v1/admin/users","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/users","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/users","type":0,"val":"users","end":""}],
    types: placeholder as Registry['admin.admin.list_users']['types'],
  },
  'admin.admin.update_user_role': {
    methods: ["PATCH"],
    pattern: '/api/v1/admin/users/:userId/role',
    tokens: [{"old":"/api/v1/admin/users/:userId/role","type":0,"val":"api","end":""},{"old":"/api/v1/admin/users/:userId/role","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/users/:userId/role","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/users/:userId/role","type":0,"val":"users","end":""},{"old":"/api/v1/admin/users/:userId/role","type":1,"val":"userId","end":""},{"old":"/api/v1/admin/users/:userId/role","type":0,"val":"role","end":""}],
    types: placeholder as Registry['admin.admin.update_user_role']['types'],
  },
  'admin.admin.list_moderation_actions': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/moderation-actions',
    tokens: [{"old":"/api/v1/admin/moderation-actions","type":0,"val":"api","end":""},{"old":"/api/v1/admin/moderation-actions","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/moderation-actions","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/moderation-actions","type":0,"val":"moderation-actions","end":""}],
    types: placeholder as Registry['admin.admin.list_moderation_actions']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
