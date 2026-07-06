/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'avatars.show': {
    methods: ["GET","HEAD"]
    pattern: '/uploads/avatars/:filename'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { filename: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/avatars_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/avatars_controller').default['show']>>>
    }
  }
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
}
