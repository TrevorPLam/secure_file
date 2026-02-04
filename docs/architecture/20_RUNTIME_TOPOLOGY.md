# Runtime Topology

[← Back to Index](./00_INDEX.md)

## What Runs Where

CloudVault is a **monolithic full-stack application** with a single Node.js process serving both API and frontend assets.

```
┌─────────────────────────────────────────────────┐
│              Node.js Process (Port 5000)        │
│  ┌──────────────────────────────────────────┐  │
│  │         Express.js HTTP Server           │  │
│  │                                          │  │
│  │  ┌────────────┐      ┌───────────────┐  │  │
│  │  │ API Routes │      │ Static Assets │  │  │
│  │  │ /api/*     │      │ /*, /assets/* │  │  │
│  │  └────────────┘      └───────────────┘  │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
         ↓ TCP                      ↓ TCP
┌────────────────────┐    ┌─────────────────────┐
│  PostgreSQL        │    │ Google Cloud        │
│  (Port 5432)       │    │ Storage (HTTPS)     │
│  - Users           │    │ - File blobs        │
│  - Sessions        │    │                     │
│  - Files metadata  │    │                     │
└────────────────────┘    └─────────────────────┘
```

### Components

| Component | Type | Port | Purpose |
|-----------|------|------|---------|
| Express Server | Node.js process | 5000 | HTTP server (API + static files) |
| PostgreSQL | Database | 5432 | Persistent data storage |
| Google Cloud Storage | Object store | HTTPS | File blob storage |

**No separate services**: No background workers, queues, or microservices.

## Environments

### Development (Local)

**Start command**: `npm run dev`

```bash
$ npm run dev
# Starts:
# 1. Express server (API) on port 5000
# 2. Vite dev server (HMR) proxied through Express
# 3. TypeScript compilation in watch mode
```

**What happens**:
1. `tsx` runs `server/index.ts` with hot reload
2. Vite dev server embedded in Express (via `setupVite()`)
3. React hot module replacement (HMR) active
4. API requests to `/api/*` handled by Express routes
5. Frontend requests proxied to Vite dev server

**Requirements**:
- Node.js 20+
- PostgreSQL database running
- Environment variables set:
  ```bash
  DATABASE_URL=postgresql://user:pass@localhost:5432/cloudvault
  SESSION_SECRET=your-secret-key
  ISSUER_URL=https://auth.replit.com/.well-known/openid-configuration
  REPL_ID=your-repl-id
  ```

**File watching**:
- Server code: `tsx` auto-restarts on changes
- Client code: Vite HMR (no page reload)
- Shared code: Both server and client reload

### Production (Replit)

**Start command**: `npm run start`

**Build process** (`npm run build`):
1. Vite bundles client code → `dist/public/`
2. esbuild bundles server code → `dist/index.cjs`
3. Copies static assets and node_modules

**Runtime**:
- Single Node.js process runs `dist/index.cjs`
- Express serves static files from `dist/public/`
- API routes handle `/api/*` requests
- PostgreSQL connection via `DATABASE_URL`
- Google Cloud Storage via Replit sidecar service

**Deployment target**: Replit platform
- Configured in `.replit` file
- Port 5000 exposed automatically
- PostgreSQL provisioned by Replit
- Object storage via Replit integration

### Testing/Staging

**Not currently configured** - no separate staging environment.

To add staging:
1. Create new Replit deployment
2. Use separate `DATABASE_URL`
3. Configure separate OIDC app in Replit Auth

## Boot Sequence

### Development Boot

```
1. tsx server/index.ts
   ↓
2. Import Express and create HTTP server
   ↓
3. setupAuth(app) - Initialize Passport.js and session middleware
   ↓
4. registerRoutes(httpServer, app) - Register API endpoints
   ↓
5. setupVite(app, httpServer) - Embed Vite dev server (dev only)
   ↓
6. serveStatic(app) - Serve static files (production only)
   ↓
7. app.listen(5000) - Start HTTP server
   ↓
8. Database connection pool initialized on first query
   ↓
9. Ready to accept requests
```

**Key files in order**:
1. `server/index.ts` - Entry point
2. `server/routes.ts` - Route registration
3. `server/replit_integrations/auth/setup.ts` - Auth setup
4. `server/db.ts` - Database connection (lazy)

### Production Boot

Same as development, except:
- Step 5 skipped (no Vite dev server)
- Step 6 serves pre-built files from `dist/public/`

## Entry Points

### Server Entry Point

**File**: `server/index.ts`

**Execution**:
- Development: `tsx server/index.ts`
- Production: `node dist/index.cjs`

