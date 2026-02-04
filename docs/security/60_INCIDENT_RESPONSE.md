# Incident Response

## Overview

This document establishes procedures for responding to **security incidents**, including secret leaks, vulnerability discoveries, data breaches, and service outages.

**Incident Types Covered**:
1. Secret leaked to public repository
2. Vulnerability disclosed by external researcher
3. Compromised dependency discovered
4. Unauthorized access detected
5. Data breach or exfiltration

---

## Incident Severity Classification

| Severity | Response Time | Examples | Escalation |
|----------|---------------|----------|------------|
| **P0 - Critical** | Immediate (24/7) | Active data breach, RCE exploit in the wild | All hands on deck, executive notification |
| **P1 - High** | <4 hours | Secret leaked, SQL injection discovered | Security team + on-call engineer |
| **P2 - Medium** | <24 hours | Non-exploited vulnerability, DDoS attack | Security team during business hours |
| **P3 - Low** | <7 days | Outdated dependency, security header missing | Planned sprint work |

---

## Playbook 1: Secret Leak to Public Repository

### Detection

**Indicators**:
- GitHub secret scanning alert (if enabled)
- Manual code review finds hardcoded credential
- External researcher reports exposed key
- Unauthorized access in logs (secret used by attacker)

### Response Timeline

#### T+0 (Immediate - Within 15 minutes)

**Step 1: Confirm Exposure**
```bash
# Search Git history for secret
git log -p | grep -i "SESSION_SECRET\|DATABASE_URL\|CLIENT_SECRET"

# Check if secret is in current HEAD
git show HEAD | grep -i "secret"

# Find which commits contain secret
git log --all --source --full-history -S "your-secret-value"
```

**Step 2: Assess Impact**
- Which secret was exposed? (SESSION_SECRET, database password, API key?)
- When was it committed? (check commit timestamp)
- Is repository public or private? (public = assume compromised)
- Has secret been used for unauthorized access? (check logs)

---

#### T+15 min: Rotate Compromised Secret

**For `SESSION_SECRET`**:
```bash
# Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# Update Replit Secrets (or environment variable)
# Old secret: Keep active temporarily for graceful transition

# Deploy new version with both secrets (dual-secret mode)
SESSION_SECRET=$NEW_SECRET
SESSION_SECRET_OLD=$OLD_SECRET

# Update session middleware to accept both
secret: [process.env.SESSION_SECRET, process.env.SESSION_SECRET_OLD]
```

**For `DATABASE_URL`**:
```bash
# Create new database user with new password
# Replit managed PostgreSQL: Contact support for credential rotation

# Update environment variable
# Deploy immediately (database connection interruption expected)
```

**For `OIDC_CLIENT_SECRET`**:
```bash
# Coordinate with Replit support to rotate OAuth client secret
# Cannot be rotated instantly (requires IdP update)
# Temporary mitigation: Monitor for unauthorized token issuance
```

**For `GCS_SERVICE_ACCOUNT_KEY`**:
```bash
# In Google Cloud Console:
# 1. Create new service account key
# 2. Update GCS_KEY environment variable
# 3. Delete old key from GCP (revoke immediately)
# 4. Deploy new version
```

---

#### T+30 min: Revoke Compromised Secret

**Invalidate all sessions** (if `SESSION_SECRET` leaked):
```sql
-- PostgreSQL
TRUNCATE TABLE session;
```

**Revoke database access** (if `DATABASE_URL` leaked):
```sql
-- Revoke old user's permissions
REVOKE ALL PRIVILEGES ON DATABASE cloudvault FROM old_user;
DROP USER old_user;
```

**Delete old GCS key** (if service account key leaked):
```bash
# Google Cloud Console > IAM > Service Accounts > Keys > Delete
```

---

#### T+1 hour: Remove Secret from Git History

**Option 1: BFG Repo-Cleaner** (recommended for large repos)
```bash
# Download BFG: https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --replace-text secrets.txt repo.git

# secrets.txt contains:
# SESSION_SECRET=abc123 ==> SESSION_SECRET=REDACTED
```

**Option 2: git filter-branch** (built-in, slower)
```bash
git filter-branch --tree-filter \
  'find . -type f -exec sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=REDACTED/g" {} \;' \
  --all
```

