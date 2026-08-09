import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  Flag,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Newspaper,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { useAdminSignout } from '#/lib/auth'
import { openReportCountQueryOptions } from '#/lib/reports'
import { sectionHref } from '#/lib/router'
import Button from '#/components/Button'
import { cn } from '#/lib/utils'
import type { ReactNode } from 'react'
import type { AdminSection } from '#/lib/router'
import type { CurrentUser } from '#/lib/auth'

interface NavItem {
  section: AdminSection
  label: string
  icon: typeof LayoutDashboard
}

const NAV_ITEMS: NavItem[] = [
  { section: 'overview', label: 'Overview', icon: LayoutDashboard },
  { section: 'reports', label: 'Reports', icon: Flag },
  { section: 'users', label: 'Users', icon: Users },
  { section: 'chat', label: 'Chat', icon: MessagesSquare },
  { section: 'audit', label: 'Audit log', icon: ScrollText },
  { section: 'news', label: 'News', icon: Newspaper },
  { section: 'settings', label: 'Settings', icon: SlidersHorizontal },
  { section: 'stats', label: 'Stats', icon: BarChart3 },
]

interface AppShellProps {
  currentAdmin: CurrentUser
  section: AdminSection
  children: ReactNode
}

/**
 * The frame around every admin section: the header with the signed-in
 * admin, and the sidebar navigation. The report queue's badge is shown
 * here rather than on the queue itself, so an admin sitting on another
 * section still notices work arriving.
 */
export default function AppShell({
  currentAdmin,
  section,
  children,
}: AppShellProps) {
  const signout = useAdminSignout()
  const openReports = useQuery(openReportCountQueryOptions)

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-edge bg-panel px-4 py-3">
        <ShieldCheck aria-hidden="true" className="size-5 text-ink-soft" />
        <h1 className="m-0 mr-auto text-base font-semibold">Kalooki Admin</h1>
        <span className="text-sm text-ink-soft">{currentAdmin.username}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => signout.mutate()}
          disabled={signout.isPending}
        >
          <LogOut aria-hidden="true" />
          Sign out
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav
          aria-label="Admin sections"
          className="thin-scrollbar shrink-0 overflow-x-auto border-b border-edge bg-panel lg:w-52 lg:border-r lg:border-b-0"
        >
          <ul className="m-0 flex list-none gap-1 p-2 lg:flex-col">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = item.section === section
              const badge =
                item.section === 'reports' && (openReports.data ?? 0) > 0
                  ? openReports.data
                  : null

              return (
                <li key={item.section}>
                  <a
                    href={sectionHref(item.section)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors',
                      isActive
                        ? 'bg-accent text-ink'
                        : 'text-ink-soft hover:bg-panel-raised hover:text-ink',
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    {item.label}
                    {badge !== null && (
                      <span className="ml-auto rounded-full bg-danger px-1.5 py-0.5 text-[0.6875rem] font-semibold text-ink">
                        {badge}
                      </span>
                    )}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 p-4">{children}</main>
      </div>
    </div>
  )
}