**Responsibilities**:
1. Create Express app and HTTP server
2. Configure middleware (JSON parser, logging, sessions)
3. Register routes (auth, API, storage)
4. Start listening on port 5000

### Client Entry Point

**File**: `client/src/main.tsx`

**Execution**: Rendered by Vite dev server or loaded from `dist/public/index.html`

**Responsibilities**:
1. Import React and ReactDOM
2. Render `<App />` component into DOM
3. Apply global styles (Tailwind)

**Route flow**:
```
main.tsx
  └─> App.tsx (Router + Providers)
       ├─> LandingPage (/)
       ├─> DashboardPage (/) [authenticated]
       └─> ShareDownloadPage (/share/:token)
```

### Database Entry Point

**File**: `shared/schema.ts`

**Execution**: Imported by `server/db.ts` to create Drizzle instance

**Responsibilities**:
1. Define table schemas (folders, files, shareLinks, users, sessions)
2. Define relations between tables
3. Export TypeScript types for tables
4. Export Zod validation schemas

## Port Allocation

| Port | Service | Environment | Notes |
|------|---------|-------------|-------|
| 5000 | Express HTTP | Dev & Prod | Configurable via `process.env.PORT` |
| 5432 | PostgreSQL | Dev & Prod | Standard PostgreSQL port |

**Firewall requirements**: Port 5000 must be accessible for web traffic.

## Process Management

### Development

- **Foreground process**: Single `npm run dev` process
- **Restart**: Ctrl+C and re-run `npm run dev`
- **Auto-reload**: `tsx` watches server files, Vite watches client files

### Production (Replit)

- **Process manager**: Replit's managed hosting
- **Restart policy**: Auto-restart on crash
- **Logging**: stdout/stderr captured by Replit
- **Health checks**: HTTP endpoint monitoring (Replit built-in)

**No PM2, systemd, or Docker** - Replit handles process management.

## Environment Configuration

### Required Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | Session encryption key | Random 32+ char string |
| `ISSUER_URL` | OIDC discovery endpoint | `https://auth.replit.com/...` |
| `REPL_ID` | Replit application ID | Auto-set on Replit |
| `NODE_ENV` | Environment mode | `development` or `production` |

### Optional Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | HTTP server port | `5000` |

**Configuration files**:
- `.replit` - Replit deployment config
- `vite.config.ts` - Build and dev server config
- `drizzle.config.ts` - Database migration config

## Deployment Steps

### Deploy to Replit (Production)

1. **Push to Git**: Commit changes to GitHub
2. **Import on Replit**: Connect GitHub repo
3. **Configure secrets**: Set `DATABASE_URL`, `SESSION_SECRET`, etc.
4. **Run build**: `npm run build` (or auto-build on Replit)
5. **Start**: `npm run start` (or click "Run" in Replit)

**First deployment**:
```bash
# Push database schema
npm run db:push

# Build and start
npm run build
npm run start
```

### Local Development Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd secure_file

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, etc.

# 4. Initialize database
npm run db:push

# 5. Start development server
npm run dev

# 6. Open browser to http://localhost:5000
```

## Monitoring & Logs

### Development Logs

- **Console output**: All logs to stdout
- **Format**: Timestamps + source (e.g., `[express]`, `[vite]`)
- **API logs**: Request method, path, status, duration, response body

Example:
```
11:34:56 AM [express] POST /api/files 201 in 45ms :: {"id":"abc123",...}
```

### Production Logs

- **Platform**: Replit logging dashboard
- **Access**: View in Replit console or download logs
- **Retention**: Per Replit plan limits

**Log sources**:
- Express server (API requests)
- Uncaught exceptions
- Database errors
- Authentication events

**No external logging service** (e.g., Datadog, Sentry) currently integrated.

## Evidence

Key files defining runtime behavior:

- [server/index.ts](../../server/index.ts):1-100 - Server bootstrap and middleware setup
- [vite.config.ts](../../vite.config.ts) - Dev server and build configuration
- [.replit](../../.replit) - Replit deployment configuration
- [package.json](../../package.json):6-11 - Start scripts
- [script/build.ts](../../script/build.ts) - Production build process
- [server/db.ts](../../server/db.ts) - Database connection initialization

## Related Documentation

- [Overview](./10_OVERVIEW.md) - System architecture
- [Modules & Dependencies](./30_MODULES_AND_DEPENDENCIES.md) - Code structure
- [Data Documentation](../data/00_INDEX.md) - Database setup
- [Integrations](../integrations/00_INDEX.md) - External services

[← Back to Index](./00_INDEX.md)
