# CloudVault Backlog

This backlog tracks follow-up work identified during sessions. Items are ordered by impact.

## Metadata

- **Purpose**: Track follow-up tasks and deferred work for future sessions.
- **Inputs**: Session reflections, testing gaps, and documentation needs.
- **Outputs**: Prioritized task list for promotion into TODO items.
- **Invariants**: Entries should be actionable, scoped, and avoid duplicates.

## High Priority

- **Install lint/format dependencies in CI-capable environment**: Run `npm ci` (or approved mirror) to resolve `eslint`, `prettier`, and `@typescript-eslint/*`, then validate `npm run lint` and `npm run format:check`.
- **Regenerate lockfile after dependency sync**: Update `package-lock.json` to include lint/format toolchain once registry access is available.
- **Confirm CODEOWNERS handles**: Replace placeholder GitHub teams in `.github/CODEOWNERS` with real org teams/usernames.

## Medium Priority

- **Enable optional pre-commit hook**: Add Husky/lint-staged once lint dependencies are available and team agreement is documented.
- **Dependabot reviewers**: Decide reviewers/auto-merge policies and update `.github/dependabot.yml` accordingly.
- **Performance test automation**: Add optional CI job for `test/performance/` runs once baselines are agreed.

## Low Priority

- **Add integration test templates**: Provide reusable fixtures/utilities in `test/fixtures/` to speed up integration testing.
