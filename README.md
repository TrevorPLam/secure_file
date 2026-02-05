# CloudVault

Secure file sharing and storage application built with React, Express, and PostgreSQL.

## Quick Links

- **📚 [Full Documentation](./docs/README.md)** - Complete architecture and API documentation
- **🚀 [Getting Started](./docs/architecture/20_RUNTIME_TOPOLOGY.md#local-development-setup)** - Set up local development
- **🏗️ [Architecture Overview](./docs/architecture/10_OVERVIEW.md)** - System design and components

## What is CloudVault?

CloudVault enables users to:

- 📁 Upload and organize files in folders
- 🔗 Share files via password-protected, time-limited links
- 📊 Track download counts for shared files
- 🔒 Secure access with Replit authentication

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, shadcn/ui, Tailwind CSS
- **Backend**: Express.js, TypeScript, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Storage**: Google Cloud Storage (via Replit)
- **Auth**: Replit Auth (OpenID Connect)
- **Hosting**: Replit platform

## Development

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Replit account (for auth and storage)

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, SESSION_SECRET, etc.

# Initialize database
npm run db:push

# Start development server
npm run dev
```

Open http://localhost:5000

### Available Scripts

```bash
npm run dev       # Start development server with hot reload
npm run build     # Build for production
npm run start     # Start production server
npm run check     # TypeScript type checking
npm run db:push   # Push schema changes to database
```

## Documentation

Comprehensive documentation is available in the `docs/` directory:

| Document                                        | Description                       |
| ----------------------------------------------- | --------------------------------- |
| [Documentation Hub](./docs/README.md)           | Entry point to all documentation  |
| [Architecture](./docs/architecture/00_INDEX.md) | System design, modules, and flows |
| [API Reference](./docs/api/00_INDEX.md)         | REST API endpoints                |
| [Data Model](./docs/data/00_INDEX.md)           | Database schema and storage       |
| [Integrations](./docs/integrations/00_INDEX.md) | Third-party services              |
| [ADR](./docs/adr/README.md)                     | Architecture decisions            |

## Project Structure

```
secure_file/
├── client/          # React frontend application
│   ├── src/
│   │   ├── components/   # UI components (including shadcn/ui)
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utilities and API client
│   │   ├── pages/        # Route components
│   │   └── main.tsx      # Entry point
├── server/          # Express backend application
│   ├── replit_integrations/  # Auth and storage modules
│   ├── index.ts     # HTTP server entry point
│   ├── routes.ts    # API route definitions
│   ├── storage.ts   # Data access layer
│   └── db.ts        # Database connection
├── shared/          # Shared types and schemas
│   ├── schema.ts    # Drizzle ORM database schema
│   └── models/      # Type definitions
├── docs/            # Architecture documentation
└── migrations/      # Database migrations
```

See [Modules & Dependencies](./docs/architecture/30_MODULES_AND_DEPENDENCIES.md) for detailed structure.

## Key Features

### File Management

- Hierarchical folder structure
- Drag-and-drop file uploads
- Direct upload to cloud storage (no server bottleneck)

### Secure Sharing

- Generate shareable links with unique tokens
- Optional password protection (bcrypt hashed)
- Time-limited expiration
- Download count tracking

### Authentication

- Replit Auth via OpenID Connect (OIDC)
- Session-based authentication
- Secure session storage in PostgreSQL

## Architecture Highlights

- **Monolithic full-stack**: Single Node.js process for simplicity
- **Type-safe**: Shared TypeScript types between client and server
- **Direct uploads**: Presigned URLs for scalable file uploads
- **Session-based auth**: Stateful authentication with server-side sessions
- **ORM-first**: Drizzle ORM for type-safe database queries

Read more in [System Overview](./docs/architecture/10_OVERVIEW.md).

## API Overview

RESTful API with JSON payloads. All endpoints (except share links) require authentication.

**Base URL**: `/api`

**Example endpoints**:

- `GET /api/folders` - List folders
- `POST /api/files` - Create file metadata
- `POST /api/share-links` - Create share link
- `GET /api/share-links/token/:token` - Get share link (public)

See [API Documentation](./docs/api/00_INDEX.md) for complete reference.

## Contributing

### Making Changes

1. Read relevant documentation in `docs/`
2. Follow module dependency rules
3. Update documentation when changing architecture
4. Test changes locally before committing

### Documentation Updates

When you change code, update these docs:

- New feature → [Key Flows](./docs/architecture/40_KEY_FLOWS.md)
- New module → [Modules & Dependencies](./docs/architecture/30_MODULES_AND_DEPENDENCIES.md)
- API changes → [API Documentation](./docs/api/00_INDEX.md)
- Architecture decision → [ADR](./docs/adr/README.md)

## License

MIT

## Additional Documentation

- [replit.md](./replit.md) - Original project documentation
- [AI_META_HEADER_REPORT.md](./AI_META_HEADER_REPORT.md) - AI meta-header documentation

---

**For complete documentation, start here**: [docs/README.md](./docs/README.md)
