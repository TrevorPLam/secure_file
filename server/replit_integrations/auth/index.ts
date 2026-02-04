// AI-META-BEGIN
// AI-META: Auth module barrel export - provides authentication setup, middleware, and storage interface
// OWNERSHIP: server/replit_integrations/auth
// ENTRYPOINTS: Imported by server/routes.ts for auth setup and route registration
// DEPENDENCIES: ./replitAuth (setupAuth, isAuthenticated), ./storage (authStorage), ./routes (registerAuthRoutes)
// DANGER: Barrel file - keep exports stable to avoid circular dependencies
// CHANGE-SAFETY: Safe to add new exports, unsafe to rename or remove existing exports without auditing all importers
// TESTS: Run `npm run check` for type safety
// AI-META-END

export { setupAuth, isAuthenticated, getSession } from "./replitAuth";
export { authStorage, type IAuthStorage } from "./storage";
export { registerAuthRoutes } from "./routes";
