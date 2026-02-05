# Modules and Dependencies

[← Back to Index](./00_INDEX.md)

## Module Map

CloudVault follows a **three-tier monorepo structure**: client, server, and shared.

```
secure_file/
├── client/          # Frontend React application
├── server/          # Backend Express application
├── shared/          # Shared types and schemas
├── migrations/      # Database migrations
└── script/          # Build scripts
```

### Top-Level Folders

| Folder        | Purpose         | Access Level | Imports From            |
| ------------- | --------------- | ------------ | ----------------------- |
| `client/`     | React frontend  | Browser only | `shared/`, npm packages |
| `server/`     | Express backend | Node.js only | `shared/`, npm packages |
| `shared/`     | Types & schemas | Both         | npm packages only       |
| `migrations/` | SQL migrations  | Build time   | None (generated)        |
| `script/`     | Build tooling   | Build time   | All                     |

**Import rule**: `client/` and `server/` may import from `shared/`, but `shared/` must not import from either.

## Client Module Structure

**Base path**: `client/src/`

```
client/src/
├── components/      # React components
│   ├── ui/         # shadcn/ui components (65 files)
│   └── ...         # Custom components
├── hooks/          # Custom React hooks
├── lib/            # Utilities and helpers
├── pages/          # Route components (page-level)
├── main.tsx        # Application entry point
└── App.tsx         # Root component with routing
```

### Client Submodules

| Path             | Purpose              | Key Files                              | Dependencies                              |
| ---------------- | -------------------- | -------------------------------------- | ----------------------------------------- |
| `components/ui/` | shadcn/ui primitives | `button.tsx`, `dialog.tsx`, etc.       | `@radix-ui/*`, `class-variance-authority` |
| `components/`    | Custom components    | `FileUpload.tsx`, `FolderTree.tsx`     | `./ui/*`, `hooks/`                        |
| `hooks/`         | React hooks          | `use-auth.ts`, `use-upload.ts`         | `@tanstack/react-query`, `lib/`           |
| `lib/`           | Utilities            | `api.ts`, `queryClient.ts`, `utils.ts` | None (leaf module)                        |
| `pages/`         | Routes               | `dashboard.tsx`, `landing.tsx`         | `components/`, `hooks/`                   |

### Client Dependency Rules

**Allowed**:

- `pages/` → `components/`, `hooks/`, `lib/`
- `components/` → `components/ui/`, `hooks/`, `lib/`
- `hooks/` → `lib/`
- `lib/` → npm packages only

**Forbidden**:

- ❌ `components/ui/` → `components/` (ui components are self-contained)
- ❌ `lib/` → `hooks/` or `components/` (utils are leaf nodes)
- ❌ Circular imports between any modules

## Server Module Structure

**Base path**: `server/`

```
server/
├── replit_integrations/   # Replit platform integrations
│   ├── auth/             # OIDC authentication
│   └── object_storage/   # Google Cloud Storage
├── index.ts              # HTTP server entry point
├── routes.ts             # API route definitions
├── db.ts                 # Database connection
├── storage.ts            # Storage abstraction (CRUD)
└── static.ts             # Static file serving
```

### Server Submodules

| Path                                  | Purpose          | Key Files                              | Dependencies                         |
| ------------------------------------- | ---------------- | -------------------------------------- | ------------------------------------ |
| `replit_integrations/auth/`           | Authentication   | `setup.ts`, `middleware.ts`, `user.ts` | `passport`, `openid-client`          |
| `replit_integrations/object_storage/` | File storage     | `service.ts`, `routes.ts`              | `@google-cloud/storage`              |
| `index.ts`                            | Server bootstrap | Entry point                            | All server modules                   |
| `routes.ts`                           | API endpoints    | Route handlers                         | `storage.ts`, `replit_integrations/` |
| `storage.ts`                          | Data access      | CRUD operations                        | `db.ts`, `@shared/schema`            |
| `db.ts`                               | Database         | Drizzle instance                       | `drizzle-orm`, `pg`                  |

### Server Dependency Rules

**Allowed**:

