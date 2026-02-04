// AI-META-BEGIN
// AI-META: Auth storage layer - handles user CRUD operations with upsert pattern for Replit Auth
// OWNERSHIP: server/replit_integrations/auth
// ENTRYPOINTS: Imported as authStorage singleton by replitAuth.ts and routes.ts
// DEPENDENCIES: @shared/models/auth (user schema), ../../db (database connection), drizzle-orm (ORM)
// DANGER: Upsert required for Replit Auth - conflicts update existing users; must maintain IAuthStorage interface contract
// CHANGE-SAFETY: Safe to add new methods, unsafe to change upsert logic or getUser signature without breaking auth flow
// TESTS: Run `npm run check` for type safety, integration tests for auth flows
// AI-META-END

import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
