import { createFileRoute } from '@tanstack/react-router'
import ContentPage, { ContentSection } from '#/components/ContentPage'

export const Route = createFileRoute('/_app/tips')({
  component: TipsPage,
})

function TipsPage() {
  return (
    <ContentPage
      title="Tips and tricks"
      intro="Kalooki rewards patience and card counting more than luck. A few habits that win games:"
    >
      <ContentSection heading="Watch the discard pile">
        <p className="m-0">
          Every discard tells you what your opponents are not collecting. If the
          player before you keeps throwing hearts, your heart runs are safer to
          chase, and your heart discards are safer to make.
        </p>
      </ContentSection>

      <ContentSection heading="Don't come down too early">
        <p className="m-0">
          Tabling exactly 40 points the moment you can is often a mistake: it
          shows your hand and hands opponents go-er targets. If your hand is
          strong, hold on and come down big, but balance that against the risk
          of being caught with everything if someone calls up.
        </p>
      </ContentSection>

      <ContentSection heading="Count the high cards you hold">
        <p className="m-0">
          Aces and jokers are 11 and 15 penalty points each. Holding two jokers
          into the endgame is a 30-point gamble; dump expensive cards early
          when a round starts going against you.
        </p>
      </ContentSection>

      <ContentSection heading="Track the jokers on the table">
        <p className="m-0">
          A tabled joker can be reclaimed if you have come down and hold both
          natural replacement cards. If you have one of them, the second is
          worth drawing for; a free joker can flip a round.
        </p>
      </ContentSection>

      <ContentSection heading="Mind the deck, not just your hand">
        <p className="m-0">
          Two decks mean every card exists twice. Before waiting on a card, ask
          how many copies you have already seen tabled or discarded; waiting on
          a card that is already gone loses rounds.
        </p>
      </ContentSection>

      <ContentSection heading="Save your buy-in">
        <p className="m-0">
          You only get one. Buying back in early in the game buys you the most
          remaining play, but buying in while three or more strong players
          remain can just delay the inevitable; sometimes the better play is
          accepting a loss and starting fresh.
        </p>
      </ContentSection>
    </ContentPage>
  )
}
