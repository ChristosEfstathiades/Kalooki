import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'avatars.show': { paramsTuple: [ParamValue]; params: {'filename': ParamValue} }
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.access_tokens.store': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'profile.profile.update': { paramsTuple?: []; params?: {} }
    'profile.access_tokens.destroy': { paramsTuple?: []; params?: {} }
    'social.friends.index': { paramsTuple?: []; params?: {} }
    'social.friends.destroy': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'social.friend_requests.index': { paramsTuple?: []; params?: {} }
    'social.friend_requests.store': { paramsTuple?: []; params?: {} }
    'social.friend_requests.accept': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'social.friend_requests.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'social.groups.index': { paramsTuple?: []; params?: {} }
    'social.groups.store': { paramsTuple?: []; params?: {} }
    'social.groups.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'social.groups.transfer': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'social.groups.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'social.group_invites.store': { paramsTuple: [ParamValue]; params: {'groupId': ParamValue} }
    'social.group_members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'groupId': ParamValue,'userId': ParamValue} }
    'social.group_invites.index': { paramsTuple?: []; params?: {} }
    'social.group_invites.accept': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'social.group_invites.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'social.chat_messages.global': { paramsTuple?: []; params?: {} }
    'social.chat_messages.group': { paramsTuple: [ParamValue]; params: {'groupId': ParamValue} }
    'social.chat_messages.match': { paramsTuple: [ParamValue]; params: {'matchId': ParamValue} }
    'social.chat_messages.report': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'social.matches.index': { paramsTuple?: []; params?: {} }
    'social.leaderboard.index': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'avatars.show': { paramsTuple: [ParamValue]; params: {'filename': ParamValue} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'social.friends.index': { paramsTuple?: []; params?: {} }
    'social.friend_requests.index': { paramsTuple?: []; params?: {} }
    'social.groups.index': { paramsTuple?: []; params?: {} }
    'social.groups.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'social.group_invites.index': { paramsTuple?: []; params?: {} }
    'social.chat_messages.global': { paramsTuple?: []; params?: {} }
    'social.chat_messages.group': { paramsTuple: [ParamValue]; params: {'groupId': ParamValue} }
    'social.chat_messages.match': { paramsTuple: [ParamValue]; params: {'matchId': ParamValue} }
    'social.matches.index': { paramsTuple?: []; params?: {} }
    'social.leaderboard.index': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'avatars.show': { paramsTuple: [ParamValue]; params: {'filename': ParamValue} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'social.friends.index': { paramsTuple?: []; params?: {} }
    'social.friend_requests.index': { paramsTuple?: []; params?: {} }
    'social.groups.index': { paramsTuple?: []; params?: {} }
    'social.groups.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'social.group_invites.index': { paramsTuple?: []; params?: {} }
    'social.chat_messages.global': { paramsTuple?: []; params?: {} }
    'social.chat_messages.group': { paramsTuple: [ParamValue]; params: {'groupId': ParamValue} }
    'social.chat_messages.match': { paramsTuple: [ParamValue]; params: {'matchId': ParamValue} }
    'social.matches.index': { paramsTuple?: []; params?: {} }
    'social.leaderboard.index': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.access_tokens.store': { paramsTuple?: []; params?: {} }
    'profile.access_tokens.destroy': { paramsTuple?: []; params?: {} }
    'social.friend_requests.store': { paramsTuple?: []; params?: {} }
    'social.friend_requests.accept': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'social.groups.store': { paramsTuple?: []; params?: {} }
    'social.groups.transfer': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'social.group_invites.store': { paramsTuple: [ParamValue]; params: {'groupId': ParamValue} }
    'social.group_invites.accept': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'social.chat_messages.report': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'profile.profile.update': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'social.friends.destroy': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'social.friend_requests.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'social.groups.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'social.group_members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'groupId': ParamValue,'userId': ParamValue} }
    'social.group_invites.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}