# Key Flows

[← Back to Index](./00_INDEX.md)

## Overview

This document describes the **6 critical flows** in CloudVault that every developer should understand.

**Reading guide**: Each flow includes:

- **Trigger**: What starts the flow
- **Steps**: Numbered sequence through system layers
- **Modules Touched**: Code locations
- **Failure Modes**: Common errors and edge cases
- **Validation Tips**: How to test the flow

## Flow 1: User Authentication

### Trigger

User clicks "Sign in with Replit" on landing page.

### Steps

```
1. User clicks login button
   → client/src/pages/landing.tsx

2. Browser redirected to Replit Auth OIDC endpoint
   → server/replit_integrations/auth/setup.ts (Passport strategy)

3. User authenticates on Replit
   → External (Replit Auth service)

4. Replit redirects back with authorization code
   → /auth/callback

5. Server exchanges code for ID token
   → server/replit_integrations/auth/setup.ts (OpenIDConnectStrategy)

6. Server validates token and extracts claims (sub, name, email)
   → Passport.js verify callback

7. Server upserts user to database
   → server/replit_integrations/auth/user.ts (upsertUser)
   → shared/schema.ts (users table)

8. Server creates session in PostgreSQL
   → express-session with connect-pg-simple
   → shared/schema.ts (sessions table)

9. Server sets session cookie
   → express-session middleware

10. Browser redirected to dashboard
    → client/src/App.tsx (AuthenticatedApp)

11. Client fetches user info
    → client/src/hooks/use-auth.ts (useAuth hook)
    → GET /api/user
```

### Modules Touched

- `server/replit_integrations/auth/setup.ts` - OIDC configuration
- `server/replit_integrations/auth/middleware.ts` - isAuthenticated guard
- `server/replit_integrations/auth/user.ts` - User sync logic
- `shared/schema.ts` - users and sessions tables
- `server/routes.ts` - Auth route handlers
- `client/src/hooks/use-auth.ts` - Auth state management

### Failure Modes

| Error                   | Cause                   | Symptom                   | Fix                        |
| ----------------------- | ----------------------- | ------------------------- | -------------------------- |
| "OIDC discovery failed" | Wrong ISSUER_URL        | Server won't start        | Check environment variable |
| "Session not found"     | Session expired/cleared | Redirected to login       | User must re-authenticate  |
| "Unauthorized"          | Missing session cookie  | API returns 401           | Check cookie settings      |
| "User not found"        | Database insert failed  | Auth succeeds but no user | Check DATABASE_URL         |

### Validation Tips

```bash
# 1. Check OIDC configuration
curl https://auth.replit.com/.well-known/openid-configuration

# 2. Test login flow manually
# - Open /api/login in browser
# - Should redirect to Replit
# - After auth, should redirect to dashboard

# 3. Verify session in database
psql $DATABASE_URL -c "SELECT * FROM sessions;"

# 4. Test authenticated endpoint
curl -b cookies.txt http://localhost:5000/api/user
```

## Flow 2: File Upload

### Trigger

User drags file into upload dialog on dashboard.

### Steps

```
1. User selects file in Uppy dialog
   → client/src/components/FileUpload.tsx (Uppy Dashboard)

2. Client requests presigned upload URL
   → POST /api/storage/presigned-url
   → server/replit_integrations/object_storage/routes.ts

3. Server validates user authentication
   → isAuthenticated middleware

4. Server generates presigned URL from Google Cloud Storage
   → server/replit_integrations/object_storage/service.ts (getPresignedUploadUrl)

5. Server returns presigned URL + objectPath
   → Response: { presignedUrl, objectPath }

6. Client uploads file directly to Google Cloud Storage
   → Uppy @uppy/aws-s3 plugin (uses presigned URL)
   → Bypasses server for data transfer

7. Upload completes, client notifies server
   → POST /api/files
   → Body: { name, size, mimeType, objectPath, folderId? }

8. Server validates request with Zod schema
   → server/routes.ts (insertFileSchema)

9. Server creates file metadata record
   → server/storage.ts (createFile)
   → INSERT INTO files

10. Server returns file object
    → Response: { id, name, size, ... }

11. Client updates file list cache
    → client/src/hooks/use-upload.ts
    → React Query invalidates /api/files query

12. UI shows new file in folder
    → client/src/pages/dashboard.tsx (file table re-renders)
```

### Modules Touched

- `client/src/components/FileUpload.tsx` - Uppy integration
- `client/src/hooks/use-upload.ts` - Upload state management
- `server/replit_integrations/object_storage/routes.ts` - Presigned URL endpoint
- `server/replit_integrations/object_storage/service.ts` - GCS integration
- `server/routes.ts` - File creation endpoint
- `server/storage.ts` - Database operations
- `shared/schema.ts` - files table

