# Implementation Plan: Enterprise Features Gap Analysis

## Overview

This implementation plan transforms CloudVault into an enterprise-grade file sharing platform competitive with ShareFile, Box, and Dropbox Business. The plan is divided into 4 phases over 12 months, implementing critical features incrementally with comprehensive testing.

**Key Principles**:
- Incremental delivery with independent features
- Backward compatibility maintained throughout
- Property-based testing for correctness guarantees
- Security and performance built-in from the start

**Technology Stack Additions**:
- Real-time: Socket.io for WebSocket communication
- Background Jobs: BullMQ with Redis
- Search: PostgreSQL full-text search (Phase 1), Elasticsearch (Phase 2+)
- Caching: Redis for sessions and query caching
- Testing: fast-check for property-based testing
- AI/ML: OpenAI GPT-4 (or alternative LLM), pgvector for embeddings
- Vector Search: PostgreSQL pgvector extension
- DLP: Custom pattern matching + ML-based detection

---

## Phase 0: AI Foundation & Infrastructure (Weeks 1-4, Late 2025/Early 2026)

**Critical Path**: Must complete before other enterprise features can fully benefit from AI capabilities.

### 0. Infrastructure & AI Setup

- [ ] 0.1 Infrastructure Foundation
  - [ ] 0.1.1 Set up Redis instance for caching and job queues
    - Install and configure Redis server
    - Set up connection pooling
    - Configure persistence and backup
    - _Requirements: 6.3.4, AI caching_
  
  - [ ] 0.1.2 Configure BullMQ for background job processing
    - Install BullMQ and dependencies
    - Create queue manager module
    - Set up job monitoring dashboard
    - _Requirements: AI async processing, 6.3.5_
  
  - [ ] 0.1.3 Set up test database and test GCS bucket
    - Create separate test database
    - Configure test GCS bucket
    - Add database reset scripts for tests
    - _Requirements: Testing infrastructure_
  
  - [ ] 0.1.4 Install and configure fast-check for property-based testing
    - Add fast-check dependency
    - Create test generators for domain objects
    - Set up test configuration (100 runs minimum)
    - _Requirements: Testing infrastructure_

- [ ] 0.2 AI/LLM Integration
  - [ ] 0.2.1 Evaluate and select LLM provider
    - Compare OpenAI, Anthropic Claude, Google Vertex, open-source options
    - Criteria: cost, latency, accuracy, privacy
    - Recommended: OpenAI GPT-4 initially, plan migration path
    - _Requirements: 2.0_
  
  - [ ] 0.2.2 Set up LLM API integration
    - Add API keys and rate limiting
    - Implement token counting for cost control
    - Add retry logic and circuit breaker
    - _Requirements: 2.0_
  
  - [ ] 0.2.3 Create LLM service module
    - Implement summarization endpoint
    - Implement entity extraction endpoint
    - Implement classification endpoint
    - Add cost tracking and alerting
    - _Requirements: 2.0_
  
  - [ ] 0.2.4 Write integration tests for LLM
    - Test summarization accuracy
    - Test entity extraction
    - Test classification
    - Test rate limiting and cost controls
    - _Requirements: 2.0_

- [ ] 0.3 Vector Database Setup (pgvector)
  - [ ] 0.3.1 Install pgvector PostgreSQL extension
    - Add pgvector to PostgreSQL
    - Test vector similarity operations
    - _Requirements: 3.2, semantic search_
  
  - [ ] 0.3.2 Create embedding tables
    - Add `contentEmbeddings` table
    - Add `documentAnalyses` table
    - Create vector similarity indexes (IVFFlat)
    - _Requirements: 2.0_
  
  - [ ] 0.3.3 Implement embedding generation service
    - Use OpenAI text-embedding-3-small (1536 dims)
    - Chunk large documents
    - Implement caching
    - _Requirements: 2.0_
  
  - [ ] 0.3.4 Test vector operations
    - Test embedding generation
    - Test similarity searches
    - Test performance at scale
    - _Requirements: 3.2_

- [ ] 0.4 Document AI Analysis Service
  - [ ] 0.4.1 Implement document text extraction
    - Add PDF text extraction (pdf.js or pdfkit)
    - Add DOCX extraction (docx library)
    - Add image OCR (Tesseract.js or cloud API)
    - Add plain text handling
    - _Requirements: 2.0_
  
  - [ ] 0.4.2 Create AIAnalysisService class
    - Implement analyzeDocument() method
    - Implement summarizeText() method
    - Implement extractEntities() method
    - Implement classifyDocument() method
    - Implement findDuplicates() method (using embeddings)
    - _Requirements: 2.0_
  
  - [ ] 0.4.3 Build document analysis background job
    - Create job processor for document analysis
    - Add queue-based processing
    - Implement retry logic
    - Add progress tracking
    - _Requirements: 2.0_
  
  - [ ] 0.4.4 Write property-based tests for AI service
    - **Property 48: AI Analysis Idempotency** - Re-running analysis produces same results
    - **Property 49: Classification Consistency** - Same document always classified same way
    - **Property 50: Entity Extraction Completeness** - All entities in document are found
    - _Requirements: 2.0_

---

## Phase 1: Critical Enterprise Features (Q1 2026)

### 1. Infrastructure Setup

- [ ] 1.1 Set up Redis instance for caching and job queues
  - Install and configure Redis server
  - Set up connection pooling
  - Configure persistence and backup
  - _Requirements: 6.3.4_

- [ ] 1.2 Configure BullMQ for background job processing
  - Install BullMQ and dependencies
  - Create queue manager module
  - Set up job monitoring dashboard
  - _Requirements: 6.3.5_


- [ ] 1.3 Set up test database and test GCS bucket
  - Create separate test database
  - Configure test GCS bucket
  - Add database reset scripts for tests
  - _Requirements: Testing infrastructure_

- [ ] 1.4 Install and configure fast-check for property-based testing
  - Add fast-check dependency
  - Create test generators for domain objects
  - Set up test configuration (100 runs minimum)
  - _Requirements: Testing infrastructure_

---

### 2. File Version Control

- [ ] 2.1 Create file versions database schema
  - [ ] 2.1.1 Add fileVersions table to shared/schema.ts
    - Define table with id, fileId, versionNumber, objectPath, size, mimeType, uploadedBy, createdAt, isDeleted
    - Add indexes on fileId, createdAt, and unique constraint on (fileId, versionNumber)
    - Add foreign key to files table with cascade delete
    - _Requirements: 2.1.1_
  
  - [ ] 2.1.2 Add currentVersionId column to files table
    - Add nullable currentVersionId column
    - Create migration script
    - _Requirements: 2.1.1_
  
  - [ ] 2.1.3 Run database migration
    - Generate migration with drizzle-kit
    - Test migration on test database
    - Apply to development database
    - _Requirements: 2.1.1_

- [ ] 2.2 Implement version service
  - [ ] 2.2.1 Create server/services/versionService.ts
    - Implement createVersion() method
    - Implement listVersions() method
    - Implement getVersion() method
    - Implement restoreVersion() method
    - Implement getVersionDownloadUrl() method
    - _Requirements: 2.1.1, 2.1.2, 2.1.3, 2.1.4_
  
  - [ ]* 2.2.2 Write property test for version creation
    - **Property 1: Version Creation on Update**
    - **Validates: Requirements 2.1.1**
  
  - [ ]* 2.2.3 Write property test for version restore
    - **Property 4: Version Restore Creates New Version**
    - **Validates: Requirements 2.1.4**


- [ ] 2.3 Modify file upload to create versions
  - [ ] 2.3.1 Update file upload handler in server/routes.ts
    - Create version record on new file upload
    - Create version record on file update
    - Store version content in GCS with unique path
    - Update file.currentVersionId
    - _Requirements: 2.1.1_
  
  - [ ]* 2.3.2 Write unit tests for file upload with versioning
    - Test initial upload creates version 1
    - Test update creates version 2
    - Test version content is preserved
    - _Requirements: 2.1.1_

- [ ] 2.4 Implement version API endpoints
  - [ ] 2.4.1 Add GET /api/files/:fileId/versions endpoint
    - Implement route handler
    - Add authentication check
    - Add permission check (view permission required)
    - Return versions with metadata
    - _Requirements: 2.1.2_
  
  - [ ] 2.4.2 Add GET /api/files/:fileId/versions/:versionId/download endpoint
    - Implement route handler
    - Add authentication and permission checks
    - Generate presigned GCS URL
    - Return redirect to presigned URL
    - _Requirements: 2.1.3_
  
  - [ ] 2.4.3 Add POST /api/files/:fileId/versions/:versionId/restore endpoint
    - Implement route handler
    - Add authentication and permission checks (edit required)
    - Create new version with restored content
    - Update currentVersionId
    - Create audit log entry
    - _Requirements: 2.1.4_
  
  - [ ]* 2.4.4 Write integration tests for version API
    - Test list versions returns all versions
    - Test download version returns correct content
    - Test restore version creates new version
    - Test permission checks work correctly
    - _Requirements: 2.1.2, 2.1.3, 2.1.4_


- [ ] 2.5 Implement version pruning background job
  - [ ] 2.5.1 Create version pruning worker in server/jobs/workers/versionPruning.ts
    - Implement pruning logic (keep last N versions)
    - Delete old versions from GCS
    - Soft delete old versions in database
    - _Requirements: 2.1.5, 2.1.6_
  
  - [ ] 2.5.2 Schedule daily version pruning job
    - Add cron job to run daily at 2 AM
    - Process all files with version count > retention limit
    - Log pruning results
    - _Requirements: 2.1.6_
  
  - [ ]* 2.5.3 Write property test for version pruning
    - **Property 5: Version Pruning Respects Limit**
    - **Validates: Requirements 2.1.5, 2.1.6**

- [ ] 2.6 Create version history UI component
  - [ ] 2.6.1 Create client/src/components/VersionHistory.tsx
    - Display version list with timeline view
    - Show version metadata (number, size, uploader, date)
    - Add download button for each version
    - Add restore button with confirmation dialog
    - Implement infinite scroll for large version lists
    - _Requirements: 2.1.2, 2.1.3, 2.1.4_
  
  - [ ]* 2.6.2 Write component tests for VersionHistory
    - Test version list renders correctly
    - Test download button triggers download
    - Test restore button shows confirmation
    - _Requirements: 2.1.2, 2.1.3, 2.1.4_

- [ ] 2.7 Checkpoint - Version Control Complete
  - Ensure all version control tests pass
  - Verify version creation, listing, download, and restore work end-to-end
  - Check version pruning job runs successfully
  - Ask user if questions arise

---

### 3. Multi-Factor Authentication (MFA)

