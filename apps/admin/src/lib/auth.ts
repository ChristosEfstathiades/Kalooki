import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { TuyauError } from '@tuyau/core/client'
import { api } from '#/lib/api'
import { clearStoredToken, getStoredToken, storeToken } from '#/lib/auth-token'
import type { Data } from '@KalookiOnline/backend/data'

export type CurrentUser = Data.User

/**
 * Thrown when valid credentials belong to an account that is not an
 * admin. The token is discarded, so a moderator or player signing in
 * here gains nothing.
 */
export const NOT_AN_ADMIN_MESSAGE =
  'This site is for administrators only. Sign in at the main site instead.'

/**
 * Query for the signed-in admin. Resolves to null when no token is
 * stored, the token is no longer valid, or the account is not an admin.
 */
export const currentAdminQueryOptions = queryOptions({
  queryKey: ['auth', 'currentAdmin'],
  queryFn: async (): Promise<CurrentUser | null> => {
    if (!getStoredToken()) {
      return null
    }

    const [profile, error] = await api.get('/api/v1/account/profile', {}).safe()
    if (error) {
      // Expired, revoked or banned means "signed out", not a failure
      if (error.status === 401 || error.status === 403) {
        clearStoredToken()
        return null
      }
      throw error
    }
    if (profile.data.role !== 'admin') {
      clearStoredToken()
      return null
    }
    return profile.data
  },
  staleTime: 5 * 60 * 1000,
})

export interface SigninInput {
  identifier: string
  password: string
}

/**
 * Signs an admin in. Credentials are checked by the same endpoint the
 * player site uses; this app additionally refuses any account that is
 * not an admin and throws the token away.
 */
export function useAdminSignin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SigninInput) => {
      const response = await api.post('/api/v1/auth/login', {
        body: {
          identifier: input.identifier,
          password: input.password,
          rememberMe: false,
        },
      })
      if (response.data.user.role !== 'admin') {
        throw new Error(NOT_AN_ADMIN_MESSAGE)
      }
      return response.data
    },
    onSuccess: (data) => {
      storeToken(data.token)
      queryClient.setQueryData(currentAdminQueryOptions.queryKey, data.user)
    },
  })
}

/**
 * Signs the admin out. The local token is cleared even when the revoke
 * request fails (e.g. the token already expired server-side).
 */
export function useAdminSignout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await api.post('/api/v1/account/logout', {}).safe()
    },
    onSettled: () => {
      clearStoredToken()
      queryClient.setQueryData(currentAdminQueryOptions.queryKey, null)
      void queryClient.invalidateQueries()
    },
  })
}

/**
 * Turns a failed API call into human-readable messages. Handles VineJS
 * validation errors, single message payloads, and network failures.
 */
export function extractApiErrors(error: unknown): string[] {
  if (error instanceof TuyauError) {
    if (error.kind === 'network') {
      return ['Could not reach the server. Check your connection and try again.']
    }

    const response: unknown = error.response
    if (response && typeof response === 'object') {
      if ('errors' in response && Array.isArray(response.errors)) {
        const messages = response.errors
          .map((item: unknown) =>
            item &&
            typeof item === 'object' &&
            'message' in item &&
            typeof item.message === 'string'
              ? item.message
              : null,
          )
          .filter((message: string | null): message is string => message !== null)
        if (messages.length > 0) {
          return messages
        }
      }
      if ('message' in response && typeof response.message === 'string') {
        return [response.message]
      }
    }
  }

  if (error instanceof Error) {
    return [error.message]
  }

  return ['Something went wrong. Please try again.']
}
