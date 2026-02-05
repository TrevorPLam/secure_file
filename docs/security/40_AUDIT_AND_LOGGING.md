# Audit and Logging

## Overview

CloudVault currently uses **console.log/console.error** for logging. This document establishes requirements for **structured logging**, **PII redaction**, **audit trails**, and **log retention**.

**Current State**: ❌ Unstructured logging, no PII redaction, response bodies logged

---

## Current Logging Implementation

### Request Logging (`server/index.ts:47-71`)

```typescript
app.use((req, res, next) => {
  const start = Date.now()
  const originalJson = res.json.bind(res)

  res.json = function (data: any) {
    const duration = Date.now() - start

    if (req.path.startsWith('/api')) {
      console.log(`${formatTime()} - ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`)
      console.log(`Response:`, data) // ⚠️ SECURITY ISSUE: Logs full response
    }

    return originalJson(data)
  }

  next()
})
```

**Security Issues**:

- ❌ **Response bodies logged** - May contain session tokens, user PII
- ❌ **No log levels** - Everything logged at same priority
- ❌ **No structured format** - Difficult to parse/query
- ❌ **No request ID** - Cannot correlate related log entries

---

### Error Logging (`server/index.ts:77-88`)

```typescript
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err)
  res.status(500).send('Internal server error')
})
```

**Issues**:

- ❌ **Stack traces logged** - May reveal internal paths
- ❌ **No error categorization** - Can't distinguish auth failures from database errors

---

## Structured Logging Requirements

### Recommended Library: Winston or Pino

**Winston** (full-featured):

```typescript
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json() // Structured JSON output
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
})
```

**Pino** (high-performance, recommended):

```typescript
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.body.password',
      'res.body.accessToken',
    ],
    remove: true,
  },
})
```

---

### Log Levels

| Level   | Use Case                                      | Examples                                         |
| ------- | --------------------------------------------- | ------------------------------------------------ |
| `error` | System failures requiring immediate attention | Database connection lost, OIDC validation failed |
| `warn`  | Potential issues, degraded functionality      | Rate limit exceeded, slow query (>1s)            |
| `info`  | Normal operations, audit events               | User login, file upload, share creation          |
| `debug` | Detailed diagnostic information               | SQL query parameters, token expiration times     |
| `trace` | Very verbose (development only)               | Full request/response bodies                     |

**Production Setting**: `LOG_LEVEL=info` (default)

---

## PII Redaction Policy

### Personally Identifiable Information (PII) to Redact

| Field                       | Risk                         | Redaction Method                           |
| --------------------------- | ---------------------------- | ------------------------------------------ |
| `req.headers.cookie`        | Session hijacking            | Redact entirely                            |
| `req.headers.authorization` | Bearer tokens                | Redact entirely                            |
| `req.body.password`         | Credential exposure          | Redact entirely                            |
| `req.user.email`            | User identification          | Hash or mask (e.g., `u***@example.com`)    |
| `req.ip`                    | User tracking (GDPR concern) | Anonymize last octet (e.g., `192.168.1.0`) |
| `res.body.refreshToken`     | Token leakage                | Redact entirely                            |

---

### Redaction Implementation (Pino)

```typescript
import pino from 'pino'

const logger = pino({
  redact: {
    paths: [
      // Headers
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-api-key"]',

      // Request bodies
      'req.body.password',
      'req.body.token',
      'req.body.secret',

      // Response bodies
      'res.body.accessToken',
      'res.body.refreshToken',
      'res.body.session',

      // User data
      'req.user.email',
      'req.user.claims.email',
    ],
    remove: true, // Remove redacted fields entirely (vs. replacing with '[Redacted]')
  },
  serializers: {
    req: req => ({
      id: req.id,
      method: req.method,
      url: req.url,
      ip: anonymizeIP(req.ip), // Custom IP anonymization
    }),
  },
})

function anonymizeIP(ip: string): string {
  return ip.replace(/\.\d+$/, '.0') // 192.168.1.123 → 192.168.1.0
}
```

