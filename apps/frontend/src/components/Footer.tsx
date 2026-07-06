import { Link } from '@tanstack/react-router'

/**
 * Site footer: content-page links and copyright. Shown on every page
 * except the gameplay page (docs/Frontend-design.md).
 */
export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border py-8 text-sm text-muted-foreground">
      <div className="page-wrap flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link
            to="/rules"
            className="text-muted-foreground hover:text-foreground"
          >
            How to play
          </Link>
          <Link
            to="/tips"
            className="text-muted-foreground hover:text-foreground"
          >
            Tips &amp; tricks
          </Link>
          <Link
            to="/contact"
            className="text-muted-foreground hover:text-foreground"
          >
            Contact
          </Link>
          <Link
            to="/privacy"
            className="text-muted-foreground hover:text-foreground"
          >
            Privacy policy
          </Link>
        </nav>
        <p className="m-0">&copy; {year} KalookiOnline. All rights reserved.</p>
      </div>
    </footer>
  )
}
