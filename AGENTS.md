# AGENTS.md - CloudVault Project Guide for AI Assistants

**Last Updated:** February 4, 2026  
**Project:** CloudVault - Secure File Sharing Platform  
**Status:** Production-ready MVP with optional improvements  
**Test Coverage:** 64.33% (211 passing tests)  
**DIAMOND Grade:** A (91.4% - Excellent)

---

## 📋 Purpose of This Document

This document provides AI coding assistants with:

- **Project context** and architecture overview
- **Development guidelines** and best practices
- **Safety constraints** and critical considerations
- **Testing requirements** and quality standards
- **Quick reference** for common development patterns

**For task priorities and current work:** See [TODO.md](./TODO.md) for the complete task list and priorities.

**For human developers:** See [README.md](./README.md) and [docs/](./docs/) for complete documentation.

---

## 🏗️ Project Overview

### What is CloudVault?

CloudVault is a secure file sharing and storage application that enables users to:

- Upload and organize files in hierarchical folders
- Share files via password-protected, time-limited links
- Track download counts and access analytics
- Authenticate securely via Replit Auth (OpenID Connect)

### Technology Stack

- **Frontend:** React 18, TypeScript, Vite, shadcn/ui, Tailwind CSS
- **Backend:** Express.js, TypeScript, Node.js
- **Database:** PostgreSQL with Drizzle ORM
- **Storage:** Google Cloud Storage (via Replit)
- **Auth:** Replit Auth (OIDC)
- **Hosting:** Replit platform

### Project Structure

```
secure_file/
├── client/          # React frontend
│   └── src/
│       ├── components/  # UI components (shadcn/ui)
│       ├── hooks/       # Custom React hooks
│       ├── lib/         # Utilities and API client
│       └── pages/       # Route components
├── server/          # Express backend
│   ├── replit_integrations/  # Auth and storage
│   ├── routes.ts    # API endpoints
│   ├── storage.ts   # Data access layer
│   ├── security.ts  # Security middleware
│   └── db.ts        # Database connection
├── shared/          # Shared types/schemas
│   └── schema.ts    # Drizzle ORM schema
├── docs/            # Architecture documentation
└── test/            # Test utilities
```

---

## 🛡️ Development Guidelines for AI Agents

### Code Safety Constraints

#### 🚨 NEVER Change Without Approval:

1. **Encryption parameters** (AES-256-GCM, scrypt settings)
2. **Database schema** (always use migrations, never direct ALTER)
3. **Authentication flows** (Replit OIDC integration)
4. **Session management** (secure-by-default settings)
5. **Rate limiting thresholds** (security-sensitive)

#### ⚠️ High-Risk Areas (Extra Caution):

- `server/security.ts` - Security middleware
- `server/replit_integrations/auth/` - Authentication logic
- `shared/schema.ts` - Database schema
- `server/routes.ts` - API authorization checks

#### ✅ Safe to Modify:

- UI components (client/src/components/)
- Frontend hooks (client/src/hooks/)
- Documentation (docs/, README.md)
- Tests (adding new tests always safe)
- Utilities (pure functions)

---

### Code Quality Standards

#### TypeScript

- **All code must be TypeScript** (no `any` types without justification)
- Use shared types from `shared/` directory
- Prefer type inference where possible
- Document complex types with JSDoc

#### Testing

- **Minimum 80% coverage** for new code
- **100% coverage required** for:
  - Security features
  - API endpoints
  - Authentication/authorization
  - Data validation
- Run `npm test` before committing
- Run `npm run test:coverage` to verify coverage

#### API Design

- **RESTful conventions:**
  - `GET /api/resource` - List/read
  - `POST /api/resource` - Create
  - `PUT /api/resource/:id` - Update
  - `DELETE /api/resource/:id` - Delete
- **Consistent error format:**
  ```json
  { "error": "message", "code": "ERROR_CODE" }
  ```
- **Rate limiting** on all public endpoints
- **Input validation** with Zod schemas

#### Security

- **All endpoints require authentication** (except share links)
- **Validate all user input** (never trust client data)
- **Sanitize file names** (prevent path traversal)
- **Use parameterized queries** (prevent SQL injection)
- **Hash passwords** with bcrypt (cost factor: 12)
- **Generate secure tokens** (randomBytes, 32 bytes minimum)

