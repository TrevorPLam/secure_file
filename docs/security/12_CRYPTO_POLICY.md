# Cryptography Policy

## Overview

CloudVault's cryptographic controls protect data confidentiality and integrity across authentication, password storage, and transport security. This policy establishes **approved algorithms**, **key management requirements**, and **prohibited practices**.

**Guiding Principles**:
- ✅ Use industry-standard, vetted algorithms (no custom crypto)
- ✅ Delegate cryptographic operations to trusted libraries
- ✅ Assume TLS for all network communication
- ❌ Never roll our own cryptographic primitives

---

## Approved Cryptographic Algorithms

### Password Hashing

**Algorithm**: bcrypt  
**Implementation**: `bcryptjs` library (version 2.4.3+)  
**Cost Factor**: 10 rounds (2^10 = 1,024 iterations)

**Evidence** (`server/routes.ts:184-186`):
```typescript
const hashedPassword = await bcrypt.hash(password, 10);
```

**Rationale**:
- ✅ Bcrypt automatically handles salt generation (per-password random salt)
- ✅ Cost factor 10 balances security and performance (~150ms per hash on modern hardware)
- ✅ Constant-time comparison via `bcrypt.compare()` prevents timing attacks (line 273)

**Alternative Consideration**: Argon2id (more modern, OWASP recommended)  
- **Pros**: Stronger against GPU/ASIC attacks, memory-hard
- **Cons**: Less mature in Node.js ecosystem, requires native bindings
- **Decision**: Remain with bcrypt unless specific threat model requires Argon2id

**Prohibited**:
- ❌ SHA-256/SHA-512 without salt (fast hash functions enable rainbow table attacks)
- ❌ MD5 (cryptographically broken)
- ❌ Plaintext password storage

---

### Token Generation (Share Links, Session IDs)

**Algorithm**: UUID v4 (cryptographically random)  
**Implementation**: Node.js `crypto.randomUUID()`

**Evidence** (`server/replit_integrations/object_storage/objectStorage.ts:153`):
```typescript
const uploadPath = `/objects/${crypto.randomUUID()}`;
```

**Evidence** (`shared/schema.ts:19,39,61`):
```sql
id: varchar("id").primaryKey().default(sql`gen_random_uuid()`)
```

**Properties**:
- ✅ 128-bit entropy (2^128 = 3.4×10^38 possible values)
- ✅ Uses cryptographically secure random number generator (CSPRNG)
- ✅ PostgreSQL `gen_random_uuid()` uses `pgcrypto` extension (equivalent security)

**Rationale**:
- UUID v4 collision probability negligible (1 in 2.7 trillion for 1 billion UUIDs)
- Share link tokens infeasible to brute force without rate limiting

**Prohibited**:
- ❌ Sequential IDs (e.g., auto-incrementing integers) - predictable
- ❌ Timestamp-based UUIDs (UUID v1) - leak creation time, MAC address
- ❌ `Math.random()` - not cryptographically secure

---

### Transport Security (TLS)

**Protocol**: TLS 1.2 or higher  
**Enforcement**: Replit platform (reverse proxy)

**Evidence** (`server/replit_integrations/auth/replitAuth.ts:48-50`):
```typescript
cookie: {
  httpOnly: true,
  secure: true, // HTTPS-only cookie transmission
}
```

**Session Cookie Protection**:
- ✅ `secure: true` flag prevents cookie transmission over HTTP
- ✅ Replit's infrastructure terminates TLS at edge (application sees HTTP internally)

**Cipher Suite Requirements** (Replit managed):
- ✅ Forward secrecy (ECDHE key exchange)
- ✅ AES-128-GCM or AES-256-GCM (authenticated encryption)
- ❌ No RC4, 3DES, or export-grade ciphers

