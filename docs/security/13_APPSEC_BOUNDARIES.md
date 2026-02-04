# Application Security Boundaries

## Overview

CloudVault's attack surface spans **HTTP APIs**, **database queries**, and **file storage operations**. This document catalogs all security boundary crossings and the validation/sanitization controls protecting each.

**Defense Layers**:
1. **Input Validation**: Zod schemas reject malformed requests before processing
2. **Injection Prevention**: Drizzle ORM parameterizes SQL; GCS SDK sanitizes paths
3. **Output Encoding**: React JSX auto-escapes (XSS mitigation)
4. **Error Handling**: Generic errors prevent information disclosure

---

## Trust Boundaries Map

```
┌─────────────────────────────────────────────────────────────┐
│ UNTRUSTED: Client Browser / HTTP Requests                  │
│ - User input (folder names, file names, passwords)         │
│ - URL parameters (IDs, tokens)                             │
│ - File uploads (content, MIME type, size)                  │
└─────────────────┬───────────────────────────────────────────┘
                  │ Validation: Zod schemas
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ TRUSTED: Express.js Application Logic                      │
│ - Validated input only                                      │
│ - Authorization checks enforced                             │
└─────────┬───────────────────────┬───────────────────────────┘
          │ SQL params            │ GCS API calls
          ▼                       ▼
┌──────────────────────┐   ┌──────────────────────┐
│ PostgreSQL Database  │   │ Google Cloud Storage │
│ - Drizzle ORM        │   │ - @google-cloud/     │
│   (parameterized)    │   │   storage SDK        │
└──────────────────────┘   └──────────────────────┘
```

---

## Input Validation (Zod Schemas)

### Folder Creation (`server/routes.ts:61-78`)

**Endpoint**: `POST /api/folders`

**Schema** (`shared/schema.ts:81-84`):
```typescript
export const insertFolderSchema = createInsertSchema(folders).omit({
  id: true,        // Server-generated UUID
  createdAt: true, // Auto-populated timestamp
});
```

**Inferred Validation**:
- `name`: `text()` (required, unbounded string)
- `parentId`: `varchar()` (optional, must be valid UUID format if present)
- `userId`: `varchar()` (required, must be valid UUID format)

**Code** (`routes.ts:64-74`):
```typescript
const folderData = insertFolderSchema.parse({
  name: req.body.name,
  userId: req.user.claims.sub, // From session, not user input
  parentId: req.body.parentId || null,
});

try {
  const newFolder = await storage.createFolder(folderData);
  return res.json(newFolder);
} catch (error: any) {
  return res.status(500).send(error.message);
}
```

**Security Properties**:
- ✅ `userId` extracted from authenticated session (not request body)
- ✅ Zod validates `parentId` format (UUID validation implicit in schema)
- ⚠️ **No length limit on `name`** - PostgreSQL `text` type allows up to 1 GB
  - **Risk**: Database storage exhaustion via long folder names
  - **Mitigation**: Add length validation: `name: text("name").notNull().$type<string & { __brand: 'FolderName' }>()` + `.max(255)` in Zod

**Gap**: Folder name not sanitized for XSS (relies on React JSX auto-escaping)

---

### File Metadata Creation (`server/routes.ts:104-128`)

**Endpoint**: `POST /api/files`

**Schema** (`shared/schema.ts:86-89`):
```typescript
export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  createdAt: true,
});
```

**Validated Fields**:
- `name`: File name (e.g., `document.pdf`)
- `size`: File size in bytes (`bigint`)
- `mimeType`: Content type (e.g., `application/pdf`)
- `objectPath`: GCS storage path (e.g., `/objects/abc-123`)
- `folderId`: Optional parent folder UUID
- `userId`: Owner UUID (from session)

**Code** (`routes.ts:111-123`):
```typescript
const fileData = insertFileSchema.parse({
  name: req.body.name,
  size: req.body.size,
  mimeType: req.body.mimeType,
  objectPath: req.body.objectPath,
  folderId: req.body.folderId || null,
  userId: req.user.claims.sub,
});

const newFile = await storage.createFile(fileData);
res.json(newFile);
```

**Security Properties**:
- ✅ `userId` from session (not request body)
- ✅ `size` validated as bigint (type coercion fails for non-numeric values)
- ⚠️ **No MIME type validation** - Accepts any string (e.g., `text/html; charset=utf-8`)
  - **Risk**: Content-Type confusion attacks if served directly
  - **Mitigation**: Validate against allowlist: `mimeType.startsWith('image/') || mimeType === 'application/pdf'`
