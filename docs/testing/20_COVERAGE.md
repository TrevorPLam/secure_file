# Coverage Requirements

CloudVault enforces **100% line and branch coverage** for all first-party, non-generated code.

## What is Covered

### Included in Coverage

- `server/**/*.ts` - All server-side business logic
- `shared/**/*.ts` - Shared types and schemas
- `client/src/lib/**/*.ts` - Client utility functions
- `client/src/hooks/**/*.ts` - React hooks with business logic

### Excluded from Coverage

- `client/src/components/ui/**/*` - Generated shadcn/ui components
- `server/index.ts` - Server bootstrap (environment-specific)
- `server/static.ts` - Static file serving (middleware only)
- `server/vite.ts` - Vite dev server integration
- `script/**/*` - Build scripts
- `**/*.test.ts` - Test files themselves
- `node_modules/**` - Third-party dependencies
- `dist/**` - Build output
- `coverage/**` - Coverage reports

## Coverage Thresholds

Current configuration in `vitest.config.ts`:

```typescript
coverage: {
  lines: 100,
  functions: 100,
  branches: 100,
  statements: 100,
}
```

## How Coverage is Measured

- **Line Coverage**: Percentage of code lines executed
- **Branch Coverage**: Percentage of conditional branches taken
- **Function Coverage**: Percentage of functions called
- **Statement Coverage**: Percentage of statements executed

All four metrics must reach 100% (minus documented exceptions).

## Checking Coverage Locally

```bash
# Generate coverage report
npm run test:coverage

# View in terminal (summary)
# Automatically displayed after running coverage

# View in browser (detailed)
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
```

## Coverage Gates

### Local

```bash
npm run test:coverage
```

Fails if coverage is below thresholds.

### CI/CD

GitHub Actions workflow runs coverage checks on every PR and push.
Builds will fail if coverage drops below 100% (with exceptions).

## Adding New Code

When adding new code:

1. Write tests alongside your implementation
2. Aim for 100% coverage of your new code
3. Run `npm run test:coverage` to verify
4. Fix any uncovered lines/branches
5. Only add to exceptions if absolutely necessary

## Understanding Coverage Reports

### HTML Report Structure

```
coverage/
├── index.html           # Overall summary
├── client/
│   └── src/
│       ├── lib/        # Client libraries (target: 100%)
│       └── hooks/      # React hooks (target: 100%)
├── server/             # Server code (target: 100%)
└── shared/             # Shared code (target: 100%)
```

### Reading Coverage Indicators

- **🟢 Green (100%)**: Fully covered
- **🟡 Yellow (50-99%)**: Partially covered
- **🔴 Red (0-49%)**: Poorly covered

Click on any file in the HTML report to see line-by-line coverage.

## Common Coverage Pitfalls

### Uncovered Branches

❌ **Bad**: Test doesn't cover else branch

```typescript
function isValid(value: string) {
  if (value.length > 0) {
    return true
  }
  return false
}

// Test only checks happy path
expect(isValid('hello')).toBe(true)
```

✅ **Good**: Test covers both branches

```typescript
expect(isValid('hello')).toBe(true)
expect(isValid('')).toBe(false)
```

### Uncovered Error Paths

❌ **Bad**: Doesn't test error handling

```typescript
async function fetchData() {
  try {
    return await api.get('/data')
  } catch (error) {
    return null // Uncovered!
  }
}
```

✅ **Good**: Tests both success and error

```typescript
it('returns data on success', async () => {
  api.get.mockResolvedValue({ data: [] })
  expect(await fetchData()).toEqual({ data: [] })
})

it('returns null on error', async () => {
  api.get.mockRejectedValue(new Error('Network error'))
  expect(await fetchData()).toBeNull()
})
```

## Exceptions

Some code cannot realistically reach 100% coverage. Document these in [99_EXCEPTIONS.md](./99_EXCEPTIONS.md).

Valid reasons for exceptions:

- Platform-specific bootstrap code
- Replit sidecar integration (external service)
- Code that requires production environment
- Dead code scheduled for removal

Invalid reasons:

- "Too hard to test"
- "Not important"
- "Takes too long"

## Maintaining Coverage

### Before Merging

1. Run `npm run test:coverage`
2. Verify 100% coverage (or documented exceptions)
3. Update exception docs if needed
4. Get PR approval

### During Refactoring

- Coverage must not decrease
- If removing code, remove its tests
- If adding code, add tests

### When Fixing Bugs

Add a test that:

1. Reproduces the bug (fails)
2. Passes after the fix
3. Maintains 100% coverage

## No Merge Policy

**PRs will not be merged if:**

- Coverage drops below 100% (minus exceptions)
- New code lacks tests
- Exceptions aren't documented
- Coverage report shows red

This is enforced by CI checks.

## Questions?

See [Test Patterns](./30_TEST_PATTERNS.md) for guidance on writing tests.
