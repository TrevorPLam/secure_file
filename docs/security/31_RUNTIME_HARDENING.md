# Runtime Hardening

## Overview

Runtime protections defend against attacks **after** code is deployed. This document covers HTTP security headers, rate limiting, CORS/CSP policies, and runtime monitoring.

**Current State**: ❌ Minimal runtime protections (relies on Replit platform defaults)

---

## HTTP Security Headers

### Current State: ❌ Missing

**Evidence**: No Helmet.js or security header middleware in `server/index.ts`

**Attack Vectors Unmitigated**:

- ❌ Clickjacking (no X-Frame-Options)
- ❌ MIME sniffing attacks (no X-Content-Type-Options)
- ❌ XSS via inline scripts (no Content-Security-Policy)
- ❌ Protocol downgrade attacks (no HSTS)

---

### Recommended Implementation: Helmet.js

**Install**:

```bash
npm install helmet
```

**Configuration** (`server/index.ts`):

```typescript
import helmet from 'helmet'

// Add after app initialization, before routes
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-* required for Vite HMR
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://storage.googleapis.com'],
        connectSrc: ["'self'", 'https://storage.googleapis.com'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [], // Force HTTPS
      },
    },
    crossOriginEmbedderPolicy: false, // May break file uploads
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  })
)
```

---

### Security Header Details

#### 1. Content-Security-Policy (CSP)

**Purpose**: Prevent XSS by whitelisting script/style sources

**Recommended Policy**:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://storage.googleapis.com;
  connect-src 'self' https://storage.googleapis.com;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
```

**Directive Explanation**:

- `default-src 'self'`: Only load resources from same origin
- `script-src 'unsafe-inline' 'unsafe-eval'`: Required for Vite dev server (React Hot Reload)
  - **Production**: Remove `'unsafe-*'` and use nonce-based CSP
- `img-src https://storage.googleapis.com`: Allow GCS file previews
- `upgrade-insecure-requests`: Auto-upgrade HTTP→HTTPS

**Nonce-Based CSP** (production, future):

```typescript
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomUUID();
  next();
});

app.use(helmet.contentSecurityPolicy({
  directives: {
    scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
  },
}));

// In HTML template:
<script nonce="<%= cspNonce %>">...</script>
```

---

#### 2. Strict-Transport-Security (HSTS)

**Purpose**: Force HTTPS for all future requests (prevent protocol downgrade)

**Recommended Header**:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Parameters**:

- `max-age=31536000`: 1 year (browsers remember HTTPS requirement)
- `includeSubDomains`: Apply to all subdomains
- `preload`: Eligible for HSTS preload list (browsers ship with CloudVault as HTTPS-only)

