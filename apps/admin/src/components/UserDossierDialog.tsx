import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { userDossierQueryOptions } from '#/lib/admin'
import Button from '#/components/Button'
import ModerationEntry from '#/components/ModerationEntry'
import StatusPill from '#/components/StatusPill'
import { formatDateTime } from '#/lib/utils'

interface UserDossierDialogProps {
  userId: number
  onClose: () => void
}

/**
 * Everything on record about one account, on one screen: their play
 * record, their recent chat, the reports for and against them, and
 * their moderation history — so a ban or mute is decided on the record
 * rather than on the single message that happened to be reported.
 */
export default function UserDossierDialog({
  userId,
  onClose,
}: UserDossierDialogProps) {
  const dossier = useQuery(userDossierQueryOptions(userId))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="User dossier"
      className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
    >
      <div className="w-full max-w-4xl rounded-lg border border-edge bg-panel">
        <header className="sticky top-0 flex items-center gap-3 rounded-t-lg border-b border-edge bg-panel px-4 py-3">
          <h2 className="m-0 mr-auto text-sm font-semibold">
            {dossier.data?.user.username ?? 'Loading…'}
            {dossier.data?.isOnline && (
              <span className="ml-2">
                <StatusPill label="Online" tone="ok" />
              </span>
            )}
          </h2>
          <Button size="sm" variant="outline" onClick={onClose}>
            <X aria-hidden="true" />
            Close
          </Button>
        </header>

        {dossier.isPending && (
          <p className="m-0 px-4 py-12 text-center text-sm text-ink-soft">
            Loading the dossier…
          </p>
        )}

        {dossier.data && (
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <Panel title="Account">
              <DataRow label="Email" value={dossier.data.user.email} />
              <DataRow label="Role" value={dossier.data.user.role} />
              <DataRow
                label="Joined"
                value={formatDateTime(dossier.data.user.createdAt)}
              />
              <DataRow
                label="Email verified"
                value={
                  dossier.data.user.emailVerifiedAt === null
                    ? 'No'
                    : formatDateTime(dossier.data.user.emailVerifiedAt)
                }
              />
              <DataRow
                label="Ban"
                value={
                  dossier.data.user.isBanned
                    ? `${formatDateTime(dossier.data.user.bannedAt)}${dossier.data.user.banReason ? ` — ${dossier.data.user.banReason}` : ''}`
                    : 'Not banned'
                }
              />
              <DataRow
                label="Mute"
                value={
                  dossier.data.user.isMuted
                    ? dossier.data.user.mutedUntil === null
                      ? 'Permanent'
                      : `Until ${formatDateTime(dossier.data.user.mutedUntil)}`
                    : 'Not muted'
                }
              />
              <DataRow
                label="Leaderboard"
                value={
                  dossier.data.user.excludedFromLeaderboard
                    ? 'Excluded'
                    : 'Eligible'
                }
              />
              <DataRow
                label="Social"
                value={`${dossier.data.social.friends} friends · ${dossier.data.social.groups} groups`}
              />
            </Panel>

            <Panel title="Record">
              <DataRow
                label="Public matches"
                value={`${dossier.data.play.publicMatches.played} played · ${dossier.data.play.publicMatches.wins} won · ${Math.round(dossier.data.play.publicWinRate * 100)}% win rate`}
              />
              <DataRow
                label="Private matches"
                value={`${dossier.data.play.privateMatches.played} played · ${dossier.data.play.privateMatches.wins} won`}
              />
              <DataRow
                label="Practice"
                value={`${dossier.data.play.practiceMatches.played} played`}
              />
              <DataRow
                label="Left early"
                value={`${dossier.data.play.publicMatches.abandoned + dossier.data.play.privateMatches.abandoned} matches`}
              />
              <DataRow
                label="Messages"
                value={`${dossier.data.reports.messagesPosted} posted · ${dossier.data.reports.messagesCensored} censored · ${dossier.data.reports.messagesDeleted} deleted`}
              />
              <DataRow
                label="Reports against"
                value={`${dossier.data.reports.reportsAgainst} on ${dossier.data.reports.reportedMessages} messages · ${dossier.data.reports.openReportsAgainst} open · ${dossier.data.reports.actionedReportsAgainst} actioned`}
              />
              <DataRow
                label="Reports filed"
                value={`${dossier.data.reports.reportsFiled}`}
              />
            </Panel>

            <Panel title="Recent chat">
              {dossier.data.recentMessages.length === 0 && (
                <p className="m-0 py-4 text-center text-sm text-ink-soft">
                  Nothing in the global or in-game chats.
                </p>
              )}
              <ul className="m-0 list-none p-0">
                {dossier.data.recentMessages.map((message) => (
                  <li
                    key={message.id}
                    className="border-b border-edge py-2 last:border-b-0"
                  >
                    <div className="flex items-baseline gap-2 text-xs text-ink-soft">
                      <StatusPill
                        label={
                          message.channel === 'match' ? 'In-game' : 'Global'
                        }
                      />
                      {message.wasCensored && (
                        <StatusPill label="Censored" tone="warn" />
                      )}
                      {message.deletedAt !== null && (
                        <StatusPill label="Deleted" tone="danger" />
                      )}
                      {message.reportCount > 0 && (
                        <StatusPill
                          label={`${message.reportCount} ${message.reportCount === 1 ? 'report' : 'reports'}`}
                          tone="warn"
                        />
                      )}
                      <span className="ml-auto whitespace-nowrap">
                        {formatDateTime(message.createdAt)}
                      </span>
                    </div>
                    <p className="m-0 font-mono text-sm break-words">
                      {message.body}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Recent matches">
              {dossier.data.recentMatches.length === 0 && (
                <p className="m-0 py-4 text-center text-sm text-ink-soft">
                  No recorded matches.
                </p>
              )}
              <ul className="m-0 list-none p-0">
                {dossier.data.recentMatches.map((match) => (
                  <li
                    key={match.id}
                    className="flex items-baseline gap-2 border-b border-edge py-1.5 text-sm last:border-b-0"
                  >
                    <StatusPill label={match.kind} />
                    <span>
                      {match.placement === 1
                        ? 'Won'
                        : `Placed ${match.placement}`}{' '}
                      · {match.finalScore} pts
                    </span>
                    {match.leftEarly && (
                      <StatusPill label="Left early" tone="warn" />
                    )}
                    <span className="ml-auto text-xs whitespace-nowrap text-ink-soft">
                      {formatDateTime(match.endedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Moderation received">
              {dossier.data.actionsReceived.length === 0 && (
                <p className="m-0 py-4 text-center text-sm text-ink-soft">
                  Never moderated.
                </p>
              )}
              <ul className="m-0 -mx-4 list-none p-0">
                {dossier.data.actionsReceived.map((entry) => (
                  <ModerationEntry key={entry.id} entry={entry} />
                ))}
              </ul>
            </Panel>

            {dossier.data.actionsTaken.length > 0 && (
              <Panel title="Moderation taken">
                <ul className="m-0 -mx-4 list-none p-0">
                  {dossier.data.actionsTaken.map((entry) => (
                    <ModerationEntry key={entry.id} entry={entry} />
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface PanelProps {
  title: string
  children: React.ReactNode
}

/** One titled block of the dossier. */
function Panel({ title, children }: PanelProps) {
  return (
    <section className="thin-scrollbar max-h-96 overflow-y-auto rounded-md border border-edge bg-surface px-4 py-3">
      <h3 className="mt-0 mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

interface DataRowProps {
  label: string
  value: string
}

/** One label/value line in the account and record panels. */
function DataRow({ label, value }: DataRowProps) {
  return (
    <p className="m-0 flex gap-2 border-b border-edge py-1 text-sm last:border-b-0">
      <span className="w-32 shrink-0 text-ink-soft">{label}</span>
      <span className="min-w-0 break-words">{value}</span>
    </p>
  )
}
