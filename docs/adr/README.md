# Architecture Decision Records

[← Back to Architecture Index](../architecture/00_INDEX.md)

## What are ADRs?

Architecture Decision Records (ADRs) document significant architectural decisions made in the project. Each ADR captures:
- **Context**: The situation requiring a decision
- **Decision**: What was decided
- **Consequences**: Trade-offs and implications

## Current State

**No formal ADRs exist yet.** This README establishes the ADR format for future decisions.

## ADR Format

Future ADRs should follow this template:

```markdown
# ADR-NNNN: Decision Title

**Status**: Proposed | Accepted | Deprecated | Superseded

**Date**: YYYY-MM-DD

**Deciders**: Names of key decision makers

## Context

What problem are we solving? What constraints exist?

## Decision

What did we decide to do?

## Alternatives Considered

1. **Option A**: Description + why rejected
2. **Option B**: Description + why rejected

## Consequences

### Positive
- Benefit 1
- Benefit 2

### Negative
- Trade-off 1
- Trade-off 2

### Risks
- Risk 1
- Risk 2

## Evidence

Links to relevant code, docs, or external resources.
```

## Implied Decisions (Not Formally Recorded)

Based on codebase analysis, these architectural decisions have been made:

### ADR-0001: Monolithic Architecture

**Decision**: Build as single Node.js process (monolith) instead of microservices.

**Rationale**: 
- Simpler deployment (one Repl)
- Lower complexity for small team
- Faster initial development

**Trade-offs**:
- ✅ Easy to debug and test
- ✅ No inter-service communication overhead
- ❌ Harder to scale independently
- ❌ All code shares same runtime

**Evidence**: [docs/architecture/20_RUNTIME_TOPOLOGY.md](../architecture/20_RUNTIME_TOPOLOGY.md)

---

### ADR-0002: Replit Platform Lock-in

**Decision**: Build on Replit platform (Auth, PostgreSQL, Object Storage).

**Rationale**:
- Integrated auth (no separate identity provider)
- Managed database (no ops overhead)
- Free/cheap hosting for side projects

**Trade-offs**:
- ✅ Fast to set up and deploy
- ✅ No infrastructure management
- ❌ Vendor lock-in (hard to migrate)
- ❌ Limited control over infrastructure

**Evidence**: [docs/integrations/00_INDEX.md](../integrations/00_INDEX.md)

---

### ADR-0003: Session-Based Authentication

**Decision**: Use session cookies (via express-session) instead of JWT.

**Rationale**:
- Replit Auth provides OIDC ID token
- Server-side sessions easier to invalidate
- No need for token refresh logic

**Trade-offs**:
- ✅ Simple logout (delete session)
- ✅ No client-side token management
- ❌ Stateful (requires session store)
- ❌ Harder to scale horizontally (sticky sessions)

**Evidence**: [server/replit_integrations/auth/setup.ts](../../server/replit_integrations/auth/setup.ts)

---

### ADR-0004: Drizzle ORM

**Decision**: Use Drizzle ORM instead of Prisma, TypeORM, or raw SQL.

**Rationale**:
- Type-safe queries with TypeScript
- Lightweight (no heavy runtime)
- Schema-first (types inferred from schema)

**Trade-offs**:
- ✅ Excellent TypeScript integration
- ✅ No code generation step
- ❌ Smaller community than Prisma
- ❌ Less mature migration tooling

**Evidence**: [shared/schema.ts](../../shared/schema.ts)

---

### ADR-0005: Direct Upload to Object Storage

**Decision**: Use presigned URLs for direct client-to-GCS uploads (bypassing server).

**Rationale**:
- Reduces server load (no file streaming)
- Faster uploads (direct to cloud)
- Scalable (no server bottleneck)

**Trade-offs**:
- ✅ Server only handles metadata (lightweight)
- ✅ Parallel uploads scale independently
- ❌ More complex client code (Uppy integration)
- ❌ Two-step process (presigned URL + metadata)

**Evidence**: [docs/architecture/40_KEY_FLOWS.md](../architecture/40_KEY_FLOWS.md) (Flow 2)

---

### ADR-0006: shadcn/ui Component Library

