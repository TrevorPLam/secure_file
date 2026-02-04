# Identity and Access Management

## Overview

CloudVault implements **delegated authentication** via OpenID Connect (OIDC) with Replit as the identity provider, paired with **session-based authorization** for API access. This document describes the authentication flow, session management, authorization model, and gaps requiring remediation.

**Authentication Mechanism**: OIDC (OpenID Connect)  
**Session Storage**: PostgreSQL via `connect-pg-simple`  
**Authorization Model**: User ownership (files, folders, shares)  
**MFA Support**: ❌ Not implemented (dependent on Replit IdP)

---

## Authentication Flow

### OIDC Integration (`server/replit_integrations/auth/replitAuth.ts`)

CloudVault uses the `openid-client` library with Passport.js for OIDC authentication.

#### 1. Discovery & Client Configuration (Lines 21-29)
```typescript
export const getOIDCClient = memoizee(async () => {
  const issuer = await Issuer.discover(OIDC_ISSUER);
  return new issuer.Client({
    client_id: OIDC_CLIENT_ID,
    client_secret: OIDC_CLIENT_SECRET,
    redirect_uris: [OIDC_REDIRECT_URI],
    response_types: ['code'],
  });
}, { maxAge: 3600000 }); // 1 hour cache
```

**Security Properties**:
- ✅ OIDC discovery URL validated against `OIDC_ISSUER` environment variable
- ✅ Client credentials stored in environment variables (not hardcoded)
- ✅ 1-hour discovery cache reduces attack surface for discovery endpoint manipulation
- ✅ Authorization Code flow (`response_types: ['code']`) - most secure OIDC flow

**Evidence**: Uses `/.well-known/openid-configuration` to retrieve Replit's signing keys dynamically

---

#### 2. Login Initiation (`routes.ts:115-121`)
```typescript
router.get("/api/login", (req, res, next) => {
  passport.authenticate("oidc", {
    scope: "openid profile email",
  })(req, res, next);
});
```

**Flow**:
1. User accesses `/api/login`
2. Passport redirects to Replit's authorization endpoint with:
   - `client_id`: CloudVault's OIDC client ID
   - `redirect_uri`: CloudVault's callback URL
   - `scope`: `openid profile email` (requests user identity and email)
   - `response_type=code`: Authorization Code flow
