# API Documentation Index

[← Back to Architecture Index](../architecture/00_INDEX.md)

## Overview

CloudVault exposes a REST API for file and folder management. All endpoints (except share link access) require authentication.

## API Design Principles

1. **RESTful**: Resources identified by URLs, standard HTTP methods
2. **JSON**: All request/response bodies are JSON
3. **Session-based auth**: Cookie-based authentication (not JWT)
4. **Validation**: Zod schemas validate all inputs
5. **Error consistency**: Structured error responses

## Base URL

- **Development**: `http://localhost:5000/api`
- **Production**: `https://<your-repl>.replit.app/api`

## Authentication

### Session Cookie

**Cookie name**: `connect.sid`

**Set by**: `/api/login` (via Replit Auth)

**Required for**: All endpoints except:
- `GET /api/share-links/token/:token` (public)
- `POST /api/share-links/:token/download` (public)

**Missing cookie**: Returns `401 Unauthorized`

### Obtaining Session

```bash
# 1. Start auth flow (redirects to Replit)
curl -c cookies.txt http://localhost:5000/api/login

# 2. Complete Replit authentication in browser

# 3. Use cookies.txt for authenticated requests
curl -b cookies.txt http://localhost:5000/api/folders
```

## API Endpoints

### Authentication Routes

#### GET /api/login

**Purpose**: Initiate Replit Auth login flow

**Auth required**: No

**Response**: Redirect to Replit OIDC endpoint

**Evidence**: [server/replit_integrations/auth/routes.ts](../../server/replit_integrations/auth/routes.ts)

---

#### GET /api/auth/callback

**Purpose**: OIDC callback (handled by Passport)

**Auth required**: No (in progress)

**Response**: Redirect to dashboard with session cookie

---

#### GET /api/logout

**Purpose**: Destroy session and log out

**Auth required**: Yes

**Response**: Redirect to landing page

---

#### GET /api/user

**Purpose**: Get current user info

**Auth required**: Yes

**Response**:
```json
{
  "id": "user_abc123",
  "username": "john_doe",
  "name": "John Doe",
  "email": "john@example.com",
  "profileImageUrl": "https://..."
}
```

**Evidence**: [server/routes.ts](../../server/routes.ts) (if exists)

### Folder Routes

#### GET /api/folders

**Purpose**: List folders in a specific parent folder

**Auth required**: Yes

**Query params**:
- `parentId` (optional): Parent folder ID (omit for root)

**Response**:
```json
[
  {
    "id": "folder_xyz",
    "name": "Documents",
    "parentId": null,
    "userId": "user_abc123",
    "createdAt": "2026-01-15T10:30:00Z"
  }
]
```

**Error codes**:
- `401`: Not authenticated
- `500`: Database error

**Evidence**: [server/routes.ts](../../server/routes.ts):30-40

---

#### GET /api/folders/path/:folderId

**Purpose**: Get breadcrumb path from folder to root

**Auth required**: Yes

**Path params**:
- `folderId`: Folder ID

**Response**:
```json
[
  {
    "id": "folder_root",
    "name": "Root",
    "parentId": null,
    "userId": "user_abc123",
    "createdAt": "2026-01-15T10:30:00Z"
  },
  {
    "id": "folder_xyz",
    "name": "Documents",
    "parentId": "folder_root",
    "userId": "user_abc123",
    "createdAt": "2026-01-15T10:35:00Z"
  }
]
```

**Error codes**:
- `401`: Not authenticated
- `403`: Not authorized (not your folder)
- `404`: Folder not found

**Evidence**: [server/routes.ts](../../server/routes.ts):42-59

---

#### POST /api/folders

**Purpose**: Create new folder

**Auth required**: Yes

**Request body**:
```json
{
  "name": "My Folder",
  "parentId": "folder_xyz" // Optional, omit for root
}
```

**Response**:
```json
{
  "id": "folder_new",
  "name": "My Folder",
  "parentId": "folder_xyz",
  "userId": "user_abc123",
  "createdAt": "2026-02-04T11:34:00Z"
}
```

**Error codes**:
- `400`: Invalid request body (Zod validation)
- `401`: Not authenticated
- `500`: Database error

**Evidence**: [server/routes.ts](../../server/routes.ts):61-79

---

#### DELETE /api/folders/:id

**Purpose**: Delete folder (cascade deletes subfolders and files)

**Auth required**: Yes

**Path params**:
- `id`: Folder ID

**Response**: `204 No Content`

**Error codes**:
- `401`: Not authenticated
- `403`: Not authorized (not your folder)
- `500`: Database error

**Evidence**: [server/routes.ts](../../server/routes.ts):81-90

### File Routes

#### GET /api/files

**Purpose**: List files in a specific folder

**Auth required**: Yes

**Query params**:
- `folderId` (optional): Folder ID (omit for root)

