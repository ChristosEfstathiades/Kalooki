import { useState } from 'react'
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { extractApiErrors, useSignup } from '#/lib/auth'
import { getStoredToken } from '#/lib/auth-token'
import TextField from '#/components/TextField'
import FormErrors from '#/components/FormErrors'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/_app/signup')({
  beforeLoad: () => {
    if (getStoredToken()) {
      throw redirect({ to: '/play' })
    }
  },
  component: SignupPage,
})

const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be 20 characters or fewer')
  .regex(
    /^[A-Za-z0-9_]+$/,
    'Username can only contain letters, numbers, and underscores',
  )

const emailSchema = z.email('Enter a valid email address')

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must include at least one capital letter')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least one symbol')

function SignupPage() {
  const navigate = useNavigate()
  const signup = useSignup()
  const [serverErrors, setServerErrors] = useState<string[]>([])

  const form = useForm({
    defaultValues: {
      username: '',
      email: '',
      password: '',
      passwordConfirmation: '',
    },
    onSubmit: async ({ value }) => {
      setServerErrors([])
      try {
        await signup.mutateAsync(value)
        await navigate({ to: '/play' })
      } catch (error) {
        setServerErrors(extractApiErrors(error))
      }
    },
  })

  return (
    <div className="page-wrap flex justify-center py-12 sm:py-20">
      <section className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="m-0 text-xl font-bold">Create your account</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Already playing?{' '}
          <Link
            to="/signin"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <FormErrors errors={serverErrors} />

          <form.Field name="username" validators={{ onBlur: usernameSchema }}>
            {(field) => (
              <TextField
                field={field}
                label="Username"
                autoComplete="username"
              />
            )}
          </form.Field>

          <form.Field name="email" validators={{ onBlur: emailSchema }}>
            {(field) => (
              <TextField
                field={field}
                label="Email"
                type="email"
                autoComplete="email"
              />
            )}
          </form.Field>

          <form.Field name="password" validators={{ onBlur: passwordSchema }}>
            {(field) => (
              <TextField
                field={field}
                label="Password"
                type="password"
                autoComplete="new-password"
                hint="At least 8 characters, with a capital letter and a symbol"
              />
            )}
          </form.Field>

          <form.Field
            name="passwordConfirmation"
            validators={{
              onChangeListenTo: ['password'],
              onChange: ({ value, fieldApi }) =>
                value !== fieldApi.form.getFieldValue('password')
                  ? 'Password confirmation does not match the password'
                  : undefined,
            }}
          >
            {(field) => (
              <TextField
                field={field}
                label="Confirm password"
                type="password"
                autoComplete="new-password"
              />
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                className="w-full bg-button-red hover:bg-button-red-hover"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating account…' : 'Create account and play'}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </section>
    </div>
  )
}