3. User authenticates with Replit (outside CloudVault's control)

**Security Properties**:
- ✅ PKCE (Proof Key for Code Exchange) may be used by `openid-client` (library default)
- ✅ `state` parameter prevents CSRF attacks on callback (Passport.js handles automatically)
- ⚠️ Redirect URI must exactly match registered value (no wildcard allowed)

---

#### 3. Callback & Token Exchange (`routes.ts:123-129`)
```typescript
router.get("/api/callback", (req, res, next) => {
  passport.authenticate("oidc", {
    successReturnToOrRedirect: "/",
    failureRedirect: "/login",
  })(req, res, next);
});
```

**Backend Flow** (`replitAuth.ts:79-89`):
1. Passport receives `code` parameter from OIDC provider
2. `openid-client` exchanges code for tokens:
   - `id_token`: JWT containing user identity (`sub`, `email`, etc.)
   - `access_token`: API access token (not currently used by CloudVault)
   - `refresh_token`: Long-lived token for silent re-authentication
3. Token signature validated against Replit's public keys
4. `updateUserSession()` stores tokens in session (lines 97-111):
   ```typescript
   async function updateUserSession(tokenSet: TokenSet, done: Function) {
     return done(null, {
       access_token: tokenSet.access_token,
       refresh_token: tokenSet.refresh_token,
       expires_at: tokenSet.expires_at,
       claims: tokenSet.claims(),
     });
   }
   ```

**Security Properties**:
- ✅ ID token signature verified cryptographically (prevents forgery)
- ✅ Token expiration validated (`exp` claim checked by `openid-client`)
- ✅ Issuer claim validated (prevents token from different IdP)
- ⚠️ **MISSING**: No explicit `aud` (audience) claim validation (relies on library defaults)
- ⚠️ **MISSING**: No `nonce` validation (could enable token replay attacks in edge cases)

**Gap**: Session not regenerated after successful authentication (see Threat T-S-03 in `10_THREAT_MODEL.md`)

---

#### 4. Token Refresh (`replitAuth.ts:146-169`)
```typescript
export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

  const user = req.user as SessionUser;
  if (user.expires_at && user.expires_at < Date.now() / 1000) {
    try {
      const client = await getOIDCClient();
      const tokenSet = await client.refresh(user.refresh_token!);
      // Update session with new tokens
      await updateUserSession(tokenSet, (err, updatedUser) => {
        if (err) return next(err);
        req.user = updatedUser;
        return next();
      });
    } catch (error) {
      return res.status(401).send("Session expired");
    }
  } else {
    return next();
  }
};
```

**Automatic Token Refresh**:
- Triggered when `access_token` expires (checked via `expires_at` field)
- Uses `refresh_token` to obtain new `access_token` without user interaction
- Session updated with new token and expiration time

**Security Properties**:
- ✅ Refresh token rotation (if enabled by Replit IdP) prevents replay attacks
- ✅ Failed refresh returns 401, forcing re-authentication
- ⚠️ **MISSING**: No rate limiting on refresh attempts (could be abused for token brute force)

---

## Session Management

### Configuration (`replitAuth.ts:31-51`)

```typescript
const sessionStore = new pgSession({
  pool: pgPool,
  createTableIfMissing: true,
});

app.use(session({
  store: sessionStore,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));
```

### Session Storage
- **Backend**: PostgreSQL table `session` (created by `connect-pg-simple`)
- **Schema**:
  - `sid`: Session ID (primary key)
  - `sess`: JSON blob containing user data (tokens, claims)
  - `expire`: Expiration timestamp
- **Automatic Cleanup**: `connect-pg-simple` periodically deletes expired sessions

**Security Properties**:
- ✅ Session data stored server-side (cookie only contains session ID)
- ✅ PostgreSQL connection reuses existing pool (no separate credentials)

---

### Cookie Security Flags

| Flag | Value | Purpose | Security Impact |
|------|-------|---------|-----------------|
| `httpOnly` | `true` | Prevents JavaScript access to cookie | ✅ Mitigates XSS-based session theft |
| `secure` | `true` | Cookie only sent over HTTPS | ✅ Prevents MITM interception on insecure networks |
| `sameSite` | **NOT SET** | Controls cross-site request behavior | ⚠️ **MISSING** - Vulnerable to CSRF attacks |
| `maxAge` | 7 days (604800000 ms) | Session expiration | ⚠️ Long-lived sessions increase replay window |

**Critical Gap**: No `sameSite` attribute configured  
**Recommended**: Set `sameSite: "lax"` to prevent CSRF while allowing top-level navigation  
```typescript
cookie: {
  httpOnly: true,
  secure: true,
  sameSite: "lax", // Add this
  maxAge: 7 * 24 * 60 * 60 * 1000,
}
```

**Note**: `sameSite: "strict"` would break OIDC callback flow (external redirect from Replit)

---

### Session Configuration Details

#### `resave: false`
- Session not re-saved to store on every request
- **Security benefit**: Reduces write contention on PostgreSQL
- **Compatibility**: Safe with `touch` support in `connect-pg-simple`

#### `saveUninitialized: false`
- Empty sessions not created for unauthenticated users
- **Security benefit**: Prevents session fixation attacks (attacker can't pre-create session)
- **Compliance**: GDPR-friendly (no session cookies until user logs in)

#### `trust proxy` (`replitAuth.ts:74`)
```typescript
app.set("trust proxy", true);
```
- **Purpose**: Replit runs behind reverse proxy; Express needs to trust `X-Forwarded-*` headers
- **Security implication**: If misconfigured, attacker could spoof IP via headers
- **Mitigation**: Replit's infrastructure strips untrusted headers at edge

---

### Session Lifecycle

1. **Creation**: User completes OIDC login → Passport.js calls `req.login()` → Session created in PostgreSQL
2. **Validation**: Every API request → `isAuthenticated` middleware checks:
   - Session exists in store
   - User object present in `req.session`
   - Token not expired (or refresh token still valid)
3. **Refresh**: Access token expired → `isAuthenticated` automatically refreshes using refresh token
4. **Expiration**: 7 days of inactivity → `connect-pg-simple` deletes session row → Next request returns 401
5. **Destruction**: User calls `/api/logout` → Session deleted from store (not currently implemented)

**Missing Feature**: Logout endpoint  
**Recommended Implementation**:
```typescript
router.post("/api/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).send("Logout failed");
    req.session.destroy(() => {
      res.clearCookie("connect.sid"); // Session cookie name
      res.status(200).send("Logged out");
    });
  });
});
```

---

## Authorization Model

CloudVault implements **user-based ownership** for all resources. Authorization is enforced at the API layer by validating `userId` against `req.user.claims.sub` (OIDC subject identifier).

### Ownership Rules

| Resource | Owner | Authorization Check | Evidence |
|----------|-------|---------------------|----------|
| **Folder** | `folders.userId` | User can only access own folders | `storage.ts:52` - `eq(folders.userId, userId)` |
| **File** | `files.userId` | User can only access own files | `routes.ts:148` - `file.userId === req.user.claims.sub` |
| **Share Link** | Via file owner | User can only create shares for own files | `routes.ts:179` - Ownership validation before share creation |

### Authorization Checks in Code

#### Folder Access (`server/storage.ts:52`)
```typescript
export async function getFolder(userId: string, folderId: string) {
  return db.query.folders.findFirst({
    where: and(eq(folders.id, folderId), eq(folders.userId, userId)),
  });
}
```
- ✅ Both `folderId` and `userId` required (prevents horizontal privilege escalation)
- ✅ Returns `undefined` if folder doesn't exist OR user doesn't own it (no information disclosure)

---

#### File Share Creation (`server/routes.ts:165-195`)
```typescript
app.post("/api/files/:id/share", isAuthenticated, async (req, res) => {
  const userId = req.user.claims.sub;
  const fileId = req.params.id;
  
  const file = await storage.getFile(userId, fileId);
  if (!file) return res.status(404).send("File not found");
  
  // Ownership already validated by getFile(userId, fileId)
  
  const shareData = createShareSchema.safeParse(req.body);
  if (!shareData.success) {
    return res.status(400).json({ errors: shareData.error.errors });
  }
  
  const shareLink = await storage.createShareLink({
    fileId,
    password: shareData.data.password 
      ? await bcrypt.hash(shareData.data.password, 10)
      : undefined,
    expiresAt: shareData.data.expiresAt,
  });
  
  res.json(shareLink);
});
```

**Authorization Layers**:
1. ✅ Route protected by `isAuthenticated` middleware (line 165)
2. ✅ `getFile(userId, fileId)` validates ownership (line 148)
3. ✅ Share link inherits file permissions (anonymous users can download via token)

---

#### Share Link Access (`server/routes.ts:246-293`)
```typescript
app.get("/api/shares/:token", async (req, res) => {
  const shareLink = await storage.getShareLinkByToken(req.params.token);
  
  if (!shareLink) return res.status(404).send("Share not found");
  if (!shareLink.isActive) return res.status(410).send("Share expired");
  if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
    return res.status(410).send("Share expired");
  }
  
  // No authentication required for valid share links
  res.json({ /* share metadata */ });
});

app.post("/api/shares/:token/download", async (req, res) => {
  // ... validation ...
  
  if (shareLink.password) {
    const validPassword = await bcrypt.compare(
      req.body.password,
      shareLink.password
    );
    if (!validPassword) return res.status(401).send("Invalid password");
  }
  
  // Generate signed URL for GCS download
  // ...
});
```

**Anonymous Access Model**:
- ✅ Share links are bearer tokens (UUID) - no authentication required
- ✅ Password-protected shares require password validation (bcrypt)
- ✅ Expired shares return HTTP 410 Gone (proper semantic status)
- ⚠️ **MISSING**: No rate limiting on password attempts (brute force possible)

---

### Authorization Enforcement Pattern

**Consistent Pattern Used Throughout**:
1. Validate authentication via `isAuthenticated` middleware
2. Extract `userId` from `req.user.claims.sub`
3. Pass `userId` to storage layer function
4. Storage layer adds `AND userId = ?` to SQL query
5. Return 404 if resource not found OR not owned (no information disclosure)

**Example** (`storage.ts:82-89`):
```typescript
export async function getFile(userId: string, fileId: string) {
  return db.query.files.findFirst({
    where: and(eq(files.id, fileId), eq(files.userId, userId)),
  });
}
```

---

## Security Gaps & Recommendations

### 1. Session Fixation Vulnerability [HIGH]
**Issue**: Session ID not regenerated after successful login  
**Attack**: Attacker tricks victim into using attacker-controlled session  
**Fix**: Add `req.session.regenerate()` after OIDC callback (see `10_THREAT_MODEL.md` T-S-03)

### 2. No SameSite Cookie Attribute [MEDIUM]
**Issue**: CSRF attacks possible on state-changing endpoints  
**Attack**: Malicious site triggers `POST /api/files/:id/share` from victim's browser  
**Fix**: Set `sameSite: "lax"` in session cookie config

### 3. Missing Rate Limiting [HIGH]
**Issue**: No protection against brute force attacks on auth endpoints  
**Attack Vectors**:
- `/api/login` - Flood authentication requests
- `/api/shares/:token/download` - Brute force share passwords
- Token refresh endpoint - Abuse refresh token mechanism

**Fix**: Implement `express-rate-limit` (see `31_RUNTIME_HARDENING.md`)

### 4. No Logout Endpoint [MEDIUM]
**Issue**: Users cannot invalidate sessions  
**Impact**: Stolen session remains valid for 7 days  
**Fix**: Implement `/api/logout` endpoint (see Session Lifecycle section)

### 5. No Audience Claim Validation [MEDIUM]
**Issue**: OIDC `aud` claim not explicitly validated  
**Attack**: Token issued for different application could be accepted  
**Fix**: Configure explicit audience validation in Passport strategy:
```typescript
passport.use('oidc', new Strategy({
  // ... existing config ...
  passReqToCallback: true,
  validate: (tokenset, profile, context, idToken, done) => {
    if (idToken.aud !== OIDC_CLIENT_ID) {
      return done(new Error('Invalid audience'));
    }
    // Continue with updateUserSession
  }
}));
```

### 6. Long Session Lifetime [LOW]
**Issue**: 7-day session increases replay attack window  
**Risk**: Stolen session cookie remains valid for extended period  
**Mitigation Options**:
- Reduce `maxAge` to 24 hours for high-security deployments
- Implement sliding session expiration (extend on activity)
- Add IP binding or user-agent validation (reduces usability)

**Current Stance**: 7 days acceptable for file storage use case, but should be configurable

---

## Multi-Factor Authentication (MFA) Readiness

### Current State: ❌ Not Supported

CloudVault delegates authentication to Replit's OIDC provider. MFA support depends on Replit's IdP capabilities.

### Implementation Path (Future)

1. **Verify Replit MFA Support**
   - Check if Replit OIDC includes `amr` (Authentication Methods Reference) claim
   - Example: `"amr": ["pwd", "otp"]` indicates password + OTP authentication

2. **Require MFA for Sensitive Operations**
   ```typescript
   function requireMFA(req: Request, res: Response, next: NextFunction) {
     const amr = req.user.claims.amr as string[] | undefined;
     if (!amr || !amr.includes('otp')) {
       return res.status(403).send('MFA required for this operation');
     }
     next();
   }
   
   // Apply to sensitive routes
   app.delete("/api/files/:id", isAuthenticated, requireMFA, async (req, res) => {
     // ...
   });
   ```

3. **Step-Up Authentication**
   - For high-value operations (delete account, export all data), re-prompt for authentication
   - Use OIDC `max_age=0` parameter to force fresh login:
   ```typescript
   passport.authenticate('oidc', { scope: 'openid', prompt: 'login' })
   ```

4. **Fallback for IdP Without MFA**
   - Implement TOTP-based MFA at application layer (not recommended - increases complexity)
   - Use libraries like `speakeasy` or `otplib`

---

## Compliance & Audit

### Access Control Logging
Currently **NOT IMPLEMENTED**. See `40_AUDIT_AND_LOGGING.md` for requirements.

**Required Audit Events**:
- User login/logout (timestamp, IP, user ID)
- Failed authentication attempts (potential brute force)
- Share link creation (who shared what with whom)
- Share link password validation failures (potential brute force)
- File downloads (especially via share links)
- Authorization failures (403 responses)

### Periodic Review

- **Session Store Cleanup**: Verify `connect-pg-simple` auto-cleanup working (`SELECT * FROM session WHERE expire < NOW()` should return 0 rows)
- **Token Refresh Behavior**: Monitor refresh token usage patterns for anomalies
- **OIDC Provider Changes**: Subscribe to Replit's security advisories for IdP changes

---

## Testing Recommendations

### Unit Tests for Authorization
```typescript
describe('File Share Authorization', () => {
  it('should prevent user from sharing another user\'s file', async () => {
    const userA = { sub: 'user-a' };
    const userBFileId = 'file-owned-by-user-b';
    
    const response = await request(app)
      .post(`/api/files/${userBFileId}/share`)
      .set('Cookie', mockSessionCookie(userA))
      .send({ expiresAt: null });
    
    expect(response.status).toBe(404); // Not 403 to avoid info disclosure
  });
});
```

### Integration Tests for OIDC Flow
```typescript
describe('OIDC Authentication', () => {
  it('should regenerate session after successful login', async () => {
    const initialSessionId = getSessionId(response1);
    
    // Complete OIDC flow
    const response2 = await request(app).get('/api/callback?code=...');
    const newSessionId = getSessionId(response2);
    
    expect(newSessionId).not.toBe(initialSessionId); // Should change
  });
});
```

---

## References

- **OIDC Specification**: [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- **Session Security**: [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- **Library Docs**: 
  - [`openid-client`](https://github.com/panva/node-openid-client)
  - [`connect-pg-simple`](https://github.com/voxpelli/node-connect-pg-simple)
  - [`passport`](http://www.passportjs.org/)

---

**Last Updated**: 2025-02-04  
**Next Review**: 2025-05-04
