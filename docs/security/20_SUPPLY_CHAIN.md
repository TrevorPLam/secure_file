# Supply Chain Security

## Overview

CloudVault depends on **92 direct dependencies** (56 production, 36 development) and hundreds of transitive dependencies. This document establishes policies for **dependency management**, **vulnerability scanning**, and **supply chain attack prevention**.

**Risk Context**: npm ecosystem incidents (event-stream, ua-parser-js, colors.js) demonstrate supply chain vulnerabilities can bypass traditional security controls.

---

## Dependency Inventory

### Production Dependencies (56 packages)

**High-Risk Dependencies** (direct access to sensitive operations):

| Package | Version | Purpose | Risk Profile |
|---------|---------|---------|--------------|
| `express` | 5.0.1 | HTTP server | **HIGH** - Network-facing, attack surface |
| `express-session` | 1.19.0 | Session management | **HIGH** - Handles authentication state |
| `pg` | 8.16.3 | PostgreSQL driver | **HIGH** - Database access |
| `bcryptjs` | 3.0.3 | Password hashing | **HIGH** - Cryptographic operations |
| `openid-client` | 6.8.1 | OIDC authentication | **HIGH** - Identity verification |
| `@google-cloud/storage` | 7.18.0 | GCS SDK | **HIGH** - File storage access |
| `passport` | 0.7.0 | Authentication middleware | **MEDIUM** - Auth logic |
| `drizzle-orm` | 0.39.3 | Database ORM | **MEDIUM** - SQL query generation |
| `zod` | 3.24.2 | Input validation | **MEDIUM** - Security boundary |

**UI/Non-Security Dependencies** (42 packages):
- React ecosystem: `react@18.3.1`, `react-dom@18.3.1`, `@tanstack/react-query`
- UI components: 26 `@radix-ui` packages (badge, dialog, dropdown, etc.)
- Styling: `tailwindcss`, `clsx`, `tailwind-merge`
- File upload: `@uppy/core`, `@uppy/dashboard`, `@uppy/aws-s3`

**Evidence**: `package.json:18-92`

---

### Development Dependencies (36 packages)

**Build & Test Tools** (non-runtime, lower risk):

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | 7.3.0 | Build tool |
| `vitest` | 4.0.18 | Test runner |
| `typescript` | 5.6.3 | Type checker |
| `esbuild` | 0.25.0 | JavaScript bundler |
| `drizzle-kit` | 0.31.8 | Database migrations |

**Testing Libraries**:
- `@testing-library/react`, `@testing-library/user-event`
- `supertest` (HTTP testing)
- `@vitest/coverage-v8` (code coverage)

**Evidence**: `package.json:94-126`

---

## Lockfile Enforcement

### package-lock.json (`package.json:1-135`)

**Purpose**: Pins exact versions of all dependencies (direct + transitive) to ensure reproducible builds

**Security Properties**:
- ✅ Prevents automatic updates to compromised versions
- ✅ Ensures CI/CD uses same versions as local development
- ✅ Includes integrity hashes (SHA-512) for all packages

**Example Entry**:
```json
"bcryptjs": {
  "version": "3.0.3",
  "resolved": "https://registry.npmjs.org/bcryptjs/-/bcryptjs-3.0.3.tgz",
  "integrity": "sha512-O3fKlLZ2Y0gq1lCfUCULSNjQ0K0Qfzw1x9UiJGq1AQMJ5J1TrKTxFjYKl8k6HKsKh9c5z0vYQjvN5lKM+FtLqw=="
}
```

**Integrity Verification**:
- npm verifies SHA-512 hash during `npm install`
- Mismatch → install fails (prevents registry compromise or MITM attacks)

---

### CI/CD Lockfile Usage (`.github/workflows/test-coverage.yml:28`)

**Command**:
```yaml
- name: Install dependencies
  run: npm ci
```

**Security Properties**:
- ✅ `npm ci` (clean install) uses `package-lock.json` exclusively
- ✅ Fails if `package.json` and lockfile are out of sync
- ✅ Removes `node_modules` before install (no leftover malicious code)

