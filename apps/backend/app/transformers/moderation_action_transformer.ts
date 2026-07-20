import type ModerationAction from '#models/moderation_action'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * One entry of the moderation audit feed. Usernames come from the
 * snapshot columns rather than the relations so entries stay readable
 * after an account is deleted.
 */
export function moderationActionShape(action: ModerationAction) {
  return {
    id: action.id,
    action: action.action,
    actorId: action.actorId,
    actorUsername: action.actorUsername,
    actorRole: action.actorRole,
    targetUserId: action.targetUserId,
    targetUsername: action.targetUsername,
    messageId: action.messageId,
    messageChannel: action.messageChannel,
    messageBody: action.messageBody,
    reason: action.reason,
    details: action.details,
    createdAt: action.createdAt.toISO(),
  }
}

export default class ModerationActionTransformer extends BaseTransformer<ModerationAction> {
  toObject() {
    return moderationActionShape(this.resource)
  }
}