**Response**:
```json
[
  {
    "id": "file_abc",
    "name": "document.pdf",
    "size": 1048576,
    "mimeType": "application/pdf",
    "objectPath": "user_abc123/file_abc/document.pdf",
    "folderId": "folder_xyz",
    "userId": "user_abc123",
    "createdAt": "2026-02-04T11:00:00Z"
  }
]
```

**Error codes**:
- `401`: Not authenticated
- `500`: Database error

**Evidence**: [server/routes.ts](../../server/routes.ts):92-100

---

#### POST /api/files

**Purpose**: Create file metadata after upload to object storage

**Auth required**: Yes

**Request body**:
```json
{
  "name": "document.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "objectPath": "user_abc123/file_abc/document.pdf",
  "folderId": "folder_xyz" // Optional
}
```

**Response**:
```json
{
  "id": "file_abc",
  "name": "document.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "objectPath": "user_abc123/file_abc/document.pdf",
  "folderId": "folder_xyz",
  "userId": "user_abc123",
  "createdAt": "2026-02-04T11:00:00Z"
}
```

**Error codes**:
- `400`: Invalid request body
- `401`: Not authenticated
- `500`: Database error

**Evidence**: [server/routes.ts](../../server/routes.ts) (POST /api/files handler)

---

#### DELETE /api/files/:id

**Purpose**: Delete file (metadata and object storage)

**Auth required**: Yes

**Path params**:
- `id`: File ID

**Response**: `204 No Content`

**Error codes**:
- `401`: Not authenticated
- `403`: Not authorized (not your file)
- `500`: Database or storage error

### Share Link Routes

#### GET /api/share-links

**Purpose**: List share links for a file

**Auth required**: Yes

**Query params**:
- `fileId`: File ID

**Response**:
```json
[
  {
    "id": "link_xyz",
    "fileId": "file_abc",
    "token": "a1b2c3d4...",
    "expiresAt": "2026-12-31T23:59:59Z",
    "password": null,
    "downloadCount": 5,
    "isActive": true,
    "createdAt": "2026-02-04T11:00:00Z"
  }
]
```

**Note**: `password` field is always null in response (never expose hash)

**Evidence**: [server/routes.ts](../../server/routes.ts)

---

#### GET /api/share-links/token/:token (PUBLIC)

**Purpose**: Get share link metadata by token

**Auth required**: No

**Path params**:
- `token`: Share token

**Response**:
```json
{
  "id": "link_xyz",
  "fileId": "file_abc",
  "token": "a1b2c3d4...",
  "expiresAt": "2026-12-31T23:59:59Z",
  "password": true, // Boolean: has password?
  "downloadCount": 5,
  "isActive": true,
  "createdAt": "2026-02-04T11:00:00Z",
  "file": {
    "id": "file_abc",
    "name": "document.pdf",
    "size": 1048576,
    "mimeType": "application/pdf"
  }
}
```

**Error codes**:
- `404`: Token not found, expired, or inactive

**Evidence**: [server/routes.ts](../../server/routes.ts)

---

#### POST /api/share-links

**Purpose**: Create share link for file

**Auth required**: Yes

**Request body**:
```json
{
  "fileId": "file_abc",
  "expiresAt": "2026-12-31T23:59:59Z", // Optional
  "password": "my-secure-password" // Optional
}
```

**Response**:
```json
{
  "id": "link_xyz",
  "fileId": "file_abc",
  "token": "a1b2c3d4e5f6...",
  "expiresAt": "2026-12-31T23:59:59Z",
  "password": null,
  "downloadCount": 0,
  "isActive": true,
  "createdAt": "2026-02-04T11:34:00Z"
}
```

**Error codes**:
- `400`: Invalid request body
- `401`: Not authenticated
- `403`: Not your file
- `500`: Database error

**Evidence**: [server/routes.ts](../../server/routes.ts)

---

#### POST /api/share-links/:token/download (PUBLIC)

**Purpose**: Get presigned download URL for file

**Auth required**: No

**Path params**:
- `token`: Share token

**Request body**:
```json
{
  "password": "my-secure-password" // Required if link has password
}
```

**Response**:
```json
{
  "downloadUrl": "https://storage.googleapis.com/...?signature=..."
}
```

**Error codes**:
- `400`: Missing password when required
- `401`: Incorrect password
- `404`: Token not found, expired, or inactive
- `500`: Storage error

**Evidence**: [server/routes.ts](../../server/routes.ts)

---

#### DELETE /api/share-links/:id

**Purpose**: Delete share link

**Auth required**: Yes

**Path params**:
- `id`: Share link ID

**Response**: `204 No Content`

**Error codes**:
- `401`: Not authenticated
- `403`: Not authorized (not your link)

### Object Storage Routes

#### POST /api/storage/presigned-url

**Purpose**: Get presigned URL for uploading file

**Auth required**: Yes

**Request body**:
```json
{
  "filename": "document.pdf",
  "contentType": "application/pdf"
}
```

