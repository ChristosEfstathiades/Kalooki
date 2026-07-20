import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MessageSquare } from 'lucide-react'
import {
  chatHistoryQueryOptions,
  sendChatMessage,
  subscribeToGroupChat,
  useChatLiveUpdates,
  useReportMessage,
} from '#/lib/chat'
import { currentUserQueryOptions } from '#/lib/auth'
import {
  friendRequestsQueryOptions,
  friendsQueryOptions,
  groupsQueryOptions,
  useSendFriendRequest,
} from '#/lib/social'
import {
  canModerate,
  isModerator,
  useChatModerationUpdates,
} from '#/lib/moderation'
import LobbyPinnedBanner from '#/components/game/LobbyPinnedBanner'
import ModeratorActions from '#/components/chat/ModeratorActions'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'
import { chatNameColor, usernameColor } from '#/lib/username-color'
import type { ChatChannel } from '#/lib/chat'

/**
 * Chat sidebar for the play page: pick the global chatroom or one of
 * your group chats, read the conversation, and post messages. Live
 * updates arrive over Socket.IO (docs/Frontend-design.md).
 */
export default function ChatSidebar() {
  const { data: groups } = useQuery(groupsQueryOptions)
  const [channel, setChannel] = useState<ChatChannel>({ type: 'global' })

  useChatLiveUpdates()

  // Joining a group after connecting requires an explicit room join
  useEffect(() => {
    if (channel.type === 'group') {
      subscribeToGroupChat(channel.groupId)
    }
  }, [channel])

  return (
    <aside className="flex h-[26rem] flex-col rounded-lg border border-border bg-card lg:h-[32rem]">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageSquare
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
        <h2 className="m-0 text-sm font-semibold">Chat</h2>
      </div>

      <div className="thin-scrollbar flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
        <ChannelTab
          label="Global"
          active={channel.type === 'global'}
          onSelect={() => setChannel({ type: 'global' })}
        />
        {(groups ?? []).map((group) => (
          <ChannelTab
            key={group.id}
            label={group.name}
            active={channel.type === 'group' && channel.groupId === group.id}
            onSelect={() => setChannel({ type: 'group', groupId: group.id })}
          />
        ))}
      </div>

      {channel.type === 'group' && (
        <LobbyPinnedBanner groupId={channel.groupId} />
      )}

      <ChatConversation channel={channel} />
    </aside>
  )
}

interface ChannelTabProps {
  label: string
  active: boolean
  onSelect: () => void
}

function ChannelTab({ label, active, onSelect }: ChannelTabProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'shrink-0 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        active
          ? 'bg-button-purple text-white'
          : 'text-muted-foreground hover:bg-accent',
      )}
    >
      {label}
    </button>
  )
}

interface ChatConversationProps {
  channel: ChatChannel
}

/**
 * A single channel's conversation: history, live messages, the send
 * box, and the per-message friend-request/report menu. Shared between
 * the play-page sidebar and the in-game match chat panel.
 */
