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
  'site.site.status': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/site',
    tokens: [{"old":"/api/v1/site","type":0,"val":"api","end":""},{"old":"/api/v1/site","type":0,"val":"v1","end":""},{"old":"/api/v1/site","type":0,"val":"site","end":""}],
    types: placeholder as Registry['site.site.status']['types'],
  },
  'site.site.news': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/site/news',
    tokens: [{"old":"/api/v1/site/news","type":0,"val":"api","end":""},{"old":"/api/v1/site/news","type":0,"val":"v1","end":""},{"old":"/api/v1/site/news","type":0,"val":"site","end":""},{"old":"/api/v1/site/news","type":0,"val":"news","end":""}],
    types: placeholder as Registry['site.site.news']['types'],
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
  'admin.admin.show_user': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/users/:userId',
    tokens: [{"old":"/api/v1/admin/users/:userId","type":0,"val":"api","end":""},{"old":"/api/v1/admin/users/:userId","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/users/:userId","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/users/:userId","type":0,"val":"users","end":""},{"old":"/api/v1/admin/users/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['admin.admin.show_user']['types'],
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
  'admin.admin_metrics.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/metrics',
    tokens: [{"old":"/api/v1/admin/metrics","type":0,"val":"api","end":""},{"old":"/api/v1/admin/metrics","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/metrics","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/metrics","type":0,"val":"metrics","end":""}],
    types: placeholder as Registry['admin.admin_metrics.index']['types'],
  },
  'admin.admin_reports.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/reports',
    tokens: [{"old":"/api/v1/admin/reports","type":0,"val":"api","end":""},{"old":"/api/v1/admin/reports","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/reports","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/reports","type":0,"val":"reports","end":""}],
    types: placeholder as Registry['admin.admin_reports.index']['types'],
  },
  'admin.admin_reports.authors': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/reports/authors',
    tokens: [{"old":"/api/v1/admin/reports/authors","type":0,"val":"api","end":""},{"old":"/api/v1/admin/reports/authors","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/reports/authors","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/reports/authors","type":0,"val":"reports","end":""},{"old":"/api/v1/admin/reports/authors","type":0,"val":"authors","end":""}],
    types: placeholder as Registry['admin.admin_reports.authors']['types'],
  },
  'admin.admin_reports.open_count': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/reports/open-count',
    tokens: [{"old":"/api/v1/admin/reports/open-count","type":0,"val":"api","end":""},{"old":"/api/v1/admin/reports/open-count","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/reports/open-count","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/reports/open-count","type":0,"val":"reports","end":""},{"old":"/api/v1/admin/reports/open-count","type":0,"val":"open-count","end":""}],
    types: placeholder as Registry['admin.admin_reports.open_count']['types'],
  },
  'admin.admin_reports.resolve': {
    methods: ["POST"],
    pattern: '/api/v1/admin/reports/messages/:messageId/resolve',
    tokens: [{"old":"/api/v1/admin/reports/messages/:messageId/resolve","type":0,"val":"api","end":""},{"old":"/api/v1/admin/reports/messages/:messageId/resolve","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/reports/messages/:messageId/resolve","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/reports/messages/:messageId/resolve","type":0,"val":"reports","end":""},{"old":"/api/v1/admin/reports/messages/:messageId/resolve","type":0,"val":"messages","end":""},{"old":"/api/v1/admin/reports/messages/:messageId/resolve","type":1,"val":"messageId","end":""},{"old":"/api/v1/admin/reports/messages/:messageId/resolve","type":0,"val":"resolve","end":""}],
    types: placeholder as Registry['admin.admin_reports.resolve']['types'],
  },
  'admin.admin_reports.reopen': {
    methods: ["DELETE"],
    pattern: '/api/v1/admin/reports/messages/:messageId/resolve',
    tokens: [{"old":"/api/v1/admin/reports/messages/:messageId/resolve","type":0,"val":"api","end":""},{"old":"/api/v1/admin/reports/messages/:messageId/resolve","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/reports/messages/:messageId/resolve","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/reports/messages/:messageId/resolve","type":0,"val":"reports","end":""},{"old":"/api/v1/admin/reports/messages/:messageId/resolve","type":0,"val":"messages","end":""},{"old":"/api/v1/admin/reports/messages/:messageId/resolve","type":1,"val":"messageId","end":""},{"old":"/api/v1/admin/reports/messages/:messageId/resolve","type":0,"val":"resolve","end":""}],
    types: placeholder as Registry['admin.admin_reports.reopen']['types'],
  },
  'admin.admin_chat.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/chat/messages',
    tokens: [{"old":"/api/v1/admin/chat/messages","type":0,"val":"api","end":""},{"old":"/api/v1/admin/chat/messages","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/chat/messages","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/chat/messages","type":0,"val":"chat","end":""},{"old":"/api/v1/admin/chat/messages","type":0,"val":"messages","end":""}],
    types: placeholder as Registry['admin.admin_chat.index']['types'],
  },
  'admin.admin_news.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/news',
    tokens: [{"old":"/api/v1/admin/news","type":0,"val":"api","end":""},{"old":"/api/v1/admin/news","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/news","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/news","type":0,"val":"news","end":""}],
    types: placeholder as Registry['admin.admin_news.index']['types'],
  },
  'admin.admin_news.store': {
    methods: ["POST"],
    pattern: '/api/v1/admin/news',
    tokens: [{"old":"/api/v1/admin/news","type":0,"val":"api","end":""},{"old":"/api/v1/admin/news","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/news","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/news","type":0,"val":"news","end":""}],
    types: placeholder as Registry['admin.admin_news.store']['types'],
  },
  'admin.admin_news.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/admin/news/:id',
    tokens: [{"old":"/api/v1/admin/news/:id","type":0,"val":"api","end":""},{"old":"/api/v1/admin/news/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/news/:id","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/news/:id","type":0,"val":"news","end":""},{"old":"/api/v1/admin/news/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['admin.admin_news.update']['types'],
  },
  'admin.admin_news.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/admin/news/:id',
    tokens: [{"old":"/api/v1/admin/news/:id","type":0,"val":"api","end":""},{"old":"/api/v1/admin/news/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/news/:id","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/news/:id","type":0,"val":"news","end":""},{"old":"/api/v1/admin/news/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['admin.admin_news.destroy']['types'],
  },
  'admin.admin_settings.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/admin/settings',
    tokens: [{"old":"/api/v1/admin/settings","type":0,"val":"api","end":""},{"old":"/api/v1/admin/settings","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/settings","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/settings","type":0,"val":"settings","end":""}],
    types: placeholder as Registry['admin.admin_settings.show']['types'],
  },
  'admin.admin_settings.update_flags': {
    methods: ["PATCH"],
    pattern: '/api/v1/admin/settings/flags',
    tokens: [{"old":"/api/v1/admin/settings/flags","type":0,"val":"api","end":""},{"old":"/api/v1/admin/settings/flags","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/settings/flags","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/settings/flags","type":0,"val":"settings","end":""},{"old":"/api/v1/admin/settings/flags","type":0,"val":"flags","end":""}],
    types: placeholder as Registry['admin.admin_settings.update_flags']['types'],
  },
  'admin.admin_settings.announce': {
    methods: ["POST"],
    pattern: '/api/v1/admin/settings/announcement',
    tokens: [{"old":"/api/v1/admin/settings/announcement","type":0,"val":"api","end":""},{"old":"/api/v1/admin/settings/announcement","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/settings/announcement","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/settings/announcement","type":0,"val":"settings","end":""},{"old":"/api/v1/admin/settings/announcement","type":0,"val":"announcement","end":""}],
    types: placeholder as Registry['admin.admin_settings.announce']['types'],
  },
  'admin.admin_settings.clear_announcement': {
    methods: ["DELETE"],
    pattern: '/api/v1/admin/settings/announcement',
    tokens: [{"old":"/api/v1/admin/settings/announcement","type":0,"val":"api","end":""},{"old":"/api/v1/admin/settings/announcement","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/settings/announcement","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/settings/announcement","type":0,"val":"settings","end":""},{"old":"/api/v1/admin/settings/announcement","type":0,"val":"announcement","end":""}],
    types: placeholder as Registry['admin.admin_settings.clear_announcement']['types'],
  },
  'admin.admin_settings.notice': {
    methods: ["POST"],
    pattern: '/api/v1/admin/settings/notice',
    tokens: [{"old":"/api/v1/admin/settings/notice","type":0,"val":"api","end":""},{"old":"/api/v1/admin/settings/notice","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/settings/notice","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/settings/notice","type":0,"val":"settings","end":""},{"old":"/api/v1/admin/settings/notice","type":0,"val":"notice","end":""}],
    types: placeholder as Registry['admin.admin_settings.notice']['types'],
  },
  'admin.admin_stats.rebuild_leaderboard': {
    methods: ["POST"],
    pattern: '/api/v1/admin/stats/leaderboard/rebuild',
    tokens: [{"old":"/api/v1/admin/stats/leaderboard/rebuild","type":0,"val":"api","end":""},{"old":"/api/v1/admin/stats/leaderboard/rebuild","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/stats/leaderboard/rebuild","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/stats/leaderboard/rebuild","type":0,"val":"stats","end":""},{"old":"/api/v1/admin/stats/leaderboard/rebuild","type":0,"val":"leaderboard","end":""},{"old":"/api/v1/admin/stats/leaderboard/rebuild","type":0,"val":"rebuild","end":""}],
    types: placeholder as Registry['admin.admin_stats.rebuild_leaderboard']['types'],
  },
  'admin.admin_stats.set_exclusion': {
    methods: ["PATCH"],
    pattern: '/api/v1/admin/stats/users/:userId/exclusion',
    tokens: [{"old":"/api/v1/admin/stats/users/:userId/exclusion","type":0,"val":"api","end":""},{"old":"/api/v1/admin/stats/users/:userId/exclusion","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/stats/users/:userId/exclusion","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/stats/users/:userId/exclusion","type":0,"val":"stats","end":""},{"old":"/api/v1/admin/stats/users/:userId/exclusion","type":0,"val":"users","end":""},{"old":"/api/v1/admin/stats/users/:userId/exclusion","type":1,"val":"userId","end":""},{"old":"/api/v1/admin/stats/users/:userId/exclusion","type":0,"val":"exclusion","end":""}],
    types: placeholder as Registry['admin.admin_stats.set_exclusion']['types'],
  },
  'admin.admin_stats.wipe': {
    methods: ["DELETE"],
    pattern: '/api/v1/admin/stats/users/:userId',
    tokens: [{"old":"/api/v1/admin/stats/users/:userId","type":0,"val":"api","end":""},{"old":"/api/v1/admin/stats/users/:userId","type":0,"val":"v1","end":""},{"old":"/api/v1/admin/stats/users/:userId","type":0,"val":"admin","end":""},{"old":"/api/v1/admin/stats/users/:userId","type":0,"val":"stats","end":""},{"old":"/api/v1/admin/stats/users/:userId","type":0,"val":"users","end":""},{"old":"/api/v1/admin/stats/users/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['admin.admin_stats.wipe']['types'],
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