**HSTS Preload Submission**: [hstspreload.org](https://hstspreload.org/) (future, after stable HTTPS)

---

#### 3. X-Content-Type-Options

**Purpose**: Prevent MIME sniffing (browser guessing content type)

**Recommended Header**:

```
X-Content-Type-Options: nosniff
```

**Attack Scenario**:

- Attacker uploads `malicious.jpg` (actually contains JavaScript)
- Without `nosniff`: Browser may execute as script
- With `nosniff`: Browser refuses to execute (respects `Content-Type: image/jpeg`)

---

#### 4. X-Frame-Options

**Purpose**: Prevent clickjacking (embedding site in iframe)

**Recommended Header**:

```
X-Frame-Options: DENY
```

**Options**:

- `DENY`: Never allow framing (most secure)
- `SAMEORIGIN`: Allow framing by same domain
- `ALLOW-FROM uri`: Deprecated (use CSP `frame-ancestors` instead)

**CSP Alternative** (preferred):

```
Content-Security-Policy: frame-ancestors 'none';
```

---

#### 5. Referrer-Policy

**Purpose**: Control `Referer` header sent to external sites (prevent info disclosure)

**Recommended Header**:

```
Referrer-Policy: strict-origin-when-cross-origin
```

**Behavior**:

- Same-origin: Send full URL (e.g., `https://cloudvault.example.com/dashboard?userId=123`)
- Cross-origin HTTPS→HTTPS: Send origin only (e.g., `https://cloudvault.example.com`)
- HTTPS→HTTP: Don't send referrer (downgrade protection)

---

#### 6. Permissions-Policy

**Purpose**: Disable unnecessary browser features (reduce attack surface)

**Recommended Header**:

```
Permissions-Policy:
  geolocation=(),
  microphone=(),
  camera=(),
  payment=(),
  usb=()
```

**Features Disabled**:

- `geolocation`: CloudVault doesn't need user location
- `microphone`/`camera`: No video conferencing features
- `payment`: No in-app purchases
- `usb`: No hardware access

---

## CORS (Cross-Origin Resource Sharing)

### Current State: ❌ Not configured (defaults to same-origin only)

**Evidence**: No `cors` middleware in `server/index.ts`

**Default Behavior**: Browsers block cross-origin requests (good for security)

---

### When to Enable CORS

**Scenario**: If CloudVault API needs to be accessed from different domain (e.g., mobile app on different origin)

**Configuration**:

```typescript
import cors from 'cors'

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'https://cloudvault.example.com',
    credentials: true, // Allow cookies (session auth)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)
```

**Security Properties**:

- ✅ Whitelist specific origins (not wildcard `*`)
- ✅ `credentials: true` requires explicit origin (can't use `*`)
- ⚠️ CORS is **not** a security control (attacker can disable in own client)

**Current Recommendation**: Keep CORS disabled (same-origin only)

---

## Rate Limiting

### Current State: ❌ No rate limiting

**Evidence**: No rate limiting middleware in `server/index.ts`

**Vulnerabilities** (see `10_THREAT_MODEL.md`):

- T-D-03: Authentication endpoint flooding (DoS)
- T-T-03: Share password brute force (no throttling)
- T-I-02: Share token enumeration (no rate limit)

---

### Implementation: express-rate-limit

**Install**:

```bash
npm install express-rate-limit
```

**Global Rate Limit** (all endpoints):

```typescript
import rateLimit from 'express-rate-limit'

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15min per IP
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
})

app.use(globalLimiter)
```

---

### Endpoint-Specific Limits

#### Authentication Endpoints (Strict)

```typescript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15min
  message: 'Too many login attempts, please try again later.',
})

app.use('/api/login', authLimiter)
app.use('/api/callback', authLimiter)
```

**Rationale**: Prevents credential stuffing and brute force attacks

---

#### Share Link Password Validation (Moderate)

```typescript
const sharePasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 attempts per hour per IP
  keyGenerator: req => req.params.token, // Rate limit per share token, not per IP
})

app.post('/api/shares/:token/download', sharePasswordLimiter, async (req, res) => {
  // ... existing code ...
})
```

**Rationale**: Prevents password brute force on individual shares

---

#### File Upload (Storage Protection)

```typescript
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
})

app.post('/api/files', isAuthenticated, uploadLimiter, async (req, res) => {
  // ... existing code ...
})
```

**Rationale**: Prevents storage DoS attacks

---

### Rate Limit Storage

**Default**: In-memory (resets on server restart)

**Production**: Use Redis or PostgreSQL for distributed rate limiting

```typescript
import { RedisStore } from 'rate-limit-redis'
import Redis from 'ioredis'

const redisClient = new Redis(process.env.REDIS_URL)

const limiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:', // Rate limit key prefix
  }),
  windowMs: 15 * 60 * 1000,
  max: 1000,
})
```

**Current Recommendation**: Start with in-memory (acceptable for single-instance Replit deployment)

---

## Request Size Limits

### Current State: ✅ Partial (Express defaults)

**Express Defaults**:

- JSON body: 100kb limit (configurable)
- URL-encoded body: 100kb limit

**Configuration** (`server/index.ts`):

```typescript
app.use(express.json({ limit: '1mb' })) // Increase for file metadata
app.use(express.urlencoded({ limit: '1mb', extended: true }))
```

**Rationale**: Prevents memory exhaustion from large JSON payloads

---

### File Upload Size Limits

**Current State**: ❌ No validation in `POST /api/files` endpoint

**Recommended** (`server/routes.ts`):

```typescript
app.post('/api/files', isAuthenticated, async (req, res) => {
  const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB

  if (req.body.size > MAX_FILE_SIZE) {
    return res.status(413).send('File too large (max 100 MB)')
  }

  // ... existing code ...
})
```

---

## Non-Root User Execution

### Current State: ✅ Replit platform runs as non-root (assumed)

**Verification**:

```bash
# In Replit Shell
whoami  # Should NOT be 'root'
id -u   # Should be > 1000 (non-privileged UID)
```

**Best Practice**: If deploying to Docker, use non-root user

**Dockerfile Example**:

```dockerfile
FROM node:20-alpine

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
COPY --chown=appuser:appgroup . .

USER appuser

CMD ["node", "dist/index.cjs"]
```

---

## Secure Environment Variables

### Current Validation: ❌ Missing

**Recommended** (`server/index.ts` startup validation):

```typescript
function validateEnvironment() {
  const required = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'OIDC_CLIENT_ID',
    'OIDC_CLIENT_SECRET',
    'OIDC_REDIRECT_URI',
  ]

  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    console.error('FATAL: Missing required environment variables:', missing)
    process.exit(1) // Fail fast
  }

  // Validate secret lengths
  if (process.env.SESSION_SECRET!.length < 32) {
    console.error('FATAL: SESSION_SECRET must be at least 32 characters')
    process.exit(1)
  }
}

validateEnvironment()
```

**Rationale**: Fail fast on misconfiguration (prevents insecure startup)

---

## Process Monitoring and Health Checks

### Health Check Endpoint

**Add to** `server/routes.ts`:

```typescript
app.get('/health', (req, res) => {
  // Check database connectivity
  db.query.folders
    .findFirst()
    .then(() => {
      res.status(200).json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      })
    })
    .catch(error => {
      console.error('Health check failed:', error)
      res.status(503).json({ status: 'unhealthy', error: error.message })
    })
})
```

**Purpose**: Monitoring systems (e.g., UptimeRobot) can verify service health

---

### Graceful Shutdown

**Current State**: ❌ No graceful shutdown handler

**Recommended**:

```typescript
// server/index.ts
let server: Server

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...')
  server.close(() => {
    console.log('Server closed, exiting process')
    process.exit(0)
  })

  // Force exit after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout')
    process.exit(1)
  }, 30000)
})
```

**Rationale**: Allows in-flight requests to complete before shutdown (prevents data loss)

---

## Error Handling and Logging

### Current State: ⚠️ Error messages leak internal details

**Evidence** (`server/routes.ts:74`):

```typescript
catch (error: any) {
  return res.status(500).send(error.message); // Exposes database errors
}
```

**Recommended**:

```typescript
catch (error: any) {
  console.error('Database error:', error); // Server-side logging
  return res.status(500).send('Internal server error'); // Generic client message
}
```

**Full Error Handler** (`server/index.ts`):

```typescript
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  })

  res.status(err.status || 500).json({
    error: 'Internal server error',
    requestId: req.id, // If using express-request-id
  })
})
```

---

## Security Testing

### Penetration Testing Checklist

```bash
# 1. Test security headers
curl -I https://cloudvault.example.com | grep -i "x-frame\|csp\|hsts"

# 2. Test rate limiting
for i in {1..10}; do curl -X POST https://cloudvault.example.com/api/login; done

# 3. Test CORS (should fail)
curl -H "Origin: https://evil.com" https://cloudvault.example.com/api/folders

# 4. Test CSP (inline script should be blocked)
# Open browser DevTools Console, try: document.body.innerHTML = '<script>alert(1)</script>'
```

---

## Implementation Checklist

### Phase 1: Security Headers (Week 1)

- [ ] Install Helmet.js
- [ ] Configure CSP (allow Vite HMR in dev)
- [ ] Add HSTS header
- [ ] Test headers with securityheaders.com

### Phase 2: Rate Limiting (Week 2)

- [ ] Install express-rate-limit
- [ ] Add auth endpoint limits (5 req/15min)
- [ ] Add share password limits (100 req/hour)
- [ ] Test with load testing tool

### Phase 3: Error Handling (Week 3)

- [ ] Sanitize all error responses
- [ ] Add global error handler
- [ ] Remove stack traces from responses

### Phase 4: Monitoring (Week 4)

- [ ] Add health check endpoint
- [ ] Implement graceful shutdown
- [ ] Set up uptime monitoring

---

## References

- **OWASP Secure Headers Project**: [Link](https://owasp.org/www-project-secure-headers/)
- **Helmet.js Documentation**: [Link](https://helmetjs.github.io/)
- **CSP Evaluator**: [Google Tool](https://csp-evaluator.withgoogle.com/)
- **Security Headers Checker**: [Link](https://securityheaders.com/)

---

**Last Updated**: 2025-02-04  
**Next Review**: 2025-05-04
