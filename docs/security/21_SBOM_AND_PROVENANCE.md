# Software Bill of Materials (SBOM) and Build Provenance

## Overview

This document establishes requirements for **Software Bill of Materials (SBOM)** generation and **build provenance** tracking to ensure supply chain integrity and support incident response.

**Current State**: ❌ Not implemented  
**Priority**: MEDIUM (best practice, not blocking for MVP)

---

## SBOM Requirements

### What is an SBOM?

A Software Bill of Materials is a **machine-readable inventory** of all software components, dependencies, and metadata used in CloudVault. Analogous to ingredient labels on food products.

**Standards**:

- **CycloneDX** (OWASP, JSON/XML format) - Recommended for security use cases
- **SPDX** (Linux Foundation, JSON/RDF format) - Recommended for license compliance

**CloudVault Selection**: CycloneDX (better npm ecosystem support)

---

## CycloneDX SBOM Generation

### Tool: `@cyclonedx/cyclonedx-npm`

**Installation**:

```bash
npm install --save-dev @cyclonedx/cyclonedx-npm
```

**Generation Command**:

```bash
npx @cyclonedx/cyclonedx-npm \
  --output-format JSON \
  --output-file sbom.json \
  --spec-version 1.5
```

**SBOM Contents**:

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "components": [
    {
      "type": "library",
      "name": "express",
      "version": "5.0.1",
      "purl": "pkg:npm/express@5.0.1",
      "licenses": [{ "license": { "id": "MIT" } }],
      "hashes": [{ "alg": "SHA-512", "content": "..." }]
    }
  ]
}
```

---

### SBOM Metadata Fields

| Field                | Purpose                         | Evidence Source                  |
| -------------------- | ------------------------------- | -------------------------------- |
| `components`         | List of all dependencies        | `package-lock.json`              |
| `metadata.component` | CloudVault application metadata | `package.json:name`, `version`   |
| `dependencies`       | Dependency graph                | `package-lock.json:dependencies` |
| `vulnerabilities`    | Known CVEs                      | npm audit + Snyk                 |
| `licenses`           | License info                    | Package metadata                 |
| `hashes`             | Integrity verification          | `package-lock.json:integrity`    |

---

## Integration with CI/CD

### GitHub Actions Workflow

**Add to `.github/workflows/test-coverage.yml`**:

```yaml
- name: Generate SBOM
  run: npx @cyclonedx/cyclonedx-npm --output-file sbom.json

- name: Upload SBOM artifact
  uses: actions/upload-artifact@v4
  with:
    name: sbom
    path: sbom.json
    retention-days: 90
```

**Publish SBOM with Releases**:

```yaml
- name: Create Release with SBOM
  uses: softprops/action-gh-release@v1
  with:
    files: |
      dist/cloudvault.zip
      sbom.json
    body: |
      CloudVault v${{ github.ref_name }}

      SBOM (Software Bill of Materials): See attached sbom.json
```

---

## Build Provenance

### What is Build Provenance?

**Provenance** is cryptographically signed metadata proving:

1. **Source**: Which Git commit was built
2. **Builder**: Which CI/CD system performed build
3. **Build Process**: Exact commands executed
4. **Artifacts**: Hash of output artifacts

**Standard**: [SLSA (Supply-chain Levels for Software Artifacts)](https://slsa.dev/)

---

### SLSA Provenance Levels

| Level  | Requirements                        | CloudVault Status                  |
| ------ | ----------------------------------- | ---------------------------------- |
| SLSA 0 | No provenance                       | ✅ Current state                   |
| SLSA 1 | Provenance exists (no verification) | ⚠️ Can implement                   |
| SLSA 2 | Signed provenance                   | ⚠️ Requires signing key            |
| SLSA 3 | Hardened build platform (isolated)  | ❌ Replit Deployments not hardened |
| SLSA 4 | Two-person review + hermetic builds | ❌ Not feasible for small team     |

**Target**: SLSA 2 (signed provenance)

---

### Generating Provenance with GitHub Actions

**Tool**: `actions/attest-build-provenance@v1` (GitHub native)

**Workflow** (`.github/workflows/release.yml`):

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write
  id-token: write # Required for provenance signing

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build application
        run: npm run build

      - name: Generate provenance
        uses: actions/attest-build-provenance@v1
        with:
          subject-path: 'dist/**/*'

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
```

**Provenance File** (`dist/cloudvault.intoto.jsonl`):

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [{ "name": "dist/index.cjs", "digest": { "sha256": "abc123..." } }],
  "predicateType": "https://slsa.dev/provenance/v1",
  "predicate": {
    "buildDefinition": {
      "buildType": "https://github.com/actions/runner",
      "externalParameters": {
        "workflow": { "ref": "refs/tags/v1.0.0" }
      }
    },
    "runDetails": {
      "builder": { "id": "https://github.com/actions/runner" },
      "metadata": { "invocationId": "run-123" }
    }
  }
}
```

---

## Artifact Signing (Future Enhancement)

### Cosign (Sigstore)

**Tool**: [Cosign](https://github.com/sigstore/cosign) - sign and verify artifacts

**Signing Artifacts**:

```bash
# Generate key pair (one-time)
cosign generate-key-pair

# Sign artifact
cosign sign-blob --key cosign.key dist/cloudvault.zip > cloudvault.zip.sig
```

**Verification**:

```bash
cosign verify-blob \
  --key cosign.pub \
  --signature cloudvault.zip.sig \
  dist/cloudvault.zip
```

**Integration with GitHub Actions**:

```yaml
- name: Sign artifact
  uses: sigstore/cosign-installer@v3