**Force Push** (⚠️ WARNING: Breaks history for all contributors)
```bash
git push origin --force --all
git push origin --force --tags

# Notify team to re-clone repository
```

**GitHub: Invalidate Old Commits**
- Go to Settings > Branches > Add rule > "Require signed commits" (prevents old commits from being pushed back)

---

#### T+4 hours: Audit for Unauthorized Access

**Check database logs** (PostgreSQL):
```sql
-- Find logins from unusual IPs
SELECT * FROM session WHERE expire > NOW() - INTERVAL '24 hours'
ORDER BY expire DESC;

-- Audit file access
SELECT * FROM files WHERE created_at > NOW() - INTERVAL '24 hours';
```

**Check GCS access logs** (Google Cloud Console > Storage > Bucket > Logs):
- Filter by timeframe: Last 24 hours
- Look for downloads from unknown IPs

**Check application logs** (`server/` logs):
```bash
# Find 401/403 errors (failed auth attempts)
grep -E "401|403" combined.log | tail -n 100

# Find unusual request patterns
grep "GET\|POST" combined.log | awk '{print $3}' | sort | uniq -c | sort -rn
```

---

#### T+24 hours: Postmortem

**Template** (see Postmortem Template section below)

**Key Questions**:
1. How did secret end up in version control? (developer error, lack of .gitignore)
2. How was exposure detected? (automated alert vs. manual discovery)
3. What was the impact? (unauthorized access occurred? data accessed?)
4. What preventative measures were taken? (pre-commit hooks, secret scanning)

---

## Playbook 2: Vulnerability Disclosure

### External Researcher Report

**Scenario**: Researcher emails `security@cloudvault.example.com` with vulnerability details

#### T+0 (Within 2 hours)

**Step 1: Acknowledge Receipt**
```
Subject: Re: [Security Report] SQL Injection in /api/folders

Hi [Researcher Name],

Thank you for reporting this security issue. We take security seriously and are investigating your report.

We aim to provide an initial assessment within 48 hours and a fix within 7 days for critical issues.

Best regards,
CloudVault Security Team
```

**Step 2: Verify Vulnerability**
```bash
# Attempt to reproduce issue in staging environment
# Example: Test for SQL injection
curl -X GET "https://staging.cloudvault.example.com/api/folders/'; DROP TABLE folders; --"
```

---

#### T+4 hours: Severity Assessment

