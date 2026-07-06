import { useState } from 'react'
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { extractApiErrors, useSignin } from '#/lib/auth'
import { getStoredToken } from '#/lib/auth-token'
import TextField from '#/components/TextField'
import FormErrors from '#/components/FormErrors'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'

export const Route = createFileRoute('/_app/signin')({
  beforeLoad: () => {
    if (getStoredToken()) {
      throw redirect({ to: '/play' })
    }
  },
  component: SigninPage,
})

const emailSchema = z.email('Enter a valid email address')
const passwordSchema = z.string().min(1, 'Enter your password')

function SigninPage() {
  const navigate = useNavigate()
  const signin = useSignin()
  const [serverErrors, setServerErrors] = useState<string[]>([])

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    onSubmit: async ({ value }) => {
      setServerErrors([])
      try {
        await signin.mutateAsync(value)
        await navigate({ to: '/play' })
      } catch (error) {
        setServerErrors(extractApiErrors(error))
      }
    },
  })

  return (
    <div className="page-wrap flex justify-center py-12 sm:py-20">
      <section className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="m-0 text-xl font-bold">Sign in</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          New here?{' '}
          <Link
            to="/signup"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Create an account
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
                autoComplete="current-password"
              />
            )}
          </form.Field>

          <form.Field name="rememberMe">
            {(field) => (
              <Label className="font-normal">
                <input
                  type="checkbox"
                  name={field.name}
                  checked={field.state.value}
                  onChange={(event) => field.handleChange(event.target.checked)}
                  className="size-4 accent-[var(--button-purple)]"
                />
                Remember me
              </Label>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </section>
    </div>
  )
}