### Failure Modes

| Error                         | Cause                        | Symptom                     | Fix                            |
| ----------------------------- | ---------------------------- | --------------------------- | ------------------------------ |
| "Failed to get presigned URL" | GCS credentials missing      | Upload fails immediately    | Check REPL_ID and GCS setup    |
| "Upload to storage failed"    | Network error or expired URL | Upload progress stops       | Retry upload                   |
| "File not found in storage"   | Client didn't upload         | POST /api/files returns 500 | Check objectPath exists in GCS |
| "Duplicate file name"         | File name conflict           | No error (allowed)          | Files can have same name       |

### Validation Tips

```bash
# 1. Test presigned URL generation
curl -X POST http://localhost:5000/api/storage/presigned-url \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.txt","contentType":"text/plain"}'

# 2. Upload file to presigned URL (simulate client)
curl -X PUT "<presigned-url>" \
  -H "Content-Type: text/plain" \
  --data-binary "@test.txt"

# 3. Create file metadata
curl -X POST http://localhost:5000/api/files \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{"name":"test.txt","size":100,"mimeType":"text/plain","objectPath":"path/to/test.txt"}'

# 4. Verify file in database
psql $DATABASE_URL -c "SELECT * FROM files WHERE name='test.txt';"
```

## Flow 3: File Download via Share Link

### Trigger

Unauthenticated user visits `/share/:token` URL.

### Steps

```
1. User opens share link in browser
   → https://app.example.com/share/abc123xyz
   → client/src/App.tsx routes to ShareDownloadPage

2. Client fetches share link metadata
   → GET /api/share-links/token/abc123xyz
   → server/routes.ts (public endpoint, no auth required)

3. Server validates token and checks expiration
   → server/storage.ts (getShareLinkByToken)
   → Check: isActive = true, expiresAt > now

4. Server returns share link + file metadata
   → Response: { id, fileId, expiresAt, password?, file: {...} }

5. If password protected, show password prompt
   → client/src/pages/share-download.tsx (password form)

6. User enters password (if required)
   → Client submits password

7. Client requests download URL
   → POST /api/share-links/:token/download
   → Body: { password? }

8. Server validates password (if set)
   → server/routes.ts (bcrypt.compare)

9. Server generates presigned download URL
   → server/replit_integrations/object_storage/service.ts (getPresignedDownloadUrl)

10. Server increments download count
    → server/storage.ts (incrementDownloadCount)
    → UPDATE share_links SET download_count = download_count + 1

11. Server returns presigned download URL
    → Response: { downloadUrl }

12. Client auto-downloads file
    → window.location.href = downloadUrl (browser downloads file)
```

### Modules Touched

- `client/src/pages/share-download.tsx` - Share page UI
- `server/routes.ts` - Share link endpoints
- `server/storage.ts` - Share link queries
- `server/replit_integrations/object_storage/service.ts` - Download URL generation
- `shared/schema.ts` - shareLinks table

### Failure Modes

| Error                  | Cause                     | Symptom              | Fix                         |
| ---------------------- | ------------------------- | -------------------- | --------------------------- |
| "Share link not found" | Invalid token             | 404 error page       | Check token in URL          |
| "Link expired"         | expiresAt < now           | Error message        | Create new share link       |
| "Invalid password"     | Wrong password            | "Incorrect password" | Retry with correct password |
| "Link inactive"        | isActive = false          | 404 or error         | Owner deactivated link      |
| "Download failed"      | GCS presigned URL expired | Browser error        | Retry (new URL generated)   |

### Validation Tips

```bash
# 1. Create share link (as authenticated user)
curl -X POST http://localhost:5000/api/share-links \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{"fileId":"<file-id>","expiresAt":"2026-12-31T23:59:59Z","password":"secret123"}'

# 2. Get share link metadata (public)
curl http://localhost:5000/api/share-links/token/<token>

# 3. Download file with password
curl -X POST http://localhost:5000/api/share-links/<token>/download \
  -H "Content-Type: application/json" \
  -d '{"password":"secret123"}'
  # Returns: { downloadUrl }

# 4. Verify download count incremented
psql $DATABASE_URL -c "SELECT download_count FROM share_links WHERE token='<token>';"
```

## Flow 4: Folder Navigation

### Trigger

User clicks on folder in dashboard.

### Steps

