# Integration Tests

This guide outlines how to write and run integration tests in CloudVault.

## Metadata

- **Purpose**: Define integration test scope, setup expectations, and examples.
- **Inputs**: Test helpers, seeded data, mocked external services, and API clients.
- **Outputs**: Verification of module boundaries (routes → storage → db).
- **Invariants**: Integration tests avoid real external services unless explicitly documented.

## Scope

Integration tests validate the seams between modules (routes, storage, database). They should:

- Exercise real code paths across modules.
- Use mocks for external integrations (Replit, GCS).
- Keep runtime under 10 seconds per suite.

## Recommended Locations

- `server/*.test.ts` for backend integration tests.
- `test/integration/` for multi-module user flows.

## Example Workflow Test

```typescript
import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../../server/index";

describe("Share link workflow", () => {
  it("should block downloads without authentication", async () => {
    const response = await request(app).get("/api/files");
    expect(response.status).toBe(401);
  });
});
```

## Running Integration Tests

```bash
npm test -- --grep="integration"
```

## Tips

- Seed predictable data in `beforeEach` for deterministic assertions.
- Clean up timers, connections, and mocks in `afterEach`.
- Keep fixtures in `test/fixtures/` and reuse across suites.
