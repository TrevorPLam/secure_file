// AI-META-BEGIN
// AI-META: Auth utility functions - 401 error detection and login redirect handling
// OWNERSHIP: client/lib
// ENTRYPOINTS: Used by error handling across the app to detect unauthorized states
// DEPENDENCIES: None (pure functions)
// DANGER: redirectToLogin triggers window.location.href redirect after 500ms delay; assumes /api/login endpoint
// CHANGE-SAFETY: Safe to add new auth utilities, unsafe to change redirect behavior without testing auth flows
// TESTS: Manual testing with expired sessions
// AI-META-END

export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message)
}

// Redirect to login with a toast notification
export function redirectToLogin(
  toast?: (options: { title: string; description: string; variant: string }) => void
) {
  if (toast) {
    toast({
      title: 'Unauthorized',
      description: 'You are logged out. Logging in again...',
      variant: 'destructive',
    })
  }
  setTimeout(() => {
    window.location.href = '/api/login'
  }, 500)
}