---

### File Modification Patterns

#### When Modifying `shared/schema.ts`:

1. Add new table/column
2. Run `npm run db:push` to update database
3. Update affected routes in `server/routes.ts`
4. Update affected queries in `server/storage.ts`
5. Add tests for new schema
6. Document in `docs/data/`

#### When Modifying API Routes:

1. Update `server/routes.ts` (add/modify endpoint)
2. Add authentication/authorization checks
3. Add input validation (Zod schema)
4. Update `server/storage.ts` (data access layer)
5. Add tests (unit + integration)
6. Update `docs/api/` documentation
7. Consider rate limiting

#### When Adding New Features:

1. **Create task in TODO.md** with priority and effort estimate
2. **Update AGENTS.md** with task details
3. **Write tests first** (TDD approach)
4. **Implement feature** with security in mind
5. **Update documentation** (README, docs/, API)
6. **Run CI checks** (`npm run check`, `npm test`)
7. **Manual testing** in development environment

---

### Common Pitfalls to Avoid

❌ **Don't:**

- Use `any` type without justification
- Skip input validation ("trust the client")
- Store sensitive data in logs (passwords, tokens)
- Use `console.log` for production logging (use audit logger)
- Commit `.env` files or secrets
- Use `JSON.parse()` without try-catch
- Forget to close database connections
- Use `SELECT *` (specify columns)
- Hardcode configuration (use environment variables)

✅ **Do:**

- Use TypeScript strict mode
- Validate all inputs with Zod
- Redact sensitive data in logs
- Use structured logging (audit.ts)
- Use environment variable validation (config.ts)
- Use error boundaries in React
- Close resources in finally blocks
- Select only needed columns
- Externalize configuration

---

## 🧪 Testing Guidelines

### Test Organization

```
# Unit tests (co-located with code)
server/routes.test.ts
client/src/hooks/use-auth.test.ts

# Integration tests (separate directory)
test/integration/user-workflows.test.ts

# Performance tests (separate directory)
test/performance/load-tests.test.ts
```

### Test Naming Convention

```typescript
describe("ComponentName or FunctionName", () => {
  describe("specificMethod", () => {
    it("should do expected behavior when condition", () => {
      // Arrange
      const input = ...;

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe(expected);
    });

    it("should throw error when invalid input", () => {
      expect(() => functionUnderTest(null)).toThrow();
    });
  });
});
```

### Coverage Requirements

| Code Type         | Minimum Coverage | Notes                                  |
| ----------------- | ---------------- | -------------------------------------- |
| Security features | 100%             | Auth, authorization, validation        |
| API endpoints     | 100%             | All routes and error cases             |
| Business logic    | 90%              | Core functionality                     |
| UI components     | 70%              | Focus on logic, not presentation       |
| Utilities         | 90%              | Pure functions, data transformations   |
| Integration code  | 30%              | External services (mock at boundaries) |

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- routes.test.ts

# Run in watch mode
npm test -- --watch

