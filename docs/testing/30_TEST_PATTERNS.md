# Test Patterns

Common testing patterns used in the CloudVault project.

## Metadata

- **Purpose**: Provide repeatable testing templates for unit, integration, and UI tests.
- **Inputs**: Code under test, mocks/stubs, and supporting test utilities.
- **Outputs**: Deterministic expectations verifying behavior and error handling.
- **Invariants**: Tests must be isolated, readable, and avoid external side effects.

## Test Structure

### Standard Test Template

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { functionToTest } from "./module";

describe("ModuleName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("functionName", () => {
    it("should handle happy path", () => {
      const result = functionToTest("valid input");
      expect(result).toBe("expected output");
    });

    it("should handle edge case", () => {
      const result = functionToTest("");
      expect(result).toBeNull();
    });

    it("should throw on invalid input", () => {
      expect(() => functionToTest(null)).toThrow("Invalid input");
    });
  });
});
```

## Mocking Patterns

### Database Mocking

```typescript
vi.mock("../server/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { db } from "../server/db";

// In test
const mockInsert = {
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([mockData]),
};
(db.insert as any).mockReturnValue(mockInsert);
```

### API Request Mocking

```typescript
beforeEach(() => {
  global.fetch = vi.fn();
});

// Mock successful response
(global.fetch as any).mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: "test" }),
});

// Mock error response  
(global.fetch as any).mockResolvedValue({
  ok: false,
  status: 404,
  text: () => Promise.resolve("Not found"),
});
```

## Async Testing

```typescript
it("should handle async operations", async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

it("should handle async errors", async () => {
  await expect(failingAsyncFunction()).rejects.toThrow("Error message");
});
```

## Testing React Hooks

```typescript
import { renderHook, act } from "@testing-library/react";
import { useMyHook } from "./use-my-hook";

it("should update state", () => {
  const { result } = renderHook(() => useMyHook());
  
  act(() => {
    result.current.updateValue("new value");
  });
  
  expect(result.current.value).toBe("new value");
});
```

## Time-Based Testing

```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it("should execute after timeout", () => {
  const callback = vi.fn();
  setTimeout(callback, 1000);
  
  vi.advanceTimersByTime(1000);
  expect(callback).toHaveBeenCalled();
});
```

## Error Testing

```typescript
it("should handle errors", () => {
  expect(() => {
    throwingFunction();
  }).toThrow("Expected error message");
});

it("should handle specific error types", () => {
  expect(() => {
    throwingFunction();
  }).toThrow(CustomError);
});
```

## Parameterized Tests

```typescript
const testCases = [
  { input: "hello", expected: "HELLO" },
  { input: "world", expected: "WORLD" },
  { input: "", expected: "" },
];

testCases.forEach(({ input, expected }) => {
  it(`should convert "${input}" to "${expected}"`, () => {
    expect(toUpperCase(input)).toBe(expected);
  });
});
```

## Integration Test Pattern

```typescript
import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../server/index";

describe("File routes", () => {
  it("should reject unauthenticated access", async () => {
    const response = await request(app).get("/api/files");
    expect(response.status).toBe(401);
  });
});
```

## Anti-Patterns to Avoid

### ❌ Testing Implementation Details
```typescript
// Bad: Testing internal state
expect(component.state.isLoading).toBe(true);

// Good: Testing behavior
expect(screen.getByText("Loading...")).toBeInTheDocument();
```

### ❌ Over-Mocking
```typescript
// Bad: Mocking everything
vi.mock("./utils", () => ({ all: "mocked" }));

// Good: Mock only external dependencies
vi.mock("external-api-client");
```

### ❌ Brittle Snapshots
```typescript
// Bad: Full component snapshot
expect(component).toMatchSnapshot();

// Good: Specific assertions
expect(component.props.value).toBe("expected");
```

## Best Practices

1. **Test behavior, not implementation**
2. **One assertion per test** (or related assertions)
3. **Clear test names**: "should [expected behavior] when [condition]"
4. **Arrange, Act, Assert** pattern
5. **Independent tests**: No shared state between tests
6. **Mock external dependencies**: Network, filesystem, time
7. **Test edge cases**: null, undefined, empty, max values
8. **Test error paths**: Exceptions, rejections, invalid input

## Coverage Checklist

For each function/module, ensure tests cover:

- ✅ Happy path
- ✅ Edge cases (empty, null, undefined)
- ✅ Error conditions
- ✅ All branches (if/else, switch, ternary)
- ✅ Async success and failure
- ✅ Boundary values

See [Coverage Requirements](./20_COVERAGE.md) for more details.