**Comparison to `npm install`**:
| Command | Lockfile Behavior | Security Implication |
|---------|------------------|----------------------|
| `npm install` | Updates lockfile if `package.json` changes | ⚠️ Can silently upgrade dependencies |
| `npm ci` | Requires exact lockfile match | ✅ Reproducible, secure builds |

**Policy**: Always use `npm ci` in CI/CD, never `npm install`

---

## Vulnerability Scanning

### Current State: ❌ Not Automated

**Gap**: No `npm audit` in CI/CD pipeline

**Evidence**: `.github/workflows/test-coverage.yml` does not include vulnerability scanning step

---

### npm audit Integration (Recommended)

**Add to CI/CD**:
```yaml
- name: Security audit
  run: npm audit --production --audit-level=moderate
  continue-on-error: false # Fail build on vulnerabilities
```

**Audit Levels**:
- `info`: Informational (non-security updates)
- `low`: Low severity (fail-safe to ignore)
- `moderate`: **Recommended threshold** (balance security vs. noise)
- `high`: High severity (always fail)
- `critical`: Critical severity (always fail)

**Rationale for `moderate`**:
- Blocks exploitable vulnerabilities (CVSS ≥ 4.0)
- Low severity issues often false positives (e.g., RegEx DoS in dev tools)

---

### Automated Dependency Updates (Recommended)

**Option 1: Dependabot (GitHub)**

**Configuration** (`.github/dependabot.yml`):
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    commit-message:
      prefix: "chore(deps)"
    groups:
      security:
        patterns:
          - "*"
        dependency-type: "production"
        update-types:
          - "security"
```

**Security Benefits**:
- Automatic PRs for security updates
- Separates security patches from feature updates
- Runs CI tests before merge

**Option 2: Renovate Bot**

**Configuration** (`renovate.json`):
```json
{
  "extends": ["config:recommended", ":semanticCommits"],
  "vulnerabilityAlerts": {
    "enabled": true,
    "labels": ["security"]
  },
  "schedule": ["before 5am on Monday"]
}
```

---

## Dependency Hygiene Rules

### 1. Direct vs. Transitive Dependencies

**Policy**: Only add direct dependencies when necessary; rely on transitive dependencies for sub-dependencies

**Rationale**:
- Reduces attack surface (fewer packages to audit)
- Simplifies dependency graph (easier to identify vulnerabilities)

**Example**:
```json
// ❌ Bad - Redundant direct dependency
{
  "dependencies": {
    "express": "5.0.1",
    "body-parser": "1.20.0" // Already included by express
  }
}

// ✅ Good - Rely on transitive dependency
{
  "dependencies": {
    "express": "5.0.1" // Includes body-parser
  }
}
```

---

### 2. Minimize Dependencies for Core Security Functions

**Policy**: Prefer Node.js built-in modules over third-party packages for cryptographic operations

**Examples**:
- ✅ Use `crypto.randomUUID()` (built-in) over `uuid` package
- ✅ Use `crypto.pbkdf2()` (built-in) over custom PBKDF2 implementation
- ⚠️ Exception: bcrypt requires native library (no pure JS built-in)

**Current State**: ✅ CloudVault uses `crypto.randomUUID()` (verified in `objectStorage.ts:153`)

---

### 3. Avoid Deprecated Packages

**Check for Deprecation**:
```bash
npm outdated
npm deprecate
```

**Current Gaps** (check periodically):
- None identified as of 2025-02-04

---

### 4. License Compliance

**Policy**: Only use packages with permissive licenses (MIT, Apache 2.0, BSD)

**Prohibited Licenses**:
- GPL (requires derivative works to be GPL)
- AGPL (requires source disclosure for network services)
- Commercial licenses without approval

**Audit Command**:
```bash
npx license-checker --summary --production
```

**Expected Output** (CloudVault):
```
MIT: 45 packages
Apache-2.0: 8 packages
BSD-3-Clause: 3 packages
```

---

## Supply Chain Attack Vectors

### 1. Compromised npm Account (Maintainer Takeover)

**Historical Examples**:
- `event-stream` (2018): Malicious dependency added by new maintainer
- `ua-parser-js` (2021): Maintainer account compromised, malware published
- `coa` (2021): Account takeover, cryptocurrency miner injected

**Mitigations**:
- ✅ Lockfile pins exact versions (prevents automatic upgrades)
- ✅ npm integrity hashes verify package contents
- ⚠️ **MISSING**: No SBOM (Software Bill of Materials) for audit trail
- ⚠️ **MISSING**: No package signature verification

**Recommended**: Generate SBOM for every release (see `21_SBOM_AND_PROVENANCE.md`)

---

### 2. Dependency Confusion Attack

**Attack**: Attacker publishes malicious package with same name as internal package to public npm registry

**Example**:
```json
// Internal package (private registry)
"@cloudvault/auth": "1.0.0"

