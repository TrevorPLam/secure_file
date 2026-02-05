# CI/CD Debugging Guide

This guide outlines common CI failures and how to diagnose them.

## Metadata

- **Purpose**: Help contributors quickly resolve CI issues and keep pipelines green.
- **Inputs**: GitHub Actions logs, local environment, and recent commits.
- **Outputs**: Actionable fixes and confirmed local reproductions.
- **Invariants**: Always reproduce failures locally before retrying CI.

## Common Failure Modes

### 1) TypeScript Type Check Fails

**Symptoms**: `npm run check` fails in CI.

**Fix**:

```bash
npm run check
```

Resolve TypeScript errors locally, then re-run.

### 2) Coverage Thresholds Failing

**Symptoms**: `npm run test:coverage` fails with coverage below 100%.

**Fix**:

```bash
npm run test:coverage
```

Identify uncovered lines in `coverage/index.html` and add tests.

### 3) Focused/Skipped Tests Detected

**Symptoms**: `npm run test:check-focused` fails.

**Fix**:

```bash
npm run test:check-focused
```

Remove `.only` or `.skip` usages in tests before re-running.

### 4) Dependency Installation Failures

**Symptoms**: `npm ci` fails due to lockfile mismatch.

**Fix**:

```bash
rm -rf node_modules
npm install
```

Commit the updated `package-lock.json`.

## Debug Checklist

- [ ] Reproduce the CI step locally.
- [ ] Confirm environment variables required by tests are set.
- [ ] Verify lockfile and Node version match CI.
- [ ] Re-run the failing step only after fixing locally.

## Helpful Commands

```bash
npm run check
npm run test:check-focused
npm run test:coverage
```
