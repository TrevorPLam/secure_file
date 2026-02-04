# Pull Request Security Checklist

Use this checklist to ensure your changes meet CloudVault's security standards. Check all applicable items before requesting review.

## 🔒 Security Fundamentals

### Authentication & Authorization
- [ ] All new API endpoints use `isAuthenticated` middleware (unless intentionally public)
- [ ] User ownership is verified before returning/modifying resources
- [ ] No bypass of authentication/authorization checks
- [ ] Session handling follows established patterns

### Input Validation
- [ ] All user inputs validated with Zod schemas or equivalent
- [ ] File paths sanitized (use `normalizeObjectEntityPath`)
- [ ] Query parameters validated and type-checked
- [ ] No SQL injection risks (using Drizzle ORM parameterized queries)

### Output Encoding & Error Handling
- [ ] No sensitive data in error messages (tokens, passwords, internal paths)
- [ ] Stack traces not exposed in production responses
- [ ] API responses follow standard format
- [ ] Logging does not include PII or secrets

### Secrets & Configuration
- [ ] No hardcoded secrets (passwords, API keys, tokens)
- [ ] Secrets loaded from environment variables
- [ ] `.env.example` updated if new config added
- [ ] No secrets in code comments or documentation

## 🛡️ Code Quality

### Type Safety
- [ ] `npm run check` passes with no TypeScript errors
- [ ] No `any` types without justification
- [ ] Shared types used between client/server where applicable

### Testing
- [ ] Tests added/updated for new functionality
- [ ] Security-critical paths have explicit test coverage
- [ ] `npm run test` passes with 100% coverage (or documented exception)
- [ ] Edge cases and error conditions tested

### Dependencies
- [ ] No new dependencies added without security review
- [ ] `package-lock.json` updated with `npm ci` or `npm install`
- [ ] Vulnerable dependencies addressed or waivers documented
- [ ] No unnecessary dependencies (check bundle size impact)

## 🚀 Runtime Security

### Rate Limiting
- [ ] Sensitive endpoints have appropriate rate limiting
- [ ] Public endpoints (share links) have abuse prevention
- [ ] Rate limits tested and documented

### Headers & CORS
- [ ] Security headers not weakened
- [ ] CORS policy follows allowlist (no `Access-Control-Allow-Origin: *`)
- [ ] CSP directives maintain protection level

### Data Protection
- [ ] Passwords hashed with bcrypt (10+ rounds)
- [ ] Session cookies have HttpOnly/Secure flags
- [ ] File access permissions enforced
- [ ] No direct object references without authz check

## 📝 Documentation

### Code Documentation
- [ ] AI-META headers updated for changed files
- [ ] Complex security logic explained with comments
- [ ] Public APIs documented in `docs/api/`

### Security Documentation
- [ ] New threats added to `docs/security/10_THREAT_MODEL.md`
- [ ] Auth changes reflected in `docs/security/11_IDENTITY_AND_ACCESS.md`
- [ ] Crypto changes reflected in `docs/security/12_CRYPTO_POLICY.md`
- [ ] Incident response playbooks updated if new incident types introduced

## 🔍 Review Focus Areas

### High-Risk Changes (Require Extra Scrutiny)
Mark if your PR includes any of these:
- [ ] Authentication/authorization logic changes
- [ ] Cryptographic operations (hashing, signing, encryption)
- [ ] SQL query modifications or new queries
- [ ] File upload/download logic
- [ ] Session management changes
- [ ] New external API integrations
- [ ] Dependency upgrades (major versions)
- [ ] Security middleware modifications

### Breaking Changes
- [ ] No breaking changes to authentication
- [ ] No weakening of security controls
- [ ] Migration plan documented for breaking changes
- [ ] Backward compatibility maintained where possible

## 🧪 Pre-Merge Verification

Run these commands locally before requesting review:

```bash
# Type checking
npm run check

# Unit tests
npm run test

# Coverage enforcement
npm run test:coverage

# Dependency audit
npm audit --production

# Build verification
npm run build
```

## ✅ Final Review

- [ ] I have tested these changes locally
- [ ] I have reviewed my own code for security issues
- [ ] I have considered abuse cases and attack vectors
- [ ] I understand the security implications of these changes
- [ ] I have updated relevant documentation
- [ ] I am ready for security review

---

**Security Concerns?** If you're unsure about any security aspects, tag `@security` in your PR or reach out before merging.

**Waivers:** If you need to deviate from these guidelines, document the reason in the PR description and get security approval.