- run: cosign sign-blob --key ${{ secrets.COSIGN_KEY }} dist/cloudvault.zip
```

---

## SBOM Storage and Distribution

### Where to Store SBOMs

1. **GitHub Releases** (primary)
   - Attach `sbom.json` to every release tag
   - Publicly accessible for auditors/users

2. **GitHub Actions Artifacts** (development)
   - 90-day retention for non-release builds
   - Useful for debugging supply chain issues

3. **Dependency Track** (optional, enterprise)
   - OWASP project for SBOM management
   - Tracks vulnerabilities over time
   - Sends alerts for new CVEs affecting dependencies

---

### SBOM Consumption

**Use Cases**:

1. **Vulnerability Scanning**: Match SBOM components against CVE databases
2. **License Compliance**: Verify no GPL dependencies in production
3. **Incident Response**: Identify if compromised package version was used

**Tools**:

```bash
# Scan SBOM for vulnerabilities
grype sbom:sbom.json

# Check license compliance
syft sbom.json -o table | grep GPL
```

---

## Build Reproducibility

### Goal: Bit-for-bit Identical Builds

**Challenge**: npm packages with postinstall scripts, timestamps, or randomness produce non-deterministic builds

**Current State**: ❌ Builds not reproducible (timestamps in build artifacts)

**Improvements**:

1. **Normalize Timestamps**:

   ```bash
   export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct)
   npm run build
   ```

2. **Pin Node.js Version**:

   ```yaml
   # .github/workflows/test-coverage.yml
   - uses: actions/setup-node@v4
     with:
       node-version: '20.19.27' # Exact version, not 20.x
   ```

3. **Hermetic Builds** (Docker):
   ```dockerfile
   FROM node:20.19.27-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --production
   COPY . .
   RUN npm run build
   ```

---

## Threat Model Linkage

| Threat                 | SBOM Mitigation                            | Provenance Mitigation                         |
| ---------------------- | ------------------------------------------ | --------------------------------------------- |
| Compromised dependency | Audit SBOM for malicious package           | Provenance links to source commit             |
| Supply chain attack    | Historical SBOMs show when attack occurred | Signed provenance prevents artifact tampering |
| License violation      | SBOM lists all licenses                    | N/A                                           |
| Insider threat         | SBOM shows unexpected dependencies         | Provenance proves build came from CI/CD       |

---

## Incident Response Integration

### Scenario: Compromised npm Package Discovered

**Response with SBOM**:

1. Generate SBOM for current production version: `npx @cyclonedx/cyclonedx-npm`
2. Search SBOM for compromised package:
   ```bash
   jq '.components[] | select(.name == "ua-parser-js")' sbom.json
   ```
3. Identify affected versions:
   ```bash
   git tag | xargs -I {} git show {}:sbom.json | jq '.components[] | select(.name == "ua-parser-js")'
   ```
4. Determine if CloudVault is affected (check version range)

**Without SBOM**:

- Must manually reconstruct dependency tree from old `package-lock.json`
- Time-consuming, error-prone

---

## Compliance and Reporting

### Regulatory Requirements

| Regulation                             | Requirement                          | SBOM Support                 |
| -------------------------------------- | ------------------------------------ | ---------------------------- |
| **Executive Order 14028** (US Federal) | SBOM for software sold to government | ✅ CycloneDX format accepted |
| **EU Cyber Resilience Act** (proposed) | SBOM for CE-marked software          | ✅ SPDX or CycloneDX         |
| **NTIA Minimum Elements**              | 7 required SBOM fields               | ✅ CycloneDX includes all    |

**NTIA Minimum Elements**:

1. Author/supplier name ✅
2. Component name ✅
3. Component version ✅
4. Unique identifier (PURL) ✅
5. Dependency relationships ✅
6. SBOM timestamp ✅
7. SBOM author ✅

---

## Implementation Roadmap

### Phase 1: SBOM Generation (Week 1)

- [ ] Install `@cyclonedx/cyclonedx-npm`
- [ ] Add SBOM generation to CI/CD
- [ ] Attach SBOM to next release
- [ ] Document SBOM location in README

### Phase 2: Provenance (Week 2)

- [ ] Enable `actions/attest-build-provenance@v1`
- [ ] Test provenance verification locally
- [ ] Add provenance verification to deployment checklist

### Phase 3: Artifact Signing (Week 4)

- [ ] Generate Cosign key pair
- [ ] Store private key in GitHub Secrets
- [ ] Sign release artifacts
- [ ] Document signature verification for users

### Phase 4: Continuous Monitoring (Month 2)

- [ ] Set up Dependency Track (optional)
- [ ] Configure CVE alerts
- [ ] Monthly SBOM audits

---

## Testing and Verification

### SBOM Validation

```bash
# Validate CycloneDX schema
npx @cyclonedx/cyclonedx-cli validate --input-file sbom.json

# Count dependencies
jq '.components | length' sbom.json

# Check for GPL licenses
jq '.components[] | select(.licenses[].license.id | contains("GPL"))' sbom.json
```

### Provenance Verification

```bash
# Verify provenance signature (GitHub Actions)
gh attestation verify dist/cloudvault.zip --repo cloudvault/cloudvault
```

---

## References

- **CycloneDX Specification**: [Link](https://cyclonedx.org/specification/overview/)
- **SLSA Framework**: [Link](https://slsa.dev/)
- **NTIA SBOM Minimum Elements**: [PDF](https://www.ntia.gov/files/ntia/publications/sbom_minimum_elements_report.pdf)
- **GitHub Artifact Attestation**: [Docs](https://docs.github.com/en/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds)
- **Sigstore Cosign**: [Docs](https://docs.sigstore.dev/cosign/overview/)

---

**Last Updated**: 2025-02-04  
**Next Review**: 2025-05-04