- `routes.ts` → `storage.ts`, `replit_integrations/*`
- `storage.ts` → `db.ts`, `@shared/schema`
- `replit_integrations/auth/` → `db.ts`, `@shared/schema`
- `replit_integrations/object_storage/` → `@google-cloud/storage`

**Forbidden**:

- ❌ `storage.ts` → `routes.ts` (data layer below API layer)
- ❌ `db.ts` → anything except `drizzle-orm`, `pg` (database is leaf)
- ❌ Circular dependencies between replit_integrations modules

## Shared Module Structure

**Base path**: `shared/`

```
shared/
├── schema.ts        # Drizzle ORM table definitions
└── models/
    ├── auth.ts      # User and session tables
    └── ...          # Future model types
```

### Shared Module Rules

**Purpose**: Type definitions and validation schemas shared between client and server.

**Allowed exports**:

- Database table types (e.g., `Folder`, `File`)
- Zod validation schemas (e.g., `insertFolderSchema`)
- TypeScript interfaces/types

**Forbidden**:

- ❌ No runtime logic (functions with side effects)
- ❌ No imports from `client/` or `server/`
- ❌ No environment-specific code (Node.js or browser APIs)

**Why**: Shared module must be safely importable in both client and server contexts.

## Dependency Graph

### High-Level Flow

```
┌────────────┐       ┌────────────┐
│   Client   │       │   Server   │
│            │       │            │
│  pages/    │       │  routes.ts │
│    ↓       │       │     ↓      │
│  components│       │  storage.ts│
│    ↓       │       │     ↓      │
│  hooks/    │       │    db.ts   │
│    ↓       │       │     ↓      │
│  lib/      │       │            │
└─────┬──────┘       └─────┬──────┘
      │                    │
      └──────────┬─────────┘
                 ↓
          ┌─────────────┐
          │   Shared    │
          │  schema.ts  │
          └─────────────┘
```

### Import Path Aliases

Configured in `tsconfig.json`:

| Alias      | Resolves To   | Usage                    |
| ---------- | ------------- | ------------------------ |
| `@/`       | `client/src/` | Client-side imports only |
| `@shared/` | `shared/`     | Both client and server   |

**Examples**:

```typescript
// In client code
import { Button } from '@/components/ui/button'
import { folders } from '@shared/schema'

// In server code
import { storage } from './storage'
import { folders } from '@shared/schema'
```

## Key Architectural Rules

### 1. No Circular Dependencies

**Rule**: Module A cannot import module B if B already imports A (directly or transitively).

**Enforcement**: TypeScript compiler will error on circular imports.

**Example violation**:

```typescript
// ❌ BAD: Circular dependency
// hooks/use-auth.ts
import { LoginForm } from '@/components/LoginForm'

// components/LoginForm.tsx
import { useAuth } from '@/hooks/use-auth'
```

**Fix**: Extract shared types to a separate file or use dependency injection.

### 2. Unidirectional Data Flow

**Rule**: Higher layers depend on lower layers, never the reverse.

**Layer hierarchy** (top to bottom):

1. `pages/` (routes)
2. `components/` (UI)
3. `hooks/` (logic)
4. `lib/` (utilities)

**Enforcement**: Code review and linting.

### 3. Shared Module Purity

**Rule**: `shared/` must contain only types, schemas, and pure data transformations.

**Allowed**:

```typescript
// ✅ Good: Type definitions
export type Folder = typeof folders.$inferSelect

// ✅ Good: Validation schemas
export const insertFolderSchema = createInsertSchema(folders)
```

**Forbidden**:

```typescript
// ❌ Bad: Side effects
export function initializeDatabase() { ... }

// ❌ Bad: Environment-specific APIs
export const fs = require("fs");
```

### 4. API as Contract Boundary

**Rule**: Client and server communicate only via REST API (`/api/*` endpoints). No direct database access from client.

**Enforcement**:

- Client has no database credentials
- API endpoints validate authentication/authorization
- Zod schemas validate request/response payloads

### 5. Database Schema as Single Source of Truth

**Rule**: All database changes flow through `shared/schema.ts` and migrations.

