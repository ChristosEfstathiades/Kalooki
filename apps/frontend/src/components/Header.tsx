import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Menu, Settings } from 'lucide-react'
import { currentUserQueryOptions } from '#/lib/auth'
import UserAvatar from '#/components/UserAvatar'
import OnlineCount from '#/components/OnlineCount'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'

interface HeaderMenuProps {
  showSettings: boolean
}

/** Shared look for the rows inside the mobile menu */
const menuLinkClassName =
  'flex items-center justify-center gap-2 rounded-md px-4 py-3 text-base font-medium text-muted-foreground hover:bg-accent hover:text-foreground'

/**
 * The mobile-only hamburger menu, holding the links that the header hides
 * on narrow screens. Takes the place of the settings cog below `sm` and
 * opens as a modal in the middle of the screen.
 */
function HeaderMenu({ showSettings }: HeaderMenuProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Menu"
          className="sm:hidden"
        >
          <Menu aria-hidden="true" className="size-6" />
        </Button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="w-[calc(100%-3rem)] max-w-xs gap-0 p-4"
      >
        {/* The title gives the close button a row of its own, clear of
            the links below it */}
        <DialogTitle className="pb-3 text-sm font-semibold text-muted-foreground">
          Menu
        </DialogTitle>
        {/* Each row closes the menu as well as navigating, since the
            router keeps the page mounted underneath */}
        <nav className="flex flex-col border-t border-border pt-2">
          <DialogClose asChild>
            <Link
              to="/rules"
              className={menuLinkClassName}
              activeProps={{ className: 'text-foreground' }}
            >
              How to play
            </Link>
          </DialogClose>
          <DialogClose asChild>
            <Link
              to="/tips"
              className={menuLinkClassName}
              activeProps={{ className: 'text-foreground' }}
            >
              Tips
            </Link>
          </DialogClose>
          {showSettings ? (
            <>
              <div className="my-1 h-px bg-border" />
              <DialogClose asChild>
                <Link
                  to="/settings"
                  className={menuLinkClassName}
                  activeProps={{ className: 'text-foreground' }}
                >
                  <Settings aria-hidden="true" className="size-5" />
                  Settings
                </Link>
              </DialogClose>
            </>
          ) : null}
        </nav>
      </DialogContent>
    </Dialog>
  )
}

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
          <OnlineCount />
          {/* Below `sm` these move into the hamburger menu on the right */}
          <nav className="hidden items-center gap-4 text-sm sm:flex">
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
            <Button
              asChild
              variant="ghost"
              size="icon"
              aria-label="Settings"
              className="hidden sm:inline-flex"
            >
              <Link to="/settings">
                <Settings aria-hidden="true" />
              </Link>
            </Button>
            <HeaderMenu showSettings />
          </div>
        ) : (
          <div className="flex items-center gap-2">
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
            <HeaderMenu showSettings={false} />
          </div>
        )}
      </div>
    </header>
  )
}
