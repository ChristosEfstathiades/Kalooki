import { Outlet, createFileRoute } from '@tanstack/react-router'
import Header from '#/components/Header'
import Footer from '#/components/Footer'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

/**
 * Layout for every page except the welcome and gameplay pages: header
 * on top, footer at the bottom (docs/Frontend-design.md).
 */
function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
