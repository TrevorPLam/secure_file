# Test Data Management

This guide covers how to manage test data for consistent, repeatable tests.

## Metadata

- **Purpose**: Provide guidance for creating and maintaining deterministic test data.
- **Inputs**: Fixtures, seed scripts, mock data, and test helpers.
- **Outputs**: Reliable tests that can run in any environment.
- **Invariants**: Test data must never include production secrets or PII.

## Principles

1. **Deterministic**: Use fixed IDs and timestamps when possible.
2. **Minimal**: Create the smallest dataset that exercises the behavior.
3. **Isolated**: Each test should set up and clean its own data.
4. **Reusable**: Shared fixtures live in `test/fixtures/`.

## Fixtures

Store reusable fixtures in `test/fixtures/`:

```
test/
  fixtures/
    files.ts
    users.ts
```

Example fixture:

```typescript
export const testUser = {
  id: "user_test_01",
  email: "test@example.com",
  name: "Test User",
};
```

## Seeding Guidelines

- Seed in `beforeEach` when tests require known state.
- Clean up in `afterEach` to avoid cross-test leakage.
- Prefer factories for consistent defaults.

## Avoiding Flaky Data

- Do not depend on real time; use fake timers or fixed timestamps.
- Avoid ordering assumptions without explicit sorting.
- Mock external services with stable responses.
