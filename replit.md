# CloudVault - Secure File Sharing & Storage

## Overview

CloudVault is a secure file sharing and storage application that enables users to upload, organize, and share files with features like password protection and expiring links. The application follows a monorepo structure with a React frontend, Express backend, and PostgreSQL database.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite for development and production builds
- **File Uploads**: Uppy library with AWS S3 presigned URL integration

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Server**: HTTP server with custom middleware for logging and error handling
- **Authentication**: Replit Auth using OpenID Connect (OIDC) with Passport.js
- **Session Management**: Express sessions stored in PostgreSQL using connect-pg-simple
- **API Design**: RESTful API endpoints under `/api/*` prefix

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all database table definitions
- **Key Tables**:
  - `users` - User accounts from Replit Auth
  - `sessions` - Session storage for authentication
  - `folders` - Hierarchical folder structure per user
  - `files` - File metadata with references to object storage
  - `shareLinks` - Shareable links with optional password protection and expiry
- **Migrations**: Drizzle Kit for schema migrations (`drizzle-kit push`)

### File Storage
- **Object Storage**: Google Cloud Storage via Replit's object storage integration
- **Upload Flow**: Two-step presigned URL pattern
  1. Client requests presigned URL from backend
  2. Client uploads directly to storage using presigned URL
- **Storage Service**: Custom `ObjectStorageService` class handles presigned URLs and access control

### Authentication Flow
- Replit Auth via OIDC discovery
- Session-based authentication with PostgreSQL session store
- Protected routes use `isAuthenticated` middleware
- User data synced to local database on login via `upsertUser`

### Project Structure
```
├── client/src/          # React frontend
│   ├── components/      # UI components including shadcn/ui
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities and API client
│   └── pages/           # Route components
├── server/              # Express backend
│   ├── replit_integrations/  # Auth and object storage modules
│   └── routes.ts        # API route definitions
├── shared/              # Shared TypeScript types and schemas
│   ├── schema.ts        # Drizzle database schema
│   └── models/          # Type definitions
└── migrations/          # Database migrations
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)
- **Drizzle ORM**: Type-safe database queries and schema management

### Authentication
- **Replit Auth**: OIDC-based authentication (requires `ISSUER_URL`, `REPL_ID`, `SESSION_SECRET`)
- **Passport.js**: Authentication middleware
- **express-session**: Session management

### Object Storage
- **Google Cloud Storage**: File storage via Replit's sidecar service
- **Uppy**: Client-side file upload handling with dashboard UI

### UI/Frontend
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library
- **date-fns**: Date formatting utilities

### Security
- **bcryptjs**: Password hashing for share link protection