// AI-META-BEGIN
// AI-META: Auth route handlers - provides API endpoint for fetching current authenticated user
// OWNERSHIP: server/replit_integrations/auth
// ENTRYPOINTS: registerAuthRoutes called from server/routes.ts during route registration
// DEPENDENCIES: express, ./storage (authStorage), ./replitAuth (isAuthenticated middleware)
// DANGER: isAuthenticated guard required on all routes to prevent unauthorized access
// CHANGE-SAFETY: Safe to add new auth-related routes, unsafe to remove auth guards
// TESTS: Manual API testing with authenticated session
// AI-META-END

import type { Express } from 'express'
import { authStorage } from './storage'
import { isAuthenticated } from './replitAuth'

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub
      const user = await authStorage.getUser(userId)
      res.json(user)
    } catch (error) {
      console.error('Error fetching user:', error)
      res.status(500).json({ message: 'Failed to fetch user' })
    }
  })
}
