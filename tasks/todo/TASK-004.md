### 4. Implement CSRF Protection

**Task ID:** TASK-004
**Title:** Implement CSRF Protection
**Priority:** P0 - Security Critical
**Status:** 🔵 Not Started
**Agent/Human:** AGENT
**Estimated Effort:** 25 hours - High Complexity

**AI Guardrails:**

- [ ] Maximum execution time: 4 hours
- [ ] File modification limits: 10 files per session
- [ ] Database change restrictions: Read-only for existing data, write-only for new CSRF tables
- [ ] External API call limits: 0 (no external APIs required)
- [ ] Safety check intervals: Every 5 file modifications

**Validation Checkpoints:**

- [ ] Pre-commit validation: Run `npm test` before each major function implementation
- [ ] Mid-implementation verification: Test CSRF token generation after implementation
- [ ] Post-implementation testing: Full test suite with 100% coverage
- [ ] Performance regression checks: Ensure <5ms overhead per request
- [ ] Security validation points: Verify timing-safe comparison implementation

**Context Preservation:**

- [ ] Critical state snapshots: Backup existing middleware configuration
- [ ] Rollback triggers: Any test failures or performance degradation >10ms
- [ ] State validation points: Verify existing routes still function after CSRF addition
- [ ] Dependency state tracking: Monitor session management integration
- [ ] Configuration baseline: Document current middleware stack

**Decision Logic:**

- [ ] If session management is unavailable then implement token-based CSRF without session storage
- [ ] If performance tests show >10ms overhead then optimize token validation logic
- [ ] If client-side integration fails then implement cookie-based token distribution
- [ ] If timing-safe comparison unavailable then use constant-time comparison implementation
- [ ] If database storage is problematic then switch to in-memory token storage

**Anti-Patterns to Avoid:**

- [ ] Never: Store CSRF tokens in localStorage (vulnerable to XSS)
- [ ] Avoid: Using predictable token generation (must use crypto.randomBytes)
- [ ] Warning: Don't implement CSRF without proper session management
- [ ] Deprecated: Synchronizer token pattern without double-submit cookie
- [ ] Security risk: Never use comparison operators (===) for token validation

**Quality Gates:**

- [ ] Code coverage threshold: 100% for all CSRF functions
- [ ] Performance benchmarks: <5ms overhead per request
- [ ] Security scan requirements: No timing attack vulnerabilities
- [ ] Documentation completeness: All security procedures documented
- [ ] Test automation: All security scenarios automated

**Integration Points:**

- [ ] API contracts: Maintain existing route signatures
- [ ] Database schema constraints: No changes to existing tables
- [ ] External service dependencies: None (self-contained security)
- [ ] Client compatibility: Support both fetch and axios HTTP clients
- [ ] Deployment dependencies: Environment variables for token settings

**Monitoring Requirements:**

- [ ] Performance metrics: Token generation/validation time
- [ ] Error rate thresholds: <0.1% CSRF validation failures
- [ ] Security event monitoring: Failed CSRF attempts logged
- [ ] Resource usage limits: <1MB memory for token storage
- [ ] User experience metrics: No visible impact on user interactions

**Pre-conditions:**

- [ ] Session management system is implemented and working
- [ ] Express.js server with middleware support is configured
- [ ] Client-side API client is available for token management
- [ ] Database is accessible for token storage (if using persistent storage)

**AI Execution Context:**

- [ ] Key files to reference: `server/index.ts`, `server/routes.ts`, `client/src/lib/api.ts`
- [ ] Relevant patterns: Express middleware pattern, timing-safe comparison
- [ ] Similar implementations: `server/security.ts` for security patterns

**Acceptance Requirements:**
- [ ] All state-changing routes (POST, PUT, DELETE, PATCH) protected by CSRF tokens
- [ ] Client automatically includes CSRF tokens in API requests via headers or cookies
- [ ] Comprehensive test coverage for CSRF middleware and token validation
- [ ] Manual verification of 403 responses on missing or invalid tokens
- [ ] Token rotation and refresh mechanisms implemented
- [ ] CSRF protection works across all authentication methods
- [ ] Double-submit cookie pattern implemented for additional security

**Files to Create/Modify:**
- [ ] Create: `server/csrf.ts` (CSRF token generation and validation)
- [ ] Create: `server/csrf.test.ts` (comprehensive CSRF tests)
- [ ] Modify: `server/routes.ts` (add CSRF middleware to routes)
- [ ] Modify: `client/src/lib/api.ts` (include CSRF tokens in requests)
- [ ] Modify: `server/index.ts` (initialize CSRF middleware)
- [ ] Create: `client/src/hooks/use-csrf.ts` (client-side CSRF token management)