---

## Audit Events

### Events Requiring Audit Logs

| Event                         | Severity | Fields to Log                                                      | Retention                 |
| ----------------------------- | -------- | ------------------------------------------------------------------ | ------------------------- |
| User login (success)          | INFO     | `userId`, `timestamp`, `ip`, `userAgent`                           | 90 days                   |
| User login (failure)          | WARN     | `attemptedUsername`, `timestamp`, `ip`, `reason`                   | 90 days                   |
| Token refresh                 | INFO     | `userId`, `timestamp`, `tokenExpiry`                               | 30 days                   |
| File upload                   | INFO     | `userId`, `fileId`, `fileName`, `size`, `timestamp`                | 1 year                    |
| File download (authenticated) | INFO     | `userId`, `fileId`, `timestamp`                                    | 1 year                    |
| Share link creation           | INFO     | `userId`, `fileId`, `shareToken`, `expiresAt`, `passwordProtected` | 1 year                    |
| Share link access             | INFO     | `shareToken`, `ip`, `timestamp`, `userAgent`                       | 1 year                    |
| Share password failure        | WARN     | `shareToken`, `ip`, `timestamp`, `attemptCount`                    | 90 days                   |
| Authorization failure (403)   | WARN     | `userId`, `resource`, `action`, `timestamp`                        | 90 days                   |
| Permission change             | WARN     | `userId`, `fileId`, `oldPermission`, `newPermission`, `timestamp`  | 2 years                   |
| Account deletion              | WARN     | `userId`, `timestamp`, `deletedBy`                                 | 7 years (legal retention) |

---

### Audit Log Example (Structured JSON)

```json
{
  "timestamp": "2025-02-04T14:32:10.123Z",
  "level": "info",
  "event": "file_upload",
  "userId": "user-abc-123",
  "fileId": "file-xyz-789",
  "fileName": "document.pdf",
  "fileSize": 1048576,
  "mimeType": "application/pdf",
  "ip": "192.168.1.0",
  "userAgent": "Mozilla/5.0...",
  "requestId": "req-uuid-456"
}
```