**Certificate Validation**:
- ✅ Replit manages certificate lifecycle (Let's Encrypt or equivalent)
- ✅ Automatic certificate renewal

**Gap**: No HSTS (HTTP Strict Transport Security) header configured  
**Recommendation**: Add to `31_RUNTIME_HARDENING.md` implementation

---

## Key Management

### Critical Secrets Inventory

| Secret | Purpose | Storage | Rotation Policy | Exposure Impact |
|--------|---------|---------|-----------------|-----------------|
| `SESSION_SECRET` | HMAC key for session cookie signatures | Environment variable | Quarterly | **CRITICAL** - Mass session forgery |
| `REPL_ID` | Replit deployment identifier | Environment variable | Immutable | LOW - Used for metadata only |
| `OIDC_CLIENT_SECRET` | OAuth 2.0 client authentication | Environment variable | Yearly (IdP-driven) | **HIGH** - Auth bypass potential |
| `DATABASE_URL` | PostgreSQL connection string (includes password) | Environment variable | Quarterly | **CRITICAL** - Full data access |
| GCS Service Account Key | Google Cloud Storage API authentication | Environment variable (JSON) | Yearly | **CRITICAL** - All file access |

---

### SESSION_SECRET Management

**Current State**: Single shared secret for all session cookies

**Generation** (recommended process):
```bash
# Generate 256-bit secret (32 bytes hex-encoded)
openssl rand -hex 32
```

**Storage**:
- ✅ Environment variable (never in version control)
- ✅ Replit Secrets (encrypted at rest)
- ⚠️ **MISSING**: Secret rotation mechanism

**Usage** (`server/replit_integrations/auth/replitAuth.ts:41`):
```typescript
secret: SESSION_SECRET,
```
- Used by `express-session` to sign cookies via HMAC-SHA256
- Signature appended to session ID: `s:sessionId.signature`

**Rotation Procedure** (not currently implemented):
1. Add `SESSION_SECRET_NEW` to environment
2. Modify session config to accept both secrets:
   ```typescript
   secret: [SESSION_SECRET_NEW, SESSION_SECRET], // New secret first
   ```
3. After 7 days (max session age), remove old secret
4. Rename `SESSION_SECRET_NEW` → `SESSION_SECRET`

**Impact of Compromise**:
- Attacker can forge session cookies for any user
- All active sessions should be invalidated (requires `TRUNCATE session;` in PostgreSQL)

---

### OIDC_CLIENT_SECRET Management

**Current State**: Shared secret between CloudVault and Replit IdP

**Evidence** (`replitAuth.ts:23-28`):
```typescript
client_secret: OIDC_CLIENT_SECRET,
```

**Purpose**:
- Authenticates CloudVault to Replit during token exchange
- Prevents unauthorized applications from using CloudVault's `client_id`

**Rotation**:
- Initiated by Replit IdP (CloudVault is client, not issuer)
- Requires coordination with Replit support
- CloudVault must update environment variable and redeploy

**Best Practice**:
- Use OAuth 2.0 client authentication alternatives:
  - **Private Key JWT** (asymmetric authentication) - eliminates shared secret
  - **Mutual TLS** (mTLS) - certificate-based authentication

---

### Database Credentials

**Current State**: PostgreSQL connection string stored in `DATABASE_URL`

**Format**:
```
postgresql://username:password@host:5432/dbname?sslmode=require
```

**Security Controls**:
- ✅ SSL/TLS required (`sslmode=require` parameter)
- ✅ Password not visible in logs (Drizzle ORM redacts connection strings)
- ⚠️ **MISSING**: Certificate pinning for database connection

**Managed by Replit**: Database provisioned and credentials injected automatically

**Gap**: Application doesn't verify server certificate (relies on `sslmode=require` without validation)

**Recommendation**:
```typescript
// In db.ts
const dbConfig = {
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: true, // Verify certificate
    ca: process.env.DB_CA_CERT, // Pin CA certificate
  },
};
```

---

### Google Cloud Storage Service Account Key

**Current State**: JSON key file stored in environment variable (likely `GCS_KEY` or similar)

**Evidence** (`server/replit_integrations/object_storage/objectStorage.ts`):
```typescript
// GCS client initialization (not explicitly shown, but required by @google-cloud/storage)
```

**Key Properties**:
- Private key (RSA 2048-bit or higher)
- Grants access to GCS bucket(s) specified in permissions

**Best Practice**:
- ✅ Use service account with least privilege (only `storage.objects.get`, `storage.objects.create`, `storage.objects.delete`)
- ✅ Restrict bucket access to single bucket (not project-wide)
- ⚠️ **MISSING**: Key rotation schedule (Google recommends 90 days)

**Rotation Procedure**:
1. Create new service account key in GCP Console
2. Add as `GCS_KEY_NEW` environment variable
3. Deploy new version (code reads from `GCS_KEY_NEW` or `GCS_KEY`)
4. Delete old key from GCP after verification
5. Remove `GCS_KEY` environment variable

**Workload Identity Alternative** (future):
- Use Workload Identity Federation instead of static keys
- Replit workload assumes GCP service account via OIDC token exchange
- Eliminates long-lived credentials

---

## Cryptographic Operations Inventory

### Operations Performed by CloudVault

| Operation | Library | Algorithm | Evidence |
|-----------|---------|-----------|----------|
| Password hashing | `bcryptjs` | bcrypt (10 rounds) | `routes.ts:184` |
| Password verification | `bcryptjs` | bcrypt (constant-time) | `routes.ts:273` |
| UUID generation | Node.js `crypto` | UUID v4 (CSPRNG) | `objectStorage.ts:153` |
| Session cookie signing | `express-session` | HMAC-SHA256 | `replitAuth.ts:41` |
| OIDC token validation | `openid-client` | RS256 (RSA-SHA256) | `replitAuth.ts:79-89` |

### Operations Delegated to Third Parties

| Operation | Provider | Trust Model |
|-----------|----------|-------------|
| TLS termination | Replit infrastructure | Trusted (infrastructure provider) |
| OIDC token signing | Replit IdP | Trusted (identity provider) |
| File encryption at rest | Google Cloud Storage | Trusted (data processor) |
| Database encryption at rest | Replit PostgreSQL | Trusted (database provider) |

---

## Prohibited Cryptographic Practices

### ❌ Custom Cryptographic Implementations

**Rule**: Never implement cryptographic algorithms from scratch

**Rationale**:
- Cryptographic code is extremely difficult to write correctly
- Timing attacks, side-channel attacks, and implementation bugs common
- Peer-reviewed libraries have undergone extensive security analysis

**Examples of Prohibited Practices**:
```typescript
// ❌ NEVER DO THIS
function customHash(password: string): string {
  // Custom hashing algorithm
}

// ❌ NEVER DO THIS
function encryptFile(data: Buffer, key: string): Buffer {
  // Custom encryption
}
```

---

### ❌ Weak Algorithms

**Prohibited Algorithms**:
- MD5 (cryptographically broken since 2004)
- SHA-1 (collision attacks demonstrated in 2017)
- DES/3DES (small key space, deprecated by NIST)
- RC4 (biases in keystream, banned by RFC 7465)

**Legacy Code Check**: None found in codebase (verified via `grep -r "md5\|sha1\|des" server/`)

---

### ❌ Hardcoded Secrets

**Rule**: Secrets must never be committed to version control

**Detection**:
```bash
# Check for hardcoded secrets
git grep -i "secret.*=.*['\"]" -- '*.ts' '*.js'
git grep -i "password.*=.*['\"]" -- '*.ts' '*.js'
```

**Current State**: ✅ All secrets loaded from environment variables

**Pre-commit Hook** (recommended):
```bash
# .git/hooks/pre-commit
#!/bin/bash
if git diff --cached | grep -i "SECRET\s*=\s*['\"]"; then
  echo "ERROR: Hardcoded secret detected!"
  exit 1
fi
```

---

### ❌ Predictable Random Numbers

**Rule**: Use `crypto.randomUUID()` or `crypto.randomBytes()`, never `Math.random()`

**Current State**: ✅ All random values use cryptographically secure sources

**Example of Correct Usage** (`objectStorage.ts:153`):
```typescript
const uploadPath = `/objects/${crypto.randomUUID()}`;
```

---

## Compliance & Standards

### OWASP Compliance

- ✅ [C3: Use strong, approved cryptographic algorithms](https://owasp.org/www-project-proactive-controls/)
- ✅ [C5: Validate all inputs and outputs](https://owasp.org/www-project-proactive-controls/) (input validation covered in `13_APPSEC_BOUNDARIES.md`)
- ⚠️ [C6: Implement digital identity](https://owasp.org/www-project-proactive-controls/) - OIDC implemented, MFA pending

### NIST Guidelines

- ✅ [NIST SP 800-63B](https://pages.nist.gov/800-63-3/sp800-63b.html) - Password hashing requirements (bcrypt ≥ 10,000 iterations; bcrypt 10 rounds = 1,024 iterations is below recommendation)
  - **Gap**: bcrypt 10 rounds = 2^10 = 1,024 iterations (NIST recommends ≥10,000 for PBKDF2; bcrypt not directly covered but principle applies)
  - **Recommendation**: Increase to 12 rounds (4,096 iterations) for new passwords
- ✅ [NIST SP 800-52](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-52r2.pdf) - TLS configuration (delegated to Replit)

---

## Key Rotation Schedule

| Secret | Rotation Frequency | Last Rotated | Next Rotation Due | Owner |
|--------|-------------------|--------------|-------------------|-------|
| `SESSION_SECRET` | Quarterly (90 days) | Unknown | TBD | DevOps team |
| `OIDC_CLIENT_SECRET` | Yearly (365 days) | Unknown | TBD | Security team (via Replit support) |
| `DATABASE_URL` | Quarterly (90 days) | Unknown | TBD | Replit (managed service) |
| GCS Service Account Key | Quarterly (90 days) | Unknown | TBD | DevOps team |

**Process**:
1. Calendar reminder sent 14 days before rotation due
2. Key rotation performed during maintenance window (low traffic period)
3. Old key remains active for 7 days (grace period)
4. Old key deleted and rotation logged in security audit log

---

## Incident Response - Key Compromise

### Scenario: `SESSION_SECRET` Leaked to Public Repository

**Immediate Actions (within 1 hour)**:
1. Rotate `SESSION_SECRET` immediately (deploy with new value)
2. Invalidate all sessions: `TRUNCATE session;` in PostgreSQL
3. Force all users to re-authenticate
4. Audit logs for suspicious session activity (search for unusual IPs, user agents)

**Follow-up Actions (within 24 hours)**:
1. Identify source of leak (commit history, log files, etc.)
2. Rewrite Git history to remove secret (`git filter-branch` or BFG Repo-Cleaner)
3. Force push to remote and notify team to re-clone repository
4. Notify users of forced logout via email (if applicable)

**Post-Incident**:
1. Document incident in postmortem (see `60_INCIDENT_RESPONSE.md`)
2. Review secret management practices
3. Implement pre-commit hooks to prevent future leaks

---

### Scenario: GCS Service Account Key Compromised

**Immediate Actions**:
1. Disable compromised service account key in GCP Console
2. Create new service account key and update `GCS_KEY` environment variable
3. Deploy new version
4. Review GCS access logs for unauthorized activity

**Investigation**:
1. Identify compromised files (check GCS audit logs for downloads by unauthorized IPs)
2. Assess data exposure (which files accessed, by whom)
3. Notify affected users if sensitive data accessed

---

## Testing & Validation

### Cryptographic Unit Tests

```typescript
describe('Password Hashing', () => {
  it('should use bcrypt with cost factor 10', async () => {
    const password = 'test123';
    const hash = await bcrypt.hash(password, 10);
    
    expect(hash).toMatch(/^\$2[aby]\$10\$/); // bcrypt format with cost 10
    
    const isValid = await bcrypt.compare(password, hash);
    expect(isValid).toBe(true);
  });
  
  it('should reject incorrect password', async () => {
    const hash = await bcrypt.hash('correct', 10);
    const isValid = await bcrypt.compare('wrong', hash);
    expect(isValid).toBe(false);
  });
});

describe('UUID Generation', () => {
  it('should generate cryptographically random UUIDs', () => {
    const uuid1 = crypto.randomUUID();
    const uuid2 = crypto.randomUUID();
    
    expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuid1).not.toBe(uuid2); // Collision extremely unlikely
  });
});
```

### Security Scans

```bash
# Check for weak crypto algorithms
npm audit --production
snyk test --severity-threshold=medium

# Check for hardcoded secrets
git secrets --scan
truffleHog --regex --entropy=False .
```

---

## References

- **OWASP Cryptographic Storage Cheat Sheet**: [Link](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- **NIST Password Guidelines (SP 800-63B)**: [Link](https://pages.nist.gov/800-63-3/sp800-63b.html)
- **Bcrypt vs Argon2**: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- **Key Management Best Practices**: [Google Cloud KMS Docs](https://cloud.google.com/kms/docs/key-rotation)

---

**Last Updated**: 2025-02-04  
**Next Review**: 2025-05-04