- [ ] 3.1 Create MFA database schema
  - [ ] 3.1.1 Add mfaDevices table to shared/schema.ts
    - Define table with id, userId, type, secret, isBackup, lastUsedAt, createdAt
    - Add indexes on userId
    - _Requirements: 2.5.1, 2.5.2, 2.5.3, 2.5.4, 2.5.5, 2.5.6_

  - [ ] 3.1.2 Add securityPolicies table to shared/schema.ts
    - Define table with id, userId, policyType, policyValue, isActive, createdAt, updatedAt
    - Add indexes on policyType and userId
    - _Requirements: 2.6.1, 2.6.2, 2.6.3, 2.6.4, 2.6.5, 2.6.6_

  - [ ] 3.1.3 Run database migration
    - Generate and apply migration for new tables
    - Test on development database
    - _Requirements: 2.5.1, 2.6.1_

- [ ] 3.2 Implement MFA service
  - [ ] 3.2.1 Create server/services/mfaService.ts
    - Implement setupMFA() method for TOTP/SMS setup
    - Implement verifyMFA() method for code verification
    - Implement generateBackupCodes() method
    - Implement getUserDevices() method
    - Implement removeDevice() method
    - Implement validateTOTPSecret() method
    - _Requirements: 2.5.1, 2.5.2, 2.5.3, 2.5.4, 2.5.5, 2.5.6_

  - [ ] 3.2.2 Write property tests for MFA service
    - **Property 18: MFA Setup Creates Device**
    - **Validates: Requirements 2.5.1, 2.5.2**

  - [ ] 3.2.3 Write property test for MFA verification
    - **Property 19: MFA Verification Validates Codes**
    - **Validates: Requirements 2.5.1, 2.5.3**

  - [ ] 3.2.4 Write unit tests for MFA service
    - Test TOTP secret generation
    - Test backup code generation
    - Test device management
    - Test rate limiting
    - _Requirements: 2.5.1, 2.5.2, 2.5.3, 2.5.4, 2.5.5, 2.5.6_

- [ ] 3.3 Implement MFA API endpoints
  - [ ] 3.3.1 Add POST /api/mfa/setup endpoint
    - Implement MFA setup with QR code generation
    - Support TOTP and SMS setup
    - Generate backup codes
    - _Requirements: 2.5.1, 2.5.2, 2.5.6_

  - [ ] 3.3.2 Add POST /api/mfa/verify endpoint
    - Implement MFA code verification
    - Rate limiting for verification attempts
    - _Requirements: 2.5.1, 2.5.3_

  - [ ] 3.3.3 Add GET /api/mfa/devices endpoint
    - List user's MFA devices
    - Support device management
    - _Requirements: 2.5.1, 2.5.4, 2.5.5_

  - [ ] 3.3.4 Add DELETE /api/mfa/devices/:deviceId endpoint
    - Remove MFA device
    - Require device ownership
    - _Requirements: 2.5.1, 2.5.5_

  - [ ] 3.3.5 Write integration tests for MFA API
    - Test MFA setup flow
    - Test verification flow
    - Test device management
    - Test error handling
    - _Requirements: 2.5.1, 2.5.2, 2.5.3, 2.5.4, 2.5.5, 2.5.6_

- [ ] 3.4 Create MFA setup UI component
  - [ ] 3.4.1 Create client/src/components/MFASetup.tsx
    - TOTP QR code display
    - Backup codes display
    - SMS verification option
    - Setup success confirmation
    - _Requirements: 2.5.1, 2.5.2, 2.5.3, 2.5.4, 2.5.5, 2.5.6_

  - [ ] 3.4.2 Write component tests for MFASetup
    - Test QR code generation
    - Test backup codes display
    - Test setup flow
    - _Requirements: 2.5.1, 2.5.2, 2.5.3, 2.5.4, 2.5.5, 2.5.6_

- [ ] 3.5 Checkpoint - MFA Complete
  - Ensure all MFA tests pass
  - Verify TOTP setup works
  - Check SMS verification works
  - Verify device management
  - Ask user if questions arise

---

### 4. Advanced Security Controls

- [ ] 4.1 Implement security policies service
  - [ ] 4.1.1 Extend server/services/securityPolicyService.ts
    - Implement getPolicy() method
    - Implement updatePolicy() method
    - Implement getUserPolicies() method
    - Implement getGlobalPolicies() method
    - Implement validateAccess() method
    - _Requirements: 2.6.1, 2.6.2, 2.6.3, 2.6.4, 2.6.5, 2.6.6_

  - [ ] 4.1.2 Add security policy caching
    - Cache policies in Redis for performance
    - Implement cache invalidation
    - Add cache warming for common policies
    - _Requirements: Performance optimization_

  - [ ] 4.1.3 Write property tests for security policies
    - **Property 20: Security Policy Evaluation**
    - **Validates: Requirements 2.6.1, 2.6.2, 2.6.3**

  - [ ] 4.1.4 Write unit tests for security policies
    - Test policy inheritance
    - Test policy caching
    - Test access validation
    - _Requirements: 2.6.1, 2.6.2, 2.6.3, 2.6.4, 2.6.5, 2.6.6_

- [ ] 4.2 Implement security policies API
  - [ ] 4.2.1 Add GET /api/security/policies endpoint
    - List security policies for user/organization
    - Support filtering and pagination
    - _Requirements: 2.6.1, 2.6.2, 2.6.3_

  - [ ] 4.2.2 Add PUT /api/security/policies/:policyId endpoint
    - Update security policy configuration
    - Validate policy changes
    - _Requirements: 2.6.1, 2.6.2, 2.6.3, 2.6.4, 2.6.5, 2.6.6_

  - [ ] 4.2.3 Write integration tests for security policies API
    - Test policy CRUD operations
    - Test access control enforcement
    - Test admin authorization
    - _Requirements: 2.6.1, 2.6.2, 2.6.3, 2.6.4, 2.6.5, 2.6.6_

- [ ] 4.3 Create security policies UI component
  - [ ] 4.3.1 Create client/src/components/SecurityPolicies.tsx
    - Policy configuration interface
    - MFA requirement toggle
    - IP whitelist management
    - Session timeout settings
    - _Requirements: 2.6.1, 2.6.2, 2.6.3, 2.6.4, 2.6.5, 2.6.6_

  - [ ] 4.3.2 Write component tests for SecurityPolicies
    - Test policy configuration
    - Test real-time updates
    - Test permission validation
    - _Requirements: 2.6.1, 2.6.2, 2.6.3, 2.6.4, 2.6.5, 2.6.6_

- [ ] 5.4 Checkpoint - Admin Dashboard Complete
  - Ensure all admin dashboard tests pass
  - Verify user management works
  - Check analytics are accurate
  - Verify compliance reporting works
  - Ask user if questions arise

---

### 5.5 Data Loss Prevention (DLP) - Depends on Phase 0 AI

- [ ] 5.5.1 Create DLP database schema
  - [ ] 5.5.1.1 Add dlpRules table to shared/schema.ts
    - Define table with id, organizationId, name, pattern, patternType, severity, action, isActive
    - Add indexes on organizationId and isActive
    - _Requirements: 2.0.1_
  
  - [ ] 5.5.1.2 Add fileClassifications table to shared/schema.ts
    - Define table with id, fileId, classification, reason, violatedRules
    - Add indexes on fileId and classification
    - _Requirements: 2.0.1_
  
  - [ ] 5.5.1.3 Add dlpViolations table to shared/schema.ts
    - Track DLP violations for audit
    - Include matched content and admin resolution
    - _Requirements: 2.0.1_
  
  - [ ] 5.5.1.4 Run database migration
    - Generate and apply migration
    - Test on development database
    - _Requirements: 2.0.1_

- [ ] 5.5.2 Implement DLP Service
  - [ ] 5.5.2.1 Create server/services/dlpService.ts
    - Implement scanFile() method
    - Implement matchRule() method (regex, keyword, ML-based)
    - Implement getViolations() method
    - Integrate AI classification from Phase 0
    - _Requirements: 2.0.1_
  
  - [ ] 5.5.2.2 Write property tests for DLP
    - **Property 51: DLP Rule Matching** - Rules consistently match sensitive patterns
    - **Property 52: DLP Violation Logging** - All violations are recorded
    - **Property 53: DLP Action Enforcement** - Blocked files cannot be shared
    - _Requirements: 2.0.1_
  
  - [ ] 5.5.2.3 Write unit tests for DLP service
    - Test regex pattern matching
    - Test keyword matching
    - Test AI-based detection
    - Test action enforcement
    - _Requirements: 2.0.1_

- [ ] 5.5.3 Implement DLP API endpoints
  - [ ] 5.5.3.1 Add GET /api/dlp/rules endpoint
    - List DLP rules for organization
    - Require admin auth
    - _Requirements: 2.0.1_
  
  - [ ] 5.5.3.2 Add POST /api/dlp/rules endpoint
    - Create new DLP rule
    - Validate pattern syntax
    - Require admin auth
    - _Requirements: 2.0.1_
  
  - [ ] 5.5.3.3 Add GET /api/files/:fileId/classification endpoint
    - Get file classification level
    - Show violated rules
    - _Requirements: 2.0.1_
  
  - [ ] 5.5.3.4 Add PUT /api/files/:fileId/classification endpoint
    - Manually override classification
    - Log classification change
    - _Requirements: 2.0.1_
  
  - [ ] 5.5.3.5 Add GET /api/dlp/violations endpoint
    - Query violations with filters
    - Admin only
    - Export capability
    - _Requirements: 2.0.1_
  
  - [ ] 5.5.3.6 Write integration tests for DLP API
    - Test rule creation and application
    - Test violation detection
    - Test classification override
    - _Requirements: 2.0.1_

- [ ] 5.5.4 Create DLP Admin UI
  - [ ] 5.5.4.1 Create client/src/components/DLPManager.tsx
    - Rule creation and management
    - Violation monitoring dashboard
    - Classification override interface
    - _Requirements: 2.0.1_
  
  - [ ] 5.5.4.2 Write component tests for DLPManager
    - Test rule creation form
    - Test violation viewing
    - _Requirements: 2.0.1_

- [ ] 5.5.5 Checkpoint - DLP Complete
  - Ensure all DLP tests pass
  - Verify rules are enforced
  - Check violations are logged
  - Verify admin dashboard works
  - Ask user if questions arise

---

### 5.6 Device Trust & Conditional Access

- [ ] 5.6.1 Create device trust database schema
  - [ ] 5.6.1.1 Add trustedDevices table to shared/schema.ts
    - Define table with id, userId, deviceFingerprint, deviceName, osName, browserName, approvedBy, lastUsedAt, isRevoked
    - Add indexes on userId and deviceFingerprint
    - _Requirements: 2.0.2_
  
  - [ ] 5.6.1.2 Add conditionalAccessPolicies table to shared/schema.ts
    - Define table with id, organizationId, name, conditions, actions, priority
    - Add indexes on organizationId and isActive
    - _Requirements: 2.0.2_
  
  - [ ] 5.6.1.3 Add conditionalAccessEvaluations table to shared/schema.ts
    - Track policy evaluations for audit
    - Include decision (allow/block/challenge) and challenge type
    - _Requirements: 2.0.2_
  
  - [ ] 5.6.1.4 Run database migration
    - Generate and apply migration
    - Test on development database
    - _Requirements: 2.0.2_

