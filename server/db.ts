// AI-META-BEGIN
// AI-META: Database connection setup - initializes Drizzle ORM with PostgreSQL connection pool
// OWNERSHIP: server/database
// ENTRYPOINTS: Imported by server/storage.ts and any module needing direct DB access
// DEPENDENCIES: drizzle-orm (ORM), pg (PostgreSQL driver), @shared/schema (table schemas)
// DANGER: DATABASE_URL must be set or app crashes at startup; connection pool exhaustion possible under high load
// CHANGE-SAFETY: Safe to adjust pool config, unsafe to change schema import or drizzle initialization without migration strategy
// TESTS: Run `npm run check` for type safety, connection test via `npm run db:push`
// AI-META-END

import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from '@shared/schema'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?')
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export const db = drizzle(pool, { schema })
