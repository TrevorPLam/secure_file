# Technology Stack

## Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 7
- **UI Library**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS 4
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **File Uploads**: Uppy with AWS S3 plugin

## Backend
- **Runtime**: Node.js 20+
- **Framework**: Express 5
- **Language**: TypeScript (ESNext modules)
- **Session Store**: PostgreSQL via connect-pg-simple

## Database & Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod
- **Storage**: Google Cloud Storage (via Replit integration)
- **Auth**: Replit Auth (OpenID Connect)

## Testing
- **Framework**: Vitest 4
- **Coverage**: 100% thresholds (lines, functions, branches, statements)
- **Environment**: happy-dom for React component tests
- **Testing Library**: @testing-library/react

## Development Tools
- **Type Checking**: TypeScript 5.6 (strict mode)
- **Linting**: ESLint with TypeScript plugin
- **Formatting**: Prettier
- **Build**: esbuild (via tsx for dev, custom build script for prod)

## Common Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:5000)
npm run check            # TypeScript type checking

# Database
npm run db:push          # Push schema changes to database

# Testing
npm test                 # Run all tests once
npm run test:watch       # Run tests in watch mode
npm run test:ui          # Interactive test UI
npm run test:coverage    # Generate coverage report

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run format           # Format with Prettier
npm run format:check     # Check formatting

# Production
npm run build            # Build for production
npm start                # Start production server
```

## Path Aliases

TypeScript and Vite are configured with these aliases:
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

## Environment Variables

Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `REPLIT_*` - Replit integration credentials (auth, storage)