- [ ] 5.6.2 Implement device fingerprinting service
  - [ ] 5.6.2.1 Create device fingerprinting utility
    - Extract device properties from request (User-Agent, screen resolution, timezone)
    - Generate consistent fingerprint hash
    - _Requirements: 2.0.2_
  
  - [ ] 5.6.2.2 Implement trusted device tracking
    - Store fingerprints for known devices
    - Support device approval workflow
    - _Requirements: 2.0.2_

- [ ] 5.6.3 Implement Conditional Access Service
  - [ ] 5.6.3.1 Create server/services/conditionalAccessService.ts
    - Implement evaluateAccess() method
    - Implement policyMatches() method
    - Support multiple conditions: device trust, location, time, sensitivity
    - Support actions: require_mfa, block, require_approval
    - _Requirements: 2.0.2_
  
  - [ ] 5.6.3.2 Write property tests for conditional access
    - **Property 54: Conditional Access Evaluation** - Policies consistently evaluated
    - **Property 55: Access Decision Consistency** - Same request always gets same decision
    - _Requirements: 2.0.2_
  
  - [ ] 5.6.3.3 Write unit tests for conditional access
    - Test device trust evaluation
    - Test location restrictions
    - Test time-based access
    - Test risk-based detection
    - _Requirements: 2.0.2_

- [ ] 5.6.4 Implement Conditional Access API
  - [ ] 5.6.4.1 Add GET /api/devices endpoint
    - List user's trusted devices
    - Show device details and last used time
    - _Requirements: 2.0.2_
  
  - [ ] 5.6.4.2 Add DELETE /api/devices/:deviceId endpoint
    - Revoke device trust
    - Invalidate sessions for that device
    - _Requirements: 2.0.2_
  
  - [ ] 5.6.4.3 Add GET /api/security/conditional-access endpoint
    - List conditional access policies
    - Admin only
    - _Requirements: 2.0.2_
  
  - [ ] 5.6.4.4 Add POST /api/security/conditional-access endpoint
    - Create new conditional access policy
    - Validate policy conditions and actions
    - Admin only
    - _Requirements: 2.0.2_
  
  - [ ] 5.6.4.5 Write integration tests for device trust API
    - Test device registration
    - Test device revocation
    - Test policy evaluation
    - _Requirements: 2.0.2_

- [ ] 5.6.5 Create device trust UI
  - [ ] 5.6.5.1 Create client/src/components/DeviceManager.tsx
    - List trusted devices
    - Revoke device button
    - Device details and last used time
    - _Requirements: 2.0.2_
  
  - [ ] 5.6.5.2 Create conditional access policy UI
    - Policy creation form
    - Condition builder (device trust, location, time)
    - Action selector (MFA, block, approval)
    - _Requirements: 2.0.2_
  
  - [ ] 5.6.5.3 Write component tests for device UI
    - Test device list rendering
    - Test revoke functionality
    - _Requirements: 2.0.2_

- [ ] 5.6.6 Checkpoint - Device Trust Complete
  - Ensure all device trust tests pass
  - Verify devices are tracked correctly
  - Check conditional access policies work
  - Verify untrusted devices are detected
  - Ask user if questions arise

---

### 3. Infrastructure Setup (Moved from 1.x)

Note: Infrastructure (Redis, BullMQ, testing setup) is now in Phase 0. This section removed.

- [ ] 5.1 Implement admin dashboard service
  - [ ] 5.1.1 Create server/services/adminService.ts
    - Implement getUserManagementData() method
    - Implement bulkUserOperation() method
    - Implement getSystemHealth() method
    - Implement getUsageAnalytics() method
    - Implement getComplianceStatus() method
    - _Requirements: 2.7.1, 2.7.2, 2.7.3, 2.7.4, 2.7.5, 2.7.6_

  - [ ] 5.1.2 Add real-time metrics aggregation
    - Implement system health monitoring
    - Add usage analytics aggregation
    - Create compliance report generation
    - _Requirements: Performance optimization_

  - [ ] 5.1.3 Write property tests for admin service
    - **Property 21: Admin Dashboard Data Accuracy**
    - **Validates: Requirements 2.7.1, 2.7.2, 2.7.3, 2.7.4, 2.7.5, 2.7.6**

  - [ ] 5.1.4 Write unit tests for admin service
    - Test user management operations
    - Test analytics aggregation
    - Test compliance reporting
    - _Requirements: 2.7.1, 2.7.2, 2.7.3, 2.7.4, 2.7.5, 2.7.6_

- [ ] 5.2 Implement admin dashboard API
  - [ ] 5.2.1 Add GET /api/admin/users endpoint
    - User management with bulk operations
    - Role-based access control
    - _Requirements: 2.7.1, 2.7.2_

  - [ ] 5.2.2 Add POST /api/admin/users/bulk endpoint
    - Bulk user operations (create, update, delete)
    - Operation progress tracking
    - _Requirements: 2.7.1, 2.7.2_

  - [ ] 5.2.3 Add GET /api/admin/system-health endpoint
    - System health monitoring
    - Performance metrics
    - Alert configuration
    - _Requirements: 2.7.3, 2.7.4_

  - [ ] 5.2.4 Add GET /api/admin/analytics endpoint
    - Usage analytics and reporting
    - Custom date ranges and filters
    - Export capabilities
    - _Requirements: 2.7.4, 2.7.5_

  - [ ] 5.2.5 Add GET /api/admin/compliance endpoint
    - Compliance status dashboard
    - Report generation
    - Audit log access
    - _Requirements: 2.7.5, 2.7.6_

  - [ ] 5.2.6 Write integration tests for admin API
    - Test admin authorization
    - Test bulk operations
    - Test analytics accuracy
    - Test compliance reporting
    - _Requirements: 2.7.1, 2.7.2, 2.7.3, 2.7.4, 2.7.5, 2.7.6_

- [ ] 5.3 Create admin dashboard UI component
  - [ ] 5.3.1 Create client/src/components/AdminDashboard.tsx
    - User management interface
    - Security policy configuration
    - System health monitoring
    - Usage analytics dashboard
    - _Requirements: 2.7.1, 2.7.2, 2.7.3, 2.7.4, 2.7.5, 2.7.6_

  - [ ] 5.3.2 Write component tests for AdminDashboard
    - Test dashboard rendering
    - Test admin functionality
    - Test real-time updates
    - _Requirements: 2.7.1, 2.7.2, 2.7.3, 2.7.4, 2.7.5, 2.7.6_

- [ ] 5.4 Checkpoint - Admin Dashboard Complete
  - Ensure all admin dashboard tests pass
  - Verify user management works
  - Check analytics are accurate
  - Verify compliance reporting works
  - Ask user if questions arise

---

### 6. Granular Permissions System

- [ ] 3.1 Create permissions database schema
  - [ ] 3.1.1 Add permissions table to shared/schema.ts
    - Define table with id, resourceType, resourceId, userId, permissionLevel, grantedBy, createdAt, expiresAt
    - Add indexes on (resourceType, resourceId), userId, and unique constraint
    - Add foreign key constraints
    - _Requirements: 2.2.1, 2.2.2_
  
  - [ ] 3.1.2 Run database migration
    - Generate and apply migration
    - Test on development database
    - _Requirements: 2.2.1_

- [ ] 3.2 Implement permission service with caching
  - [ ] 3.2.1 Create server/services/permissionService.ts
    - Implement checkPermission() with hierarchy (full > edit > download > view)
    - Implement grantPermission() method
    - Implement revokePermission() method
    - Implement listPermissions() method
    - Implement getInheritedPermissions() for folder inheritance
    - Implement getEffectivePermission() method
    - _Requirements: 2.2.1, 2.2.2, 2.2.3, 2.2.5, 2.2.6_
  
  - [ ] 3.2.2 Create server/cache/permissionCache.ts
    - Implement Redis-based permission caching
    - Add cache get/set/invalidate methods
    - Set TTL to 5 minutes
    - _Requirements: Performance optimization_
  
  - [ ]* 3.2.3 Write property test for permission hierarchy
    - **Property 6: Permission Level Hierarchy**
    - **Validates: Requirements 2.2.1**
  
  - [ ]* 3.2.4 Write property test for permission inheritance
    - **Property 7: Permission Inheritance**
    - **Validates: Requirements 2.2.2**
  
  - [ ]* 3.2.5 Write property test for permission grant
    - **Property 8: Permission Grant Enables Access**
    - **Validates: Requirements 2.2.3**
  
  - [ ]* 3.2.6 Write property test for permission revocation
    - **Property 11: Permission Revocation Removes Access**
    - **Validates: Requirements 2.2.6**


- [ ] 3.3 Add permission check middleware
  - [ ] 3.3.1 Create server/middleware/permissions.ts
    - Implement requirePermission() middleware factory
    - Check user permission before allowing access
    - Return 403 if insufficient permissions
    - Log permission denials to audit log
    - _Requirements: 2.2.1, 2.2.2_
  
  - [ ]* 3.3.2 Write unit tests for permission middleware
    - Test allows access with sufficient permission
    - Test denies access with insufficient permission
    - Test checks inherited permissions
    - _Requirements: 2.2.1, 2.2.2_

- [ ] 3.4 Implement permission CRUD API endpoints
  - [ ] 3.4.1 Add GET /api/files/:fileId/permissions endpoint
    - List all permissions for a file
    - Include inherited permissions
    - Require 'full' permission or ownership
    - _Requirements: 2.2.5_
  
  - [ ] 3.4.2 Add POST /api/files/:fileId/permissions endpoint
    - Grant permission to a user
    - Validate permission level
    - Create audit log entry
    - Send notification to user
    - Require 'full' permission or ownership
    - _Requirements: 2.2.3, 2.2.4_
  
  - [ ] 3.4.3 Add PUT /api/permissions/:permissionId endpoint
    - Update permission level
    - Create audit log entry
    - Send notification to user
    - Require 'full' permission or ownership
    - _Requirements: 2.2.4_
  
  - [ ] 3.4.4 Add DELETE /api/permissions/:permissionId endpoint
    - Revoke permission
    - Invalidate permission cache
    - Create audit log entry
    - Send notification to user
    - Require 'full' permission or ownership
    - _Requirements: 2.2.6, 2.2.4_
  
  - [ ]* 3.4.5 Write integration tests for permission API
    - Test grant permission creates record
    - Test list permissions returns all permissions
    - Test update permission changes level
    - Test revoke permission removes access
    - Test permission changes create audit logs
    - _Requirements: 2.2.3, 2.2.4, 2.2.5, 2.2.6_