# Run in UI mode (interactive)
npm run test:ui
```

---

## 📚 Essential Documentation

### Critical Files to Reference

| File                                                                                                   | Purpose                       |
| ------------------------------------------------------------------------------------------------------ | ----------------------------- |
| [README.md](./README.md)                                                                               | Project overview, quick start |
| [docs/README.md](./docs/README.md)                                                                     | Documentation hub             |
| [docs/architecture/10_OVERVIEW.md](./docs/architecture/10_OVERVIEW.md)                                 | System architecture           |
| [docs/architecture/30_MODULES_AND_DEPENDENCIES.md](./docs/architecture/30_MODULES_AND_DEPENDENCIES.md) | Code organization             |
| [docs/architecture/40_KEY_FLOWS.md](./docs/architecture/40_KEY_FLOWS.md)                               | User flows and data flows     |
| [docs/api/00_INDEX.md](./docs/api/00_INDEX.md)                                                         | REST API reference            |
| [docs/security/10_THREAT_MODEL.md](./docs/security/10_THREAT_MODEL.md)                                 | Security architecture         |
| [docs/testing/30_TEST_PATTERNS.md](./docs/testing/30_TEST_PATTERNS.md)                                 | Testing examples              |
| [TODO.md](./TODO.md)                                                                                   | Complete task list            |

### When to Update Documentation

**Always update docs when:**

- Adding new API endpoint → `docs/api/`
- Changing architecture → `docs/architecture/`
- Adding new module → `docs/architecture/30_MODULES_AND_DEPENDENCIES.md`
- Implementing security feature → `docs/security/`
- Adding test patterns → `docs/testing/30_TEST_PATTERNS.md`
- Making architecture decision → Create ADR in `docs/adr/`

---

## 🎯 Quick Reference for Common Tasks

### Add New API Endpoint

1. **Define route** in `server/routes.ts`:

   ```typescript
   app.post('/api/resource', requireAuth, async (req, res) => {
     const schema = z.object({ name: z.string() })
     const data = schema.parse(req.body)
     // ... implementation
   })
   ```

2. **Add data access** in `server/storage.ts`:

   ```typescript
   export async function createResource(userId: string, data: any) {
     return await db.insert(resources).values({ ...data, userId })
   }
   ```

3. **Write tests** in `server/routes.test.ts`:

   ```typescript
   it('should create resource when authenticated', async () => {
     const response = await request(app)
       .post('/api/resource')
       .set('Cookie', authCookie)
       .send({ name: 'Test' })

     expect(response.status).toBe(201)
   })
   ```

4. **Update docs** in `docs/api/`:

   ````markdown
   ### POST /api/resource

   Create a new resource.

   **Request:**

   ```json
   { "name": "string" }
   ```
   ````

   **Response (201):**

   ```json
   { "id": "uuid", "name": "string" }
   ```

   ```

   ```

---

### Add Database Table

1. **Update schema** in `shared/schema.ts`:

   ```typescript
   export const newTable = pgTable('new_table', {
     id: text('id')
       .primaryKey()
       .$defaultFn(() => crypto.randomUUID()),
     createdAt: timestamp('created_at').defaultNow(),
     // ... columns
   })
   ```

2. **Push to database**:

   ```bash
   npm run db:push
   ```

3. **Update types**:

   ```typescript
   export type NewTable = typeof newTable.$inferSelect
   export type InsertNewTable = typeof newTable.$inferInsert
   ```

4. **Add queries** in `server/storage.ts`

5. **Write tests** for new queries

6. **Document** in `docs/data/`

---

### Add React Component

1. **Create component** in `client/src/components/`:

   ```typescript
   export function MyComponent({ prop }: { prop: string }) {
     return <div>{prop}</div>;
   }
   ```

2. **Add styles** with Tailwind classes

3. **Write tests** (if component has logic):

   ```typescript
   it("should render prop", () => {
     render(<MyComponent prop="test" />);
     expect(screen.getByText("test")).toBeInTheDocument();
   });
   ```

4. **Export** from `client/src/components/` (if reusable)

---

### Add Security Middleware

1. **Create middleware** in `server/security.ts`:

   ```typescript
   export function mySecurityCheck(req: Request, res: Response, next: NextFunction) {
     if (!validateSomething(req)) {
       return res.status(403).json({ error: 'Forbidden' })
     }
     next()
   }
   ```

2. **Write comprehensive tests**:

   ```typescript
   it('should reject invalid requests', () => {
     // Test all edge cases
   })
   ```

3. **Apply to routes** in `server/routes.ts`:

   ```typescript
   app.post('/api/sensitive', requireAuth, mySecurityCheck, handler)
   ```

4. **Document** in `docs/security/`

---

## 🔄 Git Workflow

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semi-colons
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests
- `chore`: Maintain, dependencies

**Examples:**

```
feat(api): add CSRF protection to all routes

Implements synchronizer token pattern with timing-safe validation.
Tokens are valid for 24 hours and stored in session.

Closes #123

---

fix(auth): prevent session fixation attack

Regenerate session ID after successful login.

---

test(storage): add integration tests for file upload

