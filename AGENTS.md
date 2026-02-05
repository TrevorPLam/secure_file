# AGENTS.md - CloudVault Project Guide for AI Assistants

**Last Updated:** February 4, 2026  
**Project:** CloudVault - Secure File Sharing Platform  
**Status:** Production-ready MVP with optional improvements  
**Test Coverage:** 64.33% (211 passing tests)  
**DIAMOND Grade:** A (91.4% - Excellent)

---

## 📋 Purpose of This Document

This document provides AI coding assistants with:

- **Project context** and architecture overview
- **Prioritized task list** from TODO.md
- **Development guidelines** and best practices
- **Safety constraints** and critical considerations
- **Testing requirements** and quality standards

**For human developers:** See [README.md](./README.md) and [docs/](./docs/) for complete documentation.

---

## 🏗️ Project Overview

### What is CloudVault?

CloudVault is a secure file sharing and storage application that enables users to:

- Upload and organize files in hierarchical folders
- Share files via password-protected, time-limited links
- Track download counts and access analytics
- Authenticate securely via Replit Auth (OpenID Connect)

### Technology Stack

- **Frontend:** React 18, TypeScript, Vite, shadcn/ui, Tailwind CSS
- **Backend:** Express.js, TypeScript, Node.js
- **Database:** PostgreSQL with Drizzle ORM
- **Storage:** Google Cloud Storage (via Replit)
- **Auth:** Replit Auth (OIDC)
- **Hosting:** Replit platform

### Project Structure

```
secure_file/
├── client/          # React frontend
│   └── src/
│       ├── components/  # UI components (shadcn/ui)
│       ├── hooks/       # Custom React hooks
│       ├── lib/         # Utilities and API client
│       └── pages/       # Route components
├── server/          # Express backend
│   ├── replit_integrations/  # Auth and storage
│   ├── routes.ts    # API endpoints
│   ├── storage.ts   # Data access layer
│   ├── security.ts  # Security middleware
│   └── db.ts        # Database connection
├── shared/          # Shared types/schemas
│   └── schema.ts    # Drizzle ORM schema
├── docs/            # Architecture documentation
└── test/            # Test utilities
```

---

## 🎯 Current Priority Tasks

### 🔴 CRITICAL - Quick Wins (1-2 Days)

#### 1. Add Dedicated LICENSE File (30 minutes) ✅ COMPLETED

**Current:** 10/10 - Standard LICENSE file created  
**Target:** 10/10 - Standard LICENSE file  
**Impact:** +2 DIAMOND points

**Task:**

- [x] Create `LICENSE` file in project root
- [x] Copy MIT license text with 2026 copyright
- [ ] Commit to repository

