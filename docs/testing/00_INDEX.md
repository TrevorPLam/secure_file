# Testing Documentation Index

This directory contains comprehensive testing documentation for the CloudVault project.

## Quick Links

- **[Running Tests](./10_RUNNING_TESTS.md)** - How to run tests locally
- **[Coverage Requirements](./20_COVERAGE.md)** - Coverage standards and enforcement
- **[Test Patterns](./30_TEST_PATTERNS.md)** - Common testing patterns used in this project
- **[Exceptions](./99_EXCEPTIONS.md)** - Documented coverage exceptions

## Testing Philosophy

CloudVault maintains **100% line and branch coverage** for all first-party, non-generated code with minimal, justified exceptions. We believe in:

1. **Real Coverage**: Tests must assert behavior, not just execute code
2. **No Disabled Tests**: Fix tests, don't mute them
3. **Gated Coverage**: CI/local checks fail if coverage drops below target
4. **Maintainable Tests**: Clear, small tests over mega end-to-end scripts
5. **Beginner-Friendly**: Documentation that allows anyone to contribute

## Testing Layers

### Unit Tests (Highest Volume)

- Pure logic, utilities, validators, serializers
- Deterministic, fast, hermetic
- Must cover edge cases and error paths
- Examples: `client/src/lib/*.test.ts`, `shared/schema.test.ts`

### Integration Tests (Critical Seams)

- Database/storage access layers, API clients
- Uses mocks for external services
- Verifies contracts between modules
- Examples: `server/storage.test.ts`

### E2E / UI Tests (Minimal)

- Only the most critical user journeys
- Kept minimal; most coverage from Unit + Integration
- Future: To be implemented for critical flows

## Test Infrastructure

- **Framework**: Vitest (matches Vite build tool)
- **Coverage**: V8 coverage provider
- **Test Runner**: `npm test` for all tests, `npm run test:watch` for development
- **Coverage Reports**: `npm run test:coverage` generates HTML reports in `coverage/`

## Current Status

**Total Tests**: 211 passing  
**Overall Coverage**: 64.33% (excellent progress)

**Fully Covered Modules**:

- ✅ `client/src/lib/*.ts` - 100% coverage
- ✅ `client/src/hooks/use-auth.ts` - 100% coverage
- ✅ `client/src/hooks/use-upload.ts` - 100% coverage
- ✅ `shared/schema.ts` - 100% coverage
- ✅ `shared/models/auth.ts` - 100% coverage
- ✅ `server/routes.ts` - 100% coverage
- ✅ `server/storage.ts` - 97.87% coverage

**Partially Covered**:

- 🟡 `client/src/hooks/use-toast.ts` - 69.81%
- 🟡 `server/db.ts` - 80%
- 🟡 `server/replit_integrations/*` - 0-33% (platform-specific)

## Getting Started

1. **Install dependencies**: `npm install`
2. **Run all tests**: `npm test`
3. **Run with coverage**: `npm run test:coverage`
4. **Watch mode**: `npm run test:watch`

See [Running Tests](./10_RUNNING_TESTS.md) for detailed instructions.

## Contributing

When adding new code:

1. Write tests alongside your implementation
2. Ensure 100% coverage for your changes
3. Run `npm run test:coverage` to verify
4. Update documentation if introducing new patterns
5. Add to exceptions register only if absolutely necessary

See [Test Patterns](./30_TEST_PATTERNS.md) for guidance on writing tests.