- [ ] 3.5 Update existing APIs to check permissions
  - [ ] 3.5.1 Add permission checks to file operations
    - Update GET /api/files/:fileId to check 'view' permission
    - Update PUT /api/files/:fileId to check 'edit' permission
    - Update DELETE /api/files/:fileId to check 'full' permission
    - Update file download to check 'download' permission
    - _Requirements: 2.2.1, 2.2.2_
  
  - [ ]* 3.5.2 Write integration tests for permission enforcement
    - Test file operations respect permissions
    - Test permission inheritance works
    - Test permission denials return 403
    - _Requirements: 2.2.1, 2.2.2_

- [ ] 3.6 Create permissions manager UI component
  - [ ] 3.6.1 Create client/src/components/PermissionsManager.tsx
    - Display current permissions with user info
    - Add user search and permission grant form
    - Add permission level dropdown
    - Add remove permission button with confirmation
    - Show inherited permissions (read-only)
    - Add permission level explanations
    - _Requirements: 2.2.3, 2.2.5, 2.2.6_
  
  - [ ]* 3.6.2 Write component tests for PermissionsManager
    - Test permission list renders correctly
    - Test grant permission form works
    - Test remove permission button works
    - _Requirements: 2.2.3, 2.2.5, 2.2.6_

- [ ] 4.4 Checkpoint - Granular Permissions System Complete
  - Ensure all permission tests pass
  - Verify permission checks work on all file operations
  - Check permission inheritance works correctly
  - Verify permission caching improves performance
  - Ask user if questions arise

---

### 5. Activity Audit Logs

- [ ] 5.1 Create audit logs database schema
  - [ ] 5.1.1 Add auditLogs table to shared/schema.ts
    - Define table with id, userId, action, resourceType, resourceId, metadata, ipAddress, userAgent, createdAt
    - Add indexes on userId, (resourceType, resourceId), createdAt, action
    - Make table append-only (no updates/deletes)
    - _Requirements: 2.3.1, 2.3.2, 2.3.3_
  
  - [ ] 4.1.2 Run database migration
    - Generate and apply migration
    - Test on development database
    - _Requirements: 2.3.1_

- [ ] 4.2 Implement audit service
  - [ ] 4.2.1 Create server/services/auditService.ts
    - Implement log() method with async logging
    - Implement query() method with filters
    - Implement export() method (CSV and JSON)
    - Implement pruneOldLogs() method
    - Add sensitive data redaction
    - Extract IP and user agent from request
    - _Requirements: 2.3.1, 2.3.2, 2.3.4, 2.3.5, 2.3.6_
  
  - [ ]* 4.2.2 Write property test for audit log immutability
    - **Property 14: Audit Log Immutability**
    - **Validates: Requirements 2.3.3**
  
  - [ ]* 4.2.3 Write property test for audit log search
    - **Property 15: Audit Log Search Correctness**
    - **Validates: Requirements 2.3.4**
  
  - [ ]* 4.2.4 Write property test for audit log export
    - **Property 16: Audit Log Export Completeness**
    - **Validates: Requirements 2.3.5**

- [ ] 4.3 Add audit logging to all operations
  - [ ] 4.3.1 Add audit logging to file operations
    - Log file upload, download, delete, update
    - Log share link creation and access
    - Include file metadata in log
    - _Requirements: 2.3.1_
  
  - [ ] 4.3.2 Add audit logging to permission operations
    - Log permission grant, update, revoke
    - Include old and new permission levels
    - _Requirements: 2.3.1, 2.2.4_
  
  - [ ] 4.3.3 Add audit logging to version operations
    - Log version creation and restore
    - Include version numbers
    - _Requirements: 2.3.1_
  
  - [ ]* 4.3.4 Write property test for comprehensive logging
    - **Property 12: Comprehensive Operation Logging**
    - **Validates: Requirements 2.3.1**


- [ ] 4.4 Implement audit log API endpoints
  - [ ] 4.4.1 Add GET /api/audit-logs endpoint
    - Implement query with filters (user, action, resource, date range)
    - Add pagination (limit, offset)
    - Filter results by user permissions (users see own logs, admins see all)
    - _Requirements: 2.3.4_
  
  - [ ] 4.4.2 Add GET /api/audit-logs/export endpoint
    - Implement export in CSV and JSON formats
    - Handle large exports via background job
    - Send email notification when export ready
    - Require admin permission
    - _Requirements: 2.3.5_
  
  - [ ]* 4.4.3 Write integration tests for audit log API
    - Test query returns filtered results
    - Test pagination works correctly
    - Test export generates correct format
    - Test permission filtering works
    - _Requirements: 2.3.4, 2.3.5_

- [ ] 4.5 Implement audit log pruning background job
  - [ ] 4.5.1 Create audit log pruning worker
    - Delete logs older than retention period (default 1 year)
    - Run daily at 3 AM
    - Log pruning results
    - _Requirements: 2.3.6_
  
  - [ ]* 4.5.2 Write property test for audit log retention
    - **Property 17: Audit Log Retention Enforcement**
    - **Validates: Requirements 2.3.6**

- [ ] 4.6 Create audit log viewer UI component
  - [ ] 4.6.1 Create client/src/components/AuditLogViewer.tsx
    - Display filterable table with date range picker
    - Add action type badges with colors
    - Add user and resource links
    - Add export to CSV/JSON button
    - Implement pagination with infinite scroll
    - _Requirements: 2.3.4, 2.3.5_
  
  - [ ]* 4.6.2 Write component tests for AuditLogViewer
    - Test table renders correctly
    - Test filters work
    - Test export button triggers download
    - _Requirements: 2.3.4, 2.3.5_

- [ ] 4.7 Checkpoint - Audit Logs Complete
  - Ensure all audit log tests pass
  - Verify all operations create audit logs
  - Check audit log query and export work
  - Verify audit logs are immutable
  - Ask user if questions arise

---

### 5. File Comments and Annotations

- [ ] 5.1 Create comments database schema
  - [ ] 5.1.1 Add comments table to shared/schema.ts
    - Define table with id, fileId, userId, parentCommentId, content, createdAt, updatedAt, isDeleted
    - Add indexes on fileId, userId, parentCommentId, createdAt
    - Add foreign key to files table with cascade delete
    - _Requirements: 2.4.1, 2.4.2, 2.4.3_
  
  - [ ] 5.1.2 Run database migration
    - Generate and apply migration
    - Test on development database
    - _Requirements: 2.4.1_

- [ ] 5.2 Implement comment CRUD API endpoints
  - [ ] 5.2.1 Add GET /api/files/:fileId/comments endpoint
    - List all comments for a file
    - Include threaded replies
    - Require 'view' permission on file
    - _Requirements: 2.4.1, 2.4.3, 2.4.6_
  
  - [ ] 5.2.2 Add POST /api/files/:fileId/comments endpoint
    - Create new comment or reply
    - Require 'view' permission on file
    - Create notification for file owner and mentioned users
    - Rate limit to prevent spam (10 comments per minute)
    - _Requirements: 2.4.1, 2.4.3_
  
  - [ ] 5.2.3 Add PUT /api/comments/:commentId endpoint
    - Update comment content
    - Require comment ownership
    - Update updatedAt timestamp
    - _Requirements: 2.4.4_
  
  - [ ] 5.2.4 Add DELETE /api/comments/:commentId endpoint
    - Soft delete comment
    - Require comment ownership or file ownership
    - _Requirements: 2.4.4, 2.4.5_
  
  - [ ]* 5.2.5 Write property test for comment permissions
    - **Property 18: Comment Creation Permission**
    - **Validates: Requirements 2.4.1**
  
  - [ ]* 5.2.6 Write property test for comment threading
    - **Property 20: Comment Threading**
    - **Validates: Requirements 2.4.3**
  
  - [ ]* 5.2.7 Write property test for comment ownership
    - **Property 21: Comment Ownership for Edit/Delete**
    - **Validates: Requirements 2.4.4**
  
  - [ ]* 5.2.8 Write integration tests for comment API
    - Test create comment works
    - Test list comments returns threaded structure
    - Test update comment works for author
    - Test delete comment works for author and file owner
    - Test permission checks work
    - _Requirements: 2.4.1, 2.4.2, 2.4.3, 2.4.4, 2.4.5, 2.4.6_


- [ ] 5.3 Create comments panel UI component
  - [ ] 5.3.1 Create client/src/components/CommentsPanel.tsx
    - Display threaded comment list
    - Add rich text editor with Markdown support
    - Add reply button for each comment
    - Add edit/delete buttons for own comments
    - Add @mention autocomplete
    - Add emoji support
    - _Requirements: 2.4.1, 2.4.2, 2.4.3, 2.4.4, 2.4.5, 2.4.6_
  
  - [ ]* 5.3.2 Write component tests for CommentsPanel
    - Test comment list renders correctly
    - Test create comment form works
    - Test reply functionality works
    - Test edit/delete buttons work
    - _Requirements: 2.4.1, 2.4.2, 2.4.3, 2.4.4, 2.4.5_

- [ ] 5.4 Checkpoint - Comments Complete
  - Ensure all comment tests pass
  - Verify comment creation, editing, and deletion work
  - Check threaded replies work correctly
  - Verify permission checks work
  - Ask user if questions arise

---

## Phase 2: Collaboration & Productivity (Q2 2026)

### 6. Real-time Notifications

- [ ] 6.1 Create notifications database schema
  - [ ] 6.1.1 Add notifications table to shared/schema.ts
    - Define table with id, userId, type, title, message, resourceType, resourceId, isRead, createdAt
    - Add indexes on userId, isRead, createdAt
    - _Requirements: 3.1.1_
  
  - [ ] 6.1.2 Add notificationPreferences table to shared/schema.ts
    - Define table with id, userId, notificationType, inApp, email, createdAt
    - Add unique constraint on (userId, notificationType)
    - _Requirements: 3.1.2_
  
  - [ ] 6.1.3 Run database migration
    - Generate and apply migration
    - Test on development database
    - _Requirements: 3.1.1, 3.1.2_


- [ ] 6.2 Set up WebSocket infrastructure
  - [ ] 6.2.1 Install and configure Socket.io
    - Add Socket.io server and client dependencies
    - Create server/realtime.ts module
    - Set up authentication middleware for WebSocket
    - Configure Redis adapter for multi-server support
    - _Requirements: 3.1.6_
  
  - [ ] 6.2.2 Implement WebSocket event handlers
    - Handle user connection and room joining
    - Implement subscribe/unsubscribe to file events
    - Add error handling and reconnection logic
    - _Requirements: 3.1.6_
  
  - [ ]* 6.2.3 Write integration tests for WebSocket
    - Test connection authentication works
    - Test room subscription works
    - Test event broadcasting works
    - _Requirements: 3.1.6_

