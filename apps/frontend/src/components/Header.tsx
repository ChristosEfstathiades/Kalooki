import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Settings } from 'lucide-react'
import { currentUserQueryOptions } from '#/lib/auth'
import UserAvatar from '#/components/UserAvatar'
import OnlineCount from '#/components/OnlineCount'
import { Button } from '#/components/ui/button'

/**
 * Site header: wordmark, the live online-player count and the two
 * learn-the-game pages on the left, the signed-in user's identity and a
 * link to settings on the right. Shown on every page except the welcome
 * and gameplay pages (docs/Frontend-design.md).
 */
export default function Header() {
  const { data: user } = useQuery(currentUserQueryOptions)

  return (
    <header className="border-b border-border bg-panel">
      <div className="page-wrap flex h-14 items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-lg font-bold tracking-tight">
            Kalooki<span className="text-button-red">Online</span>
          </Link>
          <OnlineCount className="hidden sm:flex" />
          {/* The online count hides on the narrowest screens; these stay,
              since they are the way in for someone still learning */}
          <nav className="flex items-center gap-4 text-sm">
            <Link
              to="/rules"
              className="text-muted-foreground hover:text-foreground"
              activeProps={{ className: 'text-foreground' }}
            >
              How to play
            </Link>
            <Link
              to="/tips"
              className="text-muted-foreground hover:text-foreground"
              activeProps={{ className: 'text-foreground' }}
            >
              Tips
            </Link>
          </nav>
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <UserAvatar user={user} />
              <span className="hidden text-sm font-medium sm:inline">
                {user.username}
              </span>
            </span>
            <Button asChild variant="ghost" size="icon" aria-label="Settings">
              <Link to="/settings">
                <Settings aria-hidden="true" />
              </Link>
            </Button>
          </div>
        ) : (
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/signin">Sign in</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-button-red hover:bg-button-red-hover"
            >
              <Link to="/signup">Create account</Link>
            </Button>
          </nav>
        )}
      </div>
    </header>
  )
}