**Code Components:**
- [ ] `generateCsrfToken()` - Cryptographically secure token generation using crypto.randomBytes
- [ ] `validateCsrfToken(userId, token)` - Timing-safe comparison to prevent attacks
- [ ] `requireCsrf` middleware - Protect state-changing routes with token validation
- [ ] `attachCsrfToken` middleware - Add token to responses for client consumption
- [ ] `refreshCsrfToken()` - Token rotation for enhanced security
- [ ] `isCsrfProtectedRoute()` - Route detection for middleware application

**Testing Requirements:**
- [ ] Unit tests for all CSRF functions (generation, validation, refresh)
- [ ] Integration tests for middleware on protected routes
- [ ] Manual testing: Verify 403 on missing token with curl/browser tools
- [ ] Test token expiration and renewal workflows
- [ ] Test CSRF protection across different authentication states
- [ ] Test double-submit cookie pattern implementation
- [ ] Test timing attack prevention with statistical analysis

**Safety Constraints:**
- [ ] Use constant-time comparison (crypto.timingSafeEqual) to prevent timing attacks
- [ ] Token lifetime limited to 24 hours maximum with configurable expiration
- [ ] Store tokens in secure session or Redis (never in-memory for production)
- [ ] Never log CSRF tokens or expose them in error messages
- [ ] Use cryptographically secure random number generation (crypto.randomBytes)
- [ ] Implement token invalidation on logout and password change

**Dependencies:**
- [ ] Session management system (express-session or similar)
- [ ] Cryptographic library (Node.js built-in crypto module)
- [ ] Cookie parsing middleware (cookie-parser)
- [ ] Client-side HTTP client (axios/fetch wrapper)
- [ ] Redis or session store for production token storage

**Implementation Steps:**
- [ ] Create `server/csrf.ts` with token generation and validation functions
- [ ] Implement `requireCsrf` middleware for route protection
- [ ] Add `attachCsrfToken` middleware for token distribution
- [ ] Update client API to include CSRF token in request headers
- [ ] Create `server/csrf.test.ts` with comprehensive test suite
- [ ] Add CSRF middleware to all state-changing routes in `server/routes.ts`
- [ ] Implement client-side token management hook
- [ ] Test manually: Verify 403 on missing token with browser tools
- [ ] Test token rotation and refresh mechanisms
- [ ] Verify protection works across all authentication methods

**Verification Commands:**
- [ ] `npm test -- server/csrf.test.ts` - Run CSRF-specific tests
- [ ] `npm run test:coverage` - Verify 100% coverage for CSRF functions
- [ ] `curl -X POST http://localhost:3000/api/files -H "Content-Type: application/json"` - Verify 403 without token
- [ ] `npm run dev` - Start development server for manual testing
- [ ] `npm run lint` - Verify code quality standards

**Rollback Procedures:**
- [ ] Remove CSRF middleware from `server/routes.ts`
- [ ] Delete `server/csrf.ts` and `server/csrf.test.ts`
- [ ] Revert client API changes in `client/src/lib/api.ts`
- [ ] Remove CSRF token initialization from `server/index.ts`
- [ ] Restore previous route configurations

**Success Metrics:**
- [ ] All state-changing routes return 403 without valid CSRF token
- [ ] CSRF test suite achieves 100% code coverage
- [ ] Token generation and validation complete in <5ms
- [ ] No performance degradation (>5ms overhead) on protected routes
- [ ] Zero false positives in token validation

**Blockers:**
- [ ] Session management system must be implemented first
- [ ] Client-side API infrastructure must be available
- [ ] Database schema must support token storage (if using persistent storage)

**Key Functions:**
- [ ] `generateCsrfToken()` - Cryptographically secure token (32 bytes, hex encoded)
- [ ] `validateCsrfToken(userId, token)` - Timing-safe comparison with session validation
- [ ] `requireCsrf` middleware - Protect state-changing routes with token validation
- [ ] `attachCsrfToken` middleware - Add token to responses via headers or cookies

**Safety Notes:**
- [ ] Use constant-time comparison to prevent timing attacks
- [ ] Token lifetime: 24 hours maximum (configurable via environment variable)
- [ ] Store tokens in session or Redis (never in-memory for production)
- [ ] Never log CSRF tokens or expose them in responses

**Cost Analysis:**
- **Implementation Cost:** $4,000-6,000 (20-30 hours development)
- **Tools & Dependencies:** $0-500 (open-source libraries, potential Redis costs)
- **Ongoing Maintenance:** $500-1,000/year (updates, monitoring, security patches)
- **ROI:** Critical security protection, prevents CSRF attacks, compliance requirement
- **Time to Value:** 1-2 weeks implementation, immediate security improvement
- **Risk Mitigation:** Prevents session hijacking and unauthorized state changes

---
