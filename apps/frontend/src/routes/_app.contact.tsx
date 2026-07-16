import { createFileRoute } from '@tanstack/react-router'
import ContentPage, { ContentSection } from '#/components/ContentPage'

export const Route = createFileRoute('/_app/contact')({
  component: ContactPage,
})

function ContactPage() {
  return (
    <ContentPage
      title="Contact and support"
      intro="Questions, bug reports, or trouble with your account: get in touch and we'll help."
    >
      <ContentSection heading="Email">
        <p className="m-0">
          Write to{' '}
          <a
            href="mailto:support@kalookionline.com"
            className="font-medium underline underline-offset-4"
          >
            support@kalookionline.com
          </a>{' '}
          and include the username you play under. We aim to reply within two
          working days.
        </p>
      </ContentSection>

      <ContentSection heading="Reporting players or messages">
        <p className="m-0">
          Abusive chat messages can be reported directly from the chat; reports
          go straight to the moderators. For anything that needs more context,
          email us with the approximate time it happened and the players
          involved.
        </p>
      </ContentSection>

      <ContentSection heading="Account problems">
        <p className="m-0">
          If you cannot sign in or think someone else has used your account,
          email us from the address you registered with and we will look into
          it.
        </p>
      </ContentSection>
    </ContentPage>
  )
}