**Process**:

1. Modify `shared/schema.ts`
2. Run `npm run db:push` to apply changes
3. Types auto-update in client and server code

**Forbidden**:

- ❌ Manual SQL ALTER TABLE statements (bypasses type system)
- ❌ Multiple schema definitions (use Drizzle as single source)

## Critical Dependencies

### External (npm)

| Package                 | Used In                | Purpose                 | Version |
| ----------------------- | ---------------------- | ----------------------- | ------- |
| `drizzle-orm`           | Server, Shared         | Type-safe ORM           | ^0.39.3 |
| `@tanstack/react-query` | Client                 | Server state management | ^5.60.5 |
| `express`               | Server                 | HTTP server             | ^5.0.1  |
| `@google-cloud/storage` | Server                 | Object storage          | ^7.18.0 |
| `react`                 | Client                 | UI framework            | ^18.3.1 |
| `zod`                   | Client, Server, Shared | Validation              | ^3.24.2 |

### Internal (within repo)

| Module              | Depends On           | Depended By                                                  |
| ------------------- | -------------------- | ------------------------------------------------------------ |
| `shared/schema.ts`  | `drizzle-orm`, `zod` | `server/storage.ts`, `server/routes.ts`, `client/lib/api.ts` |
| `server/db.ts`      | `shared/schema.ts`   | `server/storage.ts`                                          |
| `server/storage.ts` | `server/db.ts`       | `server/routes.ts`                                           |
| `client/lib/api.ts` | `@shared/schema`     | `client/hooks/*`                                             |

## Adding New Modules

### Adding a New Client Component

```bash
# Use shadcn CLI for UI components
npx shadcn@latest add <component-name>

# Or create manually
touch client/src/components/MyComponent.tsx
```

**Checklist**:

- [ ] Place in appropriate directory (`components/` or `components/ui/`)
- [ ] Import dependencies from allowed layers only
- [ ] Export component as default or named export
- [ ] Add TypeScript types for props

### Adding a New Server Route

```typescript
// In server/routes.ts
app.get('/api/my-resource', isAuthenticated, async (req, res) => {
  // Handler logic
})
```

**Checklist**:

- [ ] Add to `server/routes.ts`
- [ ] Use `isAuthenticated` middleware for protected routes
- [ ] Validate input with Zod schema
- [ ] Call `storage.*` methods, not `db.*` directly
- [ ] Return JSON with appropriate status code

### Adding a New Database Table

```typescript
// In shared/schema.ts
export const myTable = pgTable('my_table', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull(),
  // ...
})

export type MyTable = typeof myTable.$inferSelect
export type InsertMyTable = typeof myTable.$inferInsert
```

**Checklist**:

- [ ] Define in `shared/schema.ts`
- [ ] Add indexes for foreign keys
- [ ] Export TypeScript types
- [ ] Run `npm run db:push` to apply
- [ ] Add methods to `server/storage.ts`

## Module Testing Strategy

**Current state**: No automated tests configured.

**Recommended approach** (when adding tests):

- **Client**: React Testing Library for component tests
- **Server**: Supertest for API integration tests
- **Shared**: Jest for schema validation tests

**Test boundaries**:

- Test at module boundaries (API contracts)
- Mock external services (database, object storage)
- Use shared types for type-safe mocks

## Evidence

Key files defining module structure:

- [tsconfig.json](../../tsconfig.json) - Path aliases and TypeScript config
- [client/src/](../../client/src/) - Client module structure
- [server/](../../server/) - Server module structure
- [shared/schema.ts](../../shared/schema.ts) - Shared types
- [vite.config.ts](../../vite.config.ts) - Client build configuration
- [package.json](../../package.json) - Dependencies

## Related Documentation

- [Overview](./10_OVERVIEW.md) - System architecture
- [Runtime Topology](./20_RUNTIME_TOPOLOGY.md) - Deployment structure
- [Key Flows](./40_KEY_FLOWS.md) - Data flow through modules
- [Data Documentation](../data/00_INDEX.md) - Schema details

[← Back to Index](./00_INDEX.md)
