import { createFileRoute } from '@tanstack/react-router'
import ContentPage, { ContentSection } from '#/components/ContentPage'

export const Route = createFileRoute('/_app/privacy')({
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <ContentPage
      title="Privacy policy"
      intro="What KalookiOnline stores about you, why, and for how long."
    >
      <ContentSection heading="What we collect">
        <ul className="m-0 list-disc space-y-1 pl-5">
          <li>
            <strong>Account details</strong>: your email address, username, a
            hashed password, and an optional profile photo. We never store your
            password in readable form.
          </li>
          <li>
            <strong>Gameplay records</strong>: the matches you play, including
            scores, placements, and the rules in effect. Match records are
            visible only to the players who took part and are kept indefinitely.
          </li>
          <li>
            <strong>Chat messages</strong>: messages in the global chatroom and
            in group chats are stored for 30 days and then deleted automatically.
          </li>
          <li>
            <strong>Social connections</strong>: your friends list, friend
            requests, and group memberships.
          </li>
        </ul>
      </ContentSection>

      <ContentSection heading="How we use it">
        <p className="m-0">
          Your data is used to run the service: signing you in, matching you
          into games, showing match history to participants, and moderating
          chat. Reported messages are reviewed by moderators. We do not sell
          your data or use it for advertising.
        </p>
      </ContentSection>

      <ContentSection heading="Your choices">
        <ul className="m-0 list-disc space-y-1 pl-5">
          <li>You can remove friends and leave groups at any time.</li>
          <li>Your profile photo is optional and can be changed or removed.</li>
          <li>
            To delete your account and its data, contact{' '}
            <a
              href="mailto:support@kalookionline.com"
              className="font-medium underline underline-offset-4"
            >
              support@kalookionline.com
            </a>
            .
          </li>
        </ul>
      </ContentSection>

      <ContentSection heading="Cookies and storage">
        <p className="m-0">
          We use browser storage only to keep you signed in: a session token,
          stored persistently when you choose &quot;remember me&quot;. There are
          no third-party tracking cookies.
        </p>
      </ContentSection>
    </ContentPage>
  )
}