**Query Example** (search for user's file uploads):

```bash
cat audit.log | jq 'select(.event == "file_upload" and .userId == "user-abc-123")'
```

---

## Implementation: Audit Middleware

```typescript
// server/middleware/audit.ts
import { logger } from './logger'

export function auditLog(event: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        // Only log successful operations
        logger.info({
          event,
          userId: req.user?.claims.sub,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          requestId: req.id,
        })
      }
    })
    next()
  }
}

// Usage in routes.ts
app.post('/api/files', isAuthenticated, auditLog('file_upload'), async (req, res) => {
  // ... existing code ...
})

app.post('/api/files/:id/share', isAuthenticated, auditLog('share_create'), async (req, res) => {
  // ... existing code ...
})
```

---

## Log Storage and Retention

### Development (Current)

- **Storage**: Console output only (ephemeral)
- **Retention**: Lost on server restart
- **Access**: Replit Console / terminal

### Production (Recommended)

**Option 1: File-based (Replit persistent storage)**

```typescript
new winston.transports.File({
  filename: '/var/log/cloudvault/audit.log',
  maxsize: 100 * 1024 * 1024, // 100 MB max file size
  maxFiles: 10, // Keep 10 rotated files
  tailable: true, // Support log rotation
})
```

**Option 2: Cloud Logging (Scalable)**

- **Google Cloud Logging** (integrates with GCS)
- **Datadog** (APM + logging)
- **AWS CloudWatch** (if migrating to AWS)

**Recommended for MVP**: File-based with log rotation

---

### Log Rotation

**Tool**: `winston-daily-rotate-file`

```typescript
import DailyRotateFile from 'winston-daily-rotate-file'

new DailyRotateFile({
  filename: 'cloudvault-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m', // Rotate at 20 MB
  maxFiles: '30d', // Keep 30 days
  zippedArchive: true, // Compress old logs
})
```

---

## Security Monitoring Alerts

### Critical Events Requiring Real-Time Alerts

| Event                         | Threshold                | Alert Channel | Response                     |
| ----------------------------- | ------------------------ | ------------- | ---------------------------- |
| Failed login attempts         | >5 from same IP in 15min | Slack/Email   | Potential brute force attack |
| Mass file downloads           | >50 files in 1 hour      | Slack         | Potential data exfiltration  |
| Database connection errors    | Any occurrence           | PagerDuty     | Immediate investigation      |
| OIDC token validation failure | Any occurrence           | Slack         | Potential token forgery      |
| Unexpected 5xx errors         | >10 in 5min              | Slack         | Service degradation          |

---

### Implementation: Alert Rules (Example with Pino)

```typescript
logger.on('data', log => {
  if (log.event === 'login_failure') {
    // Count failures by IP
    if (failureCount[log.ip] > 5) {
      sendAlert('Brute force attack detected', { ip: log.ip })
    }
  }

  if (log.level === 'error' && log.message.includes('ECONNREFUSED')) {
    sendAlert('Database connection lost', { error: log.message })
  }
})

async function sendAlert(message: string, context: any) {
  // Slack webhook
  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    body: JSON.stringify({ text: `🚨 ${message}`, context }),
  })
}
```

---

## Log Analysis and Querying

### Local Log Analysis (Development)

```bash
# Count errors by endpoint
cat combined.log | jq -r 'select(.level == "error") | .path' | sort | uniq -c

# Find slow requests (>1 second)
cat combined.log | jq 'select(.duration > 1000)'

# Audit trail for specific user
cat audit.log | jq 'select(.userId == "user-abc-123")'
```

---

### Production Log Analysis (Cloud)

**Google Cloud Logging Query**:

```
resource.type="cloud_run_revision"
jsonPayload.event="file_upload"
jsonPayload.userId="user-abc-123"
timestamp>"2025-02-01T00:00:00Z"
```

**Benefits**:

- Full-text search across all logs
- Alerting rules (e.g., error rate > 5%)
- Log-based metrics (e.g., request latency P95)

---

## Compliance Requirements

### GDPR (EU)

- ✅ PII redacted in logs (right to privacy)
- ✅ User can request log deletion (right to erasure)
- ⚠️ **MISSING**: User consent for logging IP addresses

### SOC 2 Type II

- ✅ Audit trail for data access (CC6.2)
- ✅ Log integrity protection via structured format (CC7.2)
- ⚠️ **MISSING**: Tamper-proof log storage (append-only mode)

### HIPAA (if handling health data)

- ❌ **NOT COMPLIANT**: Requires encrypted log storage
- ❌ **NOT COMPLIANT**: Requires access controls on logs

---

## Implementation Checklist

### Phase 1: Structured Logging (Week 1)

- [ ] Install Pino or Winston
- [ ] Replace all console.log with logger.info
- [ ] Add PII redaction rules
- [ ] Remove response body logging

### Phase 2: Audit Events (Week 2)

- [ ] Implement audit middleware
- [ ] Add audit logs to all critical endpoints
- [ ] Define log retention policy

### Phase 3: Monitoring (Week 3)

- [ ] Set up file-based log rotation
- [ ] Configure Slack alerts for critical errors
- [ ] Create log analysis dashboard

### Phase 4: Compliance (Month 2)

- [ ] Document log retention periods
- [ ] Implement user data deletion for logs
- [ ] Review GDPR compliance

---

## References

- **OWASP Logging Cheat Sheet**: [Link](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- **Pino Documentation**: [Link](https://getpino.io/)
- **Winston Documentation**: [Link](https://github.com/winstonjs/winston)
- **GDPR Logging Guidance**: [Link](https://gdpr.eu/logging-requirements/)

---

**Last Updated**: 2025-02-04  
**Next Review**: 2025-05-04