```
1. User clicks folder name
   → client/src/pages/dashboard.tsx (FolderTree or file list)

2. Client updates current folder state
   → Local state (useState or React Query param)

3. Client fetches subfolders
   → GET /api/folders?parentId=<folder-id>
   → server/routes.ts

4. Server validates user owns parent folder
   → Implicit via userId filter in query

5. Server queries folders table
   → server/storage.ts (getFoldersByParent)
   → SELECT * FROM folders WHERE user_id=... AND parent_id=...

6. Client fetches files in folder
   → GET /api/files?folderId=<folder-id>
   → server/routes.ts

7. Server queries files table
   → server/storage.ts (getFilesByFolder)
   → SELECT * FROM files WHERE user_id=... AND folder_id=...

8. Client fetches folder path (breadcrumbs)
   → GET /api/folders/path/<folder-id>
   → server/routes.ts

9. Server builds path from folder to root
   → server/storage.ts (getFolderPath)
   → Recursive query up parent_id chain

10. Client renders breadcrumbs + folder contents
    → UI updates with new folder/file lists
```

### Modules Touched

- `client/src/pages/dashboard.tsx` - Main dashboard UI
- `server/routes.ts` - Folder and file endpoints
- `server/storage.ts` - Folder path traversal
- `shared/schema.ts` - folders table with parentId relation

### Failure Modes

| Error              | Cause                   | Symptom                 | Fix                              |
| ------------------ | ----------------------- | ----------------------- | -------------------------------- |
| "Folder not found" | Invalid folderId        | Empty list or 404       | Check folder exists              |
| "Not authorized"   | User doesn't own folder | 403 error               | Check userId match               |
| "Slow query"       | Deep folder hierarchy   | Breadcrumbs load slowly | Optimize getFolderPath (use CTE) |

### Validation Tips

```bash
# 1. Create nested folders
curl -X POST http://localhost:5000/api/folders \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Parent","parentId":null}'

curl -X POST http://localhost:5000/api/folders \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Child","parentId":"<parent-id>"}'

# 2. List subfolders
curl http://localhost:5000/api/folders?parentId=<parent-id> \
  -H "Cookie: connect.sid=<session>"

# 3. Get folder path
curl http://localhost:5000/api/folders/path/<child-id> \
  -H "Cookie: connect.sid=<session>"
```

## Flow 5: Folder Deletion (Cascade)

### Trigger

User clicks delete button on folder.

### Steps

```
1. User confirms deletion in dialog
   → client/src/pages/dashboard.tsx (AlertDialog confirmation)

2. Client sends delete request
   → DELETE /api/folders/<folder-id>
   → server/routes.ts

3. Server validates user owns folder
   → Implicit via userId in deleteFolder call

4. Server begins recursive cascade deletion
   → server/storage.ts (deleteFolder)

5. Server queries all child folders
   → SELECT * FROM folders WHERE parent_id=<folder-id>

6. For each child folder, recursively call deleteFolder
   → Depth-first traversal of folder tree

7. Server queries all files in folder
   → SELECT * FROM files WHERE folder_id=<folder-id>

8. For each file:
   a. Delete all share links
      → DELETE FROM share_links WHERE file_id=<file-id>
   b. Delete file metadata
      → DELETE FROM files WHERE id=<file-id>
   c. (Note: File blob in GCS not deleted - orphaned)

9. Server deletes folder itself
   → DELETE FROM folders WHERE id=<folder-id> AND user_id=<user-id>

10. Client invalidates folder/file queries
    → React Query cache cleared

11. UI updates to show folder gone
    → Folder tree and file list re-render
```

### Modules Touched

- `server/routes.ts` - DELETE /api/folders/:id
- `server/storage.ts` - deleteFolder (recursive)
- `shared/schema.ts` - folders, files, shareLinks tables

### Failure Modes

| Error                     | Cause                   | Symptom             | Fix                          |
| ------------------------- | ----------------------- | ------------------- | ---------------------------- |
| "Timeout on large folder" | Too many nested items   | 500 error after 30s | Optimize with batch queries  |
| "Orphaned GCS objects"    | Blobs not deleted       | Storage fills up    | Implement GCS cleanup job    |
| "Partial deletion"        | Error mid-cascade       | Inconsistent state  | Use database transactions    |
| "Not authorized"          | User doesn't own folder | 403 error           | Check folder ownership first |

### Validation Tips

```bash
# 1. Create folder with nested structure
# (Use previous commands to create parent + child + files)

# 2. Delete parent folder
curl -X DELETE http://localhost:5000/api/folders/<parent-id> \
  -H "Cookie: connect.sid=<session>"

# 3. Verify cascade deletion in database
psql $DATABASE_URL -c "SELECT * FROM folders WHERE id IN ('<parent-id>', '<child-id>');"
psql $DATABASE_URL -c "SELECT * FROM files WHERE folder_id IN ('<parent-id>', '<child-id>');"
# Should return 0 rows

# 4. Check for orphaned share links
psql $DATABASE_URL -c "SELECT * FROM share_links WHERE file_id NOT IN (SELECT id FROM files);"
# Should return 0 rows (if cascade works correctly)
```

