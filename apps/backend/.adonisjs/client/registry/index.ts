/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'avatars.show': {
    methods: ["GET","HEAD"],
    pattern: '/uploads/avatars/:filename',
    tokens: [{"old":"/uploads/avatars/:filename","type":0,"val":"uploads","end":""},{"old":"/uploads/avatars/:filename","type":0,"val":"avatars","end":""},{"old":"/uploads/avatars/:filename","type":1,"val":"filename","end":""}],
    types: placeholder as Registry['avatars.show']['types'],
  },
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
  'profile.profile.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/account/profile',
    tokens: [{"old":"/api/v1/account/profile","type":0,"val":"api","end":""},{"old":"/api/v1/account/profile","type":0,"val":"v1","end":""},{"old":"/api/v1/account/profile","type":0,"val":"account","end":""},{"old":"/api/v1/account/profile","type":0,"val":"profile","end":""}],
    types: placeholder as Registry['profile.profile.show']['types'],
  },
  'profile.access_tokens.destroy': {
    methods: ["POST"],
    pattern: '/api/v1/account/logout',
    tokens: [{"old":"/api/v1/account/logout","type":0,"val":"api","end":""},{"old":"/api/v1/account/logout","type":0,"val":"v1","end":""},{"old":"/api/v1/account/logout","type":0,"val":"account","end":""},{"old":"/api/v1/account/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['profile.access_tokens.destroy']['types'],
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
