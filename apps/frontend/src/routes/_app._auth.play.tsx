import { createFileRoute } from '@tanstack/react-router'
import { Clock, MessageSquare, UserPlus, Users } from 'lucide-react'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/_app/_auth/play')({
  component: PlayPage,
})

/**
 * Logged-in home: match actions and social shortcuts on the left, chat
 * sidebar on the right (docs/Frontend-design.md). Matchmaking, friends,
 * history, and chat activate as their slices land.
 */
function PlayPage() {
  return (
    <div className="page-wrap grid gap-6 py-8 lg:grid-cols-[1fr_320px]">
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="m-0 text-2xl font-bold">Play Kalooki</h1>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Public matches use the classic ruleset. Private matches with custom
            rules start from your groups.
          </p>
          <Button
            size="lg"
            className="w-full bg-button-red hover:bg-button-red-hover sm:w-auto"
            disabled
            title="Matchmaking opens when the game engine lands"
          >
            Find public match
          </Button>
          <p className="mt-2 mb-0 text-xs text-muted-foreground">
            Matchmaking is not open yet — it arrives with the game engine.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Button
            variant="secondary"
            className="justify-start"
            disabled
            title="Coming soon"
          >
            <UserPlus aria-hidden="true" />
            Send friend request
          </Button>
          <Button
            variant="secondary"
            className="justify-start"
            disabled
            title="Coming soon"
          >
            <Users aria-hidden="true" />
            Friends
          </Button>
          <Button
            variant="secondary"
            className="justify-start"
            disabled
            title="Coming soon"
          >
            <Clock aria-hidden="true" />
            Match history
          </Button>
        </div>
      </section>

      <aside className="flex min-h-64 flex-col rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <MessageSquare
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2 className="m-0 text-sm font-semibold">Chat</h2>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="m-0 text-center text-sm text-muted-foreground">
            Global chat and group chats will live here.
          </p>
        </div>
      </aside>
    </div>
  )
}
