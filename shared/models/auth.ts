// AI-META-BEGIN
// AI-META: Auth model schema - user and session table definitions required for Replit Auth
// OWNERSHIP: shared/models/auth
// ENTRYPOINTS: Imported by @shared/schema (re-exported) and auth integration code
// DEPENDENCIES: drizzle-orm (ORM table definitions)
// DANGER: sessions and users tables are mandatory for Replit Auth - DO NOT DROP; session expiry indexed for cleanup performance
// CHANGE-SAFETY: Safe to add new user fields, unsafe to change session table structure without breaking auth
// TESTS: Verify auth flows after schema changes
// AI-META-END

import { sql } from 'drizzle-orm'
import { index, jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core'

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  'sessions',
  {
    sid: varchar('sid').primaryKey(),
    sess: jsonb('sess').notNull(),
    expire: timestamp('expire').notNull(),
  },
  table => [index('IDX_session_expire').on(table.expire)]
)

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable('users', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: varchar('email').unique(),
  firstName: varchar('first_name'),
  lastName: varchar('last_name'),
  profileImageUrl: varchar('profile_image_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export type UpsertUser = typeof users.$inferInsert
export type User = typeof users.$inferSelect
