import type User from '#models/user'
import { isBanned, isMuted } from '#services/role_service'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * A user as moderators and admins see them: the public fields plus the
 * account's email, role and moderation state. Never returned to regular
 * players. Exported as a plain shape because nested transformer
 * instances are not carried through the generated client's types.
 */
export function moderationUserShape(user: User) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    chatColor: user.chatColor,
    // SQLite hands booleans back as 0/1
    isBot: Boolean(user.isBot),
    createdAt: user.createdAt.toISO(),
    deletedAt: user.deletedAt?.toISO() ?? null,
    emailVerifiedAt: user.emailVerifiedAt?.toISO() ?? null,
    isBanned: isBanned(user),
    bannedAt: user.bannedAt?.toISO() ?? null,
    banReason: user.banReason,
    isMuted: isMuted(user),
    mutedAt: user.mutedAt?.toISO() ?? null,
    // Null while muted means the mute is permanent; read it with isMuted
    mutedUntil: user.mutedUntil?.toISO() ?? null,
    muteReason: user.muteReason,
  }
}

export default class ModerationUserTransformer extends BaseTransformer<User> {
  toObject() {
    return moderationUserShape(this.resource)
  }
}
