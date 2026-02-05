// AI-META-BEGIN
// AI-META: Drizzle Kit configuration - database migration settings and schema path
// OWNERSHIP: config/database
// ENTRYPOINTS: Used by drizzle-kit commands (db:push, generate, migrate)
// DEPENDENCIES: drizzle-kit, DATABASE_URL env var
// DANGER: DATABASE_URL must be set; migrations output to ./migrations; schema points to shared/schema.ts
// CHANGE-SAFETY: Safe to adjust migration path, unsafe to change schema path without coordinating with code
// TESTS: Run `npm run db:push` to verify config and database connection
// AI-META-END

import { defineConfig } from 'drizzle-kit'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL, ensure the database is provisioned')
}

export default defineConfig({
  out: './migrations',
  schema: './shared/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
})
