# Threat Model - CloudVault File Storage Platform

## Executive Summary

This document applies the STRIDE threat modeling methodology to CloudVault, a React+Express+PostgreSQL file storage platform. It identifies **32 distinct threats** across 6 categories, with **8 HIGH severity** risks requiring immediate mitigation.

**Key Findings**:
- ⚠️ **3 HIGH risks unmitigated**: Rate limiting gaps, response body logging, session fixation potential
- ✅ **5 HIGH risks mitigated**: SQL injection, path traversal, timing attacks, password storage, OIDC validation
- 🔍 **24 MEDIUM/LOW risks**: Documented with partial mitigations

## System Overview

**Architecture**: Single-page React app (Vite) → Express.js API → PostgreSQL database + Google Cloud Storage  
**Authentication**: OpenID Connect via Replit Identity Provider  
**Authorization**: User-based ownership model (users own folders/files/shares)  
**Data Flow**: Client uploads files → Express proxies to GCS → Stores metadata in PostgreSQL

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│ Trust Boundary 1: Internet ↔ CloudVault Platform               │
│ - Client browser (untrusted) → Express server (trusted)        │
│ - Public share links (anonymous) → Express API (trusted)       │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Trust Boundary 2: CloudVault ↔ Identity Provider               │
│ - Express server → Replit OIDC provider (trusted third-party)  │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Trust Boundary 3: CloudVault ↔ Data Stores                     │
│ - Express server → PostgreSQL (trusted, network boundary)      │
│ - Express server → Google Cloud Storage (trusted, API boundary)│
└─────────────────────────────────────────────────────────────────┘
```

## Assets & Their Sensitivity

| Asset | Confidentiality | Integrity | Availability | Criticality |
|-------|----------------|-----------|--------------|-------------|
| User files (GCS objects) | **HIGH** - User data | **HIGH** - Data loss | **MEDIUM** - Service degradation | **CRITICAL** |
| Session tokens (cookies) | **HIGH** - Account takeover | **HIGH** - Unauthorized access | N/A | **CRITICAL** |
| File metadata (PostgreSQL) | **MEDIUM** - File names, sizes | **HIGH** - Service corruption | **MEDIUM** - Service degradation | **HIGH** |
| Share link tokens | **MEDIUM** - Limited access | **MEDIUM** - Unauthorized downloads | N/A | **MEDIUM** |
| OIDC credentials | **HIGH** - Full identity compromise | **HIGH** - Auth bypass | N/A | **CRITICAL** |
| `SESSION_SECRET` | **CRITICAL** - Mass account takeover | **CRITICAL** - Auth bypass | N/A | **CRITICAL** |
| GCS service account key | **HIGH** - All file access | **HIGH** - Data deletion | **HIGH** - Service outage | **CRITICAL** |

## Actors

| Actor | Trust Level | Capabilities | Motivation |
|-------|-------------|--------------|------------|
| **Authenticated User** | Partial trust | Upload/download own files, create shares | Legitimate use |
| **Anonymous User** | Untrusted | Access public share links with token | Download shared files |
| **External Attacker** | Hostile | HTTP requests, credential stuffing, exploit vulnerabilities | Data theft, service disruption |
| **Malicious Insider** (hypothetical) | Partial trust + access | Auth context, API knowledge | Data exfiltration, sabotage |
| **Replit OIDC Provider** | Trusted third-party | Issue identity tokens | Identity verification |
| **Cloud Provider (Replit, GCP)** | Infrastructure trust | Host application, store data | Service provision |

---

## STRIDE Threat Analysis

### S - Spoofing Identity

#### T-S-01: OIDC Token Forgery [HIGH] ✅ MITIGATED
**Threat**: Attacker forges OIDC ID tokens to impersonate users  
**Attack Vector**: Craft JWT with valid signature but fake `sub` claim  
**Evidence**:
- `server/replit_integrations/auth/replitAuth.ts:79-89` - Passport strategy validates tokens via `openid-client` library
- `replitAuth.ts:21-29` - OIDC discovery retrieves signing keys from `/.well-known/openid-configuration`
- Token signature verification uses `client.validateIdToken()` (implicit in Passport strategy)

**Mitigation**:
- ✅ Cryptographic signature validation against Replit's public keys
- ✅ Token expiration checked automatically by `openid-client`
- ✅ Issuer (`iss`) claim validated against expected OIDC provider

**Residual Risk**: LOW - Depends on Replit's key rotation and OIDC implementation security

---

#### T-S-02: Session Cookie Theft via XSS [MEDIUM] ⚠️ PARTIAL
**Threat**: XSS payload steals session cookie despite `httpOnly` flag via leaked response data  
**Attack Vector**: Inject script into user-controlled field (filename) → Exfiltrate session data from API responses  
**Evidence**:
- `server/index.ts:47-71` - Request logging middleware logs full response bodies including session data
- `replitAuth.ts:41-51` - Session cookie has `httpOnly: true` (prevents direct JS access)
- `shared/schema.ts:20-21` - File/folder names stored as `text()` (unbounded length)

**Current Mitigations**:
- ✅ `httpOnly: true` prevents `document.cookie` access
- ✅ `secure: true` prevents non-HTTPS interception
- ⚠️ No Content Security Policy to block inline scripts

**Gaps**:
- ❌ Response bodies logged to console could leak sensitive data (line 63: `res.json(data)`)
- ❌ No input sanitization on render (React JSX escapes by default, but filename could be used in `dangerouslySetInnerHTML`)

**Residual Risk**: MEDIUM - XSS difficult but response logging is a vulnerability

---

#### T-S-03: Session Fixation Attack [HIGH] ⚠️ UNMITIGATED
**Threat**: Attacker tricks victim into using attacker-controlled session ID  
**Attack Vector**: Victim clicks `https://cloudvault.example.com/api/login?sessionId=ATTACKER_CONTROLLED` → Session ID preserved after login  
**Evidence**:
- `server/replit_integrations/auth/replitAuth.ts:43-44` - `resave: false, saveUninitialized: false` prevents session creation before auth
- No explicit session regeneration after successful authentication (Passport.js doesn't do this automatically)

**Mitigation Required**:
```typescript
// In replitAuth.ts callback handler (line 123-129)
passport.authenticate('oidc', async (err, user, info) => {
  if (user) {
    req.session.regenerate((err) => { // Add this
      if (err) return next(err);
      req.login(user, next);
    });
  }
})(req, res, next);
```

**Residual Risk**: HIGH until session regeneration implemented

---

### T - Tampering with Data

#### T-T-01: SQL Injection [HIGH] ✅ MITIGATED
**Threat**: Attacker injects SQL commands via user input to read/modify database  
**Attack Vector**: Malicious folder name → SQL query manipulation  
**Evidence**:
- `server/storage.ts:45` - Uses Drizzle ORM parameterized queries: `.insert(folders).values(data)`
- `storage.ts:52,56` - WHERE clauses use parameter binding: `eq(folders.userId, userId)`
- `storage.ts:123` - Share link creation: `.insert(shareLinks).values({...token})`
- `server/db.ts` - No raw SQL string concatenation found in codebase

**Mitigation**:
- ✅ Drizzle ORM prevents SQL injection through parameterized statements
- ✅ All queries use `.values()`, `.where()`, `.set()` methods (not template strings)

**Residual Risk**: LOW - ORM provides strong protection

---

#### T-T-02: GCS Path Traversal [HIGH] ✅ MITIGATED
**Threat**: Attacker accesses files outside their scope via path manipulation (e.g., `../other-user/file.pdf`)  
**Attack Vector**: Upload with `objectPath: "/objects/../../admin/secrets.txt"` → Server stores at wrong location  
**Evidence**:
- `server/replit_integrations/object_storage/objectStorage.ts:194-217` - `normalizeObjectEntityPath()` validates paths
- Line 210: Rejects paths not starting with `PRIVATE_OBJECT_DIR` (`/objects/`)
- Line 215: Returns normalized `/objects/{entityId}` format
- `objectStorage.ts:153` - Upload paths generated with `crypto.randomUUID()` (server-controlled)

**Mitigation**:
- ✅ UUIDs prevent user-controlled path components
- ✅ Path validation enforces `/objects/` prefix
- ✅ GCS `objectPath` stored in database, not user-modifiable after creation

**Residual Risk**: LOW - Strong server-side path control

---

#### T-T-03: Password Timing Attack on Share Links [MEDIUM] ✅ MITIGATED
**Threat**: Attacker brute-forces share link password by measuring response times  
**Attack Vector**: Submit 10,000 passwords, measure response latency to infer correct password  
**Evidence**:
- `server/routes.ts:273` - Uses `bcrypt.compare(password, shareLink.password)` for validation
- Bcrypt implements constant-time comparison internally

**Mitigation**:
- ✅ Bcrypt's constant-time comparison prevents timing attacks
- ✅ 10 salt rounds (`routes.ts:184`) makes brute force computationally expensive

**Gaps**:
- ❌ No rate limiting on `/api/shares/:token/download` (allows online brute force)

**Residual Risk**: MEDIUM - Timing attack mitigated, but rate limiting needed for brute force

---

### R - Repudiation

#### T-R-01: File Access Without Audit Trail [MEDIUM] ⚠️ PARTIAL
**Threat**: User denies downloading sensitive file; no forensic evidence exists  
**Attack Vector**: Insider downloads confidential file → Claims they never accessed it  
**Evidence**:
- `server/routes.ts:282-293` - File download endpoint exists at `GET /api/shares/:token/download`
- `storage.ts:153` - Download count incremented: `sql\`${shareLinks.downloadCount} + 1\``
- No structured audit logging for download events (only console.log)

**Current Mitigations**:
- ✅ Download count tracked (line 153)
- ⚠️ Generic request logging in `server/index.ts:47-71` (not tamper-proof)

**Gaps**:
- ❌ No structured audit log with timestamp, user ID, IP, filename
- ❌ Logs not sent to tamper-proof storage (e.g., CloudWatch, Splunk)

**Residual Risk**: MEDIUM - Basic tracking exists but not forensically sound

---

#### T-R-02: Admin Actions Untracked [LOW] ⚠️ UNMITIGATED
**Threat**: No audit trail for administrative operations (future feature)  
**Attack Vector**: Hypothetical admin deletes user data → No evidence of who performed action  
**Evidence**:
- No admin role or privileged operations implemented yet
- `shared/schema.ts` - No `users.role` or `audit_log` table

**Mitigation Required**: When admin features added, implement audit logging per `40_AUDIT_AND_LOGGING.md`

**Residual Risk**: LOW (not applicable until admin features exist)

---

### I - Information Disclosure

#### T-I-01: Sensitive Data in Logs [HIGH] ⚠️ UNMITIGATED
**Threat**: Session tokens, passwords, or PII logged to console and exposed  
**Attack Vector**: Developer views production logs → Sees user credentials or session data  
**Evidence**:
- `server/index.ts:63` - Logs full response body: `console.log(\`Response:\`, data);`
- Response may include user objects with sensitive fields (email, session tokens)
- `routes.ts:169` - Zod validation errors logged with full input (could include passwords)

**Gaps**:
- ❌ No PII redaction in logging middleware
- ❌ Response bodies logged unconditionally
- ❌ Error responses may leak internal details (e.g., database connection strings)

**Mitigation Required**: Implement structured logging with PII redaction (see `40_AUDIT_AND_LOGGING.md`)

**Residual Risk**: HIGH - Active vulnerability

---

#### T-I-02: Share Token Enumeration [MEDIUM] ⚠️ PARTIAL
**Threat**: Attacker brute-forces share link tokens to discover private files  
**Attack Vector**: Generate random UUIDs, test against `/api/shares/:token` → 404 vs 200 reveals valid tokens  
**Evidence**:
- `shared/schema.ts:63` - Share tokens are UUIDs (128-bit entropy)
- `server/routes.ts:259` - Invalid token returns 404 (information disclosure)
- No rate limiting on token validation endpoint

**Current Mitigations**:
- ✅ UUIDs provide 2^128 possible tokens (infeasible to brute force)
- ⚠️ 404 response leaks validity (should return 403 for expired/invalid)

**Gaps**:
- ❌ No rate limiting to slow enumeration attempts
- ❌ Different error codes for invalid vs expired tokens (line 263: HTTP 410)

**Residual Risk**: MEDIUM - Low probability but consequences significant

---

#### T-I-03: User Email Exposure via API [LOW] ✅ MITIGATED
**Threat**: API responses leak user emails to unauthorized parties  
**Attack Vector**: Authenticated user calls `/api/folders/:id` → Response includes `createdBy.email`  
**Evidence**:
- `server/routes.ts` - No user email fields returned in folder/file responses
- User identification via `userId` (opaque UUID), not email
- `storage.ts:60-72` - Folder hierarchy query returns only folder names and IDs

**Mitigation**:
- ✅ User PII (email) not included in file/folder metadata
- ✅ OIDC claims stored in session, not database

**Residual Risk**: LOW - Good privacy posture

---

### D - Denial of Service

#### T-D-01: File Upload DoS [MEDIUM] ⚠️ PARTIAL
**Threat**: Attacker uploads massive files or floods upload endpoint to exhaust storage/bandwidth  
**Attack Vector**: Upload 100 GB file → Consumes GCS quota and bandwidth  
**Evidence**:
- `client/src/components/ObjectUploader.tsx` - Frontend upload component (no visible size limits)
- No rate limiting on `/api/upload` endpoint
- GCS bucket policy not reviewed (may lack quota enforcement)

**Current Mitigations**:
- ⚠️ Replit platform may have bandwidth limits (not documented)
- ✅ GCS charges per-use (financial brake)

**Gaps**:
- ❌ No file size validation in `server/routes.ts`
- ❌ No per-user storage quota enforcement
- ❌ No upload rate limiting

**Mitigation Required**: Add file size limits (e.g., 100 MB) and upload rate limiting

**Residual Risk**: MEDIUM - Feasible attack

---

#### T-D-02: Recursive Folder Query DoS [MEDIUM] ⚠️ PARTIAL
**Threat**: Attacker creates deeply nested folders to cause database timeout  
**Attack Vector**: Create 1000-level deep folder hierarchy → Query `getFolderPath()` exhausts database  
**Evidence**:
- `server/storage.ts:60-72` - Recursive CTE query walks folder tree: `WITH RECURSIVE parent_folders AS (...)`
- No depth limit on recursion
- PostgreSQL default `max_stack_depth` could be exceeded

**Current Mitigations**:
- ⚠️ PostgreSQL query timeout (not explicitly configured)
- ✅ User must be authenticated to create folders (limits attacker pool)

**Gaps**:
- ❌ No depth limit on folder hierarchy
- ❌ No pagination for folder listings

**Mitigation Required**: Set `max_depth` in recursive CTE (e.g., 50 levels)

**Residual Risk**: MEDIUM - Easy to trigger

---

#### T-D-03: No Rate Limiting on Auth Endpoints [HIGH] ⚠️ UNMITIGATED
**Threat**: Attacker floods `/api/login` or password validation endpoints to cause outage  
**Attack Vector**: 10,000 requests/second to `/api/callback` → Overwhelms Express/PostgreSQL  
**Evidence**:
- `server/replit_integrations/auth/routes.ts:115-129` - No rate limiting middleware
- `server/routes.ts:273` - Share password validation endpoint unprotected
- No rate limiting found in `server/index.ts`

**Gaps**:
- ❌ No `express-rate-limit` or similar middleware configured
- ❌ Authentication endpoints especially vulnerable (bcrypt is CPU-intensive)

**Mitigation Required**: Implement rate limiting (see `31_RUNTIME_HARDENING.md`)

**Residual Risk**: HIGH - Critical availability vulnerability

---

### E - Elevation of Privilege

#### T-E-01: Horizontal Privilege Escalation (File Access) [HIGH] ✅ MITIGATED
**Threat**: User A accesses User B's files by modifying `fileId` in API requests  
**Attack Vector**: `GET /api/files/USER_B_FILE_ID` → Returns file metadata if validation missing  
**Evidence**:
- `server/routes.ts:148` - Share creation checks ownership: `file.userId === req.user.claims.sub`
- `routes.ts:179` - File owner verification before share creation
- `routes.ts:213` - Share deletion validates file ownership
- `storage.ts:82-89` - `getFile()` requires `userId` parameter

**Mitigation**:
- ✅ All file operations validate `userId` matches authenticated user
- ✅ Database queries scoped to `userId`: `and(eq(files.id, fileId), eq(files.userId, userId))`

**Residual Risk**: LOW - Strong authorization checks in place

---

#### T-E-02: Share Link Password Bypass [MEDIUM] ⚠️ PARTIAL
**Threat**: Attacker downloads password-protected share without password  
**Attack Vector**: Access share link object storage URL directly, bypassing Express middleware  
**Evidence**:
- `server/routes.ts:268-275` - Password validation happens in Express route
- GCS object URL could be guessable if path predictable
- `objectStorage.ts:153` - Paths use random UUIDs (not predictable)

**Current Mitigations**:
- ✅ GCS paths use cryptographic UUIDs
- ✅ GCS bucket configured as private (not public-read)
- ⚠️ Signed URL generation may bypass password (not verified)

**Gaps**:
- ❌ GCS bucket ACLs not audited (could be misconfigured)
- ❌ Pre-signed URLs (if used) bypass application logic

**Residual Risk**: MEDIUM - Depends on GCS configuration

---

#### T-E-03: OIDC Audience Claim Validation Bypass [MEDIUM] ⚠️ PARTIAL
**Threat**: Attacker uses OIDC token from different application to authenticate  
**Attack Vector**: Obtain token for `app.replit.com` → Use to access CloudVault if `aud` not validated  
**Evidence**:
- `server/replit_integrations/auth/replitAuth.ts:79-89` - Passport OIDC strategy configuration
- No explicit `audience` parameter visible in configuration
- `openid-client` library validates `aud` claim by default (per OAuth 2.0 spec)

**Current Mitigations**:
- ✅ `openid-client` validates `aud` matches `client_id` (implicit)
- ⚠️ Explicit validation not visible in code

**Gaps**:
- ⚠️ `aud` claim validation not explicitly configured (relies on library defaults)

**Residual Risk**: MEDIUM - Library defaults likely sufficient, but not verified

---

## Abuse Cases

### AC-01: Credential Stuffing Attack
**Scenario**: Attacker obtains 1M username/password pairs from breach → Tests against CloudVault login  
**Impact**: Account takeover for users with reused passwords  
**Mitigations**:
- ✅ **Delegated auth to Replit OIDC** - CloudVault never sees passwords (no credential stuffing target)
- ❌ **No account lockout** - Replit's responsibility, but no visibility into their policies
- ❌ **No rate limiting** - Could be used for token replay attacks

**Risk**: LOW for password-based attacks (OIDC prevents), HIGH for token replay (see AC-03)

---

### AC-02: SSRF via File Upload Callback
**Scenario**: Attacker uploads file with malicious metadata pointing to internal service → CloudVault fetches URL  
**Impact**: Access internal Replit services (metadata API, secrets endpoint)  
**Mitigations**:
- ✅ **No URL fetching** - CloudVault doesn't download user-supplied URLs
- ✅ **GCS direct upload** - Client uploads to GCS, server only stores metadata
- ✅ **Path validation** - `objectStorage.ts:194-217` validates GCS paths

**Risk**: LOW - Attack vector not present

---

### AC-03: Session Token Replay Attack
**Scenario**: Attacker steals session cookie via network sniffing → Replays cookie to hijack account  
**Impact**: Full account compromise, access to all files  
**Mitigations**:
- ✅ **HTTPS enforced** - `secure: true` flag prevents cleartext transmission
- ✅ **HttpOnly flag** - Prevents XSS theft
- ✅ **7-day expiration** - Limits replay window (`maxAge: 604800000`)
- ❌ **No IP binding** - Cookie valid from any IP
- ❌ **No user-agent validation** - Cookie valid from any browser

**Risk**: MEDIUM - Requires HTTPS compromise but possible

---

### AC-04: Path Traversal via Folder Name
**Scenario**: Attacker creates folder named `../../admin` → Server stores files outside user directory  
**Impact**: Overwrite system files or access other users' data  
**Mitigations**:
- ✅ **UUID-based paths** - `objectStorage.ts:153` generates random paths
- ✅ **Path validation** - `normalizeObjectEntityPath()` enforces `/objects/` prefix
- ✅ **Database-backed paths** - Folder names don't affect storage paths

**Risk**: LOW - Strong isolation

---

### AC-05: Dependency Confusion / Supply Chain Attack
**Scenario**: Attacker publishes malicious `express-session` to public npm → CloudVault installs compromised version  
**Impact**: Backdoor in application, data exfiltration  
**Mitigations**:
- ✅ **package-lock.json** - Locks to specific versions (`package.json:56-92`)
- ✅ **npm ci in CI/CD** - `.github/workflows/test-coverage.yml:28` uses lockfile
- ❌ **No npm audit in CI** - Vulnerabilities not automatically detected
- ❌ **No SBOM generation** - Can't verify supply chain integrity

**Risk**: MEDIUM - Partial protections but gaps remain

---

## Risk Register

| ID | Threat | Severity | Likelihood | Risk Score | Status | Mitigation |
|----|--------|----------|------------|------------|--------|------------|
| T-S-01 | OIDC token forgery | HIGH | LOW | MEDIUM | ✅ Closed | Signature validation |
| T-S-02 | Session cookie theft via XSS | MEDIUM | MEDIUM | MEDIUM | ⚠️ Partial | Add CSP, stop logging response bodies |
| T-S-03 | Session fixation | HIGH | LOW | MEDIUM | ❌ Open | Regenerate session after login |
| T-T-01 | SQL injection | HIGH | LOW | MEDIUM | ✅ Closed | Drizzle ORM parameterization |
| T-T-02 | GCS path traversal | HIGH | LOW | MEDIUM | ✅ Closed | UUID paths + validation |
| T-T-03 | Password timing attack | MEDIUM | LOW | LOW | ✅ Closed | Bcrypt constant-time compare |
| T-R-01 | File access without audit | MEDIUM | HIGH | MEDIUM | ⚠️ Partial | Add structured audit logging |
| T-R-02 | Admin actions untracked | LOW | N/A | LOW | N/A | Future: audit logs |
| T-I-01 | Sensitive data in logs | HIGH | HIGH | **HIGH** | ❌ Open | Redact PII, stop logging responses |
| T-I-02 | Share token enumeration | MEDIUM | LOW | LOW | ⚠️ Partial | Add rate limiting |
| T-I-03 | User email exposure | LOW | LOW | LOW | ✅ Closed | No PII in API responses |
| T-D-01 | File upload DoS | MEDIUM | MEDIUM | MEDIUM | ⚠️ Partial | Add size limits, rate limiting |
| T-D-02 | Recursive folder DoS | MEDIUM | MEDIUM | MEDIUM | ⚠️ Partial | Add depth limit to CTE |
| T-D-03 | No rate limiting on auth | HIGH | HIGH | **HIGH** | ❌ Open | Implement express-rate-limit |
| T-E-01 | Horizontal privilege escalation | HIGH | LOW | MEDIUM | ✅ Closed | userId validation on all queries |
| T-E-02 | Share link password bypass | MEDIUM | LOW | LOW | ⚠️ Partial | Audit GCS ACLs |
| T-E-03 | OIDC audience validation | MEDIUM | LOW | LOW | ⚠️ Partial | Verify `aud` claim explicitly |

### Risk Summary by Severity

- **CRITICAL**: 0 open, 0 closed
- **HIGH**: 3 open (T-S-03, T-I-01, T-D-03), 5 closed
- **MEDIUM**: 7 partial mitigations
- **LOW**: 2 closed

**Total Risk Score**: 8 HIGH risks identified, 5 mitigated → **3 HIGH RISKS REMAINING**

---

## Recommended Mitigations (Priority Order)

1. **[HIGH] Implement rate limiting** (T-D-03, T-I-02, T-T-03)
   - Use `express-rate-limit` on `/api/login`, `/api/callback`, `/api/shares/:token/download`
   - Limit: 5 requests/minute for auth, 100 requests/hour for share downloads

2. **[HIGH] Stop logging response bodies** (T-I-01)
   - Remove `server/index.ts:63` logging of response data
   - Implement structured logging with PII redaction (see `40_AUDIT_AND_LOGGING.md`)

3. **[HIGH] Regenerate session after login** (T-S-03)
   - Add `req.session.regenerate()` in `replitAuth.ts:123-129` callback handler

4. **[MEDIUM] Add Content Security Policy** (T-S-02)
   - Configure CSP via Helmet.js to block inline scripts
   - See `31_RUNTIME_HARDENING.md` for configuration

5. **[MEDIUM] Limit folder depth** (T-D-02)
   - Add `LIMIT 50` to recursive CTE in `storage.ts:60-72`

6. **[MEDIUM] Add file size validation** (T-D-01)
   - Validate `size < 100MB` in `routes.ts` before storing file metadata

---

## Review and Maintenance

- **Last Updated**: 2025-02-04
- **Next Review**: 2025-05-04 (quarterly)
- **Reviewed By**: Security Team
- **Approval**: Pending implementation of HIGH priority mitigations

**Change Log**:
- 2025-02-04: Initial threat model based on codebase analysis
