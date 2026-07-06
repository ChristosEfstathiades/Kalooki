import { useEffect } from 'react'
import { MessageSquare, X } from 'lucide-react'
import { subscribeToMatchChat, useChatLiveUpdates } from '#/lib/chat'
import { ChatConversation } from '#/components/chat/ChatSidebar'
import { getSocket } from '#/lib/socket'
import { Button } from '#/components/ui/button'

interface MatchChatPanelProps {
  matchId: string
  /** Whether the game has ended (the chat closes with the game). */
  finished: boolean
  onClose: () => void
}

/**
 * Table chat for a live game: a side panel only the match's players
 * can read and type in. The server closes the room when the game ends;
 * the stored messages then become inaccessible (docs/features.md).
 */
export default function MatchChatPanel({
  matchId,
  finished,
  onClose,
}: MatchChatPanelProps) {
  useChatLiveUpdates()

  // Join the match chat room, and re-join after a reconnect
  useEffect(() => {
    if (finished) {
      return
    }
    const socket = getSocket()
    subscribeToMatchChat(matchId)
    const onConnect = () => subscribeToMatchChat(matchId)
    socket.on('connect', onConnect)
    return () => {
      socket.off('connect', onConnect)
    }
  }, [matchId, finished])

  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-80 max-w-full flex-col border-l border-border bg-card shadow-xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageSquare
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
        <h2 className="m-0 flex-1 text-sm font-semibold">Table chat</h2>
        <Button
          size="xs"
          variant="ghost"
          aria-label="Close chat"
          onClick={onClose}
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>

      {finished ? (
        <p className="m-0 px-4 py-6 text-center text-sm text-muted-foreground">
          Chat closed — the game has ended.
        </p>
      ) : (
        <ChatConversation channel={{ type: 'match', matchId }} />
      )}
    </aside>
  )
}
