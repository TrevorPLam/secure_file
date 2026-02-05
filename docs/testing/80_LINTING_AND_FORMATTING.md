# Linting and Formatting

## Metadata

- **Purpose**: Define code-style and static analysis checks for local development and CI.
- **Inputs**: TypeScript/React source files in `server/`, `shared/`, and `client/src/`.
- **Outputs**: Lint diagnostics, optional auto-fixes, and consistent formatting.
- **Invariants**:
  - Lint runs in CI before typecheck/tests.
  - Formatting uses Prettier defaults defined in `.prettierrc.json`.
  - Focus remains on first-party source files.

## Configuration Summary

- ESLint config: `.eslintrc.json`
- ESLint ignore list: `.eslintignore`
- Prettier config: `.prettierrc.json`
- CI workflow integration: `.github/workflows/test-coverage.yml`

## Local Commands

```bash
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

## Notes

- If dependencies are not yet installed in a restricted environment, run `npm ci` in an allowed environment before invoking lint/format scripts.
- `@typescript-eslint/no-explicit-any` is currently set to warning to support incremental cleanup.
