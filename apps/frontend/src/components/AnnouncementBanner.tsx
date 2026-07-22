import { AlertTriangle, Megaphone } from 'lucide-react'
import { useAnnouncement, useSiteStatusLiveUpdates } from '#/lib/site'
import { cn } from '#/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { AnnouncementTone } from '#/lib/site'

/** Styling and icon per tone, from a passing notice to an outage. */
const TONE_STYLES: Record<
  AnnouncementTone,
  { className: string; icon: LucideIcon; label: string }
> = {
  info: {
    className: 'bg-button-purple text-white',
    icon: Megaphone,
    label: 'Announcement',
  },
  warning: {
    className: 'bg-amber-500 text-black',
    icon: AlertTriangle,
    label: 'Warning',
  },
  critical: {
    className: 'bg-button-red text-white',
    icon: AlertTriangle,
    label: 'Important',
  },
}

/**
 * Site-wide notice raised by an admin, shown above the header on every
 * page. Mounting this also subscribes to live updates, so a banner
 * raised while the page is open appears without a refresh.
 */
export default function AnnouncementBanner() {
  useSiteStatusLiveUpdates()
  const announcement = useAnnouncement()

  if (!announcement) {
    return null
  }

  const tone = TONE_STYLES[announcement.tone]
  const Icon = tone.icon

  return (
    <div
      role="status"
      className={cn('px-4 py-2 text-sm font-medium', tone.className)}
    >
      <div className="page-wrap flex items-center gap-2">
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        <span className="sr-only">{tone.label}: </span>
        <p className="m-0">{announcement.body}</p>
      </div>
    </div>
  )
}