export function ChatConversation({ channel }: ChatConversationProps) {
  const { data: currentUser } = useQuery(currentUserQueryOptions)
  const history = useQuery(chatHistoryQueryOptions(channel))
  const { data: friends } = useQuery(friendsQueryOptions)
  const { data: friendRequests } = useQuery(friendRequestsQueryOptions)
  const sendFriendRequest = useSendFriendRequest()
  const reportMessage = useReportMessage()

  useChatModerationUpdates()

  // Moderators police the public chatroom and live game chats; private
  // group conversations stay out of reach (docs/features.md).
  const showModeratorTools = isModerator(currentUser)
  const canDeleteMessages = showModeratorTools && channel.type !== 'group'

  // No point offering a friend request to existing friends or anyone
  // with a request already pending in either direction
  const noRequestNeededIds = new Set<number>([
    ...(friends ?? []).map((friend) => friend.id),
    ...(friendRequests?.outgoing ?? []).map((request) => request.recipient.id),
    ...(friendRequests?.incoming ?? []).map((request) => request.sender.id),
  ])

  const [draft, setDraft] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [menuMessageId, setMenuMessageId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const messages = history.data ?? []

  // Keep the newest message in view. Keyed on the last message's id
  // rather than the count, which stops changing once the cached list
  // reaches its cap and older messages are dropped as new ones arrive.
  const lastMessageId = messages.at(-1)?.id ?? null
  useEffect(() => {
    const list = listRef.current
    if (list) {
      list.scrollTop = list.scrollHeight
    }
  }, [lastMessageId])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const body = draft.trim()
    if (body === '') {
      return
    }
    setSendError(null)
    try {
      await sendChatMessage(channel, body)
      setDraft('')
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : 'Could not send the message',
      )
    }
  }

  const runAction = async (
    action: () => Promise<unknown>,
    successText: string,
  ) => {
    setMenuMessageId(null)
    try {
      await action()
      setFeedback(successText)
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Something went wrong',
      )
    }
  }

  return (
    <>
      <div
        ref={listRef}
        className="thin-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3"
      >
        {history.isSuccess && messages.length === 0 && (
          <p className="m-0 text-center text-sm text-muted-foreground">
            No messages in the last 30 days. Say hello.
          </p>
        )}
        {messages.map((message) => {
          const author = message.user
          if (author === null) {
            // A server-authored line (e.g. a disconnect countdown)
            return (
              <p
                key={message.id}
                className="m-0 text-center text-xs text-destructive italic"
              >
                {message.body}
              </p>
            )
          }
          const isOwnMessage = author.id === currentUser?.id
          const moderatorToolsApply =
            canDeleteMessages ||
            canModerate(currentUser, author.role, author.id)

          return (
            <div key={message.id} className="relative text-sm">
              <button
                type="button"
                className="font-semibold hover:underline"
                style={{
                  color: chatNameColor(
                    author.chatColor ?? usernameColor(author.username),
                  ),
                }}
                onClick={() =>
                  setMenuMessageId(
                    menuMessageId === message.id ? null : message.id,
                  )
                }
              >
                {author.username}
              </button>
              <StaffBadge role={author.role} />
              {': '}
              <span className="break-words">{message.body}</span>
              {menuMessageId === message.id &&
                (!isOwnMessage || moderatorToolsApply) && (
                  <span className="absolute left-0 z-10 mt-5 flex flex-wrap gap-1 rounded-md border border-border bg-popover p-1 shadow-md">
                    {!isOwnMessage && (
                      <>
                        {!noRequestNeededIds.has(author.id) && (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() =>
                              runAction(
                                () =>
                                  sendFriendRequest.mutateAsync(
                                    author.username,
                                  ),
                                `Friend request sent to ${author.username}`,
                              )
                            }
                          >
                            Send friend request
                          </Button>
                        )}
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            runAction(
                              () => reportMessage.mutateAsync(message.id),
                              'Report submitted for moderator review',
                            )
                          }
                        >
                          Report message
                        </Button>
                      </>
                    )}
                    {showModeratorTools && (
                      <ModeratorActions
                        currentUser={currentUser}
                        author={author}
                        messageId={message.id}
                        canDeleteMessages={canDeleteMessages}
                        onFinished={(text) => {
                          setMenuMessageId(null)
                          setFeedback(text)
                        }}
                      />
                    )}
                  </span>
                )}
            </div>
          )
        })}
      </div>

      {(feedback ?? sendError) && (
        <p
          className={cn(
            'm-0 border-t border-border px-4 py-2 text-xs',
            sendError ? 'text-destructive-foreground' : 'text-muted-foreground',
          )}
        >
          {sendError ?? feedback}
        </p>
      )}

      {currentUser?.isMuted ? (
        <p className="m-0 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {muteNotice(currentUser.mutedUntil, currentUser.muteReason)}
        </p>
      ) : (
        <form
          className="flex gap-2 border-t border-border p-3"
          onSubmit={submit}
        >
          <Input
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setSendError(null)
              setFeedback(null)
            }}
            placeholder="Send a message"
            aria-label="Send a message"
            maxLength={500}
          />
          <Button type="submit" disabled={draft.trim() === ''}>
            Send
          </Button>
        </form>
      )}
    </>
  )
}

interface StaffBadgeProps {
  role: string
}

/**
 * Marks moderators and admins in chat so players can tell who is
 * official. Renders nothing for ordinary players.
 */
function StaffBadge({ role }: StaffBadgeProps) {
  if (role !== 'moderator' && role !== 'admin') {
    return null
  }

  return (
    <span
      className={cn(
        'ml-1 rounded px-1 py-px align-middle text-[0.625rem] font-semibold tracking-wide uppercase',
        role === 'admin'
          ? 'bg-button-purple text-white'
          : 'bg-accent text-accent-foreground',
      )}
    >
      {role === 'admin' ? 'Admin' : 'Mod'}
    </span>
  )
}

/**
 * Explains an active mute in the chat box, including when it lifts and
 * the reason a moderator recorded.
 */
function muteNotice(mutedUntil: string | null, muteReason: string | null): string {
  const until =
    mutedUntil === null
      ? 'You are muted and cannot post in chat.'
      : `You are muted until ${new Date(mutedUntil).toLocaleString()} and cannot post in chat.`
  return muteReason ? `${until} Reason: ${muteReason}` : until
}
