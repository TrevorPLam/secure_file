// Tests for server/db.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('server/db', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure DATABASE_URL is set (already set in test/setup.ts)
    expect(process.env.DATABASE_URL).toBeDefined()
  })

  it('should export pool with connectionString', async () => {
    // The db module is already loaded with DATABASE_URL from test setup
    const { pool } = await import('../server/db')

    expect(pool).toBeDefined()
  })

  it('should export db drizzle instance', async () => {
    const { db } = await import('../server/db')

    expect(db).toBeDefined()
  })
})