```text
MIT License

Copyright (c) 2026 CloudVault Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

#### 2. Add ESLint + Prettier (4-8 hours) ✅ COMPLETED
**Current:** 10/10 - Enforced code style  
**Target:** 10/10 - Enforced code style  
**Impact:** +1 DIAMOND point

**Task:**
- [x] Install dependencies: `eslint`, `prettier`, `eslint-config-prettier`, `eslint-plugin-react`, `@typescript-eslint/*`
- [x] Create `.eslintrc.json` with TypeScript/React config
- [x] Create `.prettierrc.json` with formatting rules
- [x] Add lint/format scripts to package.json
- [x] Run format on existing codebase
- [x] Add ESLint check to CI (.github/workflows/test-coverage.yml)

**Files to create:**
- [x] `.eslintrc.json`
- [x] `.prettierrc.json`
- [x] `.eslintignore`

---

#### 3. Add CODEOWNERS File (15 minutes) ✅ COMPLETED

**Current:** 10/10 - Clear code ownership established  
**Target:** 10/10 - Clear code ownership  
**Impact:** +1 DIAMOND point

**Task:**

- [x] Create `.github/CODEOWNERS`
- [x] Define ownership for security, testing, docs areas
- [ ] Commit to repository

---

### 🔴 HIGH PRIORITY - Security & Compliance (2-4 Weeks)

#### 4. Implement CSRF Protection (4 hours)

**Priority:** P0 - Security Critical  
**Impact:** +3 DIAMOND points in Security

**Task:**

- [ ] Create `server/csrf.ts` with token generation/validation
- [ ] Add CSRF middleware to routes
- [ ] Update client API to include CSRF token in requests
- [ ] Create `server/csrf.test.ts` with comprehensive tests
- [ ] Test manually: Verify 403 on missing token

**Key Functions:**

- `generateCsrfToken()` - Cryptographically secure token
- `validateCsrfToken(userId, token)` - Timing-safe comparison
- `requireCsrf` middleware - Protect state-changing routes
- `attachCsrfToken` middleware - Add token to requests

**Safety Notes:**

- Use constant-time comparison to prevent timing attacks
- Token lifetime: 24 hours
- Store tokens in session or Redis (not in-memory for production)

---

#### 5. Structured Audit Logging (32 hours / 1 week)

**Priority:** P0 - Required for SOC 2  
**Current:** 7/10 - Console logging only  
**Target:** 9/10 - Tamper-proof audit logs  
**Impact:** +3 DIAMOND points

**Task:**

- [ ] Add `audit_logs` table to `shared/schema.ts`
- [ ] Create `server/audit.ts` with event types enum
- [ ] Implement HMAC-SHA256 log signing
- [ ] Add audit middleware to `server/index.ts`
- [ ] Create admin API endpoint: `/api/admin/audit-logs`
- [ ] Build admin UI for log viewing
- [ ] Test: Verify all CRUD operations generate logs

**Audit Event Types:**

- AUTH_LOGIN_SUCCESS, AUTH_LOGOUT
- DATA_FILE_CREATE, DATA_FILE_ACCESS, DATA_FILE_DELETE
- SECURITY_RATE_LIMIT_EXCEEDED, SECURITY_CSRF_FAILURE
- SHARE_LINK_CREATE, SHARE_LINK_ACCESS

**Compliance Requirements:**

- Retain logs for 1 year minimum
- Redact sensitive fields (password, token, apiKey)
- Log all security-relevant events
- Cryptographic integrity protection

---

#### 6. Environment Variable Validation (2 hours)

**Priority:** P1 - Required for security  
**Impact:** +1 DIAMOND point

**Task:**

- [ ] Create `server/config.ts` with Zod schema
- [ ] Validate required: `DATABASE_URL`, `SESSION_SECRET`
- [ ] Set defaults for optional vars
- [ ] Replace all `process.env` usage with validated config
- [ ] Test: Server fails fast on invalid environment

**Example Schema:**

```typescript
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
})
```

---

#### 7. Add Encryption Utilities (4 hours)

**Priority:** P1 - Data protection  
**Impact:** +2 DIAMOND points

**Task:**

- [ ] Create `server/encryption.ts` with AES-256-GCM functions
- [ ] Implement: `encrypt(plaintext, key)`, `decrypt(encrypted, key)`
- [ ] Implement: `deriveKey(password, salt)` using scrypt
- [ ] Add: `encryptMetadata()`, `decryptMetadata()`
- [ ] Create comprehensive tests
- [ ] Document encryption key management

**Algorithms:**

- Encryption: AES-256-GCM
- Key derivation: scrypt (N=32768, r=8, p=1)
- Auth tag: 128 bits

**Safety Notes:**

- NEVER change encryption parameters without migration plan
- Encryption key loss = permanent data loss
- Store master key securely (environment variable + key rotation)

---

### 🟡 MEDIUM PRIORITY - Quality Improvements (1-2 Months)

#### 8. Complete use-toast.ts Coverage (30 min) ✅ COMPLETED

**Current:** 100% | **Target:** 100%

**Task:**

- [x] Add test for `onOpenChange` edge case (toast reopens before removal)
- [x] Test timeout cleanup on rapid open/close
- [x] Verify duplicate timeout prevention

**File:** `client/src/hooks/use-toast.test.ts`

**Result:** 29 tests passing (3 new edge case tests added)

---

#### 9. Expand db.test.ts Coverage (1 hour)

**Current:** 80%, 2 basic tests  
**Target:** 100%, 8-10 tests

**Suggested Tests:**

- Connection validation (missing DATABASE_URL)
- Connection pool exhaustion
- Retry logic on transient failures
- SSL/TLS configuration
- Connection cleanup on shutdown
- Malformed connection strings

**File:** `server/db.test.ts`

---

#### 10. Add Integration Tests (2-3 hours)

**Current:** Unit tests only  
**Target:** 5-10 integration tests

**Test Flows:**

- Full file upload → share → download workflow
- Folder navigation and nested structure
- Concurrent file operations (race conditions)
- Share link expiration enforcement
- Quota and limit enforcement

**File:** `test/integration/user-workflows.test.ts` (create)

---

#### 11. Improve Security Test Coverage (1-2 hours)

**Current:** Basic security tests  
**Target:** Comprehensive security validation

**Suggested Tests:**

```typescript
// File: server/security.test.ts (additions)

describe('Security Hardening', () => {
  it('should prevent SQL injection in all endpoints', () => {
    // Test with malicious input
  })

  it('should sanitize file names', () => {
    // Test path traversal attempts: ../../../etc/passwd
  })

  it('should rate limit by IP address', () => {
    // Test IP-based throttling
  })

  it('should reject oversized payloads', () => {
    // Test payload size limits
  })

  it('should prevent CSRF attacks', () => {
    // Test CSRF token validation
  })

  it('should enforce strong password requirements on share links', () => {
    // Test password complexity
  })
})
```

**Action Items:**

- [ ] Add SQL injection prevention tests
- [ ] Test path traversal prevention
- [ ] Add CSRF protection tests
- [ ] Test file name sanitization
- [ ] Add payload size limit tests
- [ ] Test session security (fixation, hijacking)

---

#### 12. Test Replit Integration Code (2-4 hours)

**Current:** 0-33% coverage  
**Target:** 70%+

**Files Needing Tests:**

- `server/replit_integrations/auth/*.ts` (0% coverage)
- `server/replit_integrations/object_storage/*.ts` (33% coverage)

**Challenges:**

- Platform-specific code (requires Replit environment)
- External service dependencies
- OAuth flow complexity

**Action Items:**

- [ ] Mock Replit sidecar API
- [ ] Test OAuth authentication flow
- [ ] Test object storage ACL policies
- [ ] Add GCS bucket operation tests
- [ ] Test presigned URL generation
- [ ] Validate error handling for external services

---

#### 13. Add Performance Tests (2-3 hours)

**Current:** None  
**Target:** Basic load/stress tests

**Suggested Tests:**

```typescript
// File: test/performance/load-tests.test.ts

describe('Performance Tests', () => {
  it('should handle 100 concurrent uploads', async () => {
    // Test throughput
  })

  it('should respond within 100ms for file listing', async () => {
    // Test response time
  })

  it('should handle 1000 files in a folder', async () => {
    // Test scalability
  })

  it('should maintain performance under rate limiting', async () => {
    // Test degradation
  })
})
```

**Action Items:**

- [ ] Set up performance testing framework (k6 or Artillery)
- [ ] Define performance baselines
- [ ] Add load tests for critical endpoints
- [ ] Test database query performance
- [ ] Add memory leak detection tests
- [ ] Test large file upload handling

---

#### 14. Enhance Test Documentation (1 hour)

**Current:** Good documentation  
**Target:** Excellent with examples

**Additions Needed:**

- [ ] Add troubleshooting section to `docs/testing/10_RUNNING_TESTS.md`
- [ ] Create `docs/testing/40_INTEGRATION_TESTS.md`
- [ ] Add more examples to `docs/testing/30_TEST_PATTERNS.md`
- [ ] Document performance testing setup
- [ ] Add CI/CD debugging guide
- [ ] Create test data management guide

---

#### 15. Add Test Coverage Enforcement (1 hour)

**Priority:** P2 - CI/CD Quality

**Implementation:**

**File:** `vitest.config.ts` (update)

```typescript
export default defineConfig({
  test: {
    allowOnly: false, // Prevent .only() and .skip() from being committed
    // ... existing config
  },
})
```

**File:** `package.json` (add script)

```json
{
  "scripts": {
    "test:check-focused": "grep -rn '\\.only\\|describe\\.skip\\|it\\.skip\\|test\\.skip' server/ client/src/ && exit 1 || exit 0"
  }
}
```

**Success Criteria:**

- [ ] `allowOnly: false` added to vitest config
- [ ] CI fails if `.only()` or `.skip()` present
- [ ] Pre-commit check script works

---

#### 16. Add Dependabot (1 hour)

**Task:**

- [ ] Create `.github/dependabot.yml`
- [ ] Configure weekly update schedule
- [ ] Set PR limits (max 5 open)
- [ ] Add labels: "dependencies", "automated"

---

#### 17. Add AI-META Headers (2 hours)

**Task:** Add standardized documentation headers to all server files

**Template:**

```typescript
// AI-META-BEGIN
// AI-META: <Brief description of file purpose>
// OWNERSHIP: <domain>/<subdomain>
// ENTRYPOINTS: <Where this code is called from>
// DEPENDENCIES: <Key external dependencies>
// DANGER: <Critical risks or side effects>
// CHANGE-SAFETY: <Guidance on when changes are safe/unsafe>
// TESTS: <Path to test files>
// AI-META-END
```

**Files to update:**

- `server/security.ts`
- `server/routes.ts`
- `server/storage.ts`
- `server/db.ts`
- `server/index.ts`
- `shared/schema.ts`

---

#### 18. Implement Internationalization (i18n) (40 hours / 1 week)

**Current:** 3/10 - English only  
**Target:** 8/10 - Multi-language support  
**Impact:** +5 DIAMOND points

**Note:** Only pursue if targeting non-English markets.

**Steps:**

- [ ] Install react-intl or i18next
- [ ] Extract all hardcoded strings to translation files
- [ ] Create translation files (`locales/en.json`, `locales/es.json`, etc.)
- [ ] Add language picker in settings
- [ ] Translate error messages on server
- [ ] Add locale detection (browser language)

**Impact:** Enables global expansion

---

### 🔵 LOW PRIORITY - Future Enhancements (3-6 Months)

#### 19. E2E Testing with Playwright (40 hours / 1 week)

**Benefit:** Browser automation, visual regression

**Setup Tasks:**

- [ ] Install Playwright and dependencies
- [ ] Create `e2e/` test directory
- [ ] Write E2E test for login flow
- [ ] Write E2E test for file upload
- [ ] Add visual regression testing
- [ ] Test across browsers (Chrome, Firefox, Safari)
- [ ] Add mobile viewport testing

**Effort:** 40 hours

---

#### 20. Mutation Testing (16 hours / 2 days)

**Benefit:** Validate test quality by introducing code mutations

**Tools:** Stryker Mutator

**Action Items:**

- [ ] Install Stryker Mutator
- [ ] Configure mutation testing
- [ ] Run baseline mutation tests
- [ ] Fix weak test cases identified
- [ ] Add mutation testing to CI/CD

**Effort:** 16 hours

---

#### 21. Contract Testing (24 hours / 3 days)

**Benefit:** Ensure API contracts don't break

**Tools:** Pact or similar

**Action Items:**

- [ ] Define API contracts
- [ ] Set up contract testing framework
- [ ] Generate consumer contracts
- [ ] Validate provider contracts
- [ ] Add contract tests to CI/CD

**Effort:** 24 hours

---

#### 22. Deploy Monitoring & Observability (80 hours / 2 weeks)

**Current:** 6/10 - No monitoring  
**Target:** 9/10 - Full observability  
**Impact:** +3 DIAMOND points

**Options:**

- Datadog (recommended - $15-31/host/month)
- Self-hosted (Prometheus + Grafana + Loki)
- AWS CloudWatch

**Deliverables:**

- APM integration in server/index.ts
- Dashboards: Response times, error rates, storage usage
- Alerts: Error rate >1%, response time p95 >500ms
- On-call rotation (PagerDuty)
- Runbooks in `docs/operations/`

---

#### 23. Implement Disaster Recovery (56 hours / 1.5 weeks)

**Current:** 7/10 - Plan documented, not implemented  
**Target:** 9/10 - Tested backup/recovery  
**Impact:** +2 DIAMOND points

**Requirements:**

- Daily PostgreSQL backups (retain 30 days)
- Point-In-Time Recovery (PITR)
- Backup monitoring and alerts
- Restoration runbook (RTO: 4 hours, RPO: 24 hours)
- Quarterly backup testing
- GCS multi-region replication

**Deliverables:**

- `docs/operations/DISASTER_RECOVERY.md`
- `script/backup-database.sh`
- `script/restore-database.sh`
- `.github/workflows/backup-test.yml`

---

#### 24. Accessibility Audit (24 hours / 3 days)

**Current:** 7/10 - Framework support  
**Target:** 9/10 - WCAG 2.1 AA compliant  
**Impact:** +2 DIAMOND points

**Tasks:**

- [ ] Install axe-core testing library
- [ ] Add accessibility tests to components
- [ ] Run Lighthouse audit (target: 95+ score)
- [ ] Manual screen reader testing (NVDA/VoiceOver)
- [ ] Verify color contrast (4.5:1 minimum)
- [ ] Add skip navigation links
- [ ] Document in `docs/ACCESSIBILITY.md`

---

## 🚀 Feature Development Roadmap

### P0: Critical for Enterprise (Next 3 Months)

#### 1. Advanced Sharing & Permissions (4-6 weeks)

- [ ] Share files to specific users (not just public links)
- [ ] Role-based access control (Viewer, Editor, Owner)
- [ ] Folder-level permissions with inheritance
- [ ] View-only links (download disabled)
- [ ] Track link views (not just downloads)
- [ ] Domain-restricted sharing

**Business Value:** Required for team/enterprise adoption

---

#### 2. Search Functionality (2-3 weeks)

- [ ] Full-text search on file names (PostgreSQL FTS)
- [ ] Filter by type, size, date
- [ ] Fuzzy search (typo tolerance with pg_trgm)
- [ ] Search in metadata
- [ ] Recent activity feed

**Business Value:** Critical for UX beyond 100 files

---

#### 3. Admin Dashboard (2-3 weeks)

- [ ] User management UI (list, deactivate, view files)
- [ ] Storage analytics dashboard
- [ ] Activity reporting (most active users, most shared files)
- [ ] Alerts & notifications (high storage usage, suspicious activity)
- [ ] Export to CSV

**Business Value:** Required for SaaS operations

---

### P1: High Value (Months 4-6)

#### 4. PDF Viewer & Tools (3-4 weeks)

- [ ] In-browser PDF viewer (react-pdf)
- [ ] PDF annotations (comments, highlights)
- [ ] Merge, split, rotate, compress PDFs

**Business Value:** High user demand

---

#### 5. File Request Portal (3-4 weeks)

- [ ] Upload-only links (no auth required)
- [ ] File request forms (structured intake)
- [ ] Intake checklists (multi-step forms)
- [ ] Approval workflow

**Business Value:** Unique differentiator

---

#### 6. Collaboration Features (4-6 weeks)

- [ ] Comment threads on files
- [ ] @mentions with notifications
- [ ] Activity feed inside file
- [ ] Version history (track all changes)
- [ ] Version restore
- [ ] Version compare (diff view for text)

**Business Value:** Required for team productivity

---

### P2: Nice-to-Have (Months 7-12)

- Video preview and transcription
- Desktop sync client (Electron)
- AI-powered features (semantic search, auto-tagging, summarization)
- Integrations (Slack, Outlook, Zapier)

---

### P3: Advanced (Year 2+)

- Scanning & OCR
- Client portal (white-label, e-signature)
- Advanced security (client-side encryption, MFA, HSM)
- Compliance tools (retention policies, legal hold, eDiscovery)

---

## 📊 Compliance & Regulatory Roadmap

### SOC 2 Type II Requirements (30-60 days)

**Critical Path to Certification:**

1. **Access Controls** (2-3 weeks)
   - [ ] Implement RBAC (Admin, User, Guest roles)
   - [ ] Access review process (quarterly)
   - [ ] Multi-factor authentication enforcement
   - [ ] Session management hardening

2. **Monitoring & Detection** (2-3 weeks)
   - [ ] Tamper-proof audit logging (covered in task #5)
   - [ ] Security event monitoring (SIEM/log aggregation)
   - [ ] Log retention & protection (1 year minimum)

3. **Change Management** (1-2 weeks)
   - [ ] Formal change request process
   - [ ] Deployment controls (2 approvers for infrastructure)
   - [ ] Automated deployment tracking

4. **Business Continuity** (2 weeks)
   - [ ] Backup & disaster recovery (covered in task #14)
   - [ ] Data replication (multi-region)

5. **Vendor Management** (1 week)
   - [ ] Third-party security assessments
   - [ ] Vendor contracts with security requirements

6. **Audit Readiness** (1-2 weeks)
   - [ ] Policy documentation (5 policies required)
   - [ ] Evidence collection repository

**Cost Estimate:**

- Implementation: $48,000 (320 hours)
- Audit: $25,000 (Type I + Type II)
- Annual Maintenance: $15,000
- **Total Year 1:** $88,000

---

### HIPAA (If Handling Healthcare Data)

**WARNING:** CloudVault is **NOT currently HIPAA compliant**. Do not store PHI without implementing these controls.

**Requirements:**

- Security risk analysis
- Workforce security (background checks, training)
- Business Associate Agreements (BAAs)
- Encryption at rest (field-level for PHI)
- Audit controls (6-year log retention)
- Breach notification procedures (72 hours)

**Effort:** 30-60 days | **Cost:** $83,000 Year 1

---

### PCI-DSS (If Processing Payments)

**WARNING:** CloudVault does **NOT** currently process payments.

**Critical Requirements:**

- Network segmentation
- Firewall configuration
- Encrypt cardholder data (never store CVV)
- Anti-malware deployment
- Quarterly vulnerability scans ($10k-20k/year)
- Annual penetration testing ($15k-40k/year)

**Effort:** 40-60 days | **Cost:** $101,000 Year 1

---

### GDPR (For EU Users)

**Requirements:**

- Privacy policy and consent management
- User rights endpoints:
  - Right to access (`GET /api/users/me/export`)
  - Right to rectification (`PATCH /api/users/me`)
  - Right to erasure (`DELETE /api/users/me`)
  - Right to data portability (JSON export)
- Data Processing Agreements (DPAs)
- 72-hour breach notification

**Effort:** 20-30 days | **Cost:** $34,000 Year 1

---

## 🛡️ Development Guidelines for AI Agents

### Code Safety Constraints

#### 🚨 NEVER Change Without Approval:

1. **Encryption parameters** (AES-256-GCM, scrypt settings)
2. **Database schema** (always use migrations, never direct ALTER)
3. **Authentication flows** (Replit OIDC integration)
4. **Session management** (secure-by-default settings)
5. **Rate limiting thresholds** (security-sensitive)

#### ⚠️ High-Risk Areas (Extra Caution):

- `server/security.ts` - Security middleware
- `server/replit_integrations/auth/` - Authentication logic
- `shared/schema.ts` - Database schema
- `server/routes.ts` - API authorization checks

#### ✅ Safe to Modify:

- UI components (client/src/components/)
- Frontend hooks (client/src/hooks/)
- Documentation (docs/, README.md)
- Tests (adding new tests always safe)
- Utilities (pure functions)

---

### Code Quality Standards

#### TypeScript

- **All code must be TypeScript** (no `any` types without justification)
- Use shared types from `shared/` directory
- Prefer type inference where possible
- Document complex types with JSDoc

#### Testing

- **Minimum 80% coverage** for new code
- **100% coverage required** for:
  - Security features
  - API endpoints
  - Authentication/authorization
  - Data validation
- Run `npm test` before committing
- Run `npm run test:coverage` to verify coverage

#### API Design

- **RESTful conventions:**
  - `GET /api/resource` - List/read
  - `POST /api/resource` - Create
  - `PUT /api/resource/:id` - Update
  - `DELETE /api/resource/:id` - Delete
- **Consistent error format:**
  ```json
  { "error": "message", "code": "ERROR_CODE" }
  ```
- **Rate limiting** on all public endpoints
- **Input validation** with Zod schemas

#### Security

- **All endpoints require authentication** (except share links)
- **Validate all user input** (never trust client data)
- **Sanitize file names** (prevent path traversal)
- **Use parameterized queries** (prevent SQL injection)
- **Hash passwords** with bcrypt (cost factor: 12)
- **Generate secure tokens** (randomBytes, 32 bytes minimum)

---

### File Modification Patterns

#### When Modifying `shared/schema.ts`:

1. Add new table/column
2. Run `npm run db:push` to update database
3. Update affected routes in `server/routes.ts`
4. Update affected queries in `server/storage.ts`
5. Add tests for new schema
6. Document in `docs/data/`

#### When Modifying API Routes:

1. Update `server/routes.ts` (add/modify endpoint)
2. Add authentication/authorization checks
3. Add input validation (Zod schema)
4. Update `server/storage.ts` (data access layer)
5. Add tests (unit + integration)
6. Update `docs/api/` documentation
7. Consider rate limiting

#### When Adding New Features:

1. **Create task in TODO.md** with priority and effort estimate
2. **Update AGENTS.md** with task details
3. **Write tests first** (TDD approach)
4. **Implement feature** with security in mind
5. **Update documentation** (README, docs/, API)
6. **Run CI checks** (`npm run check`, `npm test`)
7. **Manual testing** in development environment

---

### Common Pitfalls to Avoid

❌ **Don't:**

- Use `any` type without justification
- Skip input validation ("trust the client")
- Store sensitive data in logs (passwords, tokens)
- Use `console.log` for production logging (use audit logger)
- Commit `.env` files or secrets
- Use `JSON.parse()` without try-catch
- Forget to close database connections
- Use `SELECT *` (specify columns)
- Hardcode configuration (use environment variables)

✅ **Do:**

- Use TypeScript strict mode
- Validate all inputs with Zod
- Redact sensitive data in logs
- Use structured logging (audit.ts)
- Use environment variable validation (config.ts)
- Use error boundaries in React
- Close resources in finally blocks
- Select only needed columns
- Externalize configuration

---

## 🧪 Testing Guidelines

### Test Organization

```
# Unit tests (co-located with code)
server/routes.test.ts
client/src/hooks/use-auth.test.ts

# Integration tests (separate directory)
test/integration/user-workflows.test.ts

# Performance tests (separate directory)
test/performance/load-tests.test.ts
```

### Test Naming Convention

```typescript
describe("ComponentName or FunctionName", () => {
  describe("specificMethod", () => {
    it("should do expected behavior when condition", () => {
      // Arrange
      const input = ...;

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe(expected);
    });

    it("should throw error when invalid input", () => {
      expect(() => functionUnderTest(null)).toThrow();
    });
  });
});
```

### Coverage Requirements

| Code Type         | Minimum Coverage | Notes                                  |
| ----------------- | ---------------- | -------------------------------------- |
| Security features | 100%             | Auth, authorization, validation        |
| API endpoints     | 100%             | All routes and error cases             |
| Business logic    | 90%              | Core functionality                     |
| UI components     | 70%              | Focus on logic, not presentation       |
| Utilities         | 90%              | Pure functions, data transformations   |
| Integration code  | 30%              | External services (mock at boundaries) |

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- routes.test.ts

# Run in watch mode
npm test -- --watch

# Run in UI mode (interactive)
npm run test:ui
```

---

## 📚 Essential Documentation

### Critical Files to Reference

| File                                                                                                   | Purpose                       |
| ------------------------------------------------------------------------------------------------------ | ----------------------------- |
| [README.md](./README.md)                                                                               | Project overview, quick start |
| [docs/README.md](./docs/README.md)                                                                     | Documentation hub             |
| [docs/architecture/10_OVERVIEW.md](./docs/architecture/10_OVERVIEW.md)                                 | System architecture           |
| [docs/architecture/30_MODULES_AND_DEPENDENCIES.md](./docs/architecture/30_MODULES_AND_DEPENDENCIES.md) | Code organization             |
| [docs/architecture/40_KEY_FLOWS.md](./docs/architecture/40_KEY_FLOWS.md)                               | User flows and data flows     |
| [docs/api/00_INDEX.md](./docs/api/00_INDEX.md)                                                         | REST API reference            |
| [docs/security/10_THREAT_MODEL.md](./docs/security/10_THREAT_MODEL.md)                                 | Security architecture         |
| [docs/testing/30_TEST_PATTERNS.md](./docs/testing/30_TEST_PATTERNS.md)                                 | Testing examples              |
| [TODO.md](./TODO.md)                                                                                   | Complete task list            |

### When to Update Documentation

**Always update docs when:**

- Adding new API endpoint → `docs/api/`
- Changing architecture → `docs/architecture/`
- Adding new module → `docs/architecture/30_MODULES_AND_DEPENDENCIES.md`
- Implementing security feature → `docs/security/`
- Adding test patterns → `docs/testing/30_TEST_PATTERNS.md`
- Making architecture decision → Create ADR in `docs/adr/`

---

## 🎯 Quick Reference for Common Tasks

### Add New API Endpoint

1. **Define route** in `server/routes.ts`:

   ```typescript
   app.post('/api/resource', requireAuth, async (req, res) => {
     const schema = z.object({ name: z.string() })
     const data = schema.parse(req.body)
     // ... implementation
   })
   ```

2. **Add data access** in `server/storage.ts`:

   ```typescript
   export async function createResource(userId: string, data: any) {
     return await db.insert(resources).values({ ...data, userId })
   }
   ```

3. **Write tests** in `server/routes.test.ts`:

   ```typescript
   it('should create resource when authenticated', async () => {
     const response = await request(app)
       .post('/api/resource')
       .set('Cookie', authCookie)
       .send({ name: 'Test' })

     expect(response.status).toBe(201)
   })
   ```

4. **Update docs** in `docs/api/`:

   ````markdown
   ### POST /api/resource

   Create a new resource.

   **Request:**

   ```json
   { "name": "string" }
   ```
   ````

   **Response (201):**

   ```json
   { "id": "uuid", "name": "string" }
   ```

   ```

   ```

---

### Add Database Table

1. **Update schema** in `shared/schema.ts`:

   ```typescript
   export const newTable = pgTable('new_table', {
     id: text('id')
       .primaryKey()
       .$defaultFn(() => crypto.randomUUID()),
     createdAt: timestamp('created_at').defaultNow(),
     // ... columns
   })
   ```

2. **Push to database**:

   ```bash
   npm run db:push
   ```

3. **Update types**:

   ```typescript
   export type NewTable = typeof newTable.$inferSelect
   export type InsertNewTable = typeof newTable.$inferInsert
   ```

4. **Add queries** in `server/storage.ts`

5. **Write tests** for new queries

6. **Document** in `docs/data/`

---

### Add React Component

1. **Create component** in `client/src/components/`:

   ```typescript
   export function MyComponent({ prop }: { prop: string }) {
     return <div>{prop}</div>;
   }
   ```

2. **Add styles** with Tailwind classes

3. **Write tests** (if component has logic):

   ```typescript
   it("should render prop", () => {
     render(<MyComponent prop="test" />);
     expect(screen.getByText("test")).toBeInTheDocument();
   });
   ```

4. **Export** from `client/src/components/` (if reusable)

---

### Add Security Middleware

1. **Create middleware** in `server/security.ts`:

   ```typescript
   export function mySecurityCheck(req: Request, res: Response, next: NextFunction) {
     if (!validateSomething(req)) {
       return res.status(403).json({ error: 'Forbidden' })
     }
     next()
   }
   ```

2. **Write comprehensive tests**:

   ```typescript
   it('should reject invalid requests', () => {
     // Test all edge cases
   })
   ```

3. **Apply to routes** in `server/routes.ts`:

   ```typescript
   app.post('/api/sensitive', requireAuth, mySecurityCheck, handler)
   ```

4. **Document** in `docs/security/`

---

## 🔄 Git Workflow

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semi-colons
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests
- `chore`: Maintain, dependencies

**Examples:**

```
feat(api): add CSRF protection to all routes

Implements synchronizer token pattern with timing-safe validation.
Tokens are valid for 24 hours and stored in session.

Closes #123

---

fix(auth): prevent session fixation attack

Regenerate session ID after successful login.

---

test(storage): add integration tests for file upload

Covers happy path, error cases, and concurrent uploads.
```

### Before Committing

```bash
# Type check
npm run check

# Run tests
npm test

# Check coverage
npm run test:coverage

# Lint (if ESLint configured)
npm run lint

# Format (if Prettier configured)
npm run format
```

---

## 🚦 Decision Making Framework

### Should I implement this task?

| Question                            | Answer                                     |
| ----------------------------------- | ------------------------------------------ |
| Is this in the priority task list?  | ✅ Yes → Proceed with confidence           |
| Is this a security-critical change? | ⚠️ Yes → Extra caution, 100% test coverage |
| Does this modify authentication?    | ⚠️ Yes → Discuss with team first           |
| Does this change database schema?   | ⚠️ Yes → Create migration, test thoroughly |
| Is this a UI-only change?           | ✅ Yes → Safe to implement                 |
| Does this add dependencies?         | ⚠️ Moderate → Check license, security      |

### When to ask for human input:

- **Always ask when:**
  - Changing encryption algorithms
  - Modifying authentication flows
  - Adding external dependencies
  - Changing database relationships
  - Implementing compliance features

- **Consider asking when:**
  - Task is ambiguous
  - Multiple valid approaches exist
  - Significant architecture change
  - User experience decisions

---

## 🎓 Learning Resources

### For Understanding the Codebase

1. **Start here:** [README.md](./README.md)
2. **Architecture:** [docs/architecture/10_OVERVIEW.md](./docs/architecture/10_OVERVIEW.md)
3. **API Reference:** [docs/api/00_INDEX.md](./docs/api/00_INDEX.md)
4. **Security:** [docs/security/99_SECURITY_POSTURE_REPORT.md](./docs/security/99_SECURITY_POSTURE_REPORT.md)
5. **Tests:** [docs/testing/30_TEST_PATTERNS.md](./docs/testing/30_TEST_PATTERNS.md)

### For Specific Topics

| Topic        | Resource                                                                 |
| ------------ | ------------------------------------------------------------------------ |
| Drizzle ORM  | [docs/data/00_INDEX.md](./docs/data/00_INDEX.md)                         |
| Replit Auth  | [docs/integrations/00_INDEX.md](./docs/integrations/00_INDEX.md)         |
| Threat Model | [docs/security/10_THREAT_MODEL.md](./docs/security/10_THREAT_MODEL.md)   |
| Key Flows    | [docs/architecture/40_KEY_FLOWS.md](./docs/architecture/40_KEY_FLOWS.md) |

---

## 📞 Support and Collaboration

### Task Status Legend

- ✅ **Complete** - Task finished and tested
- 🟡 **In Progress** - Currently being worked on
- 🔵 **Not Started** - Available to begin
- 🚀 **Future** - Planned but not prioritized
- ⚠️ **Blocked** - Dependency or external requirement

### Priority Legend

- 🔴 **P0: Critical** - Security, compliance, production blockers (do first)
- 🟠 **P1: High** - User-facing bugs, important features (do soon)
- 🟡 **P2: Medium** - Quality improvements, nice-to-haves (do eventually)
- 🔵 **P3: Low** - Future enhancements, advanced features (do later)

---

## 🏁 Getting Started Checklist for AI Agents

When beginning work on CloudVault:

- [ ] Read this AGENTS.md file completely
- [ ] Review [README.md](./README.md) for project context
- [ ] Scan [docs/architecture/10_OVERVIEW.md](./docs/architecture/10_OVERVIEW.md) for architecture
- [ ] Check [TODO.md](./TODO.md) for current task list
- [ ] Identify priority tasks (🔴 P0 first)
- [ ] Verify local setup: `npm install`, `npm test`
- [ ] Understand test requirements (80% minimum coverage)
- [ ] Review security constraints (NEVER change list)
- [ ] Familiarize with git workflow
- [ ] Ready to contribute! 🚀

---

**Last Updated:** February 4, 2026  
**Maintained By:** CloudVault Team  
**Questions?** See [docs/README.md](./docs/README.md) or create an issue in the repository.

---

_This document is generated from [TODO.md](./TODO.md) and reflects current project priorities. It is updated regularly as tasks are completed and new priorities emerge._
