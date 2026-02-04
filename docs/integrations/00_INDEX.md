# Integrations Documentation Index

[← Back to Architecture Index](../architecture/00_INDEX.md)

## Overview

CloudVault integrates with external services for authentication, storage, and deployment. All integrations are located in `server/replit_integrations/`.

## Third-Party Services

### Replit Platform

**Provider**: Replit (https://replit.com)

**Services used**:
1. **Replit Auth** - OIDC-based user authentication
2. **PostgreSQL** - Managed database hosting
3. **Object Storage** - Google Cloud Storage via sidecar
4. **Hosting** - Application deployment and runtime

**Configuration**: `.replit` file

**Environment variables**:
- `REPL_ID` - Replit application identifier
- `ISSUER_URL` - OIDC discovery endpoint

**Evidence**: [.replit](../../.replit)

---

### Replit Auth (OIDC)

**Purpose**: User authentication via OpenID Connect

**Type**: OAuth 2.0 + OIDC

**Flow**: Authorization Code Flow with PKCE

**Integration location**: `server/replit_integrations/auth/`

#### Configuration

**Discovery URL**: `https://auth.replit.com/.well-known/openid-configuration`

**Required env vars**:
- `ISSUER_URL` - OIDC issuer URL
- `REPL_ID` - Replit application ID (auto-set)
- `SESSION_SECRET` - Session encryption key

**Evidence**: [server/replit_integrations/auth/setup.ts](../../server/replit_integrations/auth/setup.ts)

#### Authentication Flow

```
1. User clicks "Sign in with Replit"
   → Redirect to Replit Auth
   
2. User authenticates on Replit
   → Replit validates credentials
   
3. Replit redirects to /api/auth/callback with code
   → Authorization code in URL params
   
4. Server exchanges code for ID token
   → POST to token endpoint
   
5. Server validates ID token
   → Verify signature, issuer, audience
   
6. Server extracts claims
   → sub (user ID), name, email, username
   
7. Server upserts user to database
   → Sync Replit user to local users table
   
8. Server creates session
   → Store session in PostgreSQL
   
9. Server sets session cookie
   → connect.sid cookie
   
10. Redirect to dashboard
```

**Evidence**: [server/replit_integrations/auth/setup.ts](../../server/replit_integrations/auth/setup.ts)

#### User Claims

**ID token contains**:
```typescript
{
  sub: string;        // User ID (unique identifier)
  name: string;       // Display name
  email: string;      // Email address
  username: string;   // Replit username
  picture: string;    // Profile image URL
}
```

**Stored in session**: Full claims object in `req.user.claims`

**Evidence**: [server/replit_integrations/auth/user.ts](../../server/replit_integrations/auth/user.ts)

#### Middleware

**isAuthenticated** - Protects routes requiring login

**Usage**:
```typescript
app.get("/api/folders", isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub;
  // Handler logic
});
```

**Evidence**: [server/replit_integrations/auth/middleware.ts](../../server/replit_integrations/auth/middleware.ts)

---

### Google Cloud Storage (Object Storage)

**Purpose**: Store file blobs (binary data)

**Access method**: Via Replit sidecar service (no direct GCS credentials)

**Integration location**: `server/replit_integrations/object_storage/`

#### How It Works

1. **Replit provisions GCS bucket** for each Repl
2. **Sidecar service** runs alongside app with GCS credentials
3. **App calls sidecar** to generate presigned URLs
4. **Client uploads directly** to GCS using presigned URL

**Evidence**: [server/replit_integrations/object_storage/service.ts](../../server/replit_integrations/object_storage/service.ts)

#### ObjectStorageService Class

**Methods**:

```typescript
class ObjectStorageService {
  // Generate presigned URL for upload
  async getPresignedUploadUrl(
    objectPath: string,
    contentType: string
  ): Promise<string>
  
  // Generate presigned URL for download
  async getPresignedDownloadUrl(
    objectPath: string
  ): Promise<string>
}
```

**Evidence**: [server/replit_integrations/object_storage/service.ts](../../server/replit_integrations/object_storage/service.ts)

#### Presigned URL Pattern

**Upload flow**:
```
1. Client requests presigned URL
   → POST /api/storage/presigned-url
   
2. Server generates presigned URL
   → Calls GCS API via sidecar
   
3. Server returns presigned URL
   → Response: { presignedUrl, objectPath }
   
4. Client uploads file
   → PUT <presigned-url> with file data
   
5. Client notifies server
   → POST /api/files with metadata
```

**Download flow**:
```
1. Client requests download URL
   → POST /api/share-links/:token/download
   
2. Server validates access
   → Check expiration, password
   
3. Server generates presigned URL
   → Calls GCS API via sidecar
   
4. Server returns presigned URL
   → Response: { downloadUrl }
   
5. Client downloads file
   → GET <download-url> (browser)
```

**Evidence**: [docs/architecture/40_KEY_FLOWS.md](../architecture/40_KEY_FLOWS.md) (Flows 2 and 3)

#### Storage Limits

**Per Repl**: Varies by Replit plan
- Free tier: Limited storage
- Paid tiers: Increased storage

**File size limit**: No application-level limit (GCS supports large files)

**Quotas**: Managed by Replit

---

### PostgreSQL Database

**Purpose**: Primary data storage

**Provider**: Replit-managed PostgreSQL

**Version**: PostgreSQL 14+ (Replit default)

**Connection**: Via `DATABASE_URL` environment variable

**Format**: `postgresql://user:pass@host:5432/dbname`

**Connection pooling**: Managed by `pg` package (10 connections default)

**Evidence**: [server/db.ts](../../server/db.ts)

#### Database Access

**Direct SQL**: Not used (except migrations)

**ORM**: Drizzle ORM for all queries

**Example**:
```typescript
import { db } from "./db";
import { folders } from "@shared/schema";

const userFolders = await db.select()
  .from(folders)
  .where(eq(folders.userId, userId));
```

**Evidence**: [server/storage.ts](../../server/storage.ts)

---

### Passport.js

**Purpose**: Authentication middleware framework

**Used for**: Replit Auth (OIDC strategy)

**Strategy**: OpenID Connect (openid-client package)

**Location**: `server/replit_integrations/auth/setup.ts`

**Evidence**: [server/replit_integrations/auth/setup.ts](../../server/replit_integrations/auth/setup.ts)

---

### npm Packages (Key External Dependencies)

| Package | Purpose | Version | Vendor |
|---------|---------|---------|--------|
| `@google-cloud/storage` | GCS SDK | ^7.18.0 | Google |
| `openid-client` | OIDC client | ^6.8.1 | panva |
| `passport` | Auth middleware | ^0.7.0 | Jared Hanson |
| `express` | HTTP server | ^5.0.1 | Express team |
| `drizzle-orm` | Database ORM | ^0.39.3 | Drizzle team |
| `bcryptjs` | Password hashing | ^3.0.3 | dcodeIO |
| `pg` | PostgreSQL driver | ^8.16.3 | Brian Carlson |
| `react` | UI framework | ^18.3.1 | Meta |
| `vite` | Build tool | ^7.3.0 | Evan You |

**Evidence**: [package.json](../../package.json)

## Webhook Patterns

**Current state**: No webhooks implemented

**Potential use cases**:
- Replit Auth user updates (not available)
- File storage events (not used)
- Payment/subscription webhooks (not applicable)

## Secrets & API Keys

### Managed by Replit

**Auto-set**:
- `REPL_ID` - Application identifier
- `DATABASE_URL` - PostgreSQL connection string
- GCS credentials (not exposed to app)

**User-set**:
- `SESSION_SECRET` - Session encryption key
- `ISSUER_URL` - OIDC discovery URL

### Storage

**Location**: Replit Secrets (environment variables)

**Access**: `process.env.SECRET_NAME`

**Not in code**: No secrets committed to Git

**Evidence**: `.gitignore` (check for .env)

### Rotation

**SESSION_SECRET**: Should be rotated periodically (no automatic rotation)

**Effect of rotation**: Invalidates all existing sessions (users logged out)

**Best practice**: Rotate after security incident or periodically (e.g., quarterly)

## External Service Failures

### Replit Auth Down

**Symptom**: Login button fails, redirects hang

**Impact**: New users cannot log in, existing sessions work

**Mitigation**: Wait for Replit service restoration

**Fallback**: None implemented

---

### Google Cloud Storage Down

**Symptom**: File upload/download fails

**Impact**: Cannot upload or download files

**Mitigation**: Wait for GCS restoration

**Fallback**: None implemented

**Evidence**: No retry logic in ObjectStorageService

---

### PostgreSQL Down

**Symptom**: All API requests fail with 500 errors

**Impact**: Application unusable

**Mitigation**: Wait for database restoration

**Fallback**: None implemented

**Evidence**: No database connection retry logic

## Rate Limits

### Replit Auth

**Limit**: Unknown (managed by Replit)

**Handling**: No rate limit handling in app

**Evidence**: No retry logic in auth integration

---

### Google Cloud Storage

**Limit**: Varies by operation (GET, PUT)

**Handling**: No rate limit handling in app

**Evidence**: No retry logic in ObjectStorageService

---

### PostgreSQL

**Limit**: Connection pool size (10 connections)

**Handling**: Queries queue if pool exhausted

**Evidence**: [server/db.ts](../../server/db.ts) (pg Pool)

## Monitoring Integrations

**Current state**: No external monitoring

**Recommendations**:
- **Sentry**: Error tracking
- **Datadog**: APM and logging
- **Uptime Robot**: Availability monitoring

## Testing Integrations

### Authentication (Dev)

```bash
# Test OIDC discovery
curl https://auth.replit.com/.well-known/openid-configuration

# Start auth flow (manual)
# 1. Open http://localhost:5000/api/login
# 2. Complete authentication in browser
# 3. Verify session cookie set
```

### Object Storage (Dev)

```bash
# Test presigned URL generation
curl -X POST http://localhost:5000/api/storage/presigned-url \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.txt","contentType":"text/plain"}'

# Test upload to presigned URL
curl -X PUT "<presigned-url>" \
  -H "Content-Type: text/plain" \
  --data-binary "@test.txt"
```

### Database (Dev)

```bash
# Test connection
psql $DATABASE_URL -c "SELECT version();"

# Test query
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

## Integration Security

### Authentication

- ✅ **HTTPS enforced**: Auth redirects use HTTPS
- ✅ **PKCE enabled**: Authorization code flow with PKCE
- ✅ **Token validation**: ID token signature verified
- ✅ **Session encryption**: Session cookie encrypted

### Object Storage

- ✅ **Presigned URLs**: Time-limited access (no permanent credentials)
- ✅ **Path isolation**: User ID in object path
- ⚠️ **No ACLs**: Application enforces access control, not GCS
- ❌ **No blob cleanup**: Deleted files leave orphaned blobs

### Database

- ✅ **Parameterized queries**: Drizzle ORM prevents SQL injection
- ✅ **Connection pooling**: Reuses connections securely
- ✅ **Encrypted in transit**: PostgreSQL connection uses SSL
- ⚠️ **No query timeouts**: Long queries can block pool

### Secrets

- ✅ **Not in code**: Secrets in environment variables
- ✅ **Not in Git**: .env in .gitignore
- ⚠️ **No rotation**: Manual secret rotation required

## Evidence

Key files implementing integrations:

- [server/replit_integrations/auth/](../../server/replit_integrations/auth/) - Authentication integration
- [server/replit_integrations/object_storage/](../../server/replit_integrations/object_storage/) - Storage integration
- [server/db.ts](../../server/db.ts) - Database connection
- [.replit](../../.replit) - Replit platform configuration
- [package.json](../../package.json) - External dependencies

## Related Documentation

- [Architecture Overview](../architecture/10_OVERVIEW.md) - Integration context
- [Key Flows](../architecture/40_KEY_FLOWS.md) - Integration usage
- [API Documentation](../api/00_INDEX.md) - API endpoints using integrations
- [Glossary](../architecture/90_GLOSSARY.md) - Integration terms

[← Back to Architecture Index](../architecture/00_INDEX.md)