**Response**:
```json
{
  "presignedUrl": "https://storage.googleapis.com/...?signature=...",
  "objectPath": "user_abc123/file_xyz/document.pdf"
}
```

**Usage**:
1. Client gets presigned URL
2. Client uploads file to presigned URL (PUT request)
3. Client creates file metadata via POST /api/files

**Error codes**:
- `401`: Not authenticated
- `500`: Storage service error

**Evidence**: [server/replit_integrations/object_storage/routes.ts](../../server/replit_integrations/object_storage/routes.ts)

## Request/Response Patterns

### Standard Success Response

```json
{
  "id": "resource_id",
  // ... resource fields
}
```

**Status codes**:
- `200 OK`: GET, PUT, PATCH
- `201 Created`: POST
- `204 No Content`: DELETE

### Standard Error Response

```json
{
  "message": "Human-readable error message"
}
```

**Optional fields**:
- `errors`: Zod validation errors (array)

**Status codes**:
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: Resource doesn't exist
- `500 Internal Server Error`: Server error

### Validation Errors (Zod)

```json
{
  "message": "Invalid folder data",
  "errors": [
    {
      "path": ["name"],
      "message": "String must contain at least 1 character(s)"
    }
  ]
}
```

## API Versioning

**Current version**: v1 (implicit, no /v1 prefix)

**Future versioning**: Not implemented

**Breaking changes**: Would require new API version (e.g., /api/v2/*)

## Rate Limiting

**Current state**: Not implemented

**Recommendations**: Add rate limiting middleware (e.g., express-rate-limit) to prevent abuse.

## CORS

**Current state**: No CORS headers (same-origin only)

**Implications**: API only callable from same domain as frontend

**To enable**: Add `cors` middleware for cross-origin requests

## Error Handling

### Global Error Handler

**Location**: [server/index.ts](../../server/index.ts):77-86

**Catches**: All unhandled errors in routes

**Response format**:
```json
{
  "message": "Error message"
}
```

### Common Errors

| Error Type | Status | Message | Cause |
|------------|--------|---------|-------|
| Authentication | 401 | "Unauthorized" | Missing or invalid session |
| Authorization | 403 | "Not authorized" | User doesn't own resource |
| Not Found | 404 | "Resource not found" | Invalid ID or deleted |
| Validation | 400 | "Invalid ..." | Zod schema validation failed |
| Server Error | 500 | "Failed to ..." | Database or storage error |

## Testing the API

### Using curl

```bash
# Login and save cookies
curl -c cookies.txt -L http://localhost:5000/api/login

# Create folder
curl -b cookies.txt -X POST http://localhost:5000/api/folders \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Folder"}'

# List folders
curl -b cookies.txt http://localhost:5000/api/folders

# Upload flow
# 1. Get presigned URL
curl -b cookies.txt -X POST http://localhost:5000/api/storage/presigned-url \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.txt","contentType":"text/plain"}'

# 2. Upload to presigned URL
curl -X PUT "<presigned-url>" \
  -H "Content-Type: text/plain" \
  --data-binary "@test.txt"

# 3. Create file metadata
curl -b cookies.txt -X POST http://localhost:5000/api/files \
  -H "Content-Type: application/json" \
  -d '{"name":"test.txt","size":100,"mimeType":"text/plain","objectPath":"..."}'
```

### Using Postman

1. Import OpenAPI spec (not available - create manually)
2. Set up environment variables (base URL)
3. Use cookie authentication (manually set `connect.sid`)

### Using Client Code

See `client/src/lib/api.ts` for typed API client functions.

## API Client (Frontend)

**Location**: [client/src/lib/api.ts](../../client/src/lib/api.ts) (if exists)

**Pattern**: React Query hooks wrap API calls

**Example**:
```typescript
// In client code
import { useQuery } from '@tanstack/react-query';

const { data: folders } = useQuery({
  queryKey: ['folders', parentId],
  queryFn: () => fetch(`/api/folders?parentId=${parentId}`).then(r => r.json())
});
```

## Evidence

Key files implementing API:

- [server/routes.ts](../../server/routes.ts) - All API endpoints
- [server/replit_integrations/auth/routes.ts](../../server/replit_integrations/auth/routes.ts) - Auth endpoints
- [server/replit_integrations/object_storage/routes.ts](../../server/replit_integrations/object_storage/routes.ts) - Storage endpoints
- [server/index.ts](../../server/index.ts):77-86 - Error handling
- [shared/schema.ts](../../shared/schema.ts):81-95 - Validation schemas

## Related Documentation

- [Architecture Overview](../architecture/10_OVERVIEW.md) - API context
- [Key Flows](../architecture/40_KEY_FLOWS.md) - API usage in flows
- [Data Documentation](../data/00_INDEX.md) - Database backing API
- [Integrations](../integrations/00_INDEX.md) - External API dependencies

[← Back to Architecture Index](../architecture/00_INDEX.md)
