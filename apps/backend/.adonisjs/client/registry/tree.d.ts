/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  auth: {
    newAccount: {
      store: typeof routes['auth.new_account.store']
    }
    accessTokens: {
      store: typeof routes['auth.access_tokens.store']
    }
  }
  presence: {
    index: typeof routes['presence.index']
  }
  profile: {
    profile: {
      show: typeof routes['profile.profile.show']
      update: typeof routes['profile.profile.update']
    }
    accessTokens: {
      destroy: typeof routes['profile.access_tokens.destroy']
    }
    accountDeletion: {
      destroy: typeof routes['profile.account_deletion.destroy']
    }
  }
  social: {
    friends: {
      index: typeof routes['social.friends.index']
      destroy: typeof routes['social.friends.destroy']
    }
    friendRequests: {
      index: typeof routes['social.friend_requests.index']
      store: typeof routes['social.friend_requests.store']
      accept: typeof routes['social.friend_requests.accept']
      destroy: typeof routes['social.friend_requests.destroy']
    }
    groups: {
      index: typeof routes['social.groups.index']
      store: typeof routes['social.groups.store']
      show: typeof routes['social.groups.show']
      transfer: typeof routes['social.groups.transfer']
      destroy: typeof routes['social.groups.destroy']
    }
    groupInvites: {
      store: typeof routes['social.group_invites.store']
      index: typeof routes['social.group_invites.index']
      accept: typeof routes['social.group_invites.accept']
      destroy: typeof routes['social.group_invites.destroy']
    }
    groupMembers: {
      destroy: typeof routes['social.group_members.destroy']
    }
    chatMessages: {
      global: typeof routes['social.chat_messages.global']
      group: typeof routes['social.chat_messages.group']
      match: typeof routes['social.chat_messages.match']
      report: typeof routes['social.chat_messages.report']
    }
    matches: {
      index: typeof routes['social.matches.index']
    }
    leaderboard: {
      index: typeof routes['social.leaderboard.index']
    }
  }
  moderation: {
    moderation: {
      showUser: typeof routes['moderation.moderation.show_user']
      destroyMessage: typeof routes['moderation.moderation.destroy_message']
      ban: typeof routes['moderation.moderation.ban']
      unban: typeof routes['moderation.moderation.unban']
      mute: typeof routes['moderation.moderation.mute']
      unmute: typeof routes['moderation.moderation.unmute']
    }
  }
  admin: {
    admin: {
      listUsers: typeof routes['admin.admin.list_users']
      updateUserRole: typeof routes['admin.admin.update_user_role']
      listModerationActions: typeof routes['admin.admin.list_moderation_actions']
    }
  }
}
