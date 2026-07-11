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
import { groupsQueryOptions, useSendFriendRequest } from '#/lib/social'
import LobbyPinnedBanner from '#/components/game/LobbyPinnedBanner'
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
    <aside className="flex flex-col rounded-lg border border-border bg-card lg:h-[32rem]">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageSquare
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
        <h2 className="m-0 text-sm font-semibold">Chat</h2>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
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
  const sendFriendRequest = useSendFriendRequest()
  const reportMessage = useReportMessage()

  const [draft, setDraft] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [menuMessageId, setMenuMessageId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const messages = history.data ?? []

  // Keep the newest message in view
  useEffect(() => {
    const list = listRef.current
    if (list) {
      list.scrollTop = list.scrollHeight
    }
  }, [messages.length])

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
        className="min-h-48 flex-1 space-y-2 overflow-y-auto px-4 py-3"
      >
        {history.isSuccess && messages.length === 0 && (
          <p className="m-0 text-center text-sm text-muted-foreground">
            No messages in the last 30 days. Say hello.
          </p>
        )}
        {messages.map((message) => (
          <div key={message.id} className="relative text-sm">
            <button
              type="button"
              className="font-semibold hover:underline"
              style={{
                color: chatNameColor(
                  message.user.chatColor ?? usernameColor(message.user.username),
                ),
              }}
              onClick={() =>
                setMenuMessageId(
                  menuMessageId === message.id ? null : message.id,
                )
              }
            >
              {message.user.username}
            </button>
            {': '}
            <span className="break-words">{message.body}</span>
            {menuMessageId === message.id &&
              message.user.id !== currentUser?.id && (
                <span className="absolute left-0 z-10 mt-5 flex gap-1 rounded-md border border-border bg-popover p-1 shadow-md">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      runAction(
                        () =>
                          sendFriendRequest.mutateAsync(message.user.username),
                        `Friend request sent to ${message.user.username}`,
                      )
                    }
                  >
                    Send friend request
                  </Button>
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
                </span>
              )}
          </div>
        ))}
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

      <form className="flex gap-2 border-t border-border p-3" onSubmit={submit}>
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
    </>
  )
}