// Attacker publishes to public npm
"@cloudvault/auth": "99.0.0" // Higher version tricks npm into installing
```

**Mitigations**:
- ✅ CloudVault has no internal packages (not vulnerable)
- ✅ Scoped packages (`@cloudvault/*`) require npm organization ownership

**Prevention for Future**:
```json
// .npmrc - Scope to private registry
@cloudvault:registry=https://npm.pkg.github.com
```

---

### 3. Typosquatting

**Attack**: Attacker publishes malicious package with similar name to popular package

**Examples**:
- `react-native-svg` → `react-native-sgv` (typo)
- `lodash` → `loadash` (typo)

**Mitigations**:
- ✅ Lockfile prevents accidental installation (exact package name pinned)
- ✅ Code review for new dependencies (human verification)

**Detection**:
```bash
# Check for suspicious package names
npx snyk test --detection-depth=5
```

---

### 4. Prototype Pollution

**Vulnerability**: Malicious package modifies `Object.prototype`, affecting all JavaScript objects

**Example**:
```javascript
// Malicious package
Object.prototype.isAdmin = true;

// Victim code
if (user.isAdmin) { /* Admin access granted */ }
```

**Mitigations**:
- ✅ Node.js `--frozen-intrinsics` flag (not currently used)
- ⚠️ **MISSING**: No runtime prototype pollution detection

**Detection in CI**:
```bash
# Scan for prototype pollution vulnerabilities
npx snyk test --severity-threshold=high
```

---

## Dependency Update Process

### Monthly Audit Workflow

1. **Check for Outdated Packages**:
   ```bash
   npm outdated --long
   ```

2. **Review Security Advisories**:
   ```bash
   npm audit --production
   ```

3. **Update Non-Breaking Changes**:
   ```bash
   npm update --save # Updates within semver range
   ```

4. **Test After Updates**:
   ```bash
   npm run test
   npm run build
   ```

5. **Commit Lockfile**:
   ```bash
   git add package-lock.json
   git commit -m "chore(deps): Update dependencies [security]"
   ```

6. **Document Breaking Changes**:
   - Create ADR (Architecture Decision Record) for major version upgrades
   - Example: `docs/adr/0015-upgrade-react-19.md`

---

### Emergency Security Patch Process

**Scenario**: Critical vulnerability announced in production dependency (e.g., `express` RCE)

**Response Timeline**:
1. **T+0 hours**: Security advisory received
2. **T+1 hour**: Assess impact (does CloudVault use vulnerable code path?)
3. **T+2 hours**: Update dependency, run tests
4. **T+4 hours**: Deploy hotfix to production
5. **T+24 hours**: Postmortem and preventative measures

**Commands**:
```bash
# Emergency update
npm install express@latest-security
npm audit fix --force # Auto-fixes vulnerabilities
npm test
git commit -m "security: Patch express RCE (CVE-2024-XXXX)"
```

---

## Package Verification

### Integrity Hash Verification

**Automatic**: npm verifies `integrity` field in `package-lock.json` during install

**Manual Verification** (for critical packages):
```bash
# Download tarball
npm pack bcryptjs@3.0.3