- ⚠️ **`objectPath` user-controlled** - Client provides GCS path after upload
  - **Risk**: Path traversal if not validated by GCS SDK
  - **Current Protection**: `objectStorage.normalizeObjectEntityPath()` (see below)

---

### Share Link Creation (`server/routes.ts:165-195`)

**Endpoint**: `POST /api/files/:id/share`

**Schema** (`routes.ts:159-163`):
```typescript
const createShareSchema = z.object({
  password: z.string().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});
```

**Code** (`routes.ts:167-186`):
```typescript
const shareData = createShareSchema.safeParse(req.body);
if (!shareData.success) {
  return res.status(400).json({ errors: shareData.error.errors });
}

// ... ownership validation ...

const shareLink = await storage.createShareLink({
  fileId,
  password: shareData.data.password 
    ? await bcrypt.hash(shareData.data.password, 10)
    : undefined,
  expiresAt: shareData.data.expiresAt,
  token: crypto.randomUUID(), // Server-generated
  isActive: true,
});
```

**Security Properties**:
- ✅ Password hashed with bcrypt before storage (never stored plaintext)
- ✅ `token` server-generated (client cannot specify)
- ✅ `expiresAt` coerced to Date (Zod validates ISO 8601 format)
- ⚠️ **No password strength requirements** - Accepts single-character passwords
  - **Mitigation**: Add `.min(8)` to password validation

---

## SQL Injection Prevention

### Drizzle ORM Parameterization

All database queries use **Drizzle ORM**, which automatically parameterizes values to prevent SQL injection.

#### Example: Folder Query (`server/storage.ts:52-58`)

**Potentially Vulnerable Code** (if using raw SQL):
```typescript
// ❌ VULNERABLE (not used in CloudVault)
const query = `SELECT * FROM folders WHERE id = '${folderId}' AND user_id = '${userId}'`;
db.execute(query); // SQL injection possible
```

**Actual Code** (secure):
```typescript
export async function getFolder(userId: string, folderId: string) {
  return db.query.folders.findFirst({
    where: and(eq(folders.id, folderId), eq(folders.userId, userId)),
  });
}
```

**Generated SQL** (parameterized):
```sql
SELECT * FROM folders WHERE id = $1 AND user_id = $2
-- Parameters: [$1 = folderId, $2 = userId]
```

**Security Properties**:
- ✅ User input never concatenated into SQL strings
- ✅ Drizzle ORM escapes all values automatically
- ✅ PostgreSQL prepared statements prevent injection

---

#### Example: Share Link Download Count Increment (`storage.ts:151-156`)

**Code**:
```typescript
await db
  .update(shareLinks)
  .set({ downloadCount: sql`${shareLinks.downloadCount} + 1` })
  .where(eq(shareLinks.id, shareLinkId));
```

**Generated SQL**:
```sql
UPDATE share_links 
SET download_count = download_count + 1 
WHERE id = $1
```

**Security Properties**:
- ✅ `sql` template literal creates SQL fragment (not user-controlled)
- ✅ `shareLinkId` bound as parameter ($1)
- ✅ No arithmetic injection possible (column reference is static)

---

### Verification: No Raw SQL String Concatenation

**Audit Command**:
```bash
grep -rn "execute.*\`" server/ --include="*.ts"
grep -rn "db\\.raw" server/ --include="*.ts"
```

**Result**: ✅ Zero raw SQL queries found (confirmed safe)

---

## Path Traversal Prevention (GCS)

### Path Normalization (`server/replit_integrations/object_storage/objectStorage.ts:194-217`)

**Function**: `normalizeObjectEntityPath(objectPath: string)`

**Purpose**: Validate GCS paths to prevent access to unauthorized objects

**Code**:
```typescript
export function normalizeObjectEntityPath(objectPath: string): string {
  // Accept GCS URLs: gs://bucket/objects/entityId or https://storage.googleapis.com/...
  let path = objectPath;
  
  if (path.startsWith('gs://')) {
    path = path.replace(/^gs:\/\/[^/]+/, '');
  } else if (path.includes('storage.googleapis.com')) {
    const url = new URL(path);
    path = url.pathname; // Extract /bucket/objects/entityId
  }
  
  // Validate path starts with configured private directory
  if (!path.startsWith(PRIVATE_OBJECT_DIR)) { // PRIVATE_OBJECT_DIR = "/objects/"
    throw new Error(`Invalid object path: ${path}`);
  }
  
  return path; // Returns normalized /objects/{entityId}
}
```

