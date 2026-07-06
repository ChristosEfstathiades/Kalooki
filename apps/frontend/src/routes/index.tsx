import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Clock, MessageSquare, Shuffle, Users } from 'lucide-react'
import { getStoredToken } from '#/lib/auth-token'
import Footer from '#/components/Footer'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    // Signed-in players skip the marketing page and go straight to play
    if (getStoredToken()) {
      throw redirect({ to: '/play' })
    }
  },
  component: WelcomePage,
})

const features = [
  {
    icon: Shuffle,
    title: 'Public matches',
    description:
      'Jump into a game against other players any time. Every public match uses the classic ruleset, so you always know what you are playing.',
  },
  {
    icon: Users,
    title: 'Private games with friends',
    description:
      'Create a group, invite your friends, and set your own rules — decks, jokers, timers, and the points you need to come down.',
  },
  {
    icon: MessageSquare,
    title: 'Chat while you play',
    description:
      'A global chatroom for everyone and a private chat in every group. Talk between hands or plan the next game night.',
  },
  {
    icon: Clock,
    title: 'Match history',
    description:
      'Every game is recorded: winners, round-by-round scores, and placements. Only the players in a match can see it.',
  },
]

const rulesDigest = [
  {
    heading: 'The deal',
    body: 'Kalooki is played with 2 decks and 2 jokers — 106 cards — for 2 to 6 players. Each player is dealt 13 cards.',
  },
  {
    heading: 'Your turn',
    body: 'Draw a card from the deck or take the top discard, then discard one to end your turn. A discard can only be taken if you use it in a set immediately.',
  },
  {
    heading: 'Coming down',
    body: 'Build sets — groups of 3–4 cards of the same value in different suits, or runs of 3+ cards in one suit. Once your sets are worth 40 or more points you can lay them on the table.',
  },
  {
    heading: 'Winning',
    body: 'First player to table and discard all 13 cards wins the round. Everyone else scores penalty points for cards left in hand — go over 150 and you are out. Last player standing wins the game.',
  },
]

function WelcomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <section className="page-wrap py-16 sm:py-24">
          <p className="m-0 text-sm font-semibold tracking-widest text-muted-foreground uppercase">
            KalookiOnline
          </p>
          <h1 className="mt-3 mb-0 max-w-2xl text-4xl font-bold sm:text-5xl">
            Play Kalooki online, in real time
          </h1>
          <p className="mt-4 mb-8 max-w-xl text-lg text-muted-foreground">
            The classic Rummy card game loved in the UK, Jamaica, and Cyprus.
            Public matches against other players, or private games with friends
            under your own rules.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-button-red hover:bg-button-red-hover"
            >
              <Link to="/signup">Play now — it&apos;s free</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/signin">I already have an account</Link>
            </Button>
          </div>
        </section>

        <section className="border-y border-border bg-panel py-12">
          <div className="page-wrap grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <article key={feature.title}>
                <feature.icon
                  aria-hidden="true"
                  className="size-5 text-muted-foreground"
                />
                <h2 className="mt-3 mb-1 text-base font-semibold">
                  {feature.title}
                </h2>
                <p className="m-0 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="page-wrap py-12 sm:py-16">
          <h2 className="m-0 text-2xl font-bold">How Kalooki works</h2>
          <p className="mt-2 mb-8 text-sm text-muted-foreground">
            The short version — the{' '}
            <Link to="/rules" className="underline underline-offset-4">
              full rules
            </Link>{' '}
            cover jokers, go-ers, calling up, and scoring.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            {rulesDigest.map((rule, index) => (
              <article
                key={rule.heading}
                className="rounded-lg border border-border bg-card p-5"
              >
                <h3 className="m-0 text-sm font-semibold text-muted-foreground">
                  {index + 1}. {rule.heading}
                </h3>
                <p className="mt-2 mb-0 text-sm">{rule.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
