# Security Policy

## Reporting a Vulnerability

CloudVault takes security seriously. We appreciate your efforts to responsibly disclose any vulnerabilities you may find.

### How to Report

**DO NOT** report security vulnerabilities through public GitHub issues.

Instead, please report them via one of these channels:

1. **GitHub Security Advisories** (Preferred)
   - Go to: https://github.com/TrevorPLam/secure_file/security/advisories
   - Click "Report a vulnerability"
   - Fill out the form with details

2. **Email** (Alternative)
   - Email: security@example.com (update with actual email)
   - Subject: [SECURITY] CloudVault Vulnerability Report
   - Include: Detailed description, steps to reproduce, impact assessment

### What to Include

To help us triage and fix the issue quickly, please include:

- **Type of vulnerability** (e.g., SQL injection, XSS, authentication bypass)
- **Affected components** (e.g., API endpoints, UI components, dependencies)
- **Steps to reproduce** (detailed, step-by-step instructions)
- **Proof of concept** (code snippets, screenshots, videos if applicable)
- **Impact assessment** (what an attacker could do with this vulnerability)
- **Suggested fix** (optional but appreciated)

### Response Timeline

We aim to respond to security reports according to the following SLA:

| Severity | Triage | Patch | Public Disclosure |
|----------|--------|-------|-------------------|
| **Critical** | 24 hours | 7 days | After patch deployed |
| **High** | 48 hours | 14 days | After patch deployed |
| **Medium** | 1 week | 30 days | After patch deployed |
| **Low** | 2 weeks | 60 days | After patch deployed |

### What to Expect

1. **Acknowledgment**: We'll acknowledge receipt within the triage timeframe
2. **Assessment**: We'll assess severity and impact
3. **Updates**: We'll provide regular updates on progress
4. **Resolution**: We'll develop, test, and deploy a fix
5. **Credit**: We'll credit you in the security advisory (if desired)
6. **Disclosure**: We'll coordinate public disclosure with you

### Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅ Yes    |
| < 1.0   | ❌ No     |

### Security Measures in Place

CloudVault implements multiple layers of security:

- ✅ **Authentication**: OIDC-based with session management
- ✅ **Authorization**: Role-based access control
- ✅ **Input Validation**: Zod schemas on all inputs
- ✅ **SQL Injection Prevention**: Parameterized queries (Drizzle ORM)
- ✅ **XSS Prevention**: Content-Security-Policy headers
- ✅ **CSRF Prevention**: SameSite cookies
- ✅ **Rate Limiting**: API and authentication endpoints
- ✅ **Secrets Management**: Environment variables, no hardcoded secrets
- ✅ **Dependency Scanning**: Automated via GitHub Actions
- ✅ **SAST**: CodeQL scanning on every PR
- ✅ **Secret Scanning**: Gitleaks on every commit

For complete security documentation, see [SECURITY_SUMMARY.md](SECURITY_SUMMARY.md) and [docs/security/](docs/security/).

### Scope

#### In Scope
- Authentication and authorization bypasses
- SQL injection, XSS, CSRF
- Remote code execution (RCE)
- Path traversal attacks
- Sensitive data exposure
- Cryptographic vulnerabilities
- Dependency vulnerabilities (with exploit proof)

#### Out of Scope
- Social engineering attacks
- Denial of Service (DoS) without demonstrable impact
- Issues in third-party services (Replit, GCS)
- Vulnerabilities in unsupported versions
- Issues requiring physical access
- Already known/reported issues

### Bug Bounty

We currently **do not** offer a bug bounty program, but we deeply appreciate:
- Responsible disclosure
- Detailed vulnerability reports
- Proof-of-concept code
- Suggested fixes

We will credit security researchers in:
- Security advisories
- CHANGELOG.md
- Hall of Fame (if we establish one)

### Safe Harbor

CloudVault supports safe harbor for security researchers who:

1. Make a good faith effort to avoid privacy violations, data destruction, and service disruption
2. Only interact with accounts you own or with explicit permission
3. Report vulnerabilities promptly
4. Give us reasonable time to fix issues before public disclosure
5. Do not exploit a vulnerability beyond what's necessary to prove it exists

We will not pursue legal action against researchers who follow these guidelines.

### Past Security Advisories

See [GitHub Security Advisories](https://github.com/TrevorPLam/secure_file/security/advisories) for published vulnerabilities.

### Additional Resources

- **Threat Model**: [docs/security/10_THREAT_MODEL.md](docs/security/10_THREAT_MODEL.md)
- **Incident Response**: [docs/security/60_INCIDENT_RESPONSE.md](docs/security/60_INCIDENT_RESPONSE.md)
- **Security Program**: [docs/security/00_INDEX.md](docs/security/00_INDEX.md)

### Contact

For general security questions (not vulnerability reports):
- Open a discussion: https://github.com/TrevorPLam/secure_file/discussions
- Email: security@example.com (update with actual email)

---

**Thank you for helping keep CloudVault and our users safe!**

*Last Updated: 2026-02-04*
