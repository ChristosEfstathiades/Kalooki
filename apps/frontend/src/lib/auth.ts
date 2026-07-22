import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { TuyauError } from '@tuyau/core/client'
import { api } from '#/lib/api'
import { closeSocket } from '#/lib/socket'
import { clearStoredToken, getStoredToken, storeToken } from '#/lib/auth-token'
import type { Data } from '@KalookiOnline/backend/data'
import type { UsernameColor } from '#/lib/username-color'

export type CurrentUser = Data.User

/**
 * Query for the signed-in user. Resolves to null when no token is
 * stored or the stored token is no longer valid.
 */
export const currentUserQueryOptions = queryOptions({
  queryKey: ['auth', 'currentUser'],
  queryFn: async (): Promise<CurrentUser | null> => {
    if (!getStoredToken()) {
      return null
    }

    const [profile, error] = await api.get('/api/v1/account/profile', {}).safe()
    if (error) {
      // An expired or revoked token means "signed out", not a failure
      if (error.status === 401) {
        clearStoredToken()
        return null
      }
      throw error
    }
    return profile.data
  },
  staleTime: 5 * 60 * 1000,
})

export interface SigninInput {
  identifier: string
  password: string
  rememberMe: boolean
}

/**
 * Signs the user in, stores the access token ("remember me" persists it
 * across browser restarts), and primes the current-user cache. The
 * identifier can be either the account's email address or its username.
 */
export function useSignin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SigninInput) => {
      const response = await api.post('/api/v1/auth/login', {
        body: {
          identifier: input.identifier,
          password: input.password,
          rememberMe: input.rememberMe,
        },
      })
      return response.data
    },
    onSuccess: (data, input) => {
      storeToken(data.token, input.rememberMe)
      queryClient.setQueryData(currentUserQueryOptions.queryKey, data.user)
    },
  })
}

export interface SignupInput {
  username: string
  email: string
  password: string
  passwordConfirmation: string
}

/**
 * Creates an account. In development the backend returns a token
 * immediately; in production the token is null until the email address
 * is verified.
 */
export function useSignup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SignupInput) => {
      const response = await api.post('/api/v1/auth/signup', {
        body: {
          username: input.username,
          email: input.email,
          password: input.password,
          passwordConfirmation: input.passwordConfirmation,
        },
      })
      return response.data
    },
    onSuccess: (data) => {
      if (data.token) {
        storeToken(data.token, false)
        queryClient.setQueryData(currentUserQueryOptions.queryKey, data.user)
      }
    },
  })
}

export interface UpdateProfileInput {
  username?: string
  chatColor?: UsernameColor
}

/**
 * Updates the signed-in user's username and/or chat name colour, and
 * refreshes the current-user cache with the returned profile.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const response = await api.patch('/api/v1/account/profile', {
        body: {
          ...(input.username !== undefined ? { username: input.username } : {}),
          ...(input.chatColor !== undefined
            ? { chatColor: input.chatColor }
            : {}),
        },
      })
      return response.data
    },
    onSuccess: (user) => {
      queryClient.setQueryData(currentUserQueryOptions.queryKey, user)
    },
  })
}

/**
 * Signs the user out. The local token is cleared even when the revoke
 * request fails (e.g. the token already expired server-side).
 */
export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      // Closed before the request, not after: revoking the token now
      // drops its live sockets server-side, and this tab should tear its
      // own connection down rather than react to that as a revocation.
      closeSocket()
      await api.post('/api/v1/account/logout', {}).safe()
    },
    onSettled: () => {
      clearStoredToken()
      closeSocket()
      queryClient.setQueryData(currentUserQueryOptions.queryKey, null)
    },
  })
}

/**
 * Deletes the signed-in user's account. The backend soft-deletes it
 * with a 30-day restore window (signing back in restores it), so
 * locally this behaves like a logout: token cleared, socket closed,
 * current-user cache reset.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      // As in useLogout: the backend drops this account's sockets as part
      // of the delete, so close ours first and keep the local teardown.
      closeSocket()
      await api.delete('/api/v1/account', {})
    },
    onSuccess: () => {
      clearStoredToken()
      closeSocket()
      queryClient.setQueryData(currentUserQueryOptions.queryKey, null)
    },
  })
}

/**
 * Turns a failed API call into human-readable messages for a form.
 * Handles VineJS validation errors ({ errors: [{ message }] }), single
 * message payloads, and network failures.
 */
export function extractApiErrors(error: unknown): string[] {
  if (error instanceof TuyauError) {
    if (error.kind === 'network') {
      return [
        'Could not reach the server. Check your connection and try again.',
      ]
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
          .filter(
            (message: string | null): message is string => message !== null,
          )
        if (messages.length > 0) {
          return messages
        }
      }
      if ('message' in response && typeof response.message === 'string') {
        return [response.message]
      }
    }
  }

  return ['Something went wrong. Please try again.']
}