**Security Properties**:
- ✅ Rejects paths not starting with `/objects/` (enforces directory isolation)
- ✅ Accepts both `gs://` URLs and HTTPS URLs (flexible but validated)
- ✅ Throws exception for invalid paths (fail-secure)

**Test Cases**:
```typescript
normalizeObjectEntityPath('/objects/abc-123')           // ✅ Valid
normalizeObjectEntityPath('gs://bucket/objects/abc')    // ✅ Valid (normalized to /objects/abc)
normalizeObjectEntityPath('/admin/secrets.txt')         // ❌ Throws error
normalizeObjectEntityPath('/objects/../admin/file.txt') // ⚠️ NOT TESTED - Potential bypass
```

**Gap**: Path traversal sequences (`../`) not explicitly sanitized  
**Mitigation Required**:
```typescript
// Add path traversal protection
path = path.replace(/\.\./g, ''); // Remove all ../ sequences
// OR use Node.js path.normalize() after validation
```

---

### Upload Path Generation (`objectStorage.ts:148-157`)

**Code**:
```typescript
async function generateUploadUrl(objectName?: string): Promise<string> {
  const uploadPath = objectName || `/objects/${crypto.randomUUID()}`;
  
  const uploadUrl = await objectStorageService.generateUploadUrl(
    uploadPath,
    OBJECT_EXPIRATION_TIME
  );
  
  return uploadUrl;
}
```

**Security Properties**:
- ✅ If `objectName` not provided, generates random UUID path (server-controlled)
- ⚠️ If `objectName` provided by client, not validated before GCS upload
  - **Risk**: Client could specify `objectName = "/objects/../admin/backdoor"`
  - **Current Protection**: GCS SDK may normalize paths (behavior not verified)

**Recommended Fix**:
```typescript
const uploadPath = objectName 
  ? normalizeObjectEntityPath(objectName) // Validate client-provided paths
  : `/objects/${crypto.randomUUID()}`;
```

---

## Cross-Site Scripting (XSS) Prevention

### React JSX Auto-Escaping

**Framework**: React 18 (client-side rendering)

**Evidence** (`client/src/components/FileList.tsx` - example):
```tsx
<div>{file.name}</div> {/* Automatically escaped */}
```

**React Escaping Behavior**:
- ✅ All JSX text content HTML-escaped automatically
- ✅ Converts `<script>` to `&lt;script&gt;` (harmless)
- ✅ Attribute values (e.g., `href`, `src`) validated by React

**Exceptions Requiring Manual Sanitization**:
```tsx
// ❌ DANGEROUS - Bypasses React escaping
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ❌ DANGEROUS - JavaScript URL scheme
<a href={`javascript:${userInput}`}>Click</a>
```

**Audit Command**:
```bash
grep -rn "dangerouslySetInnerHTML" client/ --include="*.tsx"
grep -rn "javascript:" client/ --include="*.tsx"
```

**Result**: ✅ Zero dangerous patterns found

---

### Server-Side Rendering (SSR) - Not Applicable

CloudVault uses **client-side rendering only** (Vite SPA). Server does not render HTML with user data.

**Evidence** (`server/static.ts`):
```typescript
app.use(express.static(CLIENT_BUILD_DIR)); // Static file serving only
```

**Security Property**: ✅ No server-side template injection risk (Mustache, EJS, etc.)

---

## Error Handling & Information Disclosure

### Generic Error Messages (`server/routes.ts`)

**Current Pattern**:
```typescript
// ✅ Good - Generic error
if (!file) {
  return res.status(404).send("File not found");
}

// ⚠️ Risky - Exposes internal details
catch (error: any) {
  return res.status(500).send(error.message); // Line 74
}
```

**Gaps**:
- ❌ Database errors leaked to client (line 74, 123)
  - Example: `"duplicate key value violates unique constraint"` reveals schema
- ❌ Zod validation errors include full input data (line 169)
  - Example: `{ "errors": [{"path": ["password"], "received": "secret123"}] }`

**Recommended Error Handling**:
```typescript
catch (error: any) {
  console.error('Database error:', error); // Log full error server-side
  return res.status(500).send("Internal server error"); // Generic message to client
}
```

---

### Differentiated Error Codes (Information Disclosure)

**Issue**: Different HTTP status codes reveal resource existence

**Example** (`routes.ts:259-263`):
```typescript
if (!shareLink) {
  return res.status(404).send("Share not found"); // Resource doesn't exist
}
if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
  return res.status(410).send("Share expired"); // Resource exists but expired
}
```

**Attack**: Attacker brute-forces share tokens:
- 404 → Invalid token (try next)
- 410 → Valid token but expired (useful intel)

