import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
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
  const { data: user } = useQuery(currentUserQueryOptions)
  const logout = useLogout()

  if (!user) {
    return null
  }

  return (
    <div className="page-wrap max-w-2xl py-8">
      <h1 className="m-0 text-2xl font-bold">Settings</h1>

      <ProfileSection user={user} />

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
