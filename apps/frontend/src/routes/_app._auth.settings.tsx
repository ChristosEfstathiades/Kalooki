import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import {
  currentUserQueryOptions,
  extractApiErrors,
  useLogout,
  useUpdateProfile,
} from '#/lib/auth'
import UserAvatar from '#/components/UserAvatar'
import TextField from '#/components/TextField'
import FormErrors from '#/components/FormErrors'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { cn } from '#/lib/utils'
import { getStoredTheme, setTheme } from '#/lib/theme'
import { chatNameColor, USERNAME_COLORS, usernameColor } from '#/lib/username-color'
import type { Theme } from '#/lib/theme'
import type { CurrentUser } from '#/lib/auth'

export const Route = createFileRoute('/_app/_auth/settings')({
  component: SettingsPage,
})

const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be 20 characters or fewer')
  .regex(
    /^[A-Za-z0-9_]+$/,
    'Username can only contain letters, numbers, and underscores',
  )

/**
 * Account settings: edit the profile (username and photo) and sign out.
 */
function SettingsPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const { data: user } = useQuery(currentUserQueryOptions)
  const logout = useLogout()

  if (!user) {
    return null
  }

  return (
    <div className="page-wrap max-w-2xl py-8">
      <button
        type="button"
        onClick={() => router.history.back()}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back
      </button>
      <h1 className="m-0 text-2xl font-bold">Settings</h1>

      <ProfileSection user={user} />

      <ChatColorSection user={user} />

      <ThemeSection />

      <section className="mt-6 rounded-lg border border-border bg-card p-6">
        <h2 className="m-0 text-lg font-semibold">Session</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Signing out ends this session on this device.
        </p>
        <Button
          variant="secondary"
          disabled={logout.isPending}
          onClick={() => {
            logout.mutate(undefined, {
              onSettled: () => {
                void navigate({ to: '/' })
              },
            })
          }}
        >
          {logout.isPending ? 'Signing out…' : 'Sign out'}
        </Button>
      </section>
    </div>
  )
}

interface ProfileSectionProps {
  user: CurrentUser
}

/**
 * Profile editor: change the username and/or upload a new photo. The
 * form only submits the fields that actually changed.
 */
function ProfileSection({ user }: ProfileSectionProps) {
  const updateProfile = useUpdateProfile()
  const [serverErrors, setServerErrors] = useState<string[]>([])
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const form = useForm({
    defaultValues: {
      username: user.username,
    },
    onSubmit: async ({ value }) => {
      setServerErrors([])
      setSaved(false)
      try {
        await updateProfile.mutateAsync({
          ...(value.username !== user.username
            ? { username: value.username }
            : {}),
          ...(avatar ? { avatar } : {}),
        })
        setAvatar(null)
        if (avatarPreview) {
          URL.revokeObjectURL(avatarPreview)
          setAvatarPreview(null)
        }
        setSaved(true)
      } catch (error) {
        setServerErrors(extractApiErrors(error))
      }
    },
  })

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-6">
      <h2 className="m-0 text-lg font-semibold">Profile</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{user.email}</p>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <FormErrors errors={serverErrors} />

        <div className="flex items-center gap-4">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="New avatar preview"
              className="size-16 rounded-full object-cover"
            />
          ) : (
            <UserAvatar user={user} className="size-16 text-lg" />
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="avatar">Profile photo</Label>
            <Input
              id="avatar"
              name="avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                if (avatarPreview) {
                  URL.revokeObjectURL(avatarPreview)
                }
                setAvatar(file)
                setAvatarPreview(file ? URL.createObjectURL(file) : null)
              }}
            />
            <p className="m-0 text-xs text-muted-foreground">
              JPG, PNG, or WebP, up to 2 MB
            </p>
          </div>
        </div>

        <form.Field name="username" validators={{ onBlur: usernameSchema }}>
          {(field) => (
            <TextField field={field} label="Username" autoComplete="username" />
          )}
        </form.Field>

        <div className="flex items-center gap-3">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                className="bg-button-purple hover:bg-button-purple-hover"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving…' : 'Save changes'}
              </Button>
            )}
          </form.Subscribe>
          {saved && (
            <p className="m-0 text-sm text-muted-foreground" role="status">
              Profile updated.
            </p>
          )}
        </div>
      </form>
    </section>
  )
}

/**
 * Theme picker: dark (the default) or light, remembered per device.
 */
function ThemeSection() {
  // Starts on the server-safe default and reads the real choice after
  // mount, so SSR markup matches the first client render
  const [theme, setThemeState] = useState<Theme>('dark')
  useEffect(() => {
    setThemeState(getStoredTheme())
  }, [])

  const choose = (nextTheme: Theme) => {
    setTheme(nextTheme)
    setThemeState(nextTheme)
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-6">
      <h2 className="m-0 text-lg font-semibold">Appearance</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Choose how the site looks on this device.
      </p>

      <div className="flex gap-2" role="radiogroup" aria-label="Theme">
        {(['dark', 'light'] as const).map((option) => (
          <Button
            key={option}
            type="button"
            role="radio"
            aria-checked={theme === option}
            variant={theme === option ? 'default' : 'secondary'}
            className={cn(
              theme === option &&
                'bg-button-purple hover:bg-button-purple-hover',
            )}
            onClick={() => choose(option)}
          >
            {option === 'dark' ? 'Dark (default)' : 'Light'}
          </Button>
        ))}
      </div>
    </section>
  )
}

interface ChatColorSectionProps {
  user: CurrentUser
}

/**
 * Lets the user pick their chat name colour from the fixed palette
 * chat messages are coloured from. Without a choice here, a colour is
 * derived from the username instead (see lib/username-color.ts).
 */
function ChatColorSection({ user }: ChatColorSectionProps) {
  const updateProfile = useUpdateProfile()
  const activeColor = user.chatColor ?? usernameColor(user.username)

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-6">
      <h2 className="m-0 text-lg font-semibold">Chat colour</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Choose the colour your name appears in across every chat.
      </p>

      <p className="m-0 mb-4 text-sm">
        <span
          className="font-semibold"
          style={{ color: chatNameColor(activeColor) }}
        >
          {user.username}
        </span>
        {': '}
        <span className="text-muted-foreground">This is what it looks like</span>
      </p>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Chat colour">
        {USERNAME_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={color === activeColor}
            aria-label={color}
            disabled={updateProfile.isPending}
            onClick={() => updateProfile.mutate({ chatColor: color })}
            className={cn(
              'size-8 rounded-full ring-offset-2 ring-offset-card transition',
              color === activeColor ? 'ring-2 ring-foreground' : 'hover:opacity-80',
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </section>
  )
}
