// AI-META-BEGIN
// AI-META: Authentication hook - provides user state, login/logout functionality via React Query
// OWNERSHIP: client/hooks
// ENTRYPOINTS: Used by App.tsx for auth gating and dashboard page for user display
// DEPENDENCIES: @tanstack/react-query (caching/mutations), @shared/models/auth (User type)
// DANGER: 401 responses return null user (logged out state); logout mutation deletes all user data via /api/auth/logout
// CHANGE-SAFETY: Safe to add new auth methods, unsafe to change query keys or user fetch logic without coordinating with server
// TESTS: Manual testing with login/logout flows, verify query cache invalidation
// AI-META-END

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { User } from '@shared/models/auth'

async function fetchUser(): Promise<User | null> {
  const response = await fetch('/api/auth/user', {
    credentials: 'include',
  })

  if (response.status === 401) {
    return null
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`)
  }

  return response.json()
}

async function logout(): Promise<void> {
  window.location.href = '/api/logout'
}

export function useAuth() {
  const queryClient = useQueryClient()
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ['/api/auth/user'],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(['/api/auth/user'], null)
    },
  })

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  }
}