- [ ] 6.3 Implement notification service
  - [ ] 6.3.1 Create server/services/notificationService.ts
    - Implement create() method
    - Implement markAsRead() method
    - Implement markAllAsRead() method
    - Implement list() method with filters
    - Implement sendEmail() method
    - Implement sendRealtime() method via WebSocket
    - Check user preferences before sending
    - _Requirements: 3.1.1, 3.1.2, 3.1.4, 3.1.5, 3.1.6_
  
  - [ ]* 6.3.2 Write property test for notification delivery
    - **Property 28: Real-time Notification Delivery**
    - **Validates: Requirements 3.1.6**
  
  - [ ]* 6.3.3 Write property test for email preferences
    - **Property 25: Email Notification Preference**
    - **Validates: Requirements 3.1.2**

- [ ] 6.4 Add notification creation to operations
  - [ ] 6.4.1 Add notifications for file operations
    - Notify on file upload, share, delete
    - Notify file owner and collaborators
    - _Requirements: 3.1.1_
  
  - [ ] 6.4.2 Add notifications for permission changes
    - Notify user when permission granted/revoked
    - Include permission level in notification
    - _Requirements: 3.1.1_
  
  - [ ] 6.4.3 Add notifications for comments
    - Notify file owner on new comment
    - Notify mentioned users
    - Notify parent comment author on reply
    - _Requirements: 3.1.1_
  
  - [ ]* 6.4.4 Write property test for notification creation
    - **Property 24: Activity Notification Creation**
    - **Validates: Requirements 3.1.1**


- [ ] 6.5 Implement email notification worker
  - [ ] 6.5.1 Create email notification background job
    - Create server/jobs/workers/emailNotifications.ts
    - Check user email preferences
    - Send email using configured service (SendGrid, AWS SES)
    - Render email templates
    - _Requirements: 3.1.2_
  
  - [ ]* 6.5.2 Write unit tests for email worker
    - Test email sent when preference enabled
    - Test email not sent when preference disabled
    - Test email template rendering
    - _Requirements: 3.1.2_

- [ ] 6.6 Implement notification API endpoints
  - [ ] 6.6.1 Add GET /api/notifications endpoint
    - List user notifications with filters
    - Support unreadOnly filter
    - Add pagination
    - Return unread count
    - _Requirements: 3.1.5_
  
  - [ ] 6.6.2 Add PUT /api/notifications/:notificationId/read endpoint
    - Mark notification as read
    - Require notification ownership
    - _Requirements: 3.1.4_
  
  - [ ] 6.6.3 Add PUT /api/notifications/read-all endpoint
    - Mark all user notifications as read
    - Return count of marked notifications
    - _Requirements: 3.1.4_
  
  - [ ] 6.6.4 Add GET /api/notifications/preferences endpoint
    - Get user notification preferences
    - Return all notification types with in-app and email settings
    - _Requirements: 3.1.2_
  
  - [ ] 6.6.5 Add PUT /api/notifications/preferences endpoint
    - Update user notification preferences
    - Validate notification types
    - _Requirements: 3.1.2_
  
  - [ ]* 6.6.6 Write integration tests for notification API
    - Test list notifications works
    - Test mark as read works
    - Test mark all as read works
    - Test preferences get/update works
    - _Requirements: 3.1.2, 3.1.4, 3.1.5_


- [ ] 6.7 Create notification center UI component
  - [ ] 6.7.1 Create client/src/components/NotificationCenter.tsx
    - Display dropdown with unread count badge
    - Show notification list with icons
    - Mark as read on click
    - Add mark all as read button
    - Add filter by notification type
    - Link to resource
    - _Requirements: 3.1.1, 3.1.4, 3.1.5_
  
  - [ ] 6.7.2 Create client/src/hooks/use-realtime.ts
    - Connect to WebSocket server
    - Handle notification events
    - Update notification state
    - Show toast on new notification
    - _Requirements: 3.1.6_
  
  - [ ] 6.7.3 Create notification preferences modal
    - Display all notification types
    - Add toggle for in-app and email
    - Save preferences on change
    - _Requirements: 3.1.2_
  
  - [ ]* 6.7.4 Write component tests for NotificationCenter
    - Test notification list renders
    - Test mark as read works
    - Test real-time updates work
    - _Requirements: 3.1.1, 3.1.4, 3.1.5, 3.1.6_

- [ ] 6.8 Checkpoint - Notifications Complete
  - Ensure all notification tests pass
  - Verify real-time notifications work
  - Check email notifications respect preferences
  - Verify notification center UI works
  - Ask user if questions arise

---

### 7. Advanced Search (Enhanced with AI from Phase 0)

**Dependencies**: Requires Phase 0 AI completion for semantic search using embeddings.

- [ ] 7.1 Add full-text search to database
  - [ ] 7.1.1 Add search_vector column to files table
    - Add tsvector column for full-text search
    - Create GIN index on search_vector
    - _Requirements: 3.2.1_
  
  - [ ] 7.1.2 Create trigger to update search_vector
    - Update search_vector on file insert/update
    - Include file name and metadata in vector
    - _Requirements: 3.2.1_
  
  - [ ] 7.1.3 Run database migration
    - Generate and apply migration
    - Test on development database
    - _Requirements: 3.2.1_


- [ ] 7.2 Implement semantic search service (uses embeddings from Phase 0)
  - [ ] 7.2.1 Create server/services/semanticSearchService.ts
    - Implement search() method using vector similarity
    - Implement hybrid search (full-text + semantic)
    - Use embeddings generated in Phase 0
    - Filter results by user permissions
    - _Requirements: 3.2.1, 3.2.7, 3.2.8_
  
  - [ ] 7.2.2 Create server/services/searchService.ts
    - Implement search() method with PostgreSQL full-text search
    - Combine results from semantic and full-text search
    - Implement indexFile() method
    - Implement removeFromIndex() method
    - Implement updateIndex() method
    - Filter results by user permissions
    - _Requirements: 3.2.1, 3.2.2, 3.2.3_
  
  - [ ]* 7.2.2 Write property test for search query matching
    - **Property 29: Search Query Matching**
    - **Validates: Requirements 3.2.1**
  
  - [ ]* 7.2.3 Write property test for search filters
    - **Property 30: Search Filter Correctness**
    - **Validates: Requirements 3.2.2**
  
  - [ ]* 7.2.4 Write property test for folder-scoped search
    - **Property 31: Folder-Scoped Search**
    - **Validates: Requirements 3.2.3**
  
  - [ ]* 7.2.5 Write property test for permission filtering
    - **Property 32: Search Permission Filtering**
    - **Validates: Requirements 3.2.1** (security)

- [ ] 7.3 Implement search indexing background job
  - [ ] 7.3.1 Create search indexing worker
    - Create server/jobs/workers/searchIndexing.ts
    - Index files on creation/update
    - Remove from index on deletion
    - _Requirements: 3.2.1_
  
  - [ ]* 7.3.2 Write unit tests for search indexing
    - Test index updates on file changes
    - Test removal on file deletion
    - _Requirements: 3.2.1_

- [ ] 7.4 Implement search API endpoints
  - [ ] 7.4.1 Add GET /api/search endpoint
    - Implement full-text search with query parameter
    - Add filters (type, mimeType, tags, size, date range, folder, sensitivity)
    - Add pagination (limit, offset)
    - Filter results by user permissions
    - Support boolean operators (AND, OR, NOT)
    - _Requirements: 3.2.1, 3.2.2, 3.2.3, 3.2.6_
  
  - [ ] 7.4.2 Add GET /api/search/semantic endpoint
    - Implement natural language semantic search
    - Use query embeddings from Phase 0
    - Return results ordered by relevance
    - Support similar queries suggestions
    - _Requirements: 3.2.7, 3.2.8_
  
  - [ ]* 7.4.3 Write integration tests for search API
    - Test full-text search returns matching files
    - Test semantic search returns relevant results
    - Test filters work correctly
    - Test folder-scoped search works
    - Test permission filtering works
    - Test boolean operators work
    - Test hybrid search combines both methods
    - _Requirements: 3.2.1, 3.2.2, 3.2.3, 3.2.6, 3.2.7, 3.2.8_


- [ ] 7.5 Create advanced search UI component
  - [ ] 7.5.1 Create client/src/components/AdvancedSearch.tsx
    - Add search input with autocomplete
    - Add advanced filters panel (collapsible)
    - Add date range picker
    - Add file type filter
    - Add tag filter with multi-select
    - Add size range slider
    - Add save search queries feature
    - Show search history
    - _Requirements: 3.2.1, 3.2.2, 3.2.3, 3.2.4, 3.2.5, 3.2.6_
  
  - [ ]* 7.5.2 Write component tests for AdvancedSearch
    - Test search input works
    - Test filters apply correctly
    - Test saved searches work
    - _Requirements: 3.2.1, 3.2.2, 3.2.4_

- [ ] 7.6 Checkpoint - Search Complete
  - Ensure all search tests pass
  - Verify search returns relevant results
  - Check filters work correctly
  - Verify permission filtering works
  - Ask user if questions arise

---

### 8. File Preview

- [ ] 8.1 Implement preview generation
  - [ ] 8.1.1 Install preview dependencies
    - Add pdf-lib for PDF preview
    - Add Sharp for image thumbnails
    - Add ffmpeg for video thumbnails
    - _Requirements: 3.3.1_
  
  - [ ] 8.1.2 Create server/services/previewService.ts
    - Implement generatePdfPreview() method
    - Implement generateImageThumbnail() method
    - Implement generateVideoThumbnail() method
    - Cache previews in GCS
    - _Requirements: 3.3.1, 3.3.4, 3.3.5_
  
  - [ ]* 8.1.3 Write unit tests for preview generation
    - Test PDF preview generation
    - Test image thumbnail generation
    - Test video thumbnail generation
    - _Requirements: 3.3.1, 3.3.4, 3.3.5_


- [ ] 8.2 Implement preview API endpoints
  - [ ] 8.2.1 Add GET /api/files/:fileId/preview endpoint
    - Generate or retrieve cached preview
    - Return preview URL or inline content
    - Require 'view' permission on file
    - _Requirements: 3.3.1_
  
  - [ ] 8.2.2 Add GET /api/files/:fileId/thumbnail endpoint
    - Generate or retrieve cached thumbnail
    - Return thumbnail URL
    - Require 'view' permission on file
    - _Requirements: 3.3.1_
  
  - [ ]* 8.2.3 Write integration tests for preview API
    - Test preview generation works
    - Test thumbnail generation works
    - Test caching works
    - Test permission checks work
    - _Requirements: 3.3.1_

- [ ] 8.3 Create file preview UI component
  - [ ] 8.3.1 Create client/src/components/FilePreview.tsx
    - Display preview in modal or dedicated page
    - Add navigation between files in same folder
    - Add zoom and pan for images/PDFs
    - Add video player with playback controls
    - Show fallback message for unsupported file types
    - _Requirements: 3.3.1, 3.3.2, 3.3.3, 3.3.4, 3.3.5, 3.3.6_
  
  - [ ]* 8.3.2 Write component tests for FilePreview
    - Test preview renders correctly
    - Test navigation works
    - Test zoom/pan works
    - Test video player works
    - _Requirements: 3.3.1, 3.3.2, 3.3.3, 3.3.4, 3.3.5_