# Verify SHA-512 hash
shasum -a 512 bcryptjs-3.0.3.tgz

# Compare to package-lock.json integrity field
# Expected: sha512-O3fKlLZ2Y0gq1lCfUCULSNjQ0K0Qfzw1x9UiJGq1AQMJ5J1TrKTxFjYKl8k6HKsKh9c5z0vYQjvN5lKM+FtLqw==
```

---

### Package Signature Verification (Future)

**npm provenance** (experimental feature as of npm 9+):
```bash
npm publish --provenance
```

**Benefits**:
- Links package to source repository and commit
- Verifies package built from declared source code
- Prevents package substitution attacks

**Requirement**: CloudVault not currently published to npm (internal use only)

---

## Third-Party Security Scanning Tools

### Recommended Tools

1. **Snyk** (commercial, free tier available)
   ```bash
   npx snyk test --all-projects
   npx snyk monitor # Continuous monitoring
   ```

2. **Socket.dev** (malware & supply chain analysis)
   ```bash
   npx socket-security analyze
   ```

3. **npm audit** (built-in)
   ```bash
   npm audit --production --json > audit-report.json
   ```

4. **OSV-Scanner** (Google's open-source vulnerability scanner)
   ```bash
   osv-scanner --lockfile=package-lock.json
   ```

---

## Developer Workstation Security

### Pre-commit Hooks (Recommended)

**Install Husky**:
```bash
npm install --save-dev husky
npx husky install
```

**Hook: Prevent Lockfile Desync** (`.husky/pre-commit`):
```bash
#!/bin/sh
npm ci --dry-run || {
  echo "ERROR: package-lock.json is out of sync with package.json"
  exit 1
}
```

**Hook: Block Known Malicious Packages** (`.husky/pre-commit`):
```bash
#!/bin/sh
# Check against known malicious packages
grep -q "event-stream@3.3.6" package-lock.json && {
  echo "ERROR: Known malicious package detected"
  exit 1
}
```

---

## Incident Response: Compromised Dependency

### Detection Indicators

- Unexpected network connections during `npm install`
- Unusual postinstall scripts (`package.json:scripts.postinstall`)
- New dependencies added without PR
- npm audit reports critical vulnerability

### Response Procedure

1. **Isolate**: Stop deployment, rollback to last known good version
2. **Identify**: Determine which package is compromised
   ```bash
   npm ls <package-name> # Find transitive dependency path
   ```
3. **Remove**: Uninstall compromised package
   ```bash
   npm uninstall <package-name>
   npm audit fix --force
   ```
4. **Verify**: Check for malicious code execution
   ```bash
   # Check for suspicious files created
   find . -name "*.exe" -o -name "*.sh" -mtime -1
   
   # Check for credential theft
   grep -r "PASSWORD\|SECRET\|TOKEN" .
   ```
5. **Rotate Secrets**: Assume credentials compromised (see `60_INCIDENT_RESPONSE.md`)
6. **Document**: Create postmortem, add to threat model

---

## Compliance & Reporting

### SBOM Generation (See `21_SBOM_AND_PROVENANCE.md`)

**Generate CycloneDX SBOM**:
```bash
npx @cyclonedx/cyclonedx-npm --output-file sbom.json
```

**Publish SBOM with Release**:
```bash
gh release create v1.0.0 --notes "Release notes" sbom.json
```

---

## References

- **npm Security Best Practices**: [npm Docs](https://docs.npmjs.com/packages-and-modules/securing-your-code)
- **OWASP Dependency Check**: [Link](https://owasp.org/www-project-dependency-check/)
- **Snyk Vulnerability Database**: [Link](https://security.snyk.io/)
- **Socket.dev Supply Chain Security**: [Link](https://socket.dev/)

---

**Last Updated**: 2025-02-04  
**Next Review**: 2025-05-04
