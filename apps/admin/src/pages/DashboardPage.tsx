import { useState } from 'react'
import AppShell from '#/components/AppShell'
import UserDossierDialog from '#/components/UserDossierDialog'
import UsersTable from '#/components/UsersTable'
import AuditPage from '#/pages/AuditPage'
import ChatPage from '#/pages/ChatPage'
import NewsPage from '#/pages/NewsPage'
import OverviewPage from '#/pages/OverviewPage'
import ReportsPage from '#/pages/ReportsPage'
import SettingsPage from '#/pages/SettingsPage'
import StatsPage from '#/pages/StatsPage'
import { useAdminSection } from '#/lib/router'
import type { CurrentUser } from '#/lib/auth'

interface DashboardPageProps {
  currentAdmin: CurrentUser
}

/**
 * The admin dashboard: the shell plus whichever section the hash names.
 *
 * The user dossier is owned here rather than by each section, because
 * several of them (reports, chat, users) open it for a user they are
 * showing, and it should behave the same however it was reached.
 */
export default function DashboardPage({ currentAdmin }: DashboardPageProps) {
  const section = useAdminSection()
  const [dossierUserId, setDossierUserId] = useState<number | null>(null)

  return (
    <AppShell currentAdmin={currentAdmin} section={section}>
      {section === 'overview' && <OverviewPage />}
      {section === 'reports' && (
        <ReportsPage onInspectUser={setDossierUserId} />
      )}
      {section === 'users' && (
        <UsersTable
          currentAdmin={currentAdmin}
          onInspectUser={setDossierUserId}
        />
      )}
      {section === 'chat' && <ChatPage onInspectUser={setDossierUserId} />}
      {section === 'audit' && <AuditPage />}
      {section === 'news' && <NewsPage />}
      {section === 'settings' && <SettingsPage />}
      {section === 'stats' && <StatsPage />}

      {dossierUserId !== null && (
        <UserDossierDialog
          userId={dossierUserId}
          onClose={() => setDossierUserId(null)}
        />
      )}
    </AppShell>
  )
}