**Use CVSS Calculator**: [https://nvd.nist.gov/vuln-metrics/cvss/v3-calculator](https://nvd.nist.gov/vuln-metrics/cvss/v3-calculator)

**Example Assessment**:
- **Attack Vector**: Network (AV:N)
- **Attack Complexity**: Low (AC:L)
- **Privileges Required**: None (PR:N)
- **User Interaction**: None (UI:N)
- **Scope**: Unchanged (S:U)
- **Confidentiality Impact**: High (C:H) - Database access
- **Integrity Impact**: High (I:H) - Data modification
- **Availability Impact**: High (A:H) - Service disruption

**CVSS Score**: 9.8 (CRITICAL)

---

#### T+8 hours: Fix Development

**Create Private Security Advisory** (GitHub):
1. Go to Security > Advisories > New draft advisory
2. Title: "SQL Injection in Folder API Endpoint"
3. Description: [Copy from researcher report]
4. Severity: CRITICAL (CVSS 9.8)
5. Affected versions: 1.0.0 - 1.2.3
6. Patched version: 1.2.4 (to be released)

**Develop Fix**:
```typescript
// Before (vulnerable)
const query = `SELECT * FROM folders WHERE id = '${folderId}'`;

// After (fixed)
const folder = await db.query.folders.findFirst({
  where: eq(folders.id, folderId)
});
```

**Add Security Regression Test**:
```typescript
it('should prevent SQL injection in folder ID', async () => {
  const maliciousId = "'; DROP TABLE folders; --";
  const response = await request(app).get(`/api/folders/${maliciousId}`);
  expect(response.status).toBe(404);
});
```

---

#### T+24 hours: Deploy Fix

**Emergency Deployment Process**:
1. Merge fix to `main` branch (bypass normal PR process if critical)
2. Tag release: `v1.2.4-security`
3. Deploy to production immediately
4. Verify fix in production: Attempt exploit (should fail)

**Notify Researcher**:
```
Subject: Re: [Security Report] SQL Injection - Fixed

Hi [Researcher Name],

We've deployed a fix for the SQL injection vulnerability you reported. The issue has been resolved in version 1.2.4.

Timeline:
- Reported: 2025-02-04 10:00 UTC
- Fix deployed: 2025-02-05 10:00 UTC (24 hours)

We'd like to acknowledge your contribution in our security advisory (with your permission). Please let us know your preferred attribution name.

Thank you again for responsible disclosure.

Best regards,
CloudVault Security Team
```

---

#### T+30 days: Public Disclosure

**Publish GitHub Security Advisory**:
- Change status from "Draft" to "Published"
- Include CVE number (if assigned by GitHub)
- Credit researcher (if agreed)

**Example Advisory**:
```markdown
# SQL Injection in Folder API (CVE-2025-XXXX)

## Summary
A SQL injection vulnerability in the folder API endpoint allowed unauthenticated attackers to execute arbitrary SQL queries.

## Impact
Attackers could read, modify, or delete database records.

## Affected Versions
- 1.0.0 through 1.2.3

## Fix
Upgrade to version 1.2.4 or later.

## Credits
Reported by [Researcher Name] on 2025-02-04.
```

---

## Playbook 3: Compromised Dependency

### Detection

**Scenario**: npm audit reports critical vulnerability in `express@5.0.1`

#### T+0: Assess Impact

```bash
# Check if CloudVault uses vulnerable code path
npm ls express
npm audit --production

# Read advisory details
npm audit --json | jq '.advisories'
```

**Key Questions**:
1. Does CloudVault use the vulnerable function? (check import statements)
2. Is vulnerability exploitable remotely? (RCE vs. local DoS)
3. Is there a patched version available?

---

#### T+1 hour: Mitigate or Upgrade

**If Patched Version Available**:
```bash
npm install express@5.0.2  # Upgrade to patched version
npm audit  # Verify fix
npm test   # Run tests
git commit -m "security: Upgrade express to 5.0.2 (CVE-2025-XXXX)"
```

**If No Patch Available**:
- **Workaround**: Disable vulnerable feature if possible
- **Vendor Contact**: Open issue with maintainer
- **Fork and Patch**: Apply security patch to forked version (last resort)
- **Replace Library**: Find alternative package

---

#### T+24 hours: Deploy and Notify

**Deploy Updated Dependencies**:
```bash
npm ci           # Clean install with new lockfile
npm run build    # Rebuild application
# Deploy to production
```

**Notify Users** (if critical):
```
Subject: Security Update - CloudVault v1.2.5

We've released a security update to address a vulnerability in a third-party library. All users should update to v1.2.5 immediately.

Details: [Link to security advisory]
```

---

## Playbook 4: Unauthorized Access Detected

### Detection

**Indicators**:
- Multiple failed login attempts from same IP
- File downloads from unusual location
- Database queries with unexpected parameters
- Successful login from compromised account

#### T+0: Contain Threat

**Block IP Address** (if applicable):
```bash
# Add to rate limiting blacklist
# Or contact Replit support to block at infrastructure level
```

**Revoke Session** (if account compromised):
```sql
DELETE FROM session WHERE sess::text LIKE '%"sub":"compromised-user-id"%';
```

**Disable Account** (if necessary):
```sql
UPDATE users SET active = false WHERE id = 'compromised-user-id';
```

---

#### T+1 hour: Investigate

**Audit Logs Analysis**:
```bash
# Find all actions by compromised account
grep "userId: compromised-user-id" audit.log

# Identify accessed files
SELECT * FROM files WHERE user_id = 'compromised-user-id' OR
  id IN (SELECT file_id FROM share_links WHERE created_at > '2025-02-04');
```

**Determine Scope**:
- Which files were accessed?
- Were files modified or deleted?
- Was data exfiltrated?

---

#### T+4 hours: Notify Affected Users

**If Data Breach Confirmed** (GDPR requirement: notify within 72 hours):
```
Subject: Security Incident Notification

Dear CloudVault User,

We are writing to inform you that your account may have been accessed by an unauthorized party on [DATE].

What happened:
- [Brief description]

What information was involved:
- [List of affected data: file names, metadata, etc.]

What we're doing:
- [Actions taken: password reset, enhanced monitoring, etc.]

What you should do:
- Change your password immediately
- Review your recent file activity
- Enable two-factor authentication (when available)

For questions, contact: security@cloudvault.example.com
```

---

## Incident Communication Plan

### Internal Communication

| Audience | Notification Method | Content |
|----------|---------------------|---------|
| **Security Team** | Slack #security | Detailed technical info, real-time updates |
| **Engineering Team** | Slack #engineering | High-level summary, action items |
| **Leadership** | Email + Slack DM | Business impact, risk assessment, mitigation plan |
| **Support Team** | Email | Customer-facing talking points, FAQs |

---

### External Communication

| Audience | Notification Method | Timeline |
|----------|---------------------|----------|
| **Affected Users** | Email | Within 72 hours (GDPR requirement) |
| **All Users** | In-app banner | Immediately (if service-wide impact) |
| **Public** | GitHub Security Advisory | After fix deployed (30 days max) |
| **Press** | Press release (if major breach) | Coordinated with legal team |

---

## Postmortem Template

**Incident**: [Brief title, e.g., "SESSION_SECRET leaked to public repository"]

**Date**: 2025-02-04  
**Severity**: P1 (High)  
**Status**: Resolved

---

### Timeline

| Time | Event |
|------|-------|
| 10:00 UTC | Secret committed to `main` branch in commit `abc123` |
| 10:15 UTC | Repository pushed to GitHub (public) |
| 14:30 UTC | External researcher reported exposure |
| 14:45 UTC | Security team confirmed leak |
| 15:00 UTC | New `SESSION_SECRET` generated and deployed |
| 15:15 UTC | All sessions invalidated (`TRUNCATE session`) |
| 16:00 UTC | Old secret revoked, Git history rewritten |
| 18:00 UTC | Audit completed (no unauthorized access detected) |

---

### Impact

**Users Affected**: 0 (no evidence of unauthorized access)  
**Data Exposed**: Session signing key (no user data directly exposed)  
**Service Downtime**: 0 minutes (rolling deployment)  
**Financial Cost**: $0 (internal time only)

---

### Root Cause

**Immediate Cause**: Developer accidentally committed `.env` file containing `SESSION_SECRET`

**Contributing Factors**:
1. `.env` not in `.gitignore` (configuration error)
2. No pre-commit hook to detect secrets (tooling gap)
3. No automated secret scanning in CI/CD (detection gap)

---

### What Went Well

- ✅ External researcher responsibly disclosed (not exploited)
- ✅ Rapid response (secret rotated within 1 hour)
- ✅ No data breach occurred (audit confirmed)
- ✅ Clear incident response playbook followed

---

### What Went Wrong

- ❌ Secret committed in the first place (human error)
- ❌ Took 4 hours to detect (reliance on external notification)
- ❌ Git history rewrite required (disruptive to team)

---

### Action Items

| Action | Owner | Deadline | Status |
|--------|-------|----------|--------|
| Add `.env` to `.gitignore` | DevOps | 2025-02-05 | ✅ Done |
| Install Gitleaks pre-commit hook | DevOps | 2025-02-07 | ⏳ In progress |
| Enable GitHub secret scanning | Security | 2025-02-08 | ⏳ Pending |
| Add secret scanning to CI/CD | DevOps | 2025-02-15 | 📋 Planned |
| Quarterly secret rotation schedule | Security | 2025-03-01 | 📋 Planned |

---

## Escalation Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| **Security Lead** | security@cloudvault.example.com | 24/7 (on-call rotation) |
| **Engineering Manager** | [Email] | Business hours + on-call |
| **CTO** | [Email] | Escalation for P0 only |
| **Legal Counsel** | [Email] | Data breach notification |

---

## References

- **NIST Incident Response Guide (SP 800-61)**: [Link](https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final)
- **SANS Incident Handler's Handbook**: [PDF](https://www.sans.org/reading-room/whitepapers/incident/incident-handlers-handbook-33901)
- **GDPR Breach Notification Requirements**: [Link](https://gdpr.eu/data-breach-notification/)

---

**Last Updated**: 2025-02-04  
**Next Review**: 2025-05-04
