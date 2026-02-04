# System Overview

[← Back to Index](./00_INDEX.md)

## What CloudVault Does

CloudVault is a secure file sharing and storage application that enables users to:

1. **Upload & Organize Files** - Store files in a hierarchical folder structure
2. **Share Securely** - Generate password-protected, time-limited share links
3. **Track Access** - Monitor download counts for shared files
4. **Manage Storage** - View storage statistics and organize content

**Target Users**: Individuals needing secure, temporary file sharing with access control.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ React 18 +   │  │ shadcn/ui    │  │ Uppy File Uploader    │ │
│  │ TypeScript   │  │ Components   │  │ (Direct to Storage)   │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘ │
│         └──────────────────┴──────────────────────┘             │
│                            │                                     │
│                   TanStack React Query                           │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                    HTTP/REST API (JSON)
                             │
┌────────────────────────────┼─────────────────────────────────────┐
│                       SERVER (Node.js)                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Express.js + TypeScript                      │   │
│  │  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐  │   │
│  │  │ Auth       │  │ Routes       │  │ Storage Service │  │   │
│  │  │ Middleware │  │ (REST API)   │  │ (Database CRUD) │  │   │
│  │  └─────┬──────┘  └──────┬───────┘  └────────┬────────┘  │   │
│  └────────┼─────────────────┼────────────────────┼───────────┘   │
│           │                 │                    │               │
│  ┌────────▼─────────┐  ┌───▼───────────┐  ┌────▼──────────┐   │
│  │ Replit Auth      │  │ Drizzle ORM   │  │ Object Storage│   │
│  │ (OIDC/Passport)  │  │               │  │ Service       │   │
│  └──────────────────┘  └───┬───────────┘  └────┬──────────┘   │
└────────────────────────────┼───────────────────┼────────────────┘
                             │                   │
                ┌────────────▼────────┐  ┌───────▼─────────────┐
                │   PostgreSQL DB     │  │ Google Cloud        │
                │  ┌────────────────┐ │  │ Storage             │
                │  │ users          │ │  │ (File Blobs)        │
                │  │ sessions       │ │  │                     │
                │  │ folders        │ │  │ Presigned URLs      │
                │  │ files          │ │  │ for upload/download │
                │  │ share_links    │ │  └─────────────────────┘
                │  └────────────────┘ │
                └─────────────────────┘
```

## Major Components

### 1. Frontend (Client)

**Location**: `client/src/`

**Responsibilities**:
- Render UI with React components
- Handle user interactions and form validation
- Manage client-side routing (Wouter)
- Upload files directly to object storage
- Cache server data with React Query

**Key Technologies**:
- React 18 with TypeScript
- shadcn/ui component library
- Tailwind CSS for styling
- Uppy for file uploads
- TanStack React Query for state management

### 2. Backend (Server)

**Location**: `server/`

**Responsibilities**:
- Authenticate users (Replit Auth via OIDC)
- Provide REST API for CRUD operations
- Generate presigned URLs for file upload/download
- Enforce authorization rules
- Manage database sessions

**Key Technologies**:
- Express.js with TypeScript
- Passport.js for authentication
- Drizzle ORM for database queries
- Google Cloud Storage SDK

### 3. Database Layer

**Location**: `shared/schema.ts`, `server/db.ts`

**Responsibilities**:
- Store user accounts and sessions
- Maintain file and folder hierarchy
- Track share links and download counts
- Provide type-safe query interface

**Key Technologies**:
- PostgreSQL database
- Drizzle ORM with type inference
- Database migrations via Drizzle Kit

### 4. Storage Layer

**Location**: `server/replit_integrations/object_storage/`, `server/storage.ts`

**Responsibilities**:
- Store actual file blobs (object storage)
- Generate time-limited upload/download URLs
- Provide abstraction over Google Cloud Storage
- Track file metadata in database

**Key Technologies**:
- Google Cloud Storage
- Presigned URL pattern for direct uploads
- ObjectStorageService class

### 5. Authentication Layer

**Location**: `server/replit_integrations/auth/`

**Responsibilities**:
- Authenticate users via Replit OIDC
- Maintain session state in PostgreSQL
- Protect routes with isAuthenticated middleware
- Sync user data to local database

**Key Technologies**:
- OpenID Connect (OIDC)
- Passport.js strategies
- Express session with PostgreSQL store

## Component Boundaries

### Client ↔ Server Boundary

- **Protocol**: HTTP REST API (JSON)
- **Authentication**: Session cookies
- **Data Format**: JSON with Zod schema validation
- **File Uploads**: Direct to storage via presigned URLs (bypasses server for data transfer)

### Server ↔ Database Boundary

- **Interface**: Drizzle ORM queries
- **Type Safety**: TypeScript types inferred from schema
- **Connection**: Single database pool shared across requests

### Server ↔ Storage Boundary

- **Interface**: ObjectStorageService class
- **Pattern**: Presigned URLs for direct client access
- **Authorization**: Server validates ownership before generating URLs

## Architectural Principles

1. **Type Safety First**: Shared TypeScript types between client and server via `@shared` imports
2. **Separation of Concerns**: Clear boundaries between UI, business logic, and data layers
3. **Zero-Trust Security**: Every API endpoint validates authentication and authorization
4. **Direct Upload Pattern**: Large file transfers bypass server to reduce load
5. **Database as Source of Truth**: File metadata in PostgreSQL, blobs in object storage
6. **Monorepo Structure**: Shared code in `shared/`, prevents type drift

## Data Flow Example

User uploads a file:

1. **Client** requests presigned upload URL from `/api/storage/presigned-url`
2. **Server** validates user auth, generates presigned URL from GCS
3. **Client** uploads file directly to Google Cloud Storage
4. **Client** notifies server file upload complete via `/api/files` POST
5. **Server** creates file metadata record in PostgreSQL
6. **Client** refreshes file list via `/api/files` GET

## Evidence

Key files documenting this architecture:

- [server/index.ts](../../server/index.ts) - HTTP server setup and middleware chain
- [server/routes.ts](../../server/routes.ts) - API endpoint registration
- [client/src/App.tsx](../../client/src/App.tsx) - Frontend routing and provider setup
- [shared/schema.ts](../../shared/schema.ts) - Database tables and relations
- [server/storage.ts](../../server/storage.ts) - Database storage abstraction
- [server/replit_integrations/object_storage/service.ts](../../server/replit_integrations/object_storage/service.ts) - Object storage interface
- [vite.config.ts](../../vite.config.ts) - Build configuration
- [package.json](../../package.json) - Dependencies and scripts

## Related Documentation

- [Runtime Topology](./20_RUNTIME_TOPOLOGY.md) - Deployment and environments
- [Modules & Dependencies](./30_MODULES_AND_DEPENDENCIES.md) - Code organization
- [Key Flows](./40_KEY_FLOWS.md) - User journeys
- [Data Documentation](../data/00_INDEX.md) - Database schema details
- [API Documentation](../api/00_INDEX.md) - REST API conventions

[← Back to Index](./00_INDEX.md)
