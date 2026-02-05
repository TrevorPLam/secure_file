# Coverage Exceptions

This document lists all code excluded from 100% coverage requirements and the justification for each exception.

## Current Exceptions

### Server Bootstrap Files

**Files**:

- `server/index.ts` - HTTP server initialization
- `server/static.ts` - Static file middleware
- `server/vite.ts` - Vite development server integration

**Reason**: These files contain environment-specific bootstrap code that runs only in production or development environments. They initialize the server, configure middleware, and start listening on ports. Testing these would require spinning up actual servers and is better handled by integration/E2E tests.

**Mitigation**: Core business logic is extracted into testable modules (routes, storage). Bootstrap code is kept minimal and follows established patterns.

**Coverage**: 0% (excluded from coverage calculation)

---

### Generated UI Components

**Files**: `client/src/components/ui/**/*`

**Reason**: These are generated components from shadcn/ui library. They are third-party code that has been copied into our codebase for customization. The library itself is well-tested.

**Mitigation**: We test our custom modifications to these components when they occur. Base components are used as-is from the library.

**Coverage**: Excluded from coverage calculation

---

### Replit Sidecar Integration

**Files**:

- `server/replit_integrations/auth/replitAuth.ts` - Replit auth integration
- `server/replit_integrations/object_storage/routes.ts` - Object storage routes
- `server/replit_integrations/object_storage/index.ts` - Object storage exports

**Reason**: These files integrate with Replit's sidecar service (external service running at localhost:1106). They require the Replit environment to test properly. Mocking the entire sidecar would not provide meaningful test coverage.

**Mitigation**:

- Core logic is tested where possible (see objectStorage.ts tests)
- Path normalization and validation logic is fully tested
- ACL policy logic has unit tests
- Integration tests can be added when running in Replit environment

**Coverage**: Partial (33-70% for testable portions)

---

### Build Scripts

**Files**: `script/**/*`

**Reason**: Build scripts are tools run during development/CI, not runtime application code. They use esbuild and other build tools to bundle the application.

**Mitigation**: Build scripts are kept simple and follow standard patterns. Build failures are caught by CI.

**Coverage**: Excluded from coverage calculation

---

## Exception Review Process

Exceptions should be reviewed quarterly and:

1. **Verified**: Still necessary?
2. **Minimized**: Can coverage be improved?
3. **Documented**: Reason still valid?
4. **Measured**: Track exception scope over time

## Adding New Exceptions

To add a new exception:

1. Write tests for everything testable
2. Document specific lines/functions that cannot be tested
3. Provide detailed justification
4. Propose mitigation strategy
5. Get team approval
6. Update this file
7. Update `vitest.config.ts` if needed

## Exception Guidelines

### Valid Reasons

- Platform-specific bootstrap code
- External service integration (no mock possible)
- Generated/vendored code
- Production-only environment configuration

### Invalid Reasons

- "Too complex to test"
- "Not enough time"
- "Low priority code"
- "Will add tests later"

## Coverage Goals

**Target**: Minimize exceptions over time

**Current Exception Rate**: ~10% of codebase
**Goal**: < 5% by end of Q1 2026

## Questions?

Contact the testing lead or open an issue to discuss coverage exceptions.