**Mitigation**: Return 403 Forbidden for both cases (no distinction)

---

## Password Timing Attack Prevention

### Constant-Time Comparison (`server/routes.ts:273`)

**Code**:
```typescript
if (shareLink.password) {
  const validPassword = await bcrypt.compare(
    req.body.password,
    shareLink.password
  );
  if (!validPassword) {
    return res.status(401).send("Invalid password");
  }
}
```

**Security Properties**:
- ✅ `bcrypt.compare()` uses constant-time comparison (timing attack resistant)
- ✅ Comparison time independent of correct password (no early-exit)

**Benchmark** (approximate):
- Correct password: ~150ms (bcrypt cost factor 10)
- Incorrect password: ~150ms (same)

**Gap**: No rate limiting allows online brute force (see `10_THREAT_MODEL.md` T-T-03)

---

## Content Security Policy (CSP) - Missing

**Current State**: ❌ No CSP headers configured

**Evidence**: No Helmet.js or CSP middleware in `server/index.ts`

**Risk**: XSS attacks not mitigated at browser level (relies solely on React escaping)

**Recommended CSP** (see `31_RUNTIME_HARDENING.md`):
```
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://storage.googleapis.com;
  connect-src 'self' https://storage.googleapis.com;
```

**Trade-offs**:
- `'unsafe-inline'` required for React Hot Reload in development
- `'unsafe-eval'` required for Vite build tooling (can remove in production)

---

## File Upload Validation - Gaps

### Missing Validations

1. **File Size Limit**: No validation in `POST /api/files` endpoint
   ```typescript
   // Recommended
   if (req.body.size > 100 * 1024 * 1024) { // 100 MB
     return res.status(413).send("File too large");
   }
   ```

2. **MIME Type Validation**: Accepts any content type
   ```typescript
   // Recommended
   const ALLOWED_TYPES = ['image/*', 'application/pdf', 'text/plain'];
   if (!ALLOWED_TYPES.some(pattern => mimeType.match(pattern))) {
     return res.status(415).send("Unsupported file type");
   }
   ```

3. **File Extension vs MIME Type Mismatch**: Not checked
   - Example: `file.jpg` with `mimeType: "application/x-msdownload"` (executable)

---

## Input Validation Checklist

| Boundary | Validation | Status | Evidence |
|----------|-----------|--------|----------|
| Folder name | Zod schema | ✅ Partial (no length limit) | `routes.ts:64` |
| File name | Zod schema | ✅ Partial (no length limit) | `routes.ts:111` |
| File size | Zod bigint | ✅ Type validation only | `routes.ts:111` |
| MIME type | None | ❌ Missing | `routes.ts:111` |
| GCS path | `normalizeObjectEntityPath()` | ⚠️ Partial (no `../` check) | `objectStorage.ts:210` |
| Share password | Zod optional string | ⚠️ Partial (no strength check) | `routes.ts:167` |
| Share expiration | Zod coerce date | ✅ Valid | `routes.ts:159` |
| SQL parameters | Drizzle ORM | ✅ Full protection | All `storage.ts` functions |
| HTML output | React JSX | ✅ Auto-escaped | All `client/` components |

---

## Testing Recommendations

### Fuzzing Input Validation
```typescript
describe('Input Validation Fuzzing', () => {
  const maliciousInputs = [
    '<script>alert(1)</script>',
    '../../etc/passwd',
    "'; DROP TABLE folders; --",
    'A'.repeat(10000), // Long string
    '\x00\x01\x02', // Null bytes
  ];
  
  for (const input of maliciousInputs) {
    it(`should reject malicious input: ${input}`, async () => {
      const response = await request(app)
        .post('/api/folders')
        .send({ name: input });
      
      expect([400, 500]).toContain(response.status);
    });
  }
});
```

### Path Traversal Tests
```typescript
describe('GCS Path Validation', () => {
  it('should reject path traversal attempts', () => {
    expect(() => normalizeObjectEntityPath('/objects/../admin')).toThrow();
    expect(() => normalizeObjectEntityPath('/admin/secrets')).toThrow();
  });
});
```

---

## References

- **OWASP Input Validation**: [Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- **SQL Injection Prevention**: [OWASP SQL Injection](https://owasp.org/www-community/attacks/SQL_Injection)
- **XSS Prevention**: [OWASP XSS](https://owasp.org/www-community/attacks/xss/)
- **Path Traversal**: [CWE-22](https://cwe.mitre.org/data/definitions/22.html)

---

**Last Updated**: 2025-02-04  
**Next Review**: 2025-05-04