- [ ] 8.4 Checkpoint - File Preview Complete
  - Ensure all preview tests pass
  - Verify preview generation works for supported types
  - Check preview caching improves performance
  - Verify preview UI works correctly
  - Ask user if questions arise

---

### 9. Bulk Operations

- [ ] 9.1 Implement bulk download
  - [ ] 9.1.1 Create bulk download background job
    - Create server/jobs/workers/bulkDownload.ts
    - Create ZIP archive with selected files
    - Upload ZIP to GCS
    - Generate presigned URL with 24-hour expiration
    - Track progress
    - _Requirements: 3.4.2_
  
  - [ ] 9.1.2 Add POST /api/bulk/download endpoint
    - Accept fileIds and folderIds
    - Create background job
    - Return jobId
    - _Requirements: 3.4.2_
  
  - [ ] 9.1.3 Add GET /api/bulk/download/:jobId endpoint
    - Check job status
    - Return download URL when complete
    - _Requirements: 3.4.2_
  
  - [ ]* 9.1.4 Write property test for bulk download completeness
    - **Property 34: Bulk Download Completeness**
    - **Validates: Requirements 3.4.2**
  
  - [ ]* 9.1.5 Write integration tests for bulk download
    - Test bulk download creates ZIP
    - Test ZIP contains all files
    - Test progress tracking works
    - _Requirements: 3.4.2_

- [ ] 9.2 Implement bulk delete
  - [ ] 9.2.1 Add POST /api/bulk/delete endpoint
    - Accept fileIds and folderIds
    - Check permissions on all items
    - Delete all items in transaction
    - Create audit log entries
    - Return count of deleted items
    - _Requirements: 3.4.3_
  
  - [ ]* 9.2.2 Write property test for bulk delete atomicity
    - **Property 35: Bulk Delete Atomicity**
    - **Validates: Requirements 3.4.3**
  
  - [ ]* 9.2.3 Write integration tests for bulk delete
    - Test bulk delete removes all items
    - Test transaction rollback on error
    - Test permission checks work
    - _Requirements: 3.4.3_


- [ ] 9.3 Implement bulk move
  - [ ] 9.3.1 Add POST /api/bulk/move endpoint
    - Accept fileIds, folderIds, and targetFolderId
    - Check permissions on all items
    - Update folderId for all items
    - Update paths
    - Create audit log entries
    - _Requirements: 3.4.4_
  
  - [ ]* 9.3.2 Write property test for bulk move consistency
    - **Property 36: Bulk Move Consistency**
    - **Validates: Requirements 3.4.4**
  
  - [ ]* 9.3.3 Write integration tests for bulk move
    - Test bulk move updates all items
    - Test paths are updated correctly
    - Test permission checks work
    - _Requirements: 3.4.4_

- [ ] 9.4 Implement bulk share link generation
  - [ ] 9.4.1 Add POST /api/bulk/share endpoint
    - Accept fileIds and share link options
    - Create share link for each file
    - Return all share links
    - _Requirements: 3.4.5_
  
  - [ ]* 9.4.2 Write property test for bulk share link creation
    - **Property 37: Bulk Share Link Creation**
    - **Validates: Requirements 3.4.5**
  
  - [ ]* 9.4.3 Write integration tests for bulk share
    - Test bulk share creates links for all files
    - Test share link options are applied
    - _Requirements: 3.4.5_

- [ ] 9.5 Create bulk operations toolbar UI
  - [ ] 9.5.1 Create client/src/components/BulkOperationsToolbar.tsx
    - Show fixed toolbar when items selected
    - Add action buttons (download, delete, move, share)
    - Show selection count
    - Add clear selection button
    - Show progress indicator for async operations
    - _Requirements: 3.4.1, 3.4.2, 3.4.3, 3.4.4, 3.4.5, 3.4.6_
  
  - [ ]* 9.5.2 Write component tests for BulkOperationsToolbar
    - Test toolbar shows when items selected
    - Test action buttons work
    - Test progress indicator works
    - _Requirements: 3.4.1, 3.4.2, 3.4.3, 3.4.4, 3.4.5_

- [ ] 9.6 Checkpoint - Bulk Operations Complete
  - Ensure all bulk operation tests pass
  - Verify bulk download, delete, move, and share work
  - Check progress tracking works
  - Verify permission checks work
  - Ask user if questions arise

---

## Phase 3: Organization & Teams (Q3 2026)

### 10. File Tags and Metadata

- [ ] 10.1 Create tags database schema
  - [ ] 10.1.1 Add tags and fileTags tables to shared/schema.ts
    - Define tags table with id, name, userId, color, createdAt
    - Define fileTags table with id, fileId, tagId, createdAt
    - Add indexes and unique constraints
    - Add foreign keys with cascade delete
    - _Requirements: 3.5.1, 3.5.2_
  
  - [ ] 10.1.2 Add fileMetadata table to shared/schema.ts
    - Define table with id, fileId, key, value, createdAt
    - Add unique constraint on (fileId, key)
    - _Requirements: 3.5.4_
  
  - [ ] 10.1.3 Run database migration
    - Generate and apply migration
    - Test on development database
    - _Requirements: 3.5.1, 3.5.4_

- [ ] 10.2 Implement tag CRUD API endpoints
  - [ ] 10.2.1 Add GET /api/tags endpoint
    - List user's tags with file counts
    - _Requirements: 3.5.2_
  
  - [ ] 10.2.2 Add POST /api/tags endpoint
    - Create new tag
    - Validate tag name uniqueness per user
    - _Requirements: 3.5.1_
  
  - [ ] 10.2.3 Add PUT /api/tags/:tagId endpoint
    - Update tag name or color
    - _Requirements: 3.5.6_
  
  - [ ] 10.2.4 Add DELETE /api/tags/:tagId endpoint
    - Delete tag and all file associations
    - _Requirements: 3.5.6_
  
  - [ ]* 10.2.5 Write property test for tag rename propagation
    - **Property 42: Tag Rename Propagation**
    - **Validates: Requirements 3.5.6**
  
  - [ ]* 10.2.6 Write integration tests for tag API
    - Test create tag works
    - Test list tags returns all user tags
    - Test update tag works
    - Test delete tag removes associations
    - _Requirements: 3.5.1, 3.5.2, 3.5.6_


- [ ] 10.3 Implement file tagging API endpoints
  - [ ] 10.3.1 Add POST /api/files/:fileId/tags endpoint
    - Add tags to file
    - Require 'edit' permission on file
    - _Requirements: 3.5.1_
  
  - [ ] 10.3.2 Add DELETE /api/files/:fileId/tags/:tagId endpoint
    - Remove tag from file
    - Require 'edit' permission on file
    - _Requirements: 3.5.1_
  
  - [ ] 10.3.3 Add GET /api/files endpoint with tag filter
    - Filter files by tags
    - Support multiple tag filters
    - _Requirements: 3.5.3_
  
  - [ ]* 10.3.4 Write property test for multiple tags per file
    - **Property 38: Multiple Tags Per File**
    - **Validates: Requirements 3.5.1**
  
  - [ ]* 10.3.5 Write property test for tag filtering
    - **Property 39: Tag Filtering Correctness**
    - **Validates: Requirements 3.5.3**
  
  - [ ]* 10.3.6 Write integration tests for file tagging
    - Test add tags to file works
    - Test remove tag from file works
    - Test filter files by tags works
    - _Requirements: 3.5.1, 3.5.3_

- [ ] 10.4 Implement file metadata API endpoints
  - [ ] 10.4.1 Add POST /api/files/:fileId/metadata endpoint
    - Set custom metadata key-value pairs
    - Require 'edit' permission on file
    - _Requirements: 3.5.4_
  
  - [ ] 10.4.2 Add GET /api/files/:fileId/metadata endpoint
    - Get all metadata for file
    - Require 'view' permission on file
    - _Requirements: 3.5.4_
  
  - [ ]* 10.4.3 Write property test for metadata round-trip
    - **Property 40: Metadata Round-Trip**
    - **Validates: Requirements 3.5.4**
  
  - [ ]* 10.4.4 Write integration tests for file metadata
    - Test set metadata works
    - Test get metadata returns correct values
    - _Requirements: 3.5.4_


- [ ] 10.5 Implement bulk tag operations
  - [ ] 10.5.1 Add POST /api/bulk/tag endpoint
    - Add tags to multiple files
    - Check permissions on all files
    - _Requirements: 3.5.5_
  
  - [ ] 10.5.2 Add POST /api/bulk/untag endpoint
    - Remove tags from multiple files
    - Check permissions on all files
    - _Requirements: 3.5.5_
  
  - [ ]* 10.5.3 Write property test for bulk tag operations
    - **Property 41: Bulk Tag Operation Consistency**
    - **Validates: Requirements 3.5.5**
  
  - [ ]* 10.5.4 Write integration tests for bulk tag operations
    - Test bulk tag adds tags to all files
    - Test bulk untag removes tags from all files
    - _Requirements: 3.5.5_

- [ ] 10.6 Create tag manager UI component
  - [ ] 10.6.1 Create client/src/components/TagManager.tsx
    - Add tag input with autocomplete
    - Add color picker for new tags
    - Display tag chips with remove button
    - Add bulk tag operations
    - Show tag usage statistics
    - _Requirements: 3.5.1, 3.5.2, 3.5.3, 3.5.5, 3.5.6_
  
  - [ ]* 10.6.2 Write component tests for TagManager
    - Test tag input works
    - Test autocomplete works
    - Test tag chips render correctly
    - _Requirements: 3.5.1, 3.5.2_

- [ ] 10.7 Checkpoint - Tags and Metadata Complete
  - Ensure all tag tests pass
  - Verify tag creation, assignment, and filtering work
  - Check metadata storage and retrieval work
  - Verify bulk tag operations work
  - Ask user if questions arise

---

### 11. Team Workspaces

- [ ] 11.1 Create workspaces database schema
  - [ ] 11.1.1 Add workspaces and workspaceMembers tables to shared/schema.ts
    - Define workspaces table with id, name, description, ownerId, storageQuota, createdAt
    - Define workspaceMembers table with id, workspaceId, userId, role, createdAt
    - Add indexes and unique constraints
    - Add foreign keys with cascade delete
    - _Requirements: 4.1.1, 4.1.2_
  
  - [ ] 11.1.2 Run database migration
    - Generate and apply migration
    - Test on development database
    - _Requirements: 4.1.1_