Covers happy path, error cases, and concurrent uploads.
```

### Before Committing

```bash
# Type check
npm run check

# Run tests
npm test

# Check coverage
npm run test:coverage

# Lint (if ESLint configured)
npm run lint

# Format (if Prettier configured)
npm run format
```

---

## 🚦 Decision Making Framework

### Should I implement this task?

| Question                            | Answer                                     |
| ----------------------------------- | ------------------------------------------ |
| Is this in the priority task list?  | ✅ Yes → Proceed with confidence           |
| Is this a security-critical change? | ⚠️ Yes → Extra caution, 100% test coverage |
| Does this modify authentication?    | ⚠️ Yes → Discuss with team first           |
| Does this change database schema?   | ⚠️ Yes → Create migration, test thoroughly |
| Is this a UI-only change?           | ✅ Yes → Safe to implement                 |
| Does this add dependencies?         | ⚠️ Moderate → Check license, security      |

### When to ask for human input:

- **Always ask when:**
  - Changing encryption algorithms
  - Modifying authentication flows
  - Adding external dependencies
  - Changing database relationships
  - Implementing compliance features

- **Consider asking when:**
  - Task is ambiguous
  - Multiple valid approaches exist
  - Significant architecture change
  - User experience decisions

---

## 🎓 Learning Resources

### For Understanding the Codebase

1. **Start here:** [README.md](./README.md)
2. **Architecture:** [docs/architecture/10_OVERVIEW.md](./docs/architecture/10_OVERVIEW.md)
3. **API Reference:** [docs/api/00_INDEX.md](./docs/api/00_INDEX.md)
4. **Security:** [docs/security/99_SECURITY_POSTURE_REPORT.md](./docs/security/99_SECURITY_POSTURE_REPORT.md)
5. **Tests:** [docs/testing/30_TEST_PATTERNS.md](./docs/testing/30_TEST_PATTERNS.md)

### For Specific Topics

| Topic        | Resource                                                                 |
| ------------ | ------------------------------------------------------------------------ |
| Drizzle ORM  | [docs/data/00_INDEX.md](./docs/data/00_INDEX.md)                         |
| Replit Auth  | [docs/integrations/00_INDEX.md](./docs/integrations/00_INDEX.md)         |
| Threat Model | [docs/security/10_THREAT_MODEL.md](./docs/security/10_THREAT_MODEL.md)   |
| Key Flows    | [docs/architecture/40_KEY_FLOWS.md](./docs/architecture/40_KEY_FLOWS.md) |

---

## 📞 Support and Collaboration

### Task Status Legend

- ✅ **Complete** - Task finished and tested
- 🟡 **In Progress** - Currently being worked on
- 🔵 **Not Started** - Available to begin
- 🚀 **Future** - Planned but not prioritized
- ⚠️ **Blocked** - Dependency or external requirement

### Priority Legend

- 🔴 **P0: Critical** - Security, compliance, production blockers (do first)
- 🟠 **P1: High** - User-facing bugs, important features (do soon)
- 🟡 **P2: Medium** - Quality improvements, nice-to-haves (do eventually)
- 🔵 **P3: Low** - Future enhancements, advanced features (do later)

---

## 🏁 Getting Started Checklist for AI Agents

When beginning work on CloudVault:

- [ ] Read this AGENTS.md file completely
- [ ] Review [README.md](./README.md) for project context
- [ ] Scan [docs/architecture/10_OVERVIEW.md](./docs/architecture/10_OVERVIEW.md) for architecture
- [ ] Check [TODO.md](./TODO.md) for current task list
- [ ] Identify priority tasks (🔴 P0 first)
- [ ] Verify local setup: `npm install`, `npm test`
- [ ] Understand test requirements (80% minimum coverage)
- [ ] Review security constraints (NEVER change list)
- [ ] Familiarize with git workflow
- [ ] Ready to contribute! 🚀

---

**Last Updated:** February 5, 2026  
**Maintained By:** CloudVault Team  
**Questions?** See [docs/README.md](./docs/README.md) or create an issue in the repository.

---

_This document provides development guidelines and project context for AI assistants working on CloudVault. For current tasks and priorities, see [TODO.md](./TODO.md)._