## Flow 6: Share Link Creation

### Trigger

User clicks "Share" button on file.

### Steps

```
1. User opens share dialog
   → client/src/pages/dashboard.tsx (Share dialog)

2. User configures share options
   → Optional: password, expiration date
   → Form inputs in dialog

3. User submits share form
   → Client sends POST request

4. Client sends create share link request
   → POST /api/share-links
   → Body: { fileId, expiresAt?, password? }

5. Server validates request schema
   → server/routes.ts (insertShareLinkSchema)

6. Server hashes password (if provided)
   → bcrypt.hash(password, 10)

7. Server generates cryptographically secure token
   → server/storage.ts (randomBytes(32).toString('hex'))

8. Server creates share link record
   → INSERT INTO share_links
   → Fields: fileId, token, expiresAt?, password? (hashed), isActive=true

9. Server returns share link object
   → Response: { id, token, expiresAt, ... }

10. Client builds shareable URL
    → const shareUrl = `${window.location.origin}/share/${token}`

11. Client shows URL in dialog with copy button
    → User can copy URL to clipboard

12. User shares URL externally
    → Via email, Slack, etc. (outside app)
```

### Modules Touched

- `client/src/pages/dashboard.tsx` - Share dialog UI
- `server/routes.ts` - POST /api/share-links
- `server/storage.ts` - createShareLink
- `shared/schema.ts` - shareLinks table
- `bcryptjs` - Password hashing

### Failure Modes

| Error             | Cause                  | Symptom           | Fix                         |
| ----------------- | ---------------------- | ----------------- | --------------------------- |
| "File not found"  | Invalid fileId         | 400 error         | Check file exists           |
| "Invalid date"    | expiresAt in past      | 400 error         | Validate date is future     |
| "Token collision" | Duplicate random token | Rare (1 in 2^256) | Retry with new token        |
| "Weak password"   | No validation          | Security risk     | Add password strength check |

### Validation Tips

```bash
# 1. Create share link with password
curl -X POST http://localhost:5000/api/share-links \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{
    "fileId":"<file-id>",
    "expiresAt":"2026-12-31T23:59:59Z",
    "password":"MySecurePass123"
  }'

# 2. Verify password is hashed
psql $DATABASE_URL -c "SELECT password FROM share_links WHERE id='<link-id>';"
# Should see bcrypt hash, not plain text

# 3. Test share link access (see Flow 3)

# 4. List all share links for a file
curl http://localhost:5000/api/share-links?fileId=<file-id> \
  -H "Cookie: connect.sid=<session>"
```

## Common Patterns Across Flows

### Authentication Check

All authenticated flows follow this pattern:

```typescript
app.get('/api/resource', isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub
  // Use userId to filter query
})
```

### Input Validation

All POST/PUT endpoints validate with Zod:

```typescript
const data = insertResourceSchema.parse(req.body)
```

### Authorization

Implicit authorization via userId filter:

```typescript
// Only returns resources owned by user
await storage.getResources(userId)
```

### Error Handling

All routes wrapped in try/catch:

```typescript
try {
  // Handler logic
} catch (error) {
  console.error('Error:', error)
  res.status(500).json({ message: 'Failed to...' })
}
```

## Evidence

Key files implementing these flows:

- [server/routes.ts](../../server/routes.ts) - All API endpoints
- [server/storage.ts](../../server/storage.ts) - Database operations
- [server/replit_integrations/auth/](../../server/replit_integrations/auth/) - Authentication flow
- [server/replit_integrations/object_storage/](../../server/replit_integrations/object_storage/) - File upload/download
- [client/src/pages/dashboard.tsx](../../client/src/pages/dashboard.tsx) - Main UI flows
- [client/src/pages/share-download.tsx](../../client/src/pages/share-download.tsx) - Share link flow
- [client/src/hooks/use-auth.ts](../../client/src/hooks/use-auth.ts) - Auth state
- [client/src/hooks/use-upload.ts](../../client/src/hooks/use-upload.ts) - Upload state

## Related Documentation

- [Overview](./10_OVERVIEW.md) - Architecture context
- [API Documentation](../api/00_INDEX.md) - Endpoint details
- [Data Documentation](../data/00_INDEX.md) - Schema details
- [Integrations](../integrations/00_INDEX.md) - External services

[← Back to Index](./00_INDEX.md)