- [ ] 11.2 Implement workspace CRUD API endpoints
  - [ ] 11.2.1 Add POST /api/workspaces endpoint
    - Create new workspace
    - Set creator as owner
    - _Requirements: 4.1.1_
  
  - [ ] 11.2.2 Add GET /api/workspaces endpoint
    - List user's workspaces
    - Include role and member count
    - _Requirements: 4.1.1_
  
  - [ ] 11.2.3 Add GET /api/workspaces/:workspaceId endpoint
    - Get workspace details
    - Include members and storage usage
    - _Requirements: 4.1.1, 4.1.4_
  
  - [ ] 11.2.4 Add PUT /api/workspaces/:workspaceId endpoint
    - Update workspace name, description, or quota
    - Require admin role
    - _Requirements: 4.1.1, 4.1.3_
  
  - [ ] 11.2.5 Add DELETE /api/workspaces/:workspaceId endpoint
    - Delete workspace and all contents
    - Require owner role
    - _Requirements: 4.1.1_
  
  - [ ]* 11.2.6 Write integration tests for workspace API
    - Test create workspace works
    - Test list workspaces returns user workspaces
    - Test update workspace works
    - Test delete workspace works
    - _Requirements: 4.1.1, 4.1.3_


- [ ] 11.3 Implement workspace member management
  - [ ] 11.3.1 Add POST /api/workspaces/:workspaceId/members endpoint
    - Invite user to workspace
    - Send email invitation
    - Require admin role
    - _Requirements: 4.1.2, 4.1.5_
  
  - [ ] 11.3.2 Add PUT /api/workspaces/:workspaceId/members/:userId endpoint
    - Update member role
    - Require admin role
    - _Requirements: 4.1.2_
  
  - [ ] 11.3.3 Add DELETE /api/workspaces/:workspaceId/members/:userId endpoint
    - Remove member from workspace
    - Require admin role
    - _Requirements: 4.1.2_
  
  - [ ] 11.3.4 Add PUT /api/workspaces/:workspaceId/owner endpoint
    - Transfer workspace ownership
    - Require owner role
    - _Requirements: 4.1.6_
  
  - [ ]* 11.3.5 Write integration tests for member management
    - Test invite member works
    - Test update member role works
    - Test remove member works
    - Test transfer ownership works
    - _Requirements: 4.1.2, 4.1.5, 4.1.6_

- [ ] 11.4 Implement workspace-scoped file operations
  - [ ] 11.4.1 Add workspaceId column to files and folders tables
    - Add nullable workspaceId column
    - Add index on workspaceId
    - _Requirements: 4.1.1_
  
  - [ ] 11.4.2 Update file operations to support workspaces
    - Filter files by workspace
    - Check workspace membership for access
    - Enforce workspace storage quotas
    - _Requirements: 4.1.1, 4.1.3_
  
  - [ ]* 11.4.3 Write integration tests for workspace files
    - Test workspace members can access files
    - Test non-members cannot access files
    - Test storage quota enforcement works
    - _Requirements: 4.1.1, 4.1.3_


- [ ] 11.5 Create workspace management UI
  - [ ] 11.5.1 Create client/src/components/WorkspaceManager.tsx
    - Display workspace list
    - Add create workspace form
    - Add workspace settings modal
    - Show member list with roles
    - Add invite member form
    - Show storage usage
    - _Requirements: 4.1.1, 4.1.2, 4.1.3, 4.1.4, 4.1.5_
  
  - [ ] 11.5.2 Create workspace activity dashboard
    - Show recent activity in workspace
    - Display storage usage chart
    - Show member activity
    - _Requirements: 4.1.4_
  
  - [ ]* 11.5.3 Write component tests for WorkspaceManager
    - Test workspace list renders
    - Test create workspace works
    - Test member management works
    - _Requirements: 4.1.1, 4.1.2_

- [ ] 11.6 Checkpoint - Workspaces Complete
  - Ensure all workspace tests pass
  - Verify workspace creation and management work
  - Check member management works
  - Verify workspace-scoped files work
  - Ask user if questions arise

---

### 12. Advanced Share Link Options

- [ ] 12.1 Extend share links schema
  - [ ] 12.1.1 Add columns to shareLinks table
    - Add downloadLimit (max downloads)
    - Add requireEmailVerification boolean
    - Add watermarkEnabled boolean
    - Add viewOnly boolean (disable download)
    - Add customBranding JSON
    - _Requirements: 4.5.1, 4.5.2, 4.5.3, 4.5.4, 4.5.5_
  
  - [ ] 12.1.2 Add shareAnalytics table
    - Define table with id, shareLinkId, viewCount, downloadCount, viewerIp, viewerLocation, createdAt
    - Add indexes on shareLinkId and createdAt
    - _Requirements: 4.5.6_
  
  - [ ] 12.1.3 Run database migration
    - Generate and apply migration
    - Test on development database
    - _Requirements: 4.5.1, 4.5.6_


- [ ] 12.2 Implement download limit enforcement
  - [ ] 12.2.1 Update share link download handler
    - Check downloadLimit before allowing download
    - Increment download count
    - Return error if limit exceeded
    - _Requirements: 4.5.1_
  
  - [ ]* 12.2.2 Write unit tests for download limit
    - Test download allowed when under limit
    - Test download denied when limit exceeded
    - _Requirements: 4.5.1_

- [ ] 12.3 Implement email verification for share links
  - [ ] 12.3.1 Add email verification flow
    - Require email before showing file
    - Send verification code via email
    - Validate code before granting access
    - _Requirements: 4.5.2_
  
  - [ ]* 12.3.2 Write integration tests for email verification
    - Test email verification required
    - Test valid code grants access
    - Test invalid code denies access
    - _Requirements: 4.5.2_

- [ ] 12.4 Implement watermarking
  - [ ] 12.4.1 Add watermark service
    - Create server/services/watermarkService.ts
    - Implement watermarkPdf() method
    - Implement watermarkImage() method
    - Include recipient email and timestamp in watermark
    - _Requirements: 4.5.3_
  
  - [ ] 12.4.2 Update share link handler to apply watermarks
    - Apply watermark when watermarkEnabled is true
    - Cache watermarked versions
    - _Requirements: 4.5.3_
  
  - [ ]* 12.4.3 Write unit tests for watermarking
    - Test watermark applied to PDFs
    - Test watermark applied to images
    - _Requirements: 4.5.3_

- [ ] 12.5 Implement view-only links
  - [ ] 12.5.1 Update share link handler for view-only
    - Disable download button when viewOnly is true
    - Prevent direct file download
    - Show preview only
    - _Requirements: 4.5.4_
  
  - [ ]* 12.5.2 Write integration tests for view-only links
    - Test download disabled for view-only links
    - Test preview works for view-only links
    - _Requirements: 4.5.4_


- [ ] 12.6 Implement share link analytics
  - [ ] 12.6.1 Track share link views and downloads
    - Record view and download events
    - Capture IP address and location
    - Store in shareAnalytics table
    - _Requirements: 4.5.6_
  
  - [ ] 12.6.2 Add GET /api/share-links/:shareLinkId/analytics endpoint
    - Return view and download counts
    - Include geographic data
    - Show timeline of access
    - Require file ownership
    - _Requirements: 4.5.6_
  
  - [ ]* 12.6.3 Write integration tests for analytics
    - Test analytics tracking works
    - Test analytics API returns correct data
    - _Requirements: 4.5.6_

- [ ] 12.7 Update share dialog UI
  - [ ] 12.7.1 Update client/src/components/ShareDialog.tsx
    - Add download limit input
    - Add email verification toggle
    - Add watermark toggle
    - Add view-only toggle
    - Add custom branding options
    - Show analytics summary
    - _Requirements: 4.5.1, 4.5.2, 4.5.3, 4.5.4, 4.5.5, 4.5.6_
  
  - [ ]* 12.7.2 Write component tests for ShareDialog
    - Test new options render correctly
    - Test options are saved correctly
    - _Requirements: 4.5.1, 4.5.2, 4.5.3, 4.5.4, 4.5.5_

- [ ] 12.8 Checkpoint - Advanced Share Links Complete
  - Ensure all share link tests pass
  - Verify download limits work
  - Check email verification works
  - Verify watermarking works
  - Check view-only links work
  - Verify analytics tracking works
  - Ask user if questions arise

---

## Phase 4: Security & Performance (Q4 2026)

### 13. Security Enhancements

- [ ] 13.1 Implement file encryption at rest
  - [ ] 13.1.1 Add encryption service
    - Create server/services/encryptionService.ts
    - Implement AES-256-GCM encryption
    - Encrypt files before uploading to GCS
    - Decrypt files on download
    - _Requirements: 6.2.1_
  
  - [ ]* 13.1.2 Write property test for encryption
    - **Property 43: File Encryption at Rest**
    - **Validates: Requirements 6.2.1**
  
  - [ ]* 13.1.3 Write unit tests for encryption service
    - Test encryption/decryption round-trip
    - Test different file sizes
    - _Requirements: 6.2.1_


- [ ] 13.2 Implement multi-factor authentication (MFA)
  - [ ] 13.2.1 Add MFA schema
    - Add mfaEnabled and mfaSecret columns to users table
    - _Requirements: 6.2.3_
  
  - [ ] 13.2.2 Implement MFA service
    - Create server/services/mfaService.ts
    - Implement TOTP generation and verification
    - Add MFA setup and verification endpoints
    - _Requirements: 6.2.3_
  
  - [ ] 13.2.3 Add MFA enforcement to authentication
    - Require MFA token when enabled
    - Reject authentication without valid token
    - _Requirements: 6.2.3_
  
  - [ ]* 13.2.4 Write property test for MFA enforcement
    - **Property 44: MFA Enforcement**
    - **Validates: Requirements 6.2.3**
  
  - [ ]* 13.2.5 Write integration tests for MFA
    - Test MFA setup works
    - Test authentication requires MFA when enabled
    - Test invalid MFA token rejected
    - _Requirements: 6.2.3_

- [ ] 13.3 Implement IP whitelisting
  - [ ] 13.3.1 Add IP whitelist schema
    - Add ipWhitelist JSON column to users or organizations table
    - _Requirements: 6.2.4_
  
  - [ ] 13.3.2 Add IP whitelist middleware
    - Check request IP against whitelist
    - Reject requests from non-whitelisted IPs
    - _Requirements: 6.2.4_
  
  - [ ]* 13.3.3 Write property test for IP whitelist
    - **Property 45: IP Whitelist Enforcement**
    - **Validates: Requirements 6.2.4**
  
  - [ ]* 13.3.4 Write integration tests for IP whitelist
    - Test whitelisted IPs allowed
    - Test non-whitelisted IPs rejected
    - _Requirements: 6.2.4_

- [ ] 13.4 Implement session timeout
  - [ ] 13.4.1 Add session timeout configuration
    - Set session maxAge in session config
    - Add automatic logout on timeout
    - _Requirements: 6.2.5_
  
  - [ ]* 13.4.2 Write property test for session timeout
    - **Property 46: Session Timeout**
    - **Validates: Requirements 6.2.5**
  
  - [ ]* 13.4.3 Write integration tests for session timeout
    - Test session expires after timeout
    - Test requests after timeout require re-authentication
    - _Requirements: 6.2.5_


