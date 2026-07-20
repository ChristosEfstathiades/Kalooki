import ChatMessage from '#models/chat_message'
import MessageReport from '#models/message_report'
import { assertMatchChatAccess, recentChatMessages } from '#services/chat_service'
import { matchSystemMessages } from '#services/game/match_service'
import { isGroupMember } from '#services/group_service'
import ChatMessageTransformer, { chatMessageShape } from '#transformers/chat_message_transformer'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

export default class ChatMessagesController {
  /**
   * Recent global chatroom history, oldest first. Live updates arrive
   * over Socket.IO.
   */
  async global({ serialize }: HttpContext) {
    const messages = await recentChatMessages({ type: 'global' })
    return serialize({ messages: ChatMessageTransformer.transform(messages) })
  }

  /**
   * Recent history for a group's chat. Members only.
   */
  async group({ auth, params, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const groupId = Number(params.groupId)

    if (!(await isGroupMember(groupId, user.id))) {
      throw new Exception('Group not found', { status: 404, code: 'E_GROUP_NOT_FOUND' })
    }

    const messages = await recentChatMessages({ type: 'group', groupId })
    return serialize({ messages: ChatMessageTransformer.transform(messages) })
  }

  /**
   * Recent history for a live game's chat, with the server's own lines
   * (disconnect countdowns and the like) woven in by time. Players of
   * that match only; once the game ends the messages are no longer
   * accessible.
   */
  async match({ auth, params, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const matchId = String(params.matchId)

    assertMatchChatAccess(matchId, user.id)

    const messages = await recentChatMessages({ type: 'match', matchId })
    const merged = [...messages.map(chatMessageShape), ...matchSystemMessages(matchId)].sort(
      (a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
    )
    return serialize({ messages: merged })
  }

  /**
   * Reports a chat message to the moderators. Idempotent per reporter;
   * only messages the user can actually see can be reported.
   */
  async report({ auth, params, serialize }: HttpContext) {
    const user = auth.getUserOrFail()

    const message = await ChatMessage.find(Number(params.id))
    if (!message || message.deletedAt !== null) {
      throw new Exception('Message not found', { status: 404, code: 'E_MESSAGE_NOT_FOUND' })
    }
    if (
      message.channel === 'group' &&
      (message.groupId === null || !(await isGroupMember(message.groupId, user.id)))
    ) {
      throw new Exception('Message not found', { status: 404, code: 'E_MESSAGE_NOT_FOUND' })
    }
    if (message.channel === 'match') {
      if (message.matchId === null) {
        throw new Exception('Message not found', { status: 404, code: 'E_MESSAGE_NOT_FOUND' })
      }
      assertMatchChatAccess(message.matchId, user.id)
    }
    if (message.userId === user.id) {
      throw new Exception('You cannot report your own message', {
        status: 400,
        code: 'E_SELF_REPORT',
      })
    }

    await MessageReport.firstOrCreate({ messageId: message.id, reporterId: user.id })
    return serialize({ message: 'Report submitted for moderator review' })
  }
}
