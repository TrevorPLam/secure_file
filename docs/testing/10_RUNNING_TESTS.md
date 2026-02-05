# Running Tests

This guide explains how to run tests in the CloudVault project.

## Prerequisites

- Node.js 20+
- Dependencies installed: `npm install`

## Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI (interactive browser interface)
npm run test:ui
```

## Running Specific Tests

### Single Test File

```bash
npm test -- path/to/test-file.test.ts
```

Examples:

```bash
npm test -- client/src/lib/utils.test.ts
npm test -- server/storage.test.ts
```

### Tests Matching a Pattern

```bash
npm test -- --grep="pattern"
```

Examples:

```bash
npm test -- --grep="should create"
npm test -- --grep="auth"
```

### Single Test Suite or Test

Use `.only` in your test file temporarily:

```typescript
describe.only('my suite', () => {
  it.only('my test', () => {
    // ...
  })
})
```

**Remember to remove `.only` before committing!**

## Understanding Test Output

### Passing Tests

```
✓ client/src/lib/utils.test.ts (9 tests) 12ms
```

### Failing Tests

```
× should do something
  AssertionError: expected 5 to equal 10
```

### Coverage Summary

```
Coverage report from v8
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
All files          |   28.82 |     28.5 |   43.22 |   28.31 |
```

## Coverage Reports

After running `npm run test:coverage`:

1. **Console Output**: Shows coverage summary in terminal
2. **HTML Report**: Open `coverage/index.html` in browser for detailed visualization
3. **LCOV Report**: Machine-readable format in `coverage/lcov.info`

### Viewing HTML Coverage Report

```bash
# Generate coverage
npm run test:coverage

# Open in browser (macOS)
open coverage/index.html

# Open in browser (Linux)
xdg-open coverage/index.html

# Or just navigate to the file in your file explorer
```

## Test Organization

Tests are colocated with source files:

```
server/
  storage.ts          # Source file
  storage.test.ts     # Test file
client/src/lib/
  utils.ts            # Source file
  utils.test.ts       # Test file
```

## Debugging Tests

### VSCode Debug Configuration

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Vitest Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test:watch"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Console Debugging

Add `console.log()` statements in your tests or use Vitest's built-in debugging:

```typescript
import { it, expect } from 'vitest'

it('should debug', () => {
  const value = someFunction()
  console.log('Debug value:', value)
  expect(value).toBe(expected)
})
```

### Browser UI Debugging

```bash
npm run test:ui
```

Opens an interactive UI in your browser where you can:

- See test results in real-time
- Filter and search tests
- View detailed error messages
- Inspect coverage

## Troubleshooting

### Tests Fail with "Cannot find module"

**Solution**: Ensure all dependencies are installed:

```bash
npm install
```

### Tests Timeout

**Solution**: Increase timeout for slow tests:

```typescript
it('slow test', async () => {
  // test code
}, 10000) // 10 second timeout
```

### Mock Issues

**Solution**: Clear mocks between tests:

```typescript
import { beforeEach, vi } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
})
```

### Coverage Not Updating

**Solution**: Clear coverage cache:

```bash
rm -rf coverage/
npm run test:coverage
```

## CI/CD Integration

Tests run automatically on:

- Every push to a branch
- Every pull request
- Before merging to main

CI will **fail** if:

- Any test fails
- Coverage drops below 100% (with allowed exceptions)
- Linting errors are present

## Best Practices

1. **Run tests before committing**: `npm test`
2. **Check coverage locally**: `npm run test:coverage`
3. **Use watch mode during development**: `npm run test:watch`
4. **Keep tests fast**: Unit tests should complete in milliseconds
5. **Clean up after tests**: Use `afterEach` to reset state

## Performance Tips

- Run specific test files during development
- Use watch mode to avoid full re-runs
- Mock expensive operations (network, filesystem)
- Keep test data minimal
- Avoid unnecessary setup in tests

## Next Steps

- [Coverage Requirements](./20_COVERAGE.md) - Understanding coverage targets
- [Test Patterns](./30_TEST_PATTERNS.md) - Writing effective tests
- [Exceptions](./99_EXCEPTIONS.md) - Coverage exceptions