- [ ] 13.5 Enhance CSRF protection
  - [ ] 13.5.1 Implement CSRF token middleware
    - Add csurf middleware to all state-changing routes
    - Generate CSRF tokens for authenticated users
    - Validate tokens on POST/PUT/DELETE requests
    - _Requirements: 6.2.6_
  
  - [ ] 13.5.2 Add GET /api/csrf-token endpoint
    - Return CSRF token for client
    - _Requirements: 6.2.6_
  
  - [ ]* 13.5.3 Write property test for CSRF protection
    - **Property 47: CSRF Protection**
    - **Validates: Requirements 6.2.6**
  
  - [ ]* 13.5.4 Write integration tests for CSRF
    - Test requests with valid token succeed
    - Test requests without token fail
    - Test requests with invalid token fail
    - _Requirements: 6.2.6_

- [ ] 13.6 Checkpoint - Security Enhancements Complete
  - Ensure all security tests pass
  - Verify encryption works
  - Check MFA enforcement works
  - Verify IP whitelisting works
  - Check session timeout works
  - Verify CSRF protection works
  - Ask user if questions arise

---

### 14. Performance Optimization

- [ ] 14.1 Implement database query optimization
  - [ ] 14.1.1 Add missing indexes
    - Review slow query log
    - Add indexes for frequently queried columns
    - Add composite indexes for common filter combinations
    - _Requirements: 6.1.5_
  
  - [ ] 14.1.2 Optimize N+1 queries
    - Use Drizzle with() for eager loading
    - Batch queries where possible
    - _Requirements: 6.1.5_
  
  - [ ]* 14.1.3 Write performance tests
    - Test API response times meet SLA (p95 < 500ms)
    - Test database query times
    - _Requirements: 6.1.5_

- [ ] 14.2 Implement caching strategy
  - [ ] 14.2.1 Create cache manager
    - Create server/cache/cacheManager.ts
    - Implement multi-layer cache (memory + Redis)
    - Add cache invalidation logic
    - _Requirements: 6.3.4_
  
  - [ ] 14.2.2 Add caching to hot paths
    - Cache file metadata
    - Cache permission checks
    - Cache user data
    - Cache search results
    - _Requirements: 6.3.4_
  
  - [ ]* 14.2.3 Write unit tests for cache manager
    - Test cache get/set/invalidate works
    - Test cache expiration works
    - _Requirements: 6.3.4_


- [ ] 14.3 Implement database connection pooling
  - [ ] 14.3.1 Configure connection pool
    - Set max pool size to 20
    - Configure idle timeout
    - Configure connection timeout
    - _Requirements: 6.3.1_
  
  - [ ] 14.3.2 Add read replica support (optional)
    - Configure read replica connection
    - Route read queries to replica
    - _Requirements: 6.3.2_
  
  - [ ]* 14.3.3 Write integration tests for connection pooling
    - Test concurrent requests work
    - Test connection pool doesn't exhaust
    - _Requirements: 6.3.1_

- [ ] 14.4 Implement CDN integration
  - [ ] 14.4.1 Configure CDN for static assets
    - Set up CDN (CloudFlare, AWS CloudFront)
    - Configure cache headers
    - _Requirements: 6.3.3_
  
  - [ ] 14.4.2 Use CDN for file downloads (optional)
    - Route public file downloads through CDN
    - Configure cache invalidation
    - _Requirements: 6.3.3_

- [ ] 14.5 Implement monitoring and alerting
  - [ ] 14.5.1 Set up Prometheus metrics
    - Add prometheus-client dependency
    - Expose /metrics endpoint
    - Add custom metrics for key operations
    - _Requirements: Monitoring_
  
  - [ ] 14.5.2 Set up health check endpoint
    - Add /health endpoint
    - Check database, Redis, and GCS connectivity
    - Return 503 if any check fails
    - _Requirements: Monitoring_
  
  - [ ] 14.5.3 Configure alerting rules
    - Set up alerts for error rate, latency, and availability
    - Configure notification channels (email, Slack)
    - _Requirements: Monitoring_

- [ ] 14.6 Checkpoint - Performance Optimization Complete
  - Ensure all performance tests pass
  - Verify API response times meet SLA
  - Check caching improves performance
  - Verify monitoring and alerting work
  - Ask user if questions arise

---

## Final Integration and Documentation

### 15. End-to-End Testing

- [ ] 15.1 Write end-to-end workflow tests
  - [ ]* 15.1.1 Test complete collaboration workflow
    - Owner uploads file
    - Owner grants permission to collaborator
    - Collaborator adds comment
    - Owner receives notification
    - Owner replies to comment
    - Verify audit logs created
    - _Requirements: Multiple features integration_
  
  - [ ]* 15.1.2 Test complete version control workflow
    - User uploads file
    - User updates file (creates version 2)
    - User updates file again (creates version 3)
    - User restores version 1
    - Verify version 4 created with version 1 content
    - _Requirements: 2.1.1, 2.1.4_
  
  - [ ]* 15.1.3 Test complete workspace workflow
    - Admin creates workspace
    - Admin invites members
    - Members upload files to workspace
    - Members collaborate on files
    - Verify workspace storage quota enforced
    - _Requirements: 4.1.1, 4.1.2, 4.1.3_

### 16. Documentation

- [ ] 16.1 Update API documentation
  - [ ] 16.1.1 Document all new API endpoints in docs/api/
    - Version control endpoints
    - Permission endpoints
    - Audit log endpoints
    - Comment endpoints
    - Notification endpoints
    - Search endpoints
    - Bulk operation endpoints
    - Tag endpoints
    - Workspace endpoints
    - Share link endpoints
    - _Requirements: Documentation_
  
  - [ ] 16.1.2 Add API examples and code snippets
    - Include request/response examples
    - Add error code documentation
    - _Requirements: Documentation_

- [ ] 16.2 Update architecture documentation
  - [ ] 16.2.1 Update docs/architecture/ with new components
    - Document new database tables
    - Document new services
    - Update data flow diagrams
    - Document WebSocket architecture
    - Document background job architecture
    - _Requirements: Documentation_
  
  - [ ] 16.2.2 Document security considerations
    - Update docs/security/ with new features
    - Document encryption implementation
    - Document MFA implementation
    - Document permission system
    - _Requirements: Documentation_


- [ ] 16.3 Create user documentation
  - [ ] 16.3.1 Write user guides in docs/user-guides/
    - File version control guide
    - Permission management guide
    - Commenting guide
    - Notification preferences guide
    - Advanced search guide
    - Bulk operations guide
    - Tag management guide
    - Workspace collaboration guide
    - Advanced share link options guide
    - _Requirements: Documentation_
  
  - [ ] 16.3.2 Create video tutorials (optional)
    - Record screen captures for key features
    - Add to documentation site
    - _Requirements: Documentation_

- [ ] 16.4 Update developer documentation
  - [ ] 16.4.1 Update docs/development/ with new patterns
    - Property-based testing guide
    - Background job patterns
    - WebSocket integration guide
    - Caching strategies
    - _Requirements: Documentation_
  
  - [ ] 16.4.2 Update AGENTS.md with new features
    - Add new features to feature list
    - Update task priorities
    - Document new testing requirements
    - _Requirements: Documentation_

### 17. Deployment Preparation

- [ ] 17.1 Set up feature flags
  - [ ] 17.1.1 Create feature flag configuration
    - Add environment variables for each feature
    - Create feature flag middleware
    - Document feature flag usage
    - _Requirements: Deployment_
  
  - [ ] 17.1.2 Test feature flag toggling
    - Verify features can be enabled/disabled
    - Test graceful degradation when disabled
    - _Requirements: Deployment_

- [ ] 17.2 Prepare database migrations
  - [ ] 17.2.1 Review all migrations
    - Ensure migrations are idempotent
    - Test rollback procedures
    - Document migration order
    - _Requirements: Deployment_
  
  - [ ] 17.2.2 Create migration runbook
    - Document pre-migration steps
    - Document post-migration verification
    - Document rollback procedures
    - _Requirements: Deployment_


- [ ] 17.3 Prepare production environment
  - [ ] 17.3.1 Set up production infrastructure
    - Provision Redis instance
    - Configure email service (SendGrid, AWS SES)
    - Set up monitoring (Prometheus, Grafana)
    - Configure alerting
    - _Requirements: Deployment_
  
  - [ ] 17.3.2 Configure production environment variables
    - Set all required environment variables
    - Configure feature flags
    - Set security settings (session timeout, CSRF)
    - _Requirements: Deployment_
  
  - [ ] 17.3.3 Test production deployment
    - Deploy to staging environment
    - Run smoke tests
    - Verify all features work
    - Load test critical paths
    - _Requirements: Deployment_

- [ ] 17.4 Create rollback plan
  - [ ] 17.4.1 Document rollback procedures
    - Database rollback steps
    - Code rollback steps
    - Feature flag rollback
    - _Requirements: Deployment_
  
  - [ ] 17.4.2 Test rollback procedures
    - Practice rollback in staging
    - Verify data integrity after rollback
    - _Requirements: Deployment_

### 18. Final Checkpoint

- [ ] 18.1 Comprehensive testing
  - Run all unit tests (target: 90%+ coverage)
  - Run all property tests (100 iterations each)
  - Run all integration tests
  - Run all end-to-end tests
  - Verify all tests pass

- [ ] 18.2 Performance verification
  - Verify API response times meet SLA (p95 < 500ms)
  - Verify WebSocket latency < 100ms
  - Verify search query latency < 2s
  - Verify bulk operations complete in reasonable time

- [ ] 18.3 Security audit
  - Review all authentication and authorization code
  - Verify encryption implementation
  - Check for SQL injection vulnerabilities
  - Verify CSRF protection
  - Review audit logging coverage

- [ ] 18.4 Documentation review
  - Verify all API endpoints documented
  - Check architecture docs are up to date
  - Ensure user guides are complete
  - Review developer documentation

- [ ] 18.5 Production readiness checklist
  - All tests passing
  - Performance targets met
  - Security audit complete
  - Documentation complete
  - Monitoring and alerting configured
  - Rollback plan tested
  - Feature flags configured
  - Production environment ready

---

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- Integration tests validate component interactions
- End-to-end tests validate complete user workflows

## Estimated Timeline

- **Phase 1** (Critical Enterprise Features): 11-15 weeks (Q1 2026)
- **Phase 2** (Collaboration & Productivity): 10-14 weeks (Q2 2026)
- **Phase 3** (Organization & Teams): 11-15 weeks (Q3 2026)
- **Phase 4** (Security & Performance): 8-10 weeks (Q4 2026)
- **Total**: 40-54 weeks (10-13 months)

## Success Criteria

- All critical enterprise features (Phase 1) implemented and tested
- 90%+ test coverage for core features
- API response times meet SLA (p95 < 500ms)
- All security features implemented and audited
- Comprehensive documentation complete
- Production deployment successful with zero downtime
- User adoption of new features > 50% within 3 months

