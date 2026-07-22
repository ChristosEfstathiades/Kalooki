/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'auth.new_account.store': {
    methods: ["POST"]
    pattern: '/api/v1/auth/signup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').signupValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').signupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.access_tokens.store': {
    methods: ["POST"]
    pattern: '/api/v1/auth/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/access_tokens_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/access_tokens_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'presence.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/presence'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/presence_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/presence_controller').default['index']>>>
    }
  }
  'site.site.status': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/site'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/site_controller').default['status']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/site_controller').default['status']>>>
    }
  }
  'site.site.news': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/site/news'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/site_controller').default['news']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/site_controller').default['news']>>>
    }
  }
  'profile.profile.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/account/profile'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
    }
  }
  'profile.profile.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/account/profile'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').updateProfileValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').updateProfileValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'profile.access_tokens.destroy': {
    methods: ["POST"]
    pattern: '/api/v1/account/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/access_tokens_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/access_tokens_controller').default['destroy']>>>
    }
  }
  'profile.account_deletion.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/account'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_deletion_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_deletion_controller').default['destroy']>>>
    }
  }
  'social.friends.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/friends'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/friends_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/friends_controller').default['index']>>>
    }
  }
  'social.friends.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/friends/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/friends_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/friends_controller').default['destroy']>>>
    }
  }
  'social.friend_requests.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/friend-requests'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/friend_requests_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/friend_requests_controller').default['index']>>>
    }
  }
  'social.friend_requests.store': {
    methods: ["POST"]
    pattern: '/api/v1/friend-requests'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/friend').sendFriendRequestValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/friend').sendFriendRequestValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/friend_requests_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/friend_requests_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'social.friend_requests.accept': {
    methods: ["POST"]
    pattern: '/api/v1/friend-requests/:id/accept'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/friend_requests_controller').default['accept']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/friend_requests_controller').default['accept']>>>
    }
  }
  'social.friend_requests.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/friend-requests/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/friend_requests_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/friend_requests_controller').default['destroy']>>>
    }
  }
  'social.groups.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/groups'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['index']>>>
    }
  }
  'social.groups.store': {
    methods: ["POST"]
    pattern: '/api/v1/groups'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/group').createGroupValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/group').createGroupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'social.groups.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/groups/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['show']>>>
    }
  }
  'social.groups.transfer': {
    methods: ["POST"]
    pattern: '/api/v1/groups/:id/transfer'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/group').transferOwnershipValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/group').transferOwnershipValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['transfer']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['transfer']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'social.groups.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/groups/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['destroy']>>>
    }
  }
  'social.group_invites.store': {
    methods: ["POST"]
    pattern: '/api/v1/groups/:groupId/invites'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/group').inviteToGroupValidator)>>
      paramsTuple: [ParamValue]
      params: { groupId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/group').inviteToGroupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/group_invites_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/group_invites_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'social.group_members.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/groups/:groupId/members/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { groupId: ParamValue; userId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/group_members_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/group_members_controller').default['destroy']>>>
    }
  }
  'social.group_invites.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/group-invites'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/group_invites_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/group_invites_controller').default['index']>>>
    }
  }
  'social.group_invites.accept': {
    methods: ["POST"]
    pattern: '/api/v1/group-invites/:id/accept'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/group_invites_controller').default['accept']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/group_invites_controller').default['accept']>>>
    }
  }
  'social.group_invites.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/group-invites/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/group_invites_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/group_invites_controller').default['destroy']>>>
    }
  }
  'social.chat_messages.global': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/chat/global/messages'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/chat_messages_controller').default['global']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/chat_messages_controller').default['global']>>>
    }
  }
  'social.chat_messages.group': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/groups/:groupId/messages'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { groupId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/chat_messages_controller').default['group']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/chat_messages_controller').default['group']>>>
    }
  }
  'social.chat_messages.match': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/matches/:matchId/messages'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { matchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/chat_messages_controller').default['match']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/chat_messages_controller').default['match']>>>
    }
  }
  'social.chat_messages.report': {
    methods: ["POST"]
    pattern: '/api/v1/chat/messages/:id/report'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/chat_messages_controller').default['report']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/chat_messages_controller').default['report']>>>
    }
  }
  'social.matches.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/matches'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/match').matchHistoryFilterValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'social.leaderboard.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/leaderboard'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/leaderboard_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/leaderboard_controller').default['index']>>>
    }
  }
  'moderation.moderation.show_user': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/moderation/users/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/moderation_controller').default['showUser']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/moderation_controller').default['showUser']>>>
    }
  }
  'moderation.moderation.destroy_message': {
    methods: ["DELETE"]
    pattern: '/api/v1/moderation/messages/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/moderation').deleteMessageValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/moderation').deleteMessageValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/moderation_controller').default['destroyMessage']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/moderation_controller').default['destroyMessage']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'moderation.moderation.ban': {
    methods: ["POST"]
    pattern: '/api/v1/moderation/users/:userId/ban'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/moderation').banUserValidator)>>
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/moderation').banUserValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/moderation_controller').default['ban']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/moderation_controller').default['ban']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'moderation.moderation.unban': {
    methods: ["DELETE"]
    pattern: '/api/v1/moderation/users/:userId/ban'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/moderation').liftModerationValidator)>>
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/moderation').liftModerationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/moderation_controller').default['unban']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/moderation_controller').default['unban']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'moderation.moderation.mute': {
    methods: ["POST"]
    pattern: '/api/v1/moderation/users/:userId/mute'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/moderation').muteUserValidator)>>
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/moderation').muteUserValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/moderation_controller').default['mute']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/moderation_controller').default['mute']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'moderation.moderation.unmute': {
    methods: ["DELETE"]
    pattern: '/api/v1/moderation/users/:userId/mute'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/moderation').liftModerationValidator)>>
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/moderation').liftModerationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/moderation_controller').default['unmute']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/moderation_controller').default['unmute']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.admin.list_users': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/users'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/moderation').listUsersValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_controller').default['listUsers']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_controller').default['listUsers']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.admin.show_user': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/users/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_controller').default['showUser']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_controller').default['showUser']>>>
    }
  }
  'admin.admin.update_user_role': {
    methods: ["PATCH"]
    pattern: '/api/v1/admin/users/:userId/role'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/moderation').setUserRoleValidator)>>
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/moderation').setUserRoleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_controller').default['updateUserRole']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_controller').default['updateUserRole']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.admin.list_moderation_actions': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/moderation-actions'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/admin').listModerationActionsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_controller').default['listModerationActions']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_controller').default['listModerationActions']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.admin_metrics.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/metrics'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_metrics_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_metrics_controller').default['index']>>>
    }
  }
  'admin.admin_reports.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/reports'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/admin').listReportsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_reports_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_reports_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.admin_reports.authors': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/reports/authors'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/admin').listReportedAuthorsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_reports_controller').default['authors']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_reports_controller').default['authors']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.admin_reports.open_count': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/reports/open-count'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_reports_controller').default['openCount']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_reports_controller').default['openCount']>>>
    }
  }
  'admin.admin_reports.resolve': {
    methods: ["POST"]
    pattern: '/api/v1/admin/reports/messages/:messageId/resolve'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin').resolveReportValidator)>>
      paramsTuple: [ParamValue]
      params: { messageId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/admin').resolveReportValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_reports_controller').default['resolve']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_reports_controller').default['resolve']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.admin_reports.reopen': {
    methods: ["DELETE"]
    pattern: '/api/v1/admin/reports/messages/:messageId/resolve'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { messageId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_reports_controller').default['reopen']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_reports_controller').default['reopen']>>>
    }
  }
  'admin.admin_chat.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/chat/messages'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/admin').searchChatValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_chat_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_chat_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.admin_news.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/news'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_news_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_news_controller').default['index']>>>
    }
  }
  'admin.admin_news.store': {
    methods: ["POST"]
    pattern: '/api/v1/admin/news'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin').createNewsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/admin').createNewsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_news_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_news_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.admin_news.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/admin/news/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin').updateNewsValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/admin').updateNewsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_news_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_news_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.admin_news.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/admin/news/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_news_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_news_controller').default['destroy']>>>
    }
  }
  'admin.admin_settings.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/admin/settings'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_settings_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_settings_controller').default['show']>>>
    }
  }
  'admin.admin_settings.update_flags': {
    methods: ["PATCH"]
    pattern: '/api/v1/admin/settings/flags'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin').siteFlagsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/admin').siteFlagsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_settings_controller').default['updateFlags']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_settings_controller').default['updateFlags']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.admin_settings.announce': {
    methods: ["POST"]
    pattern: '/api/v1/admin/settings/announcement'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin').announcementValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/admin').announcementValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_settings_controller').default['announce']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_settings_controller').default['announce']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.admin_settings.clear_announcement': {
    methods: ["DELETE"]
    pattern: '/api/v1/admin/settings/announcement'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_settings_controller').default['clearAnnouncement']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_settings_controller').default['clearAnnouncement']>>>
    }
  }
  'admin.admin_settings.notice': {
    methods: ["POST"]
    pattern: '/api/v1/admin/settings/notice'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin').globalNoticeValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/admin').globalNoticeValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_settings_controller').default['notice']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_settings_controller').default['notice']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.admin_stats.rebuild_leaderboard': {
    methods: ["POST"]
    pattern: '/api/v1/admin/stats/leaderboard/rebuild'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_stats_controller').default['rebuildLeaderboard']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_stats_controller').default['rebuildLeaderboard']>>>
    }
  }
  'admin.admin_stats.set_exclusion': {
    methods: ["PATCH"]
    pattern: '/api/v1/admin/stats/users/:userId/exclusion'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin').leaderboardExclusionValidator)>>
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/admin').leaderboardExclusionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_stats_controller').default['setExclusion']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_stats_controller').default['setExclusion']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.admin_stats.wipe': {
    methods: ["DELETE"]
    pattern: '/api/v1/admin/stats/users/:userId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin').wipeStatsValidator)>>
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/admin').wipeStatsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin_stats_controller').default['wipe']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin_stats_controller').default['wipe']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
}
