import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import {
  extractApiErrors,
  useResendVerification,
  useVerifyEmail,
} from '#/lib/auth'
import TextField from '#/components/TextField'
import FormErrors from '#/components/FormErrors'
import { Button } from '#/components/ui/button'
import { seo } from '#/lib/seo'

/**
 * Where a signup verification link lands (AUDIT.md G1).
 *
 * Deliberately absent from `sitemap.ts`: the page is only reachable from
 * an emailed link, and prerendering a page whose whole job is to consume
 * a one-time token would put an empty shell in the index.
 */
export const Route = createFileRoute('/_app/verify-email')({
  head: () =>
    seo({
      title: 'Verify your email',
      description:
        'Confirm your email address to finish setting up your Kalooki Online account.',
      path: '/verify-email',
      noindex: true,
    }),
  /**
   * The token arrives in the query string. Anything else is treated as
   * absent, which falls through to the resend form rather than erroring.
   *
   * The key is omitted rather than set to undefined when there is no
   * token, so the router treats it as optional and links to this page
   * do not have to pass a `search` prop.
   */
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search.token === 'string' ? { token: search.token } : {},
  component: VerifyEmailPage,
})

const emailSchema = z.string().min(1, 'Enter your email address')

type VerifyStatus = 'idle' | 'verifying' | 'verified' | 'failed'

function VerifyEmailPage() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const verifyEmail = useVerifyEmail()
  const resendVerification = useResendVerification()

  const [status, setStatus] = useState<VerifyStatus>(token ? 'verifying' : 'idle')
  const [errors, setErrors] = useState<string[]>([])
  const [signedIn, setSignedIn] = useState(false)
  const [resent, setResent] = useState(false)

  // Guards the effect against React's development double-invoke. The
  // token is single-use, so a second redemption would always fail and
  // flip a genuine success into an error.
  const attempted = useRef(false)

  useEffect(() => {
    if (!token || attempted.current) {
      return
    }
    attempted.current = true

    verifyEmail
      .mutateAsync({ token })
      .then((data) => {
        setSignedIn(data.token !== null)
        setStatus('verified')
      })
      .catch((error: unknown) => {
        setErrors(extractApiErrors(error))
        setStatus('failed')
      })
    // Keyed on the token alone: the mutation and setters are stable,
    // and the ref above is what actually keeps this to one attempt.
  }, [token])

  const resendForm = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      setErrors([])
      setResent(false)
      try {
        await resendVerification.mutateAsync(value)
        setResent(true)
      } catch (error) {
        setErrors(extractApiErrors(error))
      }
    },
  })

  return (
    <div className="page-wrap flex justify-center py-12 sm:py-20">
      <section className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="m-0 text-xl font-bold">Verify your email</h1>

        {status === 'verifying' && (
          <p className="mt-4 text-sm text-muted-foreground">
            Checking your link…
          </p>
        )}

        {status === 'verified' && (
          <div className="mt-4 space-y-4">
            <p className="text-sm">
              Your email address is confirmed.{' '}
              {signedIn
                ? 'You are signed in and ready to play.'
                : 'Sign in to start playing.'}
            </p>
            <Button
              className="w-full"
              onClick={() => {
                void navigate({ to: signedIn ? '/play' : '/signin' })
              }}
            >
              {signedIn ? 'Start playing' : 'Go to sign in'}
            </Button>
          </div>
        )}

        {(status === 'idle' || status === 'failed') && (
          <div className="mt-4 space-y-4">
            {status === 'failed' && <FormErrors errors={errors} />}

            <p className="text-sm text-muted-foreground">
              {status === 'failed'
                ? 'That link is no longer valid. Links expire after 24 hours and can only be used once. Enter your email address and we will send a fresh one.'
                : 'Enter the email address you signed up with and we will send you a new verification link.'}
            </p>

            {resent ? (
              <p className="text-sm">
                If that address has an account awaiting verification, a new link
                is on its way. Check your spam folder if it does not arrive.
              </p>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void resendForm.handleSubmit()
                }}
              >
                {status !== 'failed' && <FormErrors errors={errors} />}

                <resendForm.Field
                  name="email"
                  validators={{ onBlur: emailSchema }}
                >
                  {(field) => (
                    <TextField
                      field={field}
                      label="Email address"
                      type="email"
                      autoComplete="email"
                    />
                  )}
                </resendForm.Field>

                <resendForm.Subscribe
                  selector={(state) => state.isSubmitting}
                >
                  {(isSubmitting) => (
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Sending…' : 'Send a new link'}
                    </Button>
                  )}
                </resendForm.Subscribe>
              </form>
            )}
          </div>
        )}

        <p className="mt-6 text-sm text-muted-foreground">
          <Link
            to="/signin"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </p>
      </section>
    </div>
  )
}
