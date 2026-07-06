import type ChatMessage from '#models/chat_message'
import { publicUserShape } from '#transformers/public_user_transformer'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * Plain shape of a chat message, shared by the REST transformer and
 * Socket.IO broadcasts so both channels emit identical JSON. Expects
 * the user relation to be preloaded.
 */
export function chatMessageShape(message: ChatMessage) {
  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISO(),
    user: publicUserShape(message.user),
  }
}

export default class ChatMessageTransformer extends BaseTransformer<ChatMessage> {
  toObject() {
    return chatMessageShape(this.resource)
  }
}
