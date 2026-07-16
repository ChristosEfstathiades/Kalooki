import { createFileRoute } from '@tanstack/react-router'
import ContentPage, { ContentSection } from '#/components/ContentPage'

export const Route = createFileRoute('/_app/rules')({
  component: RulesPage,
})

/**
 * The full how-to-play page, following the standard game described in
 * docs/Kalooki.md. Public matches always use these rules; private
 * matches can customise timers, decks, jokers, and the come-down total.
 */
function RulesPage() {
  return (
    <ContentPage
      title="How to play Kalooki"
      intro="Kalooki is a Rummy-family game played with 2 decks and 2 jokers (106 cards) for 2 to 6 players. A game is a series of rounds; the cards left in your hand at the end of each round become penalty points, and the last player under the limit wins."
    >
      <ContentSection heading="Card values">
        <ul className="m-0 list-disc space-y-1 pl-5">
          <li>Aces: 11 points</li>
          <li>Picture cards: 10 points</li>
          <li>10 down to 2: face value</li>
          <li>Jokers: 15 points</li>
        </ul>
      </ContentSection>

      <ContentSection heading="Sets">
        <p className="m-0">
          You reduce your hand by forming sets of 3 or more cards, either as
          groups or runs:
        </p>
        <ul className="m-0 list-disc space-y-1 pl-5">
          <li>
            A <strong>group</strong> is 3 or 4 cards of the same value in
            different suits, never two cards of the same suit.
          </li>
          <li>
            A <strong>run</strong> is 3 or more consecutive cards in one suit.
            The lowest run is 2-3-4 and the highest is Q-K-A; an ace can never
            start a low run (A-2-3 is not allowed).
          </li>
        </ul>
      </ContentSection>

      <ContentSection heading="The deal and your turn">
        <p className="m-0">
          Each player is dealt 13 cards, and the rest of the cards form the
          face-down deck. The player left of the dealer goes first.
        </p>
        <p className="m-0">
          On your turn you <strong>draw</strong> one card, from the top of the
          deck or the top card of the discard pile, and end your turn by{' '}
          <strong>discarding</strong> one card. A discard can only be taken if
          you use it in a set laid on the table immediately; you cannot take it
          to hold for later.
        </p>
      </ContentSection>

      <ContentSection heading="Coming down at 40 points">
        <p className="m-0">
          Once the sets in your hand are worth{' '}
          <strong>40 points or more</strong>, you may lay them face up on the
          table; this is called <em>coming down</em>, and when to do it is up
          to you. After you have come down, you can table sets of any value for
          the rest of the round.
        </p>
      </ContentSection>

      <ContentSection heading="Go-ers">
        <p className="m-0">
          After coming down you can also add single cards, <em>go-ers</em>, to
          any set already on the table, yours or an opponent&apos;s: extend a
          run, or turn a group of 3 into a group of 4. A card taken from the
          discard pile can never be used as a go-er.
        </p>
      </ContentSection>

      <ContentSection heading="Jokers">
        <p className="m-0">
          A joker stands in for any card, in a set or as a go-er, and it must be
          clear which card it represents. A joker left in your hand at the end
          of a round costs the full 15 points.
        </p>
        <p className="m-0">
          A joker in a tabled group can be reclaimed by a player who has come
          down; <strong>both</strong> natural replacement cards are required to
          take it (this site uses the stricter, widely played variant). A joker
          in a run is taken with its exact natural card. A reclaimed joker must
          be used in a new set immediately: it cannot be kept in hand or placed
          as a go-er.
        </p>
      </ContentSection>

      <ContentSection heading="Winning a round: calling up">
        <p className="m-0">
          The first player to table all 13 cards and make a final discard{' '}
          <em>calls up</em> and scores nothing for the round. Everyone else adds
          up the cards still in their hand as penalty points. When you are down
          to one card, the site announces <em>&quot;last card&quot;</em> for
          you.
        </p>
      </ContentSection>

      <ContentSection heading="Winning the game">
        <p className="m-0">
          Scores accumulate across rounds. Go past{' '}
          <strong>150 penalty points</strong> and you are out of the game
          unless you use your one <em>buy-in</em>, which lets you rejoin on the
          same score as the highest remaining player. Buy-ins are not allowed
          once only two players remain. The last player still under the limit
          wins.
        </p>
      </ContentSection>

      <ContentSection heading="Timers, disconnects, and rejoining">
        <ul className="m-0 list-disc space-y-1 pl-5">
          <li>
            You get a <strong>30-minute bank</strong> of thinking time for the
            whole game. If it runs out, you get 60 seconds per turn; run that
            out and you are removed from the game and your cards are shuffled
            back into the deck.
          </li>
          <li>
            If you disconnect, the game pauses and you have{' '}
            <strong>5 minutes</strong> to rejoin. Disconnecting again does not
            reset the timer; you get whatever time was left.
          </li>
        </ul>
      </ContentSection>

      <ContentSection heading="Custom rules in private games">
        <p className="m-0">
          Private matches can adjust, before the game starts:
        </p>
        <ul className="m-0 list-disc space-y-1 pl-5">
          <li>Move and rejoin timers</li>
          <li>Number of decks (2–4)</li>
          <li>Number of jokers (0–4)</li>
          <li>Points needed to come down (default 40)</li>
          <li>Buy-ins per player (none to unlimited, default 1)</li>
          <li>Play money (see below)</li>
        </ul>
        <p className="m-0">
          Public matches always use the classic rules on this page.
        </p>
      </ContentSection>

      <ContentSection heading="Play money in private games">
        <p className="m-0">
          A private game can be played for <strong>chips</strong>: play money
          tracked on the scoresheet, never a real balance. The host sets four
          amounts before the game:
        </p>
        <ul className="m-0 list-disc space-y-1 pl-5">
          <li>
            <strong>Stake</strong>: put up by every player; the winner
            collects them all at the end.
          </li>
          <li>
            <strong>Buy-in cost</strong>: paid for each buy-in used, also
            collected by the winner.
          </li>
          <li>
            <strong>Each call</strong>: paid to the round&apos;s caller by
            every other player still in the game, round by round.
          </li>
          <li>
            <strong>Kalooki</strong>: paid instead of the call amount when
            the caller lays all thirteen cards in a single turn.
          </li>
        </ul>
        <p className="m-0">
          Chips are settled on the final scoresheet and saved to your match
          history; nothing carries over between games.
        </p>
      </ContentSection>
    </ContentPage>
  )
}