**Decision**: Use shadcn/ui (copy-paste components) instead of Material-UI or Ant Design.

**Rationale**:
- Full control over component code
- Tailwind CSS integration
- Accessible (Radix UI primitives)

**Trade-offs**:
- ✅ Customizable (own the code)
- ✅ No runtime dependencies
- ❌ More code to maintain
- ❌ Manual updates (no npm update)

**Evidence**: [components.json](../../components.json), [client/src/components/ui/](../../client/src/components/ui/)

---

### ADR-0007: Monorepo with Shared Types

**Decision**: Use monorepo structure with `shared/` folder for types.

**Rationale**:
- Single source of truth for schemas
- Type safety between client and server
- No type drift

**Trade-offs**:
- ✅ Refactor-safe (rename propagates)
- ✅ Zod schemas reused for validation
- ❌ Tight coupling between client/server
- ❌ Shared code must be environment-agnostic

**Evidence**: [docs/architecture/30_MODULES_AND_DEPENDENCIES.md](../architecture/30_MODULES_AND_DEPENDENCIES.md)

---

### ADR-0008: No Background Workers

**Decision**: No separate background job queue (no Redis, no Bull, no workers).

**Rationale**:
- Simpler architecture
- All operations synchronous (good enough for MVP)
- No infrastructure overhead

**Trade-offs**:
- ✅ Simpler deployment
- ✅ No queue management
- ❌ Long operations block requests
- ❌ No retry mechanism for failed operations

**Evidence**: [docs/architecture/20_RUNTIME_TOPOLOGY.md](../architecture/20_RUNTIME_TOPOLOGY.md)

---

### ADR-0009: Cascade Deletes in Application Code

**Decision**: Implement cascade deletes in application code, not database foreign keys.

**Rationale**:
- More control over deletion logic
- Can add logging/auditing
- Flexible for future changes

**Trade-offs**:
- ✅ Explicit control
- ✅ Can customize per-deletion
- ❌ Risk of orphaned records if code has bugs
- ❌ Not transactional (partial failures possible)

**Evidence**: [server/storage.ts](../../server/storage.ts):80-93

---

### ADR-0010: No Automated Tests

**Decision**: Ship without automated test suite (manual testing only).

**Rationale**:
- Faster MVP development
- Small codebase (easier to test manually)
- Resource constraints

**Trade-offs**:
- ✅ Faster initial development
- ❌ Higher risk of regressions
- ❌ Harder to refactor confidently
- ❌ No CI pipeline

**Evidence**: No `test/` directory, no test scripts in [package.json](../../package.json)

## Future ADRs

When making significant architectural changes, create a new ADR file:

**Naming**: `NNNN_short_title.md` (e.g., `0011_add_background_jobs.md`)

**Location**: `docs/adr/`

**Process**:
1. Copy template above
2. Fill in sections
3. Discuss with team
4. Mark as "Accepted" when decided
5. Link from this README

## When to Write an ADR

Write an ADR for decisions that:
- Change system architecture
- Introduce new dependencies
- Impact performance or security
- Affect multiple modules
- Have long-term consequences

**Don't write ADRs for**:
- Minor code refactors
- Bug fixes
- UI tweaks
- Routine maintenance

## ADR Status Values

- **Proposed**: Under discussion
- **Accepted**: Implemented
- **Deprecated**: No longer recommended
- **Superseded**: Replaced by newer ADR

## Evidence

Key files referenced:
- [docs/architecture/](../architecture/) - Architectural documentation
- [server/](../../server/) - Backend implementation
- [client/](../../client/) - Frontend implementation
- [shared/schema.ts](../../shared/schema.ts) - Database schema

## Related Documentation

- [Architecture Overview](../architecture/10_OVERVIEW.md) - Current architecture
- [Modules & Dependencies](../architecture/30_MODULES_AND_DEPENDENCIES.md) - Code structure
- [Integrations](../integrations/00_INDEX.md) - Third-party decisions

## External Resources

- [ADR GitHub organization](https://adr.github.io/) - ADR best practices
- [Michael Nygard's ADR template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) - Original ADR concept

[← Back to Architecture Index](../architecture/00_INDEX.md)
