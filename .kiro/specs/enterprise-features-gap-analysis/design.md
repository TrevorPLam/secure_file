# Enterprise Features Gap Analysis - Design Document

## 1. Overview

### 1.1 Purpose
This design document provides the technical architecture and implementation approach for adding enterprise-grade features to CloudVault. The design addresses the gap analysis requirements to make CloudVault competitive with ShareFile, Box, and Dropbox Business.

### 1.2 Design Principles
- **Incremental Implementation**: Features can be implemented independently with minimal dependencies
- **Backward Compatibility**: Existing functionality remains unchanged
- **Performance First**: Design for scale from the start (1000+ concurrent users)
- **Security by Default**: All features include security considerations
- **Type Safety**: Leverage TypeScript and Drizzle ORM for compile-time safety
- **Testability**: Design for property-based testing where applicable

### 1.3 Architecture Overview
The design maintains CloudVault's existing monolithic architecture while adding:
- Extended database schema for new entities (versions, permissions, audit logs, comments, tags)
- New API endpoints following RESTful conventions
- Real-time communication layer (WebSocket/SSE) for notifications
- Background job processing for async operations (version pruning, notifications)
- Search indexing layer (PostgreSQL full-text search initially, Elasticsearch for scale)

### 1.4 Technology Stack Additions
- **Real-time**: Socket.io or Server-Sent Events (SSE)
- **Background Jobs**: BullMQ with Redis
- **Search**: PostgreSQL full-text search (Phase 1), Elasticsearch (Phase 2+)
- **Caching**: Redis for session store and query caching
- **File Processing**: Sharp for image thumbnails, pdf-lib for PDF preview


## 2. Database Schema Design

### 2.1 File Versions Table
```typescript
export const fileVersions = pgTable(
  'file_versions',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    fileId: varchar('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
    versionNumber: bigint('version_number', { mode: 'number' }).notNull(),
    objectPath: text('object_path').notNull(), // GCS path for this version
    size: bigint('size', { mode: 'number' }).notNull(),
    mimeType: text('mime_type').notNull(),
    uploadedBy: varchar('uploaded_by').notNull(), // user ID
    createdAt: timestamp('created_at').defaultNow(),
    isDeleted: boolean('is_deleted').default(false), // soft delete for retention
  },
  table => [
    index('idx_file_versions_file').on(table.fileId),
    index('idx_file_versions_created').on(table.createdAt),
    // Unique constraint: one version number per file
    index('idx_file_versions_unique').on(table.fileId, table.versionNumber),
  ]
)
```

**Design Notes**:
- `versionNumber` increments for each file (1, 2, 3...)
- Current version is tracked in `files` table with `currentVersionId`
- Old versions stored with unique `objectPath` in GCS
- Soft delete allows retention policy enforcement

### 2.2 Permissions Table
```typescript
export const permissions = pgTable(
  'permissions',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    resourceType: varchar('resource_type').notNull(), // 'file' or 'folder'
    resourceId: varchar('resource_id').notNull(),
    userId: varchar('user_id').notNull(),
    permissionLevel: varchar('permission_level').notNull(), // 'view', 'download', 'edit', 'full'
    grantedBy: varchar('granted_by').notNull(), // user ID who granted permission
    createdAt: timestamp('created_at').defaultNow(),
    expiresAt: timestamp('expires_at'), // optional expiration
  },
  table => [
    index('idx_permissions_resource').on(table.resourceType, table.resourceId),
    index('idx_permissions_user').on(table.userId),
    // Unique constraint: one permission per user per resource
    index('idx_permissions_unique').on(table.resourceType, table.resourceId, table.userId),
  ]
)
```

**Permission Levels**:
- `view`: Can see file/folder exists and metadata
- `download`: Can download file (implies view)
- `edit`: Can upload new versions, rename, move (implies download)
- `full`: Can delete, share, manage permissions (implies edit)

**Inheritance**: Folder permissions inherited by children unless explicitly overridden


### 2.3 Audit Logs Table
```typescript
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar('user_id'), // null for anonymous share link access
    action: varchar('action').notNull(), // 'upload', 'download', 'delete', 'share', 'permission_change', etc.
    resourceType: varchar('resource_type').notNull(), // 'file', 'folder', 'share_link', 'permission'
    resourceId: varchar('resource_id').notNull(),
    metadata: text('metadata'), // JSON string with additional context
    ipAddress: varchar('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => [
    index('idx_audit_logs_user').on(table.userId),
    index('idx_audit_logs_resource').on(table.resourceType, table.resourceId),
    index('idx_audit_logs_created').on(table.createdAt),
    index('idx_audit_logs_action').on(table.action),
  ]
)
```

**Design Notes**:
- Immutable: No updates or deletes allowed (append-only)
- Metadata stored as JSON for flexibility (e.g., old/new values for changes)
- Indexed for fast querying by user, resource, time, and action
- Retention policy enforced via background job

### 2.4 Comments Table
```typescript
export const comments = pgTable(
  'comments',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    fileId: varchar('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
    userId: varchar('user_id').notNull(),
    parentCommentId: varchar('parent_comment_id'), // for threaded replies
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at'),
    isDeleted: boolean('is_deleted').default(false), // soft delete
  },
  table => [
    index('idx_comments_file').on(table.fileId),
    index('idx_comments_user').on(table.userId),
    index('idx_comments_parent').on(table.parentCommentId),
    index('idx_comments_created').on(table.createdAt),
  ]
)
```

**Design Notes**:
- Threaded comments via `parentCommentId` (one level of nesting)
- Soft delete preserves comment history
- `updatedAt` tracks edits

### 2.5 Tags Table
```typescript
export const tags = pgTable(
  'tags',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    name: varchar('name').notNull(),
    userId: varchar('user_id').notNull(), // tags are user-specific
    color: varchar('color'), // hex color for UI
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [
    index('idx_tags_user').on(table.userId),
    // Unique constraint: one tag name per user
    index('idx_tags_unique').on(table.userId, table.name),
  ]
)

export const fileTags = pgTable(
  'file_tags',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    fileId: varchar('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
    tagId: varchar('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [
    index('idx_file_tags_file').on(table.fileId),
    index('idx_file_tags_tag').on(table.tagId),
    // Unique constraint: one tag per file
    index('idx_file_tags_unique').on(table.fileId, table.tagId),
  ]
)
```


### 2.6 Notifications Table
```typescript
export const notifications = pgTable(
  'notifications',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    type: varchar('type').notNull(), // 'file_upload', 'file_share', 'comment', 'permission_change'
    title: text('title').notNull(),
    message: text('message').notNull(),
    resourceType: varchar('resource_type'), // 'file', 'folder', 'comment'
    resourceId: varchar('resource_id'),
    isRead: boolean('is_read').default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [
    index('idx_notifications_user').on(table.userId),
    index('idx_notifications_read').on(table.isRead),
    index('idx_notifications_created').on(table.createdAt),
  ]
)

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    notificationType: varchar('notification_type').notNull(),
    inApp: boolean('in_app').default(true),
    email: boolean('email').default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [
    index('idx_notification_prefs_user').on(table.userId),
    // Unique constraint: one preference per user per type
    index('idx_notification_prefs_unique').on(table.userId, table.notificationType),
  ]
)
```

### 2.7 Workspaces Table (Phase 3)
```typescript
export const workspaces = pgTable(
  'workspaces',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    description: text('description'),
    ownerId: varchar('owner_id').notNull(),
    storageQuota: bigint('storage_quota', { mode: 'number' }), // bytes
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [
    index('idx_workspaces_owner').on(table.ownerId),
  ]
)

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: varchar('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: varchar('user_id').notNull(),
    role: varchar('role').notNull(), // 'admin', 'editor', 'viewer'
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [
    index('idx_workspace_members_workspace').on(table.workspaceId),
    index('idx_workspace_members_user').on(table.userId),
    // Unique constraint: one membership per user per workspace
    index('idx_workspace_members_unique').on(table.workspaceId, table.userId),
  ]
)
```

### 2.8 File Metadata Table (Phase 2)
```typescript
export const fileMetadata = pgTable(
  'file_metadata',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    fileId: varchar('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
    key: varchar('key').notNull(),
    value: text('value').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [
    index('idx_file_metadata_file').on(table.fileId),
    index('idx_file_metadata_key').on(table.key),
    // Unique constraint: one key per file
    index('idx_file_metadata_unique').on(table.fileId, table.key),
  ]
)
```

### 2.10 MFA Devices Table
```typescript
export const mfaDevices = pgTable(
  'mfa_devices',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    type: varchar('type').notNull(), // 'totp', 'sms'
    secret: text('secret'), // encrypted TOTP secret or phone number
    isBackup: boolean('is_backup').default(false),
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [
    index('idx_mfa_devices_user').on(table.userId),
  ]
)
```

### 2.11 Security Policies Table
```typescript
export const securityPolicies = pgTable(
  'security_policies',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar('user_id'), // null for global policies
    policyType: varchar('policy_type').notNull(), // 'mfa_required', 'ip_whitelist', 'session_timeout'
    policyValue: text('policy_value').notNull(), // JSON config for policy
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => [
    index('idx_security_policies_type').on(table.policyType),
    index('idx_security_policies_user').on(table.userId),
  ]
)
```

### 2.12 Integration Connections Table
```typescript
export const integrationConnections = pgTable(
  'integration_connections',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    integrationType: varchar('integration_type').notNull(), // 'microsoft365', 'google_workspace', 'slack'
    accessToken: text('access_token'), // encrypted
    refreshToken: text('refresh_token'), // encrypted
    expiresAt: timestamp('expires_at'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => [
    index('idx_integration_connections_user').on(table.userId),
    index('idx_integration_connections_type').on(table.integrationType),
  ]
)
```

### 2.13 E-Signature Requests Table
```typescript
export const signatureRequests = pgTable(
  'signature_requests',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    fileId: varchar('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
    requesterId: varchar('requester_id').notNull(),
    status: varchar('status').notNull(), // 'pending', 'signed', 'declined', 'expired'
    recipients: text('recipients').notNull(), // JSON array of recipient emails
    signatureFields: text('signature_fields'), // JSON array of field definitions
    message: text('message'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  table => [
    index('idx_signature_requests_file').on(table.fileId),
    index('idx_signature_requests_requester').on(table.requesterId),
    index('idx_signature_requests_status').on(table.status),
  ]
)
```

### 2.14 Signature Responses Table
```typescript
export const signatureResponses = pgTable(
  'signature_responses',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    signatureRequestId: varchar('signature_request_id').notNull().references(() => signatureRequests.id, { onDelete: 'cascade' }),
    recipientId: varchar('recipient_id').notNull(),
    recipientEmail: varchar('recipient_email').notNull(),
    signatureData: text('signature_data'), // JSON with signature info
    ipAddress: varchar('ip_address'),
    userAgent: text('user_agent'),
    signedAt: timestamp('signed_at').defaultNow(),
  },
  table => [
    index('idx_signature_responses_request').on(table.signatureRequestId),
    index('idx_signature_responses_recipient').on(table.recipientEmail),
  ]
)
```

### 2.17 AI Content Analysis Table
```typescript
export const documentAnalyses = pgTable(
  'document_analyses',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    fileId: varchar('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
    summary: text('summary'), // AI-generated summary
    entities: text('entities'), // JSON array of extracted entities
    classification: varchar('classification'), // 'public', 'internal', 'confidential', 'restricted'
    keyTopics: text('key_topics'), // JSON array of detected topics
    embedding: text('embedding'), // pgvector embedding for semantic search
    confidence: numeric('confidence', { precision: 3, scale: 2 }), // 0-1 confidence score
    modelUsed: varchar('model_used'), // 'gpt-4', 'claude', 'llama', etc.
    processingTimeMs: integer('processing_time_ms'),
    generatedAt: timestamp('generated_at').defaultNow(),
    expiresAt: timestamp('expires_at'), // For cache expiration
  },
  table => [
    index('idx_doc_analyses_file').on(table.fileId),
    index('idx_doc_analyses_classification').on(table.classification),
    index('idx_doc_analyses_generated').on(table.generatedAt),
  ]
)
```

**Design Notes**:
- Async processing (don't block file upload)
- Cache embeddings for semantic search
- Confidence scores for uncertainty handling
- Expiration for refreshing stale analyses

### 2.18 DLP Rules and Classifications
```typescript
export const dlpRules = pgTable(
  'dlp_rules',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: varchar('organization_id'),
    name: varchar('name').notNull(), // 'SSN Pattern', 'API Key'
    pattern: text('pattern').notNull(), // Regex or keyword list
    patternType: varchar('pattern_type').notNull(), // 'regex', 'keyword', 'ml'
    severity: varchar('severity').notNull(), // 'block', 'warn', 'log'
    action: varchar('action').notNull(), // 'block_share', 'require_approval', 'alert'
    isActive: boolean('is_active').default(true),
    createdBy: varchar('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => [
    index('idx_dlp_rules_org').on(table.organizationId),
    index('idx_dlp_rules_active').on(table.isActive),
  ]
)

export const fileClassifications = pgTable(
  'file_classifications',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    fileId: varchar('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
    classification: varchar('classification').notNull(), // 'public','internal','confidential','restricted'
    reason: varchar('reason').notNull(), // 'manual','auto_dlp','auto_ml'
    setBy: varchar('set_by'), // user ID or 'system'
    violatedRules: text('violated_rules'), // JSON array of DLP rule IDs that match
    setAt: timestamp('set_at').defaultNow(),
  },
  table => [
    index('idx_file_classifications_file').on(table.fileId),
    index('idx_file_classifications_classification').on(table.classification),
  ]
)

export const dlpViolations = pgTable(
  'dlp_violations',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    fileId: varchar('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
    ruleId: varchar('rule_id').notNull().references(() => dlpRules.id),
    userId: varchar('user_id').notNull(),
    action: varchar('action').notNull(), // 'share_blocked', 'download_blocked', 'alert_sent'
    matchedContent: text('matched_content'), // Snippet of matched text
    metadata: text('metadata'), // JSON with context
    resolvedAt: timestamp('resolved_at'), // When admin reviewed
    resolvedBy: varchar('resolved_by'), // Admin who resolved
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [
    index('idx_dlp_violations_file').on(table.fileId),
    index('idx_dlp_violations_rule').on(table.ruleId),
    index('idx_dlp_violations_user').on(table.userId),
    index('idx_dlp_violations_created').on(table.createdAt),
  ]
)
```

### 2.19 Device Trust and Conditional Access
```typescript
export const trustedDevices = pgTable(
  'trusted_devices',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    deviceFingerprint: varchar('device_fingerprint').notNull(), // Hash of device properties
    deviceName: varchar('device_name'), // User-friendly name
    deviceType: varchar('device_type'), // 'desktop', 'mobile', 'tablet'
    osName: varchar('os_name'), // 'Windows', 'macOS', 'iOS', 'Android'
    browserName: varchar('browser_name'), // 'Chrome', 'Safari', etc.
    approvedBy: varchar('approved_by'), // User or admin ID
    lastUsedAt: timestamp('last_used_at'),
    isRevoked: boolean('is_revoked').default(false),
    revokedAt: timestamp('revoked_at'),
    revokedBy: varchar('revoked_by'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [
    index('idx_trusted_devices_user').on(table.userId),
    index('idx_trusted_devices_fingerprint').on(table.deviceFingerprint),
  ]
)

export const conditionalAccessPolicies = pgTable(
  'conditional_access_policies',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: varchar('organization_id'),
    name: varchar('name').notNull(),
    description: text('description'),
    conditions: text('conditions').notNull(), // JSON: device_trust, location, time, sensitivity
    actions: text('actions').notNull(), // JSON: require_mfa, block, require_approval
    priority: integer('priority'), // Lower number = higher priority
    isActive: boolean('is_active').default(true),
    createdBy: varchar('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => [
    index('idx_cond_access_policies_org').on(table.organizationId),
    index('idx_cond_access_policies_active').on(table.isActive),
    index('idx_cond_access_policies_priority').on(table.priority),
  ]
)

export const conditionalAccessEvaluations = pgTable(
  'conditional_access_evaluations',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    action: varchar('action').notNull(), // 'file_access', 'download', 'share'
    resourceId: varchar('resource_id'),
    evaluatedPolicies: text('evaluated_policies'), // JSON array of policy IDs checked
    matchedPolicies: text('matched_policies'), // JSON array of policies that matched
    decision: varchar('decision').notNull(), // 'allow', 'block', 'challenge'
    challengeType: varchar('challenge_type'), // 'mfa', 'approval', null
    metadata: text('metadata'), // JSON with context (IP, device, location, etc)
    evaluatedAt: timestamp('evaluated_at').defaultNow(),
  },
  table => [
    index('idx_cond_access_eval_user').on(table.userId),
    index('idx_cond_access_eval_decision').on(table.decision),
    index('idx_cond_access_eval_evaluated').on(table.evaluatedAt),
  ]
)
```

**Design Notes**:
- Device fingerprinting based on browser/OS/hardware properties
- Conditional access policies evaluated on every sensitive action
- Challenge types: MFA (2FA required), approval (admin approval needed), block
- Evaluation log for security auditing

### 2.20 Content Embeddings for Semantic Search
```typescript
export const contentEmbeddings = pgTable(
  'content_embeddings',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    fileId: varchar('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index'), // For large docs split into chunks
    content: text('content'), // Original text chunk
    embedding: vector('embedding', { dimensions: 1536 }), // pgvector (OpenAI: 1536 dimensions)
    embeddingModel: varchar('embedding_model'), // 'text-embedding-3-small', etc.
    metadata: text('metadata'), // JSON with page/section info
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [
    index('idx_content_embeddings_file').on(table.fileId),
    index('idx_content_embeddings_embedding', 'ivfflat', { with: 'vector_cosine_ops' }), // Vector similarity index
  ]
)
```

**Design Notes**:
- Split large documents into chunks for better accuracy
- Use IVFFlat index for approximate nearest neighbor search
- Cosine similarity for semantic matching
- Embeddings cached and reused


```typescript
export const workflowDefinitions = pgTable(
  'workflow_definitions',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    description: text('description'),
    triggerType: varchar('trigger_type').notNull(), // 'file_upload', 'share_created', 'schedule'
    triggerConfig: text('trigger_config'), // JSON config for trigger
    actions: text('actions').notNull(), // JSON array of actions
    isActive: boolean('is_active').default(true),
    createdBy: varchar('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => [
    index('idx_workflow_definitions_trigger').on(table.triggerType),
    index('idx_workflow_definitions_creator').on(table.createdBy),
  ]
)
```

### 2.16 Workflow Executions Table
```typescript
export const workflowExecutions = pgTable(
  'workflow_executions',
  {
    id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
    workflowDefinitionId: varchar('workflow_definition_id').notNull().references(() => workflowDefinitions.id, { onDelete: 'cascade' }),
    triggerData: text('trigger_data'), // JSON data that triggered workflow
    status: varchar('status').notNull(), // 'running', 'completed', 'failed'
    result: text('result'), // JSON result of execution
    error: text('error'),
    startedAt: timestamp('started_at').defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  table => [
    index('idx_workflow_executions_definition').on(table.workflowDefinitionId),
    index('idx_workflow_executions_status').on(table.status),
    index('idx_workflow_executions_started').on(table.startedAt),
  ]
)
```

### 2.9 Schema Migration Strategy
- Use Drizzle Kit for migrations: `npm run db:push` for development
- Production migrations via `drizzle-kit generate` and `drizzle-kit migrate`
- Add new tables incrementally (no breaking changes to existing tables)
- Add columns with defaults to avoid breaking existing code
- Create indexes after table creation for large tables


## 3. API Design

### 3.1 File Versions API

#### GET /api/files/:fileId/versions
List all versions of a file.

**Authorization**: User must have 'view' permission on file

**Response (200)**:
```json
{
  "versions": [
    {
      "id": "uuid",
      "versionNumber": 3,
      "size": 1024000,
      "mimeType": "application/pdf",
      "uploadedBy": "user-id",
      "uploadedByName": "John Doe",
      "createdAt": "2026-01-15T10:30:00Z",
      "isCurrent": true
    },
    {
      "id": "uuid",
      "versionNumber": 2,
      "size": 1020000,
      "mimeType": "application/pdf",
      "uploadedBy": "user-id",
      "uploadedByName": "John Doe",
      "createdAt": "2026-01-14T15:20:00Z",
      "isCurrent": false
    }
  ]
}
```

#### GET /api/files/:fileId/versions/:versionId/download
Download a specific version.

**Authorization**: User must have 'download' permission on file

**Response (200)**: Presigned GCS URL redirect

#### POST /api/files/:fileId/versions/:versionId/restore
Restore a previous version as current.

**Authorization**: User must have 'edit' permission on file

**Request Body**:
```json
{
  "createBackup": true  // optional: create backup of current version
}
```

**Response (200)**:
```json
{
  "message": "Version restored successfully",
  "newVersionNumber": 4
}
```

**Implementation Notes**:
- Restoring creates a new version (copy of old version)
- Original version history preserved
- Audit log entry created


### 3.2 Permissions API

#### GET /api/files/:fileId/permissions
List all permissions for a file.

**Authorization**: User must have 'full' permission or be owner

**Response (200)**:
```json
{
  "permissions": [
    {
      "id": "uuid",
      "userId": "user-id",
      "userName": "Jane Smith",
      "userEmail": "jane@example.com",
      "permissionLevel": "edit",
      "grantedBy": "owner-id",
      "grantedByName": "John Doe",
      "createdAt": "2026-01-10T09:00:00Z",
      "expiresAt": null
    }
  ],
  "inherited": [
    {
      "userId": "user-id-2",
      "userName": "Bob Johnson",
      "permissionLevel": "view",
      "source": "folder",
      "sourceName": "Project Files"
    }
  ]
}
```

#### POST /api/files/:fileId/permissions
Grant permission to a user.

**Authorization**: User must have 'full' permission or be owner

**Request Body**:
```json
{
  "userId": "user-id",
  "permissionLevel": "edit",
  "expiresAt": "2026-12-31T23:59:59Z"  // optional
}
```

**Response (201)**:
```json
{
  "id": "uuid",
  "message": "Permission granted successfully"
}
```

#### PUT /api/permissions/:permissionId
Update an existing permission.

**Authorization**: User must have 'full' permission or be owner

**Request Body**:
```json
{
  "permissionLevel": "download"
}
```

#### DELETE /api/permissions/:permissionId
Revoke a permission.

**Authorization**: User must have 'full' permission or be owner

**Response (200)**:
```json
{
  "message": "Permission revoked successfully"
}
```

**Implementation Notes**:
- Permission changes create audit log entries
- Notification sent to affected user
- Check permission inheritance before granting (avoid redundancy)
- Validate permission level hierarchy (can't grant higher than you have)


### 3.3 Audit Logs API

#### GET /api/audit-logs
Query audit logs with filters.

**Authorization**: Authenticated user (sees only their own actions) or admin (sees all)

**Query Parameters**:
- `userId`: Filter by user
- `action`: Filter by action type
- `resourceType`: Filter by resource type
- `resourceId`: Filter by specific resource
- `startDate`: ISO 8601 date
- `endDate`: ISO 8601 date
- `limit`: Max results (default: 100, max: 1000)
- `offset`: Pagination offset

**Response (200)**:
```json
{
  "logs": [
    {
      "id": "uuid",
      "userId": "user-id",
      "userName": "John Doe",
      "action": "download",
      "resourceType": "file",
      "resourceId": "file-id",
      "resourceName": "document.pdf",
      "metadata": {
        "versionNumber": 3,
        "shareLink": false
      },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2026-01-15T14:30:00Z"
    }
  ],
  "total": 1523,
  "limit": 100,
  "offset": 0
}
```

#### GET /api/audit-logs/export
Export audit logs as CSV or JSON.

**Authorization**: Admin only

**Query Parameters**: Same as GET /api/audit-logs plus:
- `format`: 'csv' or 'json'

**Response (200)**: File download

**Implementation Notes**:
- Audit logs are immutable (no update/delete endpoints)
- Large exports handled via background job with email notification
- Redact sensitive data (passwords, tokens) from metadata
- Rate limit to prevent abuse

### 3.4 Comments API

#### GET /api/files/:fileId/comments
List all comments for a file.

**Authorization**: User must have 'view' permission on file

**Response (200)**:
```json
{
  "comments": [
    {
      "id": "uuid",
      "userId": "user-id",
      "userName": "Jane Smith",
      "userAvatar": "https://...",
      "content": "Please review section 3",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": null,
      "isDeleted": false,
      "replies": [
        {
          "id": "uuid",
          "userId": "user-id-2",
          "userName": "John Doe",
          "content": "Will do, thanks!",
          "createdAt": "2026-01-15T10:15:00Z"
        }
      ]
    }
  ]
}
```

#### POST /api/files/:fileId/comments
Add a comment to a file.

**Authorization**: User must have 'view' permission on file

**Request Body**:
```json
{
  "content": "This looks great!",
  "parentCommentId": "uuid"  // optional, for replies
}
```

**Response (201)**:
```json
{
  "id": "uuid",
  "message": "Comment added successfully"
}
```

#### PUT /api/comments/:commentId
Edit a comment.

**Authorization**: User must be comment author

**Request Body**:
```json
{
  "content": "Updated comment text"
}
```

#### DELETE /api/comments/:commentId
Delete a comment (soft delete).

**Authorization**: User must be comment author or file owner

**Response (200)**:
```json
{
  "message": "Comment deleted successfully"
}
```

**Implementation Notes**:
- Comments trigger notifications to file owner and mentioned users
- Soft delete preserves comment history
- Markdown support for rich text formatting
- Rate limit to prevent spam


### 3.5 Notifications API

#### GET /api/notifications
List user's notifications.

**Authorization**: Authenticated user

**Query Parameters**:
- `unreadOnly`: boolean (default: false)
- `limit`: Max results (default: 50)
- `offset`: Pagination offset

**Response (200)**:
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "file_share",
      "title": "New file shared with you",
      "message": "John Doe shared 'Q4 Report.pdf' with you",
      "resourceType": "file",
      "resourceId": "file-id",
      "isRead": false,
      "createdAt": "2026-01-15T14:00:00Z"
    }
  ],
  "unreadCount": 5
}
```

#### PUT /api/notifications/:notificationId/read
Mark notification as read.

**Authorization**: Authenticated user (own notifications only)

**Response (200)**:
```json
{
  "message": "Notification marked as read"
}
```

#### PUT /api/notifications/read-all
Mark all notifications as read.

**Authorization**: Authenticated user

**Response (200)**:
```json
{
  "message": "All notifications marked as read",
  "count": 12
}
```

#### GET /api/notifications/preferences
Get notification preferences.

**Authorization**: Authenticated user

**Response (200)**:
```json
{
  "preferences": [
    {
      "notificationType": "file_upload",
      "inApp": true,
      "email": false
    },
    {
      "notificationType": "comment",
      "inApp": true,
      "email": true
    }
  ]
}
```

#### PUT /api/notifications/preferences
Update notification preferences.

**Authorization**: Authenticated user

**Request Body**:
```json
{
  "preferences": [
    {
      "notificationType": "file_upload",
      "inApp": true,
      "email": true
    }
  ]
}
```

### 3.6 Tags API

#### GET /api/tags
List user's tags.

**Authorization**: Authenticated user

**Response (200)**:
```json
{
  "tags": [
    {
      "id": "uuid",
      "name": "Important",
      "color": "#FF5733",
      "fileCount": 12,
      "createdAt": "2026-01-10T09:00:00Z"
    }
  ]
}
```

#### POST /api/tags
Create a new tag.

**Authorization**: Authenticated user

**Request Body**:
```json
{
  "name": "Project Alpha",
  "color": "#3498DB"
}
```

#### POST /api/files/:fileId/tags
Add tags to a file.

**Authorization**: User must have 'edit' permission on file

**Request Body**:
```json
{
  "tagIds": ["uuid1", "uuid2"]
}
```

#### DELETE /api/files/:fileId/tags/:tagId
Remove tag from file.

**Authorization**: User must have 'edit' permission on file


### 3.7 Search API

#### GET /api/search
Search files and folders.

**Authorization**: Authenticated user (results filtered by permissions)

**Query Parameters**:
- `q`: Search query (required)
- `type`: Filter by 'file' or 'folder'
- `mimeType`: Filter by MIME type
- `tags`: Comma-separated tag IDs
- `minSize`: Minimum file size in bytes
- `maxSize`: Maximum file size in bytes
- `startDate`: Created after date (ISO 8601)
- `endDate`: Created before date (ISO 8601)
- `folderId`: Search within specific folder
- `limit`: Max results (default: 50)
- `offset`: Pagination offset

**Response (200)**:
```json
{
  "results": [
    {
      "type": "file",
      "id": "uuid",
      "name": "Q4 Report.pdf",
      "path": "/Projects/2026/Q4 Report.pdf",
      "size": 1024000,
      "mimeType": "application/pdf",
      "tags": ["Important", "Finance"],
      "createdAt": "2026-01-10T09:00:00Z",
      "snippet": "...revenue increased by 15%..."
    }
  ],
  "total": 23,
  "limit": 50,
  "offset": 0
}
```

**Implementation Notes**:
- Phase 1: PostgreSQL full-text search on file names and metadata
- Phase 2: Elasticsearch for content search and advanced features
- Results filtered by user permissions (security-critical)
- Search index updated asynchronously via background jobs

### 3.8 Bulk Operations API

#### POST /api/bulk/download
Create bulk download (ZIP archive).

**Authorization**: Authenticated user

**Request Body**:
```json
{
  "fileIds": ["uuid1", "uuid2", "uuid3"],
  "folderIds": ["uuid4"]
}
```

**Response (202)**:
```json
{
  "jobId": "uuid",
  "message": "Bulk download job created",
  "estimatedTime": 30
}
```

#### GET /api/bulk/download/:jobId
Check bulk download status.

**Response (200)**:
```json
{
  "status": "completed",
  "downloadUrl": "https://storage.googleapis.com/...",
  "expiresAt": "2026-01-15T18:00:00Z"
}
```

#### POST /api/bulk/delete
Delete multiple files/folders.

**Authorization**: Authenticated user (must have 'full' permission on all)

**Request Body**:
```json
{
  "fileIds": ["uuid1", "uuid2"],
  "folderIds": ["uuid3"]
}
```

**Response (200)**:
```json
{
  "message": "Deleted 2 files and 1 folder",
  "deletedFiles": 2,
  "deletedFolders": 1
}
```

#### POST /api/bulk/move
Move multiple files/folders.

**Authorization**: Authenticated user (must have 'edit' permission on all)

**Request Body**:
```json
{
  "fileIds": ["uuid1", "uuid2"],
  "folderIds": ["uuid3"],
  "targetFolderId": "uuid4"
```

**Implementation Notes**:
- Bulk operations processed asynchronously for large sets
- Progress tracking via WebSocket or polling
- Atomic operations where possible (all or nothing)
- Audit log entries for each item


### 3.8 MFA API

#### POST /api/mfa/setup
Set up multi-factor authentication for user.

**Authorization**: Authenticated user

**Request Body**:
```json
{
  "type": "totp", // or "sms"
  "secret": "base32-secret", // for TOTP
  "phoneNumber": "+1234567890" // for SMS
}
```

**Response (201)**:
```json
{
  "qrCode": "data:image/png;base64,...", // TOTP QR code
  "backupCodes": ["123456", "789012", ...],
  "message": "MFA setup successful"
}
```

#### POST /api/mfa/verify
Verify MFA code during login.

**Request Body**:
```json
{
  "code": "123456",
  "mfaToken": "temporary-token"
}
```

**Response (200)**:
```json
{
  "verified": true,
  "message": "MFA verification successful"
}
```

#### GET /api/mfa/devices
List user's MFA devices.

**Authorization**: Authenticated user

**Response (200)**:
```json
{
  "devices": [
    {
      "id": "uuid",
      "type": "totp",
      "isBackup": false,
      "lastUsedAt": "2026-01-15T10:30:00Z",
      "createdAt": "2026-01-10T09:00:00Z"
    }
  ]
}
```

#### DELETE /api/mfa/devices/:deviceId
Remove MFA device.

**Authorization**: Authenticated user (device owner)

**Response (200)**:
```json
{
  "message": "MFA device removed successfully"
}
```

### 3.9 Security Policies API

#### GET /api/security/policies
List security policies for user or organization.

**Authorization**: Authenticated user (admin for global policies)

**Response (200)**:
```json
{
  "policies": [
    {
      "id": "uuid",
      "policyType": "mfa_required",
      "policyValue": {"enabled": true, "exceptions": []},
      "isActive": true,
      "createdAt": "2026-01-10T09:00:00Z"
    }
  ]
}
```

#### PUT /api/security/policies/:policyId
Update security policy.

**Authorization**: Authenticated user (admin)

**Request Body**:
```json
{
  "policyValue": {"enabled": true, "exceptions": []},
  "isActive": true
}
```

**Response (200)**:
```json
{
  "message": "Security policy updated successfully"
}
```

### 3.10 E-Signature API

#### POST /api/signature-requests
Create signature request for document.

**Authorization**: Authenticated user (must have 'edit' permission on file)

**Request Body**:
```json
{
  "fileId": "uuid",
  "recipients": ["email@example.com", "user2@example.com"],
  "signatureFields": [
    {
      "type": "signature",
      "page": 1,
      "x": 100,
      "y": 200,
      "width": 200,
      "height": 50
    }
  ],
  "message": "Please sign this document",
  "expiresAt": "2026-02-15T23:59:59Z"
}
```

**Response (201)**:
```json
{
  "id": "uuid",
  "message": "Signature request created successfully",
  "status": "pending"
}
```

#### GET /api/signature-requests
List user's signature requests.

**Authorization**: Authenticated user

**Response (200)**:
```json
{
  "requests": [
    {
      "id": "uuid",
      "fileId": "uuid",
      "fileName": "contract.pdf",
      "status": "pending",
      "recipients": ["email@example.com"],
      "createdAt": "2026-01-15T10:30:00Z",
      "expiresAt": "2026-02-15T23:59:59Z"
    }
  ]
}
```

#### GET /api/signature-requests/:requestId/sign
Get signing interface for signature request.

**Authorization**: Public access via signed URL

**Response (200)**:
```json
{
  "request": {
    "id": "uuid",
    "fileName": "contract.pdf",
    "message": "Please sign this document",
    "signatureFields": [...]
  },
  "documentUrl": "https://storage.googleapis.com/...",
  "recipientEmail": "email@example.com"
}
```

#### POST /api/signature-requests/:requestId/sign
Submit signature for document.

**Request Body**:
```json
{
  "signatureData": {
    "signature": "data:image/png;base64,...",
    "typedName": "John Doe",
    "timestamp": "2026-01-15T10:30:00Z"
  }
}
```

**Response (200)**:
```json
{
  "message": "Signature submitted successfully",
  "status": "signed"
}
```

#### POST /api/files/:fileId/analyze
Trigger AI analysis of document.

**Authorization**: Authenticated user (must have 'view' permission)

**Response (202)**:
```json
{
  "jobId": "uuid",
  "status": "queued",
  "message": "Analysis started"
}
```

#### GET /api/files/:fileId/analysis
Get AI analysis results for document.

**Authorization**: Authenticated user (must have 'view' permission)

**Response (200)**:
```json
{
  "summary": "This is a Q4 2025 financial report showing revenue growth...",
  "entities": [
    {"type": "date", "value": "2025-12-31", "confidence": 0.99},
    {"type": "amount", "value": "$5.2M", "confidence": 0.95},
    {"type": "person", "value": "John Smith", "confidence": 0.87}
  ],
  "keyTopics": ["finance", "growth", "quarterly"],
  "classification": "internal",
  "generatedAt": "2026-01-15T10:30:00Z"
}
```

#### GET /api/files/:fileId/duplicates
Find duplicate/similar files using semantic search.

**Authorization**: Authenticated user

**Query Parameters**:
- `threshold`: Similarity threshold (0-1, default 0.8)

**Response (200)**:
```json
{
  "duplicates": [
    {
      "id": "uuid",
      "name": "Q4_Report_Draft.pdf",
      "similarity": 0.92
    },
    {
      "id": "uuid",
      "name": "Q4_Report_Final.pdf",
      "similarity": 0.88
    }
  ]
}
```

### 3.13 DLP & Content Classification API

#### GET /api/dlp/rules
List DLP rules for organization.

**Authorization**: Admin only

**Response (200)**:
```json
{
  "rules": [
    {
      "id": "uuid",
      "name": "SSN Pattern",
      "pattern": "\\d{3}-\\d{2}-\\d{4}",
      "severity": "block",
      "action": "block_share",
      "isActive": true
    },
    {
      "id": "uuid",
      "name": "API Keys",
      "pattern": "(AKIA|ghp_)[A-Za-z0-9_]{20,}",
      "severity": "block",
      "action": "block_share",
      "isActive": true
    }
  ]
}
```

#### POST /api/dlp/rules
Create new DLP rule.

**Authorization**: Admin only

**Request Body**:
```json
{
  "name": "Credit Card Pattern",
  "pattern": "\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}",
  "patternType": "regex",
  "severity": "block",
  "action": "block_share"
}
```

#### GET /api/files/:fileId/classification
Get classification level for file.

**Authorization**: Admin or file owner

**Response (200)**:
```json
{
  "classification": "confidential",
  "reason": "auto_dlp",
  "violatedRules": ["ssn_pattern", "financial_data"],
  "setAt": "2026-01-15T10:30:00Z"
}
```

#### PUT /api/files/:fileId/classification
Manually set classification level.

**Authorization**: Admin or file owner

**Request Body**:
```json
{
  "classification": "restricted",
  "reason": "manual"
}
```

#### GET /api/dlp/violations
Get DLP violations for organization.

**Authorization**: Admin only

**Query Parameters**:
- `startDate`: ISO 8601 date
- `endDate`: ISO 8601 date
- `resolved`: Filter by resolved status

**Response (200)**:
```json
{
  "violations": [
    {
      "id": "uuid",
      "fileId": "uuid",
      "fileName": "payroll.xlsx",
      "ruleId": "ssn_rule",
      "ruleName": "SSN Pattern",
      "userId": "user-id",
      "action": "share_blocked",
      "matchedContent": "789-12-3456",
      "createdAt": "2026-01-15T10:30:00Z",
      "resolved": false
    }
  ],
  "total": 23
}
```

### 3.14 Device Trust & Conditional Access API

#### GET /api/devices
List user's trusted devices.

**Authorization**: Authenticated user

**Response (200)**:
```json
{
  "devices": [
    {
      "id": "uuid",
      "deviceName": "MacBook Pro",
      "deviceType": "desktop",
      "osName": "macOS",
      "browserName": "Chrome",
      "lastUsedAt": "2026-01-15T10:30:00Z",
      "isRevoked": false
    }
  ]
}
```

#### POST /api/devices/:deviceId/trust
Mark device as trusted (after admin approval).

**Authorization**: Admin approval workflow

#### DELETE /api/devices/:deviceId
Revoke device trust.

**Authorization**: User or Admin

#### GET /api/security/conditional-access
List conditional access policies.

**Authorization**: Admin only

#### POST /api/security/conditional-access
Create conditional access policy.

**Authorization**: Admin only

**Request Body**:
```json
{
  "name": "Require MFA for Confidential Files",
  "conditions": {
    "sensitivityLevelMin": "confidential",
    "untrustedDeviceOnly": true
  },
  "actions": {
    "requireMfa": true,
    "block": false
  },
  "priority": 1
}
```

### 3.15 Semantic Search API

#### GET /api/search/semantic
Perform semantic (AI-powered) search.

**Authorization**: Authenticated user

**Query Parameters**:
- `q`: Natural language query (required)
- `type`: Filter by 'file' or 'folder'
- `sensitivity`: Filter by classification level
- `limit`: Max results (default: 50)

**Response (200)**:
```json
{
  "results": [
    {
      "type": "file",
      "id": "uuid",
      "name": "Q4_Financial_Report.pdf",
      "path": "/Finance/Reports/Q4_Financial_Report.pdf",
      "size": 2048000,
      "mimeType": "application/pdf",
      "relevance": 0.95,
      "snippet": "...revenue increased by 15% in Q4 2025...",
      "createdAt": "2026-01-10T09:00:00Z"
    }
  ],
  "total": 12,
  "took": 340 // milliseconds
}
```


List user's integration connections.

**Authorization**: Authenticated user

**Response (200)**:
```json
{
  "integrations": [
    {
      "id": "uuid",
      "integrationType": "microsoft365",
      "isActive": true,
      "connectedAt": "2026-01-10T09:00:00Z",
      "lastSyncAt": "2026-01-15T10:30:00Z"
    }
  ]
}
```

#### POST /api/integrations/:type/connect
Connect to external integration.

**Authorization**: Authenticated user

**Request Body**:
```json
{
  "authCode": "auth-code-from-oauth-flow",
  "redirectUri": "https://app.cloudvault.com/integrations/callback"
}
```

**Response (201)**:
```json
{
  "id": "uuid",
  "message": "Microsoft 365 connected successfully",
  "integrationType": "microsoft365"
}
```

#### DELETE /api/integrations/:connectionId
Disconnect integration.

**Authorization**: Authenticated user

**Response (200)**:
```json
{
  "message": "Integration disconnected successfully"
}
```

### 3.12 Workflow Automation API

#### GET /api/workflows
List user's workflow definitions.

**Authorization**: Authenticated user

**Response (200)**:
```json
{
  "workflows": [
    {
      "id": "uuid",
      "name": "File Approval Process",
      "description": "Automatically approve uploaded files",
      "triggerType": "file_upload",
      "isActive": true,
      "createdAt": "2026-01-10T09:00:00Z"
    }
  ]
}
```

#### POST /api/workflows
Create new workflow definition.

**Authorization**: Authenticated user

**Request Body**:
```json
{
  "name": "File Approval Process",
  "description": "Automatically approve uploaded files",
  "triggerType": "file_upload",
  "triggerConfig": {
    "folderId": "uuid",
    "fileTypes": ["pdf", "docx"]
  },
  "actions": [
    {
      "type": "send_notification",
      "config": {"message": "New file uploaded: {{fileName}}"}
    }
  ]
}
```

**Response (201)**:
```json
{
  "id": "uuid",
  "message": "Workflow created successfully"
}
```

#### GET /api/workflows/:workflowId/executions
List workflow execution history.

**Authorization**: Authenticated user (workflow owner)

**Response (200)**:
```json
{
  "executions": [
    {
      "id": "uuid",
      "status": "completed",
      "triggerData": {"fileName": "contract.pdf"},
      "result": {"notificationSent": true},
      "startedAt": "2026-01-15T10:30:00Z",
      "completedAt": "2026-01-15T10:31:00Z"
    }
  ]
}
```


## 4. AI & Content Analysis Systems

### 4.1 AI Document Analysis Service Architecture

```typescript
// server/services/aiAnalysisService.ts
class AIAnalysisService {
  private llmClient: LLMClient; // OpenAI, Anthropic, etc.
  private embeddingModel: EmbeddingModel;
  private cache: Redis;

  async analyzeDocument(fileId: string, fileContent: Buffer, mimeType: string): Promise<DocumentAnalysis> {
    // 1. Check cache
    const cached = await this.cache.get(`analysis:${fileId}`);
    if (cached) return JSON.parse(cached);

    // 2. Extract text
    const text = await this.extractText(fileContent, mimeType);

    // 3. Generate embeddings
    const embedding = await this.embeddingModel.embed(text.substring(0, 8192)); // Limit to 8K tokens

    // 4. Run AI analysis (call LLM)
    const analysis = await this.llmClient.analyzeDocument({
      text,
      schema: {
        summary: string,
        entities: Array<{type: string, value: string, confidence: number}>,
        topics: string[],
        classification: 'public' | 'internal' | 'confidential' | 'restricted'
      }
    });

    // 5. Save to database
    const result = await db.insert(documentAnalyses).values({
      fileId,
      summary: analysis.summary,
      entities: JSON.stringify(analysis.entities),
      keyTopics: JSON.stringify(analysis.topics),
      embedding: JSON.stringify(embedding),
      classification: analysis.classification,
      confidence: analysis.confidence,
      modelUsed: 'gpt-4'
    }).returning();

    // 6. Cache for 30 days
    await this.cache.setex(`analysis:${fileId}`, 86400 * 30, JSON.stringify(result));

    return result;
  }

  async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'application/pdf':
        return await pdf.getTextFromPdf(buffer);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await docx.getTextFromDocx(buffer);
      case 'image/png':
      case 'image/jpeg':
        return await ocr.extractTextFromImage(buffer);
      default:
        return buffer.toString('utf-8');
    }
  }

  async findDuplicates(newEmbedding: number[], threshold: number = 0.95): Promise<File[]> {
    // Use vector similarity search
    const duplicates = await db.execute(sql`
      SELECT * FROM content_embeddings
      WHERE cosine_similarity(embedding, ${newEmbedding}) > ${threshold}
      LIMIT 10
    `);
    return duplicates.map(e => e.fileId);
  }
}
```

### 4.2 DLP (Data Loss Prevention) Service

```typescript
// server/services/dlpService.ts
class DLPService {
  async scanFile(fileId: string, organizationId: string): Promise<DLPViolation[]> {
    const file = await db.query.files.findFirst({ where: eq(files.id, fileId) });
    const analysis = await db.query.documentAnalyses.findFirst({ where: eq(documentAnalyses.fileId, fileId) });

    const rules = await db.query.dlpRules.findMany({
      where: and(
        eq(dlpRules.organizationId, organizationId),
        eq(dlpRules.isActive, true)
      )
    });

    const violations: DLPViolation[] = [];

    for (const rule of rules) {
      const matches = this.matchRule(rule, file, analysis);
      if (matches.length > 0) {
        violations.push({
          ruleId: rule.id,
          severity: rule.severity,
          action: rule.action,
          matches
        });
      }
    }

    // Apply action
    if (violations.length > 0) {
      const highestSeverity = this.getHighestSeverity(violations);
      const action = violations[0].action;

      if (action === 'block_share') {
        // Block sharing this file
        await db.update(files).set({ dlpBlockedUntil: new Date() }).where(eq(files.id, fileId));
      }

      if (action === 'alert') {
        // Send alert to admins
        await this.notifyAdmins(organizationId, violations);
      }

      // Log violation
      await db.insert(dlpViolations).values({
        fileId,
        ruleId: violations[0].ruleId,
        userId: file.uploadedBy,
        action: action,
        matchedContent: violations[0].matches[0].content,
      });
    }

    return violations;
  }

  private matchRule(rule: DLPRule, file: File, analysis: DocumentAnalysis): Match[] {
    const matches: Match[] = [];

    if (rule.patternType === 'regex') {
      const regex = new RegExp(rule.pattern, 'gi');
      // Match against file name and analysis
      const fileMatch = file.name.match(regex);
      if (fileMatch) matches.push(...fileMatch);
    } else if (rule.patternType === 'keyword') {
      const keywords = rule.pattern.split(',').map(k => k.trim());
      for (const keyword of keywords) {
        if (analysis.summary?.includes(keyword)) {
          matches.push({ content: keyword, confidence: 1.0 });
        }
      }
    } else if (rule.patternType === 'ml') {
      // Use AI to detect sensitive patterns
      // E.g., "this looks like an API key" based on context
    }

    return matches;
  }
}
```

### 4.3 Conditional Access Service

```typescript
// server/services/conditionalAccessService.ts
class ConditionalAccessService {
  async evaluateAccess(
    userId: string,
    action: string,
    resourceId: string,
    context: AccessContext
  ): Promise<AccessDecision> {
    const organization = await this.getUserOrganization(userId);
    const policies = await db.query.conditionalAccessPolicies.findMany({
      where: and(
        eq(conditionalAccessPolicies.organizationId, organization.id),
        eq(conditionalAccessPolicies.isActive, true)
      ),
      orderBy: asc(conditionalAccessPolicies.priority)
    });

    for (const policy of policies) {
      if (this.policyMatches(policy, context)) {
        const decision = this.getDecision(policy);
        
        // Log evaluation
        await db.insert(conditionalAccessEvaluations).values({
          userId,
          action,
          resourceId,
          matchedPolicies: JSON.stringify([policy.id]),
          decision: decision.type,
          challengeType: decision.challenge,
          metadata: JSON.stringify(context)
        });

        return decision;
      }
    }

    // Default allow
    return { type: 'allow', challenge: null };
  }

  private policyMatches(policy: ConditionalAccessPolicy, context: AccessContext): boolean {
    const conditions = JSON.parse(policy.conditions);

    // Device trust check
    if (conditions.requireTrustedDevice) {
      const trusted = this.isDeviceTrusted(context.userId, context.deviceFingerprint);
      if (!trusted) return true; // Policy matches (deny access)
    }

    // Location check (geofencing)
    if (conditions.allowedCountries) {
      const allowed = conditions.allowedCountries.includes(context.country);
      if (!allowed) return true;
    }

    // Time-based check
    if (conditions.businessHoursOnly) {
      const hour = new Date().getHours();
      if (hour < 9 || hour > 17) return true; // Outside business hours
    }

    // Risk-based check (impossible travel)
    if (conditions.detectImpossibleTravel) {
      const risky = this.isImpossibleTravel(context.userId, context.ip);
      if (risky) return true;
    }

    // Sensitivity level check
    if (conditions.sensitivityLevelMin) {
      const resource = await this.getResource(context.resourceId);
      if (resource.sensitivityLevel > conditions.sensitivityLevelMin) return true;
    }

    return false;
  }

  private getDecision(policy: ConditionalAccessPolicy): AccessDecision {
    const actions = JSON.parse(policy.actions);
    
    if (actions.block) {
      return { type: 'block', challenge: null };
    } else if (actions.requireMfa) {
      return { type: 'challenge', challenge: 'mfa' };
    } else if (actions.requireApproval) {
      return { type: 'challenge', challenge: 'approval' };
    }

    return { type: 'allow', challenge: null };
  }
}
```



### 4.1 Frontend Components

#### Version History Component
```typescript
// client/src/components/VersionHistory.tsx
interface VersionHistoryProps {
  fileId: string;
  onRestore?: (versionId: string) => void;
}

// Features:
// - List versions with timeline view
// - Download specific version
// - Restore version with confirmation dialog
// - Show diff indicators (size changes, uploader)
// - Infinite scroll for large version lists
```

#### Permissions Manager Component
```typescript
// client/src/components/PermissionsManager.tsx
interface PermissionsManagerProps {
  resourceType: 'file' | 'folder';
  resourceId: string;
  currentUserId: string;
}

// Features:
// - List current permissions with user avatars
// - Add new permission with user search
// - Edit permission level dropdown
// - Remove permission with confirmation
// - Show inherited permissions (read-only)
// - Permission level explanations
```

#### Audit Log Viewer Component
```typescript
// client/src/components/AuditLogViewer.tsx
interface AuditLogViewerProps {
  filters?: AuditLogFilters;
  adminView?: boolean;
}

// Features:
// - Filterable table with date range picker
// - Action type badges with colors
// - User and resource links
// - Export to CSV/JSON
// - Pagination with infinite scroll
// - Real-time updates via WebSocket
```

#### Comments Panel Component
```typescript
// client/src/components/CommentsPanel.tsx
interface CommentsPanelProps {
  fileId: string;
  currentUserId: string;
}

// Features:
// - Threaded comment display
// - Rich text editor (Markdown)
// - Reply to comments
// - Edit/delete own comments
// - Real-time updates via WebSocket
// - @mention autocomplete
// - Emoji support
```

#### Notification Center Component
```typescript
// client/src/components/NotificationCenter.tsx
interface NotificationCenterProps {
  userId: string;
}

// Features:
// - Dropdown with unread count badge
// - Mark as read on click
// - Mark all as read button
// - Filter by notification type
// - Link to resource
// - Real-time updates via WebSocket
// - Notification preferences modal
```

#### Tag Manager Component
```typescript
// client/src/components/TagManager.tsx
interface TagManagerProps {
  fileId?: string;
  onTagsChange?: (tags: Tag[]) => void;
}

// Features:
// - Tag input with autocomplete
// - Color picker for new tags
// - Tag chips with remove button
// - Bulk tag operations
// - Tag usage statistics
```

#### Advanced Search Component
```typescript
// client/src/components/AdvancedSearch.tsx
interface AdvancedSearchProps {
  onSearch: (query: SearchQuery) => void;
}

// Features:
// - Search input with autocomplete
// - Advanced filters panel (collapsible)
// - Date range picker
// - File type filter
// - Tag filter with multi-select
// - Size range slider
// - Save search queries
// - Search history
```

#### Bulk Operations Toolbar
```typescript
// client/src/components/BulkOperationsToolbar.tsx
interface BulkOperationsToolbarProps {
  selectedItems: SelectedItem[];
  onDownload: () => void;
  onDelete: () => void;
  onMove: () => void;
  onShare: () => void;
}

// Features:
// - Fixed toolbar when items selected
// - Action buttons with icons
// - Selection count display
// - Clear selection button
// - Progress indicator for async operations
// - MFA Setup Component
// client/src/components/MFASetup.tsx
interface MFASetupProps {
  userId: string;
  onSetupComplete: () => void;
// server/services/versionService.ts
class VersionService {
  async createVersion(fileId: string, uploadedBy: string): Promise<FileVersion>
  async listVersions(fileId: string): Promise<FileVersion[]>
  async getVersion(versionId: string): Promise<FileVersion>
  async restoreVersion(fileId: string, versionId: string, userId: string): Promise<FileVersion>
  async pruneOldVersions(fileId: string, retentionPolicy: RetentionPolicy): Promise<number>
  async getVersionDownloadUrl(versionId: string): Promise<string>
}

// Implementation Notes:
// - Automatic version creation on file update
// - Copy file to new GCS path with version suffix
// - Update file.currentVersionId
// - Background job for version pruning
```

#### Permission Service
```typescript
// server/services/permissionService.ts
class PermissionService {
  async checkPermission(userId: string, resourceType: string, resourceId: string, level: PermissionLevel): Promise<boolean>
  async grantPermission(resourceType: string, resourceId: string, userId: string, level: PermissionLevel, grantedBy: string): Promise<Permission>
  async revokePermission(permissionId: string): Promise<void>
  async listPermissions(resourceType: string, resourceId: string): Promise<Permission[]>
  async getInheritedPermissions(resourceType: string, resourceId: string): Promise<Permission[]>
  async getEffectivePermission(userId: string, resourceType: string, resourceId: string): Promise<PermissionLevel | null>
}

// Implementation Notes:
// - Cache permissions in Redis for performance
// - Check inherited permissions from parent folders
// - Permission hierarchy: view < download < edit < full
// - Audit log all permission changes
```

#### Audit Service
```typescript
// server/services/auditService.ts
class AuditService {
  async log(action: string, resourceType: string, resourceId: string, userId: string | null, metadata?: any, req?: Request): Promise<void>
  async query(filters: AuditLogFilters): Promise<PaginatedAuditLogs>
  async export(filters: AuditLogFilters, format: 'csv' | 'json'): Promise<string>
  async pruneOldLogs(retentionDays: number): Promise<number>
}

// Implementation Notes:
// - Async logging (don't block requests)
// - Extract IP and user agent from request
// - Redact sensitive data from metadata
// - Immutable logs (no updates/deletes)
```

#### Notification Service
```typescript
// server/services/notificationService.ts
class NotificationService {
  async create(userId: string, type: string, title: string, message: string, resourceType?: string, resourceId?: string): Promise<Notification>
  async markAsRead(notificationId: string): Promise<void>
  async markAllAsRead(userId: string): Promise<number>
  async list(userId: string, filters: NotificationFilters): Promise<PaginatedNotifications>
  async sendEmail(userId: string, notification: Notification): Promise<void>
  async sendRealtime(userId: string, notification: Notification): Promise<void>
}

// Implementation Notes:
// - Check user preferences before sending
// - Queue email notifications (don't block)
// - Send real-time via WebSocket/SSE
// - Batch notifications to reduce noise
```

#### MFA Service
```typescript
// server/services/mfaService.ts
class MFAService {
  async setupMFA(userId: string, type: 'totp' | 'sms', secret?: string, phoneNumber?: string): Promise<MFADevice>
  async verifyMFA(userId: string, code: string, mfaToken: string): Promise<boolean>
  async generateBackupCodes(userId: string): Promise<string[]>
  async getUserDevices(userId: string): Promise<MFADevice[]>
  async removeDevice(userId: string, deviceId: string): Promise<void>
  async validateTOTPSecret(secret: string, token: string): Promise<boolean>
}

// Implementation Notes:
// - Generate TOTP secret with crypto library
// - QR code generation for easy setup
// - Rate limiting for verification attempts
// - Encrypt sensitive data in database
```

#### Security Policies Service
```typescript
// server/services/securityPolicyService.ts
class SecurityPolicyService {
  async getPolicy(userId: string, policyType: string): Promise<SecurityPolicy | null>
  async updatePolicy(userId: string, policyType: string, policyValue: any): Promise<SecurityPolicy>
  async getUserPolicies(userId: string): Promise<SecurityPolicy[]>
  async getGlobalPolicies(): Promise<SecurityPolicy[]>
  async validateAccess(userId: string, resourceType: string, resourceId: string): Promise<boolean>
}

// Implementation Notes:
// - Policy evaluation engine for access control
// - Cache policies in Redis for performance
// - Policy inheritance (global > user > resource)
// - Audit all policy changes
```

#### E-Signature Service
```typescript
// server/services/signatureService.ts
class SignatureService {
  async createSignatureRequest(data: SignatureRequestData): Promise<SignatureRequest>
  async getSignatureRequests(userId: string): Promise<SignatureRequest[]>
  async getSigningInterface(requestId: string, recipientEmail: string): Promise<SigningInterface>
  async submitSignature(requestId: string, signatureData: SignatureData): Promise<void>
  async sendReminderEmails(requestId: string): Promise<void>
  async validateSignatureFields(fields: SignatureField[]): Promise<boolean>
}

// Implementation Notes:
// - PDF manipulation for signature placement
// - Email template rendering
// - Legally compliant signature capture
// - Audit trail for all signature actions
```

#### Integration Service
```typescript
// server/services/integrationService.ts
class IntegrationService {
  async connectIntegration(userId: string, type: string, authCode: string): Promise<IntegrationConnection>
  async getUserIntegrations(userId: string): Promise<IntegrationConnection[]>
  async disconnectIntegration(userId: string, connectionId: string): Promise<void>
  async refreshToken(connectionId: string): Promise<void>
  async syncData(connectionId: string): Promise<SyncResult>
  async getOAuthURL(type: string): Promise<string>
}

// Implementation Notes:
// - OAuth 2.0 flow implementation
// - Token encryption and secure storage
// - Webhook handling for real-time sync
// - Rate limiting for API calls
```

#### Workflow Service
```typescript
// server/services/workflowService.ts
class WorkflowService {
  async createWorkflow(userId: string, workflow: WorkflowDefinition): Promise<WorkflowDefinition>
  async getUserWorkflows(userId: string): Promise<WorkflowDefinition[]>
  async executeWorkflow(workflowId: string, triggerData: any): Promise<WorkflowExecution>
  async getWorkflowExecutions(workflowId: string): Promise<WorkflowExecution[]>
  async validateWorkflow(workflow: WorkflowDefinition): Promise<ValidationResult>
  async scheduleWorkflow(workflowId: string, schedule: ScheduleConfig): Promise<void>
}

// Implementation Notes:
// - Workflow engine with conditional logic
// - Action executor with error handling
// - Trigger detection and processing
// - Background job execution for long-running workflows
```

#### Admin Dashboard Service
```typescript
// server/services/adminService.ts
class AdminService {
  async getUserManagementData(): Promise<UserManagementData>
  async bulkUserOperation(operation: 'create' | 'update' | 'delete', users: UserData[]): Promise<BulkOperationResult>
  async getSystemHealth(): Promise<SystemHealth>
  async getUsageAnalytics(filters: AnalyticsFilters): Promise<UsageAnalytics>
  async getComplianceStatus(): Promise<ComplianceStatus>
  async exportAuditLogs(filters: AuditFilters): Promise<string>
}

// Implementation Notes:
// - Role-based access control for admin functions
// - Real-time metrics aggregation
// - Compliance report generation
// - Bulk operation optimization
```

#### Search Service
```typescript
// server/services/searchService.ts
class SearchService {
  async search(query: string, filters: SearchFilters, userId: string): Promise<SearchResults>
  async indexFile(fileId: string): Promise<void>
  async removeFromIndex(fileId: string): Promise<void>
  async updateIndex(fileId: string): Promise<void>
  async rebuildIndex(): Promise<void>
}

// Implementation Notes:
// - Phase 1: PostgreSQL full-text search
// - Phase 2: Elasticsearch integration
// - Filter results by user permissions
// - Async indexing via background jobs
```


## 5. Global Scale & Performance Architecture

### 5.1 Multi-Region Deployment Strategy

**Architecture**:
```
Global Load Balancer (CloudFlare/Route53)
  ↓
┌─────────────────┬──────────────────┬──────────────────┐
│ US-East Region  │ EU-West Region   │ Asia-Pacific Reg │
└─────────────────┴──────────────────┴──────────────────┘
   ↓                  ↓                   ↓
  ALB              ALB              ALB
   ↓                  ↓                   ↓
App Servers      App Servers      App Servers
(stateless)      (stateless)      (stateless)
   ↓                  ↓                   ↓
Postgres+      Postgres+        Postgres+
Read Replicas  Read Replicas    Read Replicas
   ↓                  ↓                   ↓
 GCS Bucket    GCS Bucket       GCS Bucket
 (regional)    (regional)       (regional)
```

**Implementation**:
- Route users to nearest region based on geolocation
- Replicate database across regions (primary-replica)
- Regional object storage (GCS buckets per region)
- Global CDN for static assets and public share links
- Cross-region replication for HA

### 5.2 Caching Strategy

**Multi-Layer Cache**:
```
Browser Cache (HTTP headers)
  ↓ Cache miss
CDN Cache (CloudFlare)
  ↓ Cache miss
Application In-Memory Cache (LRU, 500MB)
  ↓ Cache miss
Redis Cache (distributed, 5-min TTL)
  ↓ Cache miss
Database (PostgreSQL)
```

**Cache Invalidation Strategy**:
```typescript
// server/cache/cacheManager.ts
interface CacheInvalidationEvent {
  type: 'file_update' | 'permission_change' | 'dlp_rule_update' | 'analysis_complete';
  resourceId: string;
  dependents?: string[]; // Other resources that depend on this
}

function getCacheKeysToInvalidate(event: CacheInvalidationEvent): string[] {
  switch (event.type) {
    case 'file_update':
      return [
        `file:${event.resourceId}`,
        `file:${event.resourceId}:versions`,
        `search:*`, // Invalidate all search results
        `embeddings:${event.resourceId}`,
        `analysis:${event.resourceId}`,
      ];
    case 'permission_change':
      return [
        `perm:*:file:${event.resourceId}`, // All user permissions
        `file_access:${event.resourceId}`, // Access cache
      ];
    case 'dlp_rule_update':
      return [
        `dlp:*`, // All DLP caches
        `file_classification:*`, // All file classifications
      ];
    case 'analysis_complete':
      return [
        `analysis:${event.resourceId}`,
        `search:*`, // Invalidate search
      ];
  }
}
```

### 5.3 Database Performance Optimization

**Query Optimization**:
1. **Materialized Views** for analytics
   - `mv_daily_active_users` - DAU reporting
   - `mv_top_shared_files` - Popular files
   - `mv_user_storage_usage` - Storage analytics

2. **Prepared Statements** for common queries
   - `prepared_list_files`
   - `prepared_check_permission`
   - `prepared_get_versions`

3. **Connection Pooling**
   - Max pool size: 20
   - Connection reuse: 5 minutes
   - Idle timeout: 30 seconds

4. **Query Execution Plans**
   - Index all frequently filtered columns
   - Use `EXPLAIN ANALYZE` for slow queries
   - Set work_mem for large sorts

### 5.4 CDN Strategy

```typescript
// server/middleware/cdn.ts
function setCDNHeaders(res: Response, assetType: string) {
  switch (assetType) {
    case 'static_asset': // JS, CSS, images
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
      res.setHeader('CDN-Cache-Control', 'public, max-age=31536000');
      break;
    case 'public_share_link': // Public files
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
      res.setHeader('CDN-Cache-Control', 'public, max-age=3600');
      break;
    case 'api_response': // API endpoints
      res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minutes
      res.setHeader('Vary', 'Authorization'); // Don't cache across users
      break;
  }
}
```

### 5.5 Real-time Communication Optimization

**Binary Protocol for WebSocket** (reduce bandwidth):
```typescript
// server/realtime/binaryProtocol.ts
interface BinaryMessage {
  type: uint8; // 0=notification, 1=comment, 2=permission, 3=file_update
  payload: Uint8Array; // MessagePack encoded data
  timestamp: uint32;
}

// Text message: ~500 bytes
// Binary message: ~50 bytes (90% reduction)
```

**Connection Optimization**:
- Pool WebSocket connections
- Implement heartbeat every 30 seconds
- Reconnect with exponential backoff
- Batch notifications (100ms window)

### 5.6 Incremental Sync (Future)

For offline-first capabilities:
```typescript
interface SyncDelta {
  type: 'file_created' | 'file_updated' | 'file_deleted' | 'permission_changed';
  resource: any;
  timestamp: number;
  hash: string; // For conflict detection
}

// Client tracks lastSyncTime
// Server returns only changes since lastSyncTime
// Reduces bandwidth for mobile users
```



### 5.1 WebSocket Architecture

#### Technology Choice: Socket.io
- Mature, battle-tested library
- Automatic fallback to long-polling
- Room-based broadcasting
- Built-in reconnection logic
- TypeScript support

#### Server Setup
```typescript
// server/realtime.ts
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

export function setupRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL },
    adapter: createAdapter(redisClient, redisClient.duplicate())
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    const user = await validateToken(token);
    if (user) {
      socket.data.userId = user.id;
      next();
    } else {
      next(new Error('Authentication failed'));
    }
  });

  // Join user-specific room
  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
    
    // Join file-specific rooms when viewing files
    socket.on('subscribe:file', (fileId) => {
      socket.join(`file:${fileId}`);
    });
    
    socket.on('unsubscribe:file', (fileId) => {
      socket.leave(`file:${fileId}`);
    });
  });

  return io;
}
```

#### Event Types
```typescript
// Notification events
io.to(`user:${userId}`).emit('notification', {
  type: 'file_share',
  title: 'New file shared',
  message: '...',
  resourceId: 'file-id'
});

// Comment events
io.to(`file:${fileId}`).emit('comment:new', {
  commentId: 'uuid',
  userId: 'user-id',
  userName: 'John Doe',
  content: 'Great work!',
  createdAt: '2026-01-15T10:00:00Z'
});

// Permission change events
io.to(`user:${userId}`).emit('permission:granted', {
  resourceType: 'file',
  resourceId: 'file-id',
  permissionLevel: 'edit'
});

// File update events
io.to(`file:${fileId}`).emit('file:updated', {
  fileId: 'file-id',
  versionNumber: 3,
  updatedBy: 'user-id'
});
```

### 5.2 Client Integration

#### React Hook for WebSocket
```typescript
// client/src/hooks/use-realtime.ts
export function useRealtime() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const socket = io(API_URL, {
      auth: { token: getAuthToken() }
    });

    socket.on('connect', () => {
      console.log('Connected to realtime server');
    });

    socket.on('notification', (notification) => {
      // Update notification state
      queryClient.invalidateQueries(['notifications']);
      toast.info(notification.title);
    });

    setSocket(socket);

    return () => {
      socket.disconnect();
    };
  }, [user]);

  return socket;
}
```

#### File Subscription Hook
```typescript
// client/src/hooks/use-file-subscription.ts
export function useFileSubscription(fileId: string) {
  const socket = useRealtime();

  useEffect(() => {
    if (!socket || !fileId) return;

    socket.emit('subscribe:file', fileId);

    socket.on('comment:new', (comment) => {
      queryClient.setQueryData(['comments', fileId], (old) => [...old, comment]);
    });

    socket.on('file:updated', (update) => {
      queryClient.invalidateQueries(['file', fileId]);
      queryClient.invalidateQueries(['versions', fileId]);
    });

    return () => {
      socket.emit('unsubscribe:file', fileId);
      socket.off('comment:new');
      socket.off('file:updated');
    };
  }, [socket, fileId]);
}
```

### 5.3 Scalability Considerations

#### Redis Adapter
- Use Redis adapter for multi-server deployments
- Enables broadcasting across server instances
- Shared state for room memberships

#### Connection Limits
- Monitor concurrent connections per server
- Implement connection throttling
- Use sticky sessions for load balancing

#### Fallback Strategy
- Socket.io automatically falls back to long-polling
- Implement polling-based updates as ultimate fallback
- Graceful degradation for unsupported browsers


## 6. Background Job Processing

### 6.1 Job Queue Architecture

#### Technology Choice: BullMQ
- Built on Redis for reliability
- Delayed jobs and retries
- Job prioritization
- Progress tracking
- TypeScript support

#### Queue Setup
```typescript
// server/jobs/queue.ts
import { Queue, Worker } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379')
};

// Define queues
export const versionPruningQueue = new Queue('version-pruning', { connection });
export const notificationQueue = new Queue('notifications', { connection });
export const searchIndexQueue = new Queue('search-index', { connection });
export const bulkOperationsQueue = new Queue('bulk-operations', { connection });
export const auditLogPruningQueue = new Queue('audit-log-pruning', { connection });
```

### 6.2 Job Definitions

#### Version Pruning Job
```typescript
// server/jobs/workers/versionPruning.ts
const versionPruningWorker = new Worker('version-pruning', async (job) => {
  const { fileId, retentionPolicy } = job.data;
  
  const versions = await db.query.fileVersions.findMany({
    where: eq(fileVersions.fileId, fileId),
    orderBy: desc(fileVersions.versionNumber)
  });

  const versionsToDelete = versions.slice(retentionPolicy.maxVersions);
  
  for (const version of versionsToDelete) {
    // Delete from GCS
    await storage.bucket(BUCKET_NAME).file(version.objectPath).delete();
    
    // Soft delete in database
    await db.update(fileVersions)
      .set({ isDeleted: true })
      .where(eq(fileVersions.id, version.id));
  }

  return { deletedCount: versionsToDelete.length };
}, { connection });

// Schedule daily pruning for all files
cron.schedule('0 2 * * *', async () => {
  const files = await db.query.files.findMany();
  for (const file of files) {
    await versionPruningQueue.add('prune', {
      fileId: file.id,
      retentionPolicy: { maxVersions: 10 }
    });
  }
});
```

#### Email Notification Job
```typescript
// server/jobs/workers/emailNotifications.ts
const emailWorker = new Worker('notifications', async (job) => {
  const { userId, notification } = job.data;
  
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId)
  });

  const preferences = await db.query.notificationPreferences.findFirst({
    where: and(
      eq(notificationPreferences.userId, userId),
      eq(notificationPreferences.notificationType, notification.type)
    )
  });

  if (preferences?.email) {
    await sendEmail({
      to: user.email,
      subject: notification.title,
      html: renderEmailTemplate(notification)
    });
  }

  return { sent: preferences?.email || false };
}, { connection });
```

#### Search Indexing Job
```typescript
// server/jobs/workers/searchIndexing.ts
const searchIndexWorker = new Worker('search-index', async (job) => {
  const { action, fileId } = job.data;
  
  switch (action) {
    case 'index':
      const file = await db.query.files.findFirst({
        where: eq(files.id, fileId),
        with: { folder: true, tags: true }
      });
      
      // Update PostgreSQL full-text search vector
      await db.execute(sql`
        UPDATE files
        SET search_vector = to_tsvector('english', ${file.name} || ' ' || ${file.mimeType})
        WHERE id = ${fileId}
      `);
      break;
      
    case 'remove':
      await db.execute(sql`
        UPDATE files
        SET search_vector = NULL
        WHERE id = ${fileId}
      `);
      break;
  }

  return { action, fileId };
}, { connection });
```

#### Bulk Download Job
```typescript
// server/jobs/workers/bulkDownload.ts
import archiver from 'archiver';

const bulkDownloadWorker = new Worker('bulk-operations', async (job) => {
  const { jobId, fileIds, folderIds, userId } = job.data;
  
  const archive = archiver('zip', { zlib: { level: 9 } });
  const outputPath = `/tmp/bulk-${jobId}.zip`;
  const output = fs.createWriteStream(outputPath);
  
  archive.pipe(output);

  // Add files to archive
  for (const fileId of fileIds) {
    const file = await db.query.files.findFirst({
      where: eq(files.id, fileId)
    });
    
    const downloadUrl = await storage.bucket(BUCKET_NAME)
      .file(file.objectPath)
      .getSignedUrl({ action: 'read', expires: Date.now() + 3600000 });
    
    const response = await fetch(downloadUrl[0]);
    const buffer = await response.arrayBuffer();
    
    archive.append(Buffer.from(buffer), { name: file.name });
    
    // Update progress
    await job.updateProgress((fileIds.indexOf(fileId) + 1) / fileIds.length * 100);
  }

  await archive.finalize();

  // Upload to GCS
  const uploadPath = `bulk-downloads/${jobId}.zip`;
  await storage.bucket(BUCKET_NAME).upload(outputPath, {
    destination: uploadPath
  });

  // Generate presigned URL
  const [url] = await storage.bucket(BUCKET_NAME)
    .file(uploadPath)
    .getSignedUrl({ action: 'read', expires: Date.now() + 86400000 }); // 24 hours

  return { downloadUrl: url, expiresAt: new Date(Date.now() + 86400000) };
}, { connection });
```

### 6.3 Job Monitoring

#### Dashboard Integration
```typescript
// server/routes/admin.ts
app.get('/api/admin/jobs', requireAdmin, async (req, res) => {
  const queues = [versionPruningQueue, notificationQueue, searchIndexQueue];
  
  const stats = await Promise.all(queues.map(async (queue) => ({
    name: queue.name,
    waiting: await queue.getWaitingCount(),
    active: await queue.getActiveCount(),
    completed: await queue.getCompletedCount(),
    failed: await queue.getFailedCount()
  })));

  res.json({ queues: stats });
});
```


## 7. Security Considerations

### 7.1 Permission Enforcement

#### Middleware for Permission Checks
```typescript
// server/middleware/permissions.ts
export function requirePermission(level: PermissionLevel) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { resourceType, resourceId } = req.params;
    const userId = req.session.userId;

    const hasPermission = await permissionService.checkPermission(
      userId,
      resourceType,
      resourceId,
      level
    );

    if (!hasPermission) {
      await auditService.log('permission_denied', resourceType, resourceId, userId, {
        requiredLevel: level
      }, req);
      
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'PERMISSION_DENIED'
      });
    }

    next();
  };
}

// Usage
app.get('/api/files/:fileId', requireAuth, requirePermission('view'), async (req, res) => {
  // Handler code
});
```

#### Permission Caching Strategy
```typescript
// server/services/permissionCache.ts
class PermissionCache {
  private redis: Redis;
  private TTL = 300; // 5 minutes

  async get(userId: string, resourceType: string, resourceId: string): Promise<PermissionLevel | null> {
    const key = `perm:${userId}:${resourceType}:${resourceId}`;
    const cached = await this.redis.get(key);
    return cached ? (cached as PermissionLevel) : null;
  }

  async set(userId: string, resourceType: string, resourceId: string, level: PermissionLevel): Promise<void> {
    const key = `perm:${userId}:${resourceType}:${resourceId}`;
    await this.redis.setex(key, this.TTL, level);
  }

  async invalidate(resourceType: string, resourceId: string): Promise<void> {
    const pattern = `perm:*:${resourceType}:${resourceId}`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### 7.2 Audit Log Security

#### Immutable Logs
- No UPDATE or DELETE operations on audit_logs table
- Database-level constraints prevent modifications
- Separate retention policy for compliance

#### Sensitive Data Redaction
```typescript
// server/services/auditService.ts
function redactSensitiveData(metadata: any): any {
  const redacted = { ...metadata };
  
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'sessionId'];
  
  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      redacted[key] = '[REDACTED]';
    }
  }
  
  return redacted;
}
```

### 7.3 Rate Limiting

#### Per-User Rate Limits
```typescript
// server/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:api:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  keyGenerator: (req) => req.session.userId || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
});

export const commentLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:comment:'
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 comments per minute
  keyGenerator: (req) => req.session.userId
});

// Apply to routes
app.use('/api', apiLimiter);
app.post('/api/files/:fileId/comments', commentLimiter, requireAuth, async (req, res) => {
  // Handler
});
```

### 7.4 Input Validation

#### Zod Schemas for All Inputs
```typescript
// server/validation/schemas.ts
import { z } from 'zod';

export const createPermissionSchema = z.object({
  userId: z.string().uuid(),
  permissionLevel: z.enum(['view', 'download', 'edit', 'full']),
  expiresAt: z.string().datetime().optional()
});

export const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  parentCommentId: z.string().uuid().optional()
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  type: z.enum(['file', 'folder']).optional(),
  mimeType: z.string().optional(),
  tags: z.array(z.string().uuid()).optional(),
  minSize: z.number().int().positive().optional(),
  maxSize: z.number().int().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().int().positive().max(1000).default(50),
  offset: z.number().int().nonnegative().default(0)
});

// Usage in routes
app.post('/api/files/:fileId/permissions', requireAuth, async (req, res) => {
  try {
    const data = createPermissionSchema.parse(req.body);
    // Process validated data
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    throw error;
  }
});
```

### 7.5 CSRF Protection

#### Token-Based CSRF
```typescript
// server/middleware/csrf.ts
import csrf from 'csurf';

export const csrfProtection = csrf({
  cookie: false, // Use session storage
  sessionKey: 'csrfSecret'
});

// Apply to state-changing routes
app.post('/api/*', csrfProtection, (req, res, next) => {
  next();
});

// Provide token to client
app.get('/api/csrf-token', requireAuth, csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```


## 8. Performance and Scalability

### 8.1 Database Optimization

#### Indexing Strategy
```sql
-- File versions: Fast lookup by file and date
CREATE INDEX idx_file_versions_file_created ON file_versions(file_id, created_at DESC);

-- Permissions: Fast permission checks
CREATE INDEX idx_permissions_user_resource ON permissions(user_id, resource_type, resource_id);

-- Audit logs: Fast queries by user and date
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);

-- Comments: Fast lookup by file
CREATE INDEX idx_comments_file_created ON comments(file_id, created_at DESC);

-- Notifications: Fast unread queries
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- Full-text search
CREATE INDEX idx_files_search ON files USING GIN(search_vector);
```

#### Query Optimization
```typescript
// Use select() to fetch only needed columns
const files = await db.query.files.findMany({
  columns: {
    id: true,
    name: true,
    size: true,
    createdAt: true
  },
  where: eq(files.userId, userId),
  limit: 50
});

// Use with() for efficient joins
const fileWithDetails = await db.query.files.findFirst({
  where: eq(files.id, fileId),
  with: {
    folder: true,
    shareLinks: true,
    tags: {
      with: {
        tag: true
      }
    }
  }
});

// Batch queries to reduce round trips
const [files, folders, tags] = await Promise.all([
  db.query.files.findMany({ where: eq(files.userId, userId) }),
  db.query.folders.findMany({ where: eq(folders.userId, userId) }),
  db.query.tags.findMany({ where: eq(tags.userId, userId) })
]);
```

### 8.2 Caching Strategy

#### Multi-Layer Cache
```typescript
// server/cache/cacheManager.ts
class CacheManager {
  private redis: Redis;
  private memoryCache: Map<string, any>;

  async get<T>(key: string): Promise<T | null> {
    // L1: Memory cache (fastest)
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }

    // L2: Redis cache
    const cached = await this.redis.get(key);
    if (cached) {
      const value = JSON.parse(cached);
      this.memoryCache.set(key, value);
      return value;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    this.memoryCache.set(key, value);
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear Redis cache
    const keys = await this.redis.keys(`*${pattern}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// Cache keys
const CACHE_KEYS = {
  file: (fileId: string) => `file:${fileId}`,
  permissions: (userId: string, resourceId: string) => `perm:${userId}:${resourceId}`,
  userFiles: (userId: string) => `user:${userId}:files`,
  tags: (userId: string) => `user:${userId}:tags`
};
```

#### Cache Invalidation
```typescript
// Invalidate cache on mutations
async function updateFile(fileId: string, updates: Partial<File>) {
  await db.update(files).set(updates).where(eq(files.id, fileId));
  
  // Invalidate related caches
  await cacheManager.invalidate(CACHE_KEYS.file(fileId));
  await cacheManager.invalidate(`user:${file.userId}:files`);
  
  // Trigger search reindex
  await searchIndexQueue.add('index', { fileId });
}
```

### 8.3 Database Connection Pooling

```typescript
// server/db.ts
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // Read replica for queries
  ...(process.env.DATABASE_REPLICA_URL && {
    replication: {
      master: { url: process.env.DATABASE_URL },
      slaves: [{ url: process.env.DATABASE_REPLICA_URL }]
    }
  })
});

export const db = drizzle(pool, { schema });
```

### 8.4 Pagination Best Practices

#### Cursor-Based Pagination
```typescript
// More efficient than offset-based for large datasets
async function listFiles(userId: string, cursor?: string, limit: number = 50) {
  const query = db.query.files.findMany({
    where: and(
      eq(files.userId, userId),
      cursor ? lt(files.createdAt, new Date(cursor)) : undefined
    ),
    orderBy: desc(files.createdAt),
    limit: limit + 1 // Fetch one extra to determine if there's a next page
  });

  const results = await query;
  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  return { items, nextCursor, hasMore };
}
```

### 8.5 File Upload Optimization

#### Chunked Uploads for Large Files
```typescript
// client/src/lib/chunkedUpload.ts
export async function uploadLargeFile(file: File, onProgress: (percent: number) => void) {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  const chunks = Math.ceil(file.size / CHUNK_SIZE);
  
  // Initialize multipart upload
  const { uploadId, uploadUrls } = await fetch('/api/files/upload/init', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      chunks
    })
  }).then(r => r.json());

  // Upload chunks in parallel (max 3 concurrent)
  const uploadPromises = [];
  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const promise = fetch(uploadUrls[i], {
      method: 'PUT',
      body: chunk
    }).then(() => {
      onProgress((i + 1) / chunks * 100);
    });

    uploadPromises.push(promise);

    // Limit concurrent uploads
    if (uploadPromises.length >= 3) {
      await Promise.race(uploadPromises);
      uploadPromises.splice(uploadPromises.findIndex(p => p), 1);
    }
  }

  await Promise.all(uploadPromises);

  // Complete multipart upload
  await fetch(`/api/files/upload/${uploadId}/complete`, {
    method: 'POST'
  });
}
```

### 8.6 CDN Integration

```typescript
// Serve static assets and file downloads via CDN
const CDN_URL = process.env.CDN_URL || 'https://cdn.cloudvault.com';

function getFileDownloadUrl(file: File): string {
  // Use CDN for public files
  if (file.isPublic) {
    return `${CDN_URL}/files/${file.id}/${file.name}`;
  }
  
  // Use presigned URLs for private files
  return generatePresignedUrl(file.objectPath);
}
```


## 9. Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### 9.1 File Version Control Properties

**Property 1: Version Creation on Update**
*For any* file update operation, a new version record SHALL be created with an incremented version number and the current file content SHALL be preserved in the new version.
**Validates: Requirements 2.1.1**

**Property 2: Version List Completeness**
*For any* file with versions, the version list API SHALL return all versions with timestamp, uploader ID, size, and MIME type fields populated.
**Validates: Requirements 2.1.2**

**Property 3: Version Download Availability**
*For any* file version that is not deleted, a valid presigned download URL SHALL be generated that allows downloading the version content.
**Validates: Requirements 2.1.3**

**Property 4: Version Restore Creates New Version**
*For any* previous version being restored, the restore operation SHALL create a new version with the same content as the restored version, and the new version SHALL become the current version.
**Validates: Requirements 2.1.4**

**Property 5: Version Pruning Respects Limit**
*For any* file with more versions than the configured retention limit, after pruning, the number of non-deleted versions SHALL equal the retention limit, and the most recent versions SHALL be retained.
**Validates: Requirements 2.1.5, 2.1.6**

### 9.2 Permission System Properties

**Property 6: Permission Level Hierarchy**
*For any* user with a given permission level on a resource, they SHALL have access to all operations allowed by that level and all lower levels (full > edit > download > view).
**Validates: Requirements 2.2.1**

**Property 7: Permission Inheritance**
*For any* folder with a permission granted to a user, all child files and folders SHALL inherit that permission unless explicitly overridden with a different permission.
**Validates: Requirements 2.2.2**

**Property 8: Permission Grant Enables Access**
*For any* user granted a permission on a resource, subsequent permission checks for that user and resource SHALL return true for the granted level and all lower levels.
**Validates: Requirements 2.2.3**

**Property 9: Permission Changes Create Audit Logs**
*For any* permission grant, update, or revoke operation, an audit log entry SHALL be created with action type 'permission_change' and metadata containing the permission details.
**Validates: Requirements 2.2.4**

**Property 10: Permission List Completeness**
*For any* resource, the permissions list API SHALL return all users with explicit permissions on that resource, including permission level, granter, and creation timestamp.
**Validates: Requirements 2.2.5**

**Property 11: Permission Revocation Removes Access**
*For any* permission that is revoked, subsequent permission checks for that user and resource SHALL return false for the revoked level (unless inherited from parent).
**Validates: Requirements 2.2.6**


### 9.3 Audit Log Properties

**Property 12: Comprehensive Operation Logging**
*For any* file operation (upload, download, delete, share, permission change), an audit log entry SHALL be created with the operation type, resource ID, user ID, and timestamp.
**Validates: Requirements 2.3.1**

**Property 13: Audit Log Field Completeness**
*For any* audit log entry, it SHALL contain timestamp, action type, resource type, resource ID, and optionally user ID, IP address, and user agent fields.
**Validates: Requirements 2.3.2**

**Property 14: Audit Log Immutability**
*For any* audit log entry, attempts to update or delete it SHALL fail, ensuring logs remain immutable and tamper-evident.
**Validates: Requirements 2.3.3**

**Property 15: Audit Log Search Correctness**
*For any* audit log search query with filters, the results SHALL contain only logs matching all specified filters (user, action, resource, date range).
**Validates: Requirements 2.3.4**

**Property 16: Audit Log Export Completeness**
*For any* audit log export request, the exported file SHALL contain all logs matching the filters in the specified format (CSV or JSON) with all fields present.
**Validates: Requirements 2.3.5**

**Property 17: Audit Log Retention Enforcement**
*For any* audit log older than the configured retention period, it SHALL be removed by the pruning job, and logs within the retention period SHALL be preserved.
**Validates: Requirements 2.3.6**

### 9.4 Comment System Properties

**Property 18: Comment Creation Permission**
*For any* user with 'view' or higher permission on a file, they SHALL be able to create comments on that file.
**Validates: Requirements 2.4.1**

**Property 19: Comment Field Completeness**
*For any* comment, it SHALL contain content, author user ID, file ID, timestamp, and optionally parent comment ID for replies.
**Validates: Requirements 2.4.2**

**Property 20: Comment Threading**
*For any* comment reply, it SHALL be correctly linked to its parent comment via parentCommentId, and the parent comment SHALL include the reply in its replies array.
**Validates: Requirements 2.4.3**

**Property 21: Comment Ownership for Edit/Delete**
*For any* comment, only the comment author SHALL be able to edit or delete it (unless the user is the file owner).
**Validates: Requirements 2.4.4**

**Property 22: File Owner Comment Deletion**
*For any* comment on a file, the file owner SHALL be able to delete it regardless of who authored the comment.
**Validates: Requirements 2.4.5**

**Property 23: Comment Visibility**
*For any* user with 'view' or higher permission on a file, they SHALL be able to see all non-deleted comments on that file.
**Validates: Requirements 2.4.6**

### 9.5 Notification Properties

**Property 24: Activity Notification Creation**
*For any* file activity (upload, share, comment, permission change), a notification SHALL be created for relevant users (file owner, mentioned users, users with access).
**Validates: Requirements 3.1.1**

**Property 25: Email Notification Preference**
*For any* notification, an email SHALL be sent to the user only if their notification preferences have email enabled for that notification type.
**Validates: Requirements 3.1.2**

**Property 26: Notification Read State**
*For any* notification marked as read, subsequent queries SHALL show isRead as true, and the unread count SHALL decrease by one.
**Validates: Requirements 3.1.4**

**Property 27: Notification Filtering**
*For any* notification list query with filters (unread only, type), the results SHALL contain only notifications matching all specified filters.
**Validates: Requirements 3.1.5**

**Property 28: Real-time Notification Delivery**
*For any* notification created while a user is connected via WebSocket, the notification SHALL be delivered to the user's WebSocket connection in real-time.
**Validates: Requirements 3.1.6**


### 9.6 Search Properties

**Property 29: Search Query Matching**
*For any* search query, the results SHALL contain only files whose name or metadata contains the search terms (case-insensitive).
**Validates: Requirements 3.2.1**

**Property 30: Search Filter Correctness**
*For any* search with filters (file type, date range, size, owner), the results SHALL contain only files matching all specified filters.
**Validates: Requirements 3.2.2**

**Property 31: Folder-Scoped Search**
*For any* search scoped to a folder, the results SHALL contain only files within that folder or its subfolders.
**Validates: Requirements 3.2.3**

**Property 32: Search Permission Filtering**
*For any* search query, the results SHALL contain only files for which the user has at least 'view' permission.
**Validates: Requirements 3.2.1** (implicit security requirement)

**Property 33: Search Operator Correctness**
*For any* search query with boolean operators (AND, OR, NOT), the results SHALL correctly reflect the logical combination of terms.
**Validates: Requirements 3.2.6**

### 9.7 Bulk Operations Properties

**Property 34: Bulk Download Completeness**
*For any* bulk download request with file IDs, the generated ZIP archive SHALL contain all specified files with their original names and content.
**Validates: Requirements 3.4.2**

**Property 35: Bulk Delete Atomicity**
*For any* bulk delete request, either all specified files SHALL be deleted successfully, or none SHALL be deleted if any operation fails.
**Validates: Requirements 3.4.3**

**Property 36: Bulk Move Consistency**
*For any* bulk move request, all specified files SHALL have their folderId updated to the target folder, and their paths SHALL reflect the new location.
**Validates: Requirements 3.4.4**

**Property 37: Bulk Share Link Creation**
*For any* bulk share link request, a share link SHALL be created for each specified file, and all links SHALL be returned in the response.
**Validates: Requirements 3.4.5**

### 9.8 Tag System Properties

**Property 38: Multiple Tags Per File**
*For any* file, multiple tags SHALL be assignable, and all assigned tags SHALL be returned when querying the file's tags.
**Validates: Requirements 3.5.1**

**Property 39: Tag Filtering Correctness**
*For any* tag filter query, the results SHALL contain only files that have the specified tag assigned.
**Validates: Requirements 3.5.3**

**Property 40: Metadata Round-Trip**
*For any* file with custom metadata (key-value pairs), setting metadata and then retrieving it SHALL return the same key-value pairs.
**Validates: Requirements 3.5.4**

**Property 41: Bulk Tag Operation Consistency**
*For any* bulk tag operation (add/remove tags), all specified files SHALL have the tag operation applied, and subsequent queries SHALL reflect the changes.
**Validates: Requirements 3.5.5**

**Property 42: Tag Rename Propagation**
*For any* tag rename operation, all files with that tag SHALL reflect the new tag name in subsequent queries.
**Validates: Requirements 3.5.6**

### 9.9 Security Properties

**Property 43: File Encryption at Rest**
*For any* file uploaded to storage, the file content SHALL be encrypted using AES-256-GCM before being stored in GCS.
**Validates: Requirements 6.2.1**

**Property 44: MFA Enforcement**
*For any* user with MFA enabled, authentication attempts without valid MFA token SHALL be rejected.
**Validates: Requirements 6.2.3**

**Property 45: IP Whitelist Enforcement**
*For any* enterprise account with IP whitelist configured, requests from non-whitelisted IP addresses SHALL be rejected with 403 Forbidden.
**Validates: Requirements 6.2.4**

**Property 46: Session Timeout**
*For any* user session, if no activity occurs for the configured timeout period, the session SHALL be invalidated and subsequent requests SHALL require re-authentication.
**Validates: Requirements 6.2.5**

**Property 47: CSRF Protection**
*For any* state-changing API request (POST, PUT, DELETE), requests without a valid CSRF token SHALL be rejected with 403 Forbidden.
**Validates: Requirements 6.2.6**


## 10. Error Handling

### 10.1 Error Response Format

All API errors follow a consistent format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### 10.2 Error Codes

#### Authentication Errors (401)
- `AUTH_REQUIRED`: User not authenticated
- `AUTH_INVALID`: Invalid authentication token
- `AUTH_EXPIRED`: Session expired
- `MFA_REQUIRED`: Multi-factor authentication required

#### Authorization Errors (403)
- `PERMISSION_DENIED`: Insufficient permissions
- `CSRF_INVALID`: Invalid CSRF token
- `IP_BLOCKED`: IP address not whitelisted
- `RESOURCE_FORBIDDEN`: Access to resource forbidden

#### Validation Errors (400)
- `VALIDATION_ERROR`: Input validation failed
- `INVALID_FILE_TYPE`: Unsupported file type
- `FILE_TOO_LARGE`: File exceeds size limit
- `INVALID_VERSION`: Version number invalid

#### Resource Errors (404)
- `FILE_NOT_FOUND`: File does not exist
- `FOLDER_NOT_FOUND`: Folder does not exist
- `VERSION_NOT_FOUND`: Version does not exist
- `PERMISSION_NOT_FOUND`: Permission does not exist

#### Conflict Errors (409)
- `DUPLICATE_TAG`: Tag name already exists
- `PERMISSION_EXISTS`: Permission already granted
- `VERSION_CONFLICT`: Concurrent version update

#### Rate Limit Errors (429)
- `RATE_LIMIT_EXCEEDED`: Too many requests

#### Server Errors (500)
- `INTERNAL_ERROR`: Unexpected server error
- `STORAGE_ERROR`: Cloud storage operation failed
- `DATABASE_ERROR`: Database operation failed

### 10.3 Error Handling Patterns

#### Graceful Degradation
```typescript
// If real-time notifications fail, fall back to polling
try {
  await sendRealtimeNotification(userId, notification);
} catch (error) {
  logger.warn('Real-time notification failed, user will receive via polling', { error });
  // Notification still saved in database for polling
}
```

#### Retry Logic
```typescript
// Retry transient errors with exponential backoff
async function uploadToGCS(file: Buffer, path: string, retries = 3): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await storage.bucket(BUCKET_NAME).file(path).save(file);
      return;
    } catch (error) {
      if (i === retries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
}
```

#### Transaction Rollback
```typescript
// Rollback database changes on error
async function createFileWithVersion(fileData: InsertFile, versionData: InsertFileVersion) {
  const transaction = await db.transaction();
  
  try {
    const file = await transaction.insert(files).values(fileData).returning();
    const version = await transaction.insert(fileVersions).values({
      ...versionData,
      fileId: file[0].id
    }).returning();
    
    await transaction.commit();
    return { file: file[0], version: version[0] };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

#### Circuit Breaker
```typescript
// Prevent cascading failures
class CircuitBreaker {
  private failures = 0;
  private lastFailure: Date | null = null;
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.failures >= this.threshold) {
      if (this.lastFailure && Date.now() - this.lastFailure.getTime() < this.timeout) {
        return true;
      }
      this.reset();
    }
    return false;
  }

  private onSuccess(): void {
    this.failures = 0;
    this.lastFailure = null;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = new Date();
  }

  private reset(): void {
    this.failures = 0;
    this.lastFailure = null;
  }
}
```


## 11. Testing Strategy

### 11.1 Testing Approach

CloudVault's enterprise features require a comprehensive testing strategy that combines:

- **Unit Tests**: Verify specific functions and components in isolation
- **Property-Based Tests**: Verify universal properties across all inputs
- **Integration Tests**: Verify interactions between components
- **End-to-End Tests**: Verify complete user workflows

Both unit tests and property tests are complementary and necessary for comprehensive coverage. Unit tests catch concrete bugs and edge cases, while property tests verify general correctness across many inputs.

### 11.2 Property-Based Testing

#### Configuration
- **Library**: fast-check (TypeScript/JavaScript property-based testing)
- **Iterations**: Minimum 100 runs per property test
- **Seed**: Configurable for reproducibility
- **Shrinking**: Automatic minimal failing case generation

#### Property Test Structure
```typescript
import fc from 'fast-check';

describe('File Version Control', () => {
  it('Property 1: Version Creation on Update', () => {
    // Feature: enterprise-features-gap-analysis, Property 1: Version Creation on Update
    fc.assert(
      fc.asyncProperty(
        fc.record({
          fileId: fc.uuid(),
          userId: fc.uuid(),
          content: fc.uint8Array({ minLength: 1, maxLength: 1000 }),
          fileName: fc.string({ minLength: 1, maxLength: 255 })
        }),
        async ({ fileId, userId, content, fileName }) => {
          // Arrange: Create initial file
          const initialVersion = await createFile(fileId, userId, content, fileName);
          const initialVersionCount = await getVersionCount(fileId);

          // Act: Update file
          const newContent = Buffer.from('updated content');
          await updateFile(fileId, userId, newContent);

          // Assert: New version created
          const newVersionCount = await getVersionCount(fileId);
          expect(newVersionCount).toBe(initialVersionCount + 1);

          const latestVersion = await getLatestVersion(fileId);
          expect(latestVersion.versionNumber).toBe(initialVersionCount + 1);
          expect(latestVersion.uploadedBy).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5: Version Pruning Respects Limit', () => {
    // Feature: enterprise-features-gap-analysis, Property 5: Version Pruning Respects Limit
    fc.assert(
      fc.asyncProperty(
        fc.record({
          fileId: fc.uuid(),
          userId: fc.uuid(),
          versionCount: fc.integer({ min: 15, max: 50 }),
          retentionLimit: fc.integer({ min: 5, max: 10 })
        }),
        async ({ fileId, userId, versionCount, retentionLimit }) => {
          // Arrange: Create file with many versions
          await createFileWithVersions(fileId, userId, versionCount);

          // Act: Prune old versions
          await pruneVersions(fileId, { maxVersions: retentionLimit });

          // Assert: Only retention limit versions remain
          const remainingVersions = await getActiveVersions(fileId);
          expect(remainingVersions.length).toBe(retentionLimit);

          // Assert: Most recent versions retained
          const versionNumbers = remainingVersions.map(v => v.versionNumber).sort((a, b) => b - a);
          expect(versionNumbers[0]).toBe(versionCount);
          expect(versionNumbers[versionNumbers.length - 1]).toBe(versionCount - retentionLimit + 1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### Generators for Domain Objects
```typescript
// test/generators/fileGenerators.ts
export const fileArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 255 }).filter(s => !s.includes('/')),
  size: fc.integer({ min: 0, max: 5_000_000_000 }), // Up to 5GB
  mimeType: fc.oneof(
    fc.constant('application/pdf'),
    fc.constant('image/jpeg'),
    fc.constant('image/png'),
    fc.constant('text/plain'),
    fc.constant('video/mp4')
  ),
  userId: fc.uuid(),
  folderId: fc.option(fc.uuid(), { nil: null })
});

export const permissionLevelArbitrary = fc.oneof(
  fc.constant('view' as const),
  fc.constant('download' as const),
  fc.constant('edit' as const),
  fc.constant('full' as const)
);

export const permissionArbitrary = fc.record({
  id: fc.uuid(),
  resourceType: fc.oneof(fc.constant('file'), fc.constant('folder')),
  resourceId: fc.uuid(),
  userId: fc.uuid(),
  permissionLevel: permissionLevelArbitrary,
  grantedBy: fc.uuid()
});
```

### 11.3 Unit Testing

#### Unit Test Patterns
```typescript
describe('PermissionService', () => {
  describe('checkPermission', () => {
    it('should return true when user has exact permission', async () => {
      // Arrange
      const userId = 'user-1';
      const fileId = 'file-1';
      await grantPermission('file', fileId, userId, 'edit', 'owner-1');

      // Act
      const hasPermission = await permissionService.checkPermission(userId, 'file', fileId, 'edit');

      // Assert
      expect(hasPermission).toBe(true);
    });

    it('should return true when user has higher permission', async () => {
      // Arrange
      const userId = 'user-1';
      const fileId = 'file-1';
      await grantPermission('file', fileId, userId, 'full', 'owner-1');

      // Act
      const hasPermission = await permissionService.checkPermission(userId, 'file', fileId, 'edit');

      // Assert
      expect(hasPermission).toBe(true);
    });

    it('should return false when user has lower permission', async () => {
      // Arrange
      const userId = 'user-1';
      const fileId = 'file-1';
      await grantPermission('file', fileId, userId, 'view', 'owner-1');

      // Act
      const hasPermission = await permissionService.checkPermission(userId, 'file', fileId, 'edit');

      // Assert
      expect(hasPermission).toBe(false);
    });

    it('should check inherited permissions from parent folder', async () => {
      // Arrange
      const userId = 'user-1';
      const folderId = 'folder-1';
      const fileId = 'file-1';
      await createFile(fileId, 'owner-1', folderId);
      await grantPermission('folder', folderId, userId, 'edit', 'owner-1');

      // Act
      const hasPermission = await permissionService.checkPermission(userId, 'file', fileId, 'edit');

      // Assert
      expect(hasPermission).toBe(true);
    });
  });
});
```

### 11.4 Integration Testing

#### API Integration Tests
```typescript
describe('File Versions API', () => {
  let authCookie: string;
  let fileId: string;

  beforeEach(async () => {
    authCookie = await getAuthCookie('test-user');
    fileId = await createTestFile('test-user');
  });

  it('should list all versions of a file', async () => {
    // Arrange: Create multiple versions
    await updateFile(fileId, 'test-user', Buffer.from('v2'));
    await updateFile(fileId, 'test-user', Buffer.from('v3'));

    // Act
    const response = await request(app)
      .get(`/api/files/${fileId}/versions`)
      .set('Cookie', authCookie);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.versions).toHaveLength(3);
    expect(response.body.versions[0].versionNumber).toBe(3);
    expect(response.body.versions[0].isCurrent).toBe(true);
  });

  it('should restore a previous version', async () => {
    // Arrange
    await updateFile(fileId, 'test-user', Buffer.from('v2'));
    const versions = await getVersions(fileId);
    const v1 = versions.find(v => v.versionNumber === 1);

    // Act
    const response = await request(app)
      .post(`/api/files/${fileId}/versions/${v1.id}/restore`)
      .set('Cookie', authCookie)
      .send({ createBackup: true });

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.newVersionNumber).toBe(3);

    const currentContent = await getFileContent(fileId);
    const v1Content = await getVersionContent(v1.id);
    expect(currentContent).toEqual(v1Content);
  });
});
```

### 11.5 End-to-End Testing

#### User Workflow Tests
```typescript
describe('Collaboration Workflow', () => {
  it('should allow file owner to share with collaborator and receive comments', async () => {
    // Arrange
    const owner = await createTestUser('owner@example.com');
    const collaborator = await createTestUser('collaborator@example.com');
    const fileId = await uploadFile(owner, 'document.pdf');

    // Act 1: Owner grants edit permission
    await grantPermission('file', fileId, collaborator.id, 'edit', owner.id);

    // Act 2: Collaborator adds comment
    const commentId = await addComment(collaborator, fileId, 'Please review section 3');

    // Act 3: Owner receives notification
    const notifications = await getNotifications(owner);

    // Assert
    expect(notifications).toContainEqual(
      expect.objectContaining({
        type: 'comment',
        resourceId: fileId
      })
    );

    // Act 4: Owner replies to comment
    await replyToComment(owner, commentId, 'Will do, thanks!');

    // Act 5: Collaborator receives notification
    const collaboratorNotifications = await getNotifications(collaborator);
    expect(collaboratorNotifications).toContainEqual(
      expect.objectContaining({
        type: 'comment',
        resourceId: fileId
      })
    );
  });
});
```

### 11.6 Coverage Requirements

| Component Type | Minimum Coverage | Property Tests Required |
|----------------|------------------|-------------------------|
| Permission System | 100% | Yes (all properties) |
| Audit Logging | 100% | Yes (immutability, completeness) |
| Version Control | 95% | Yes (version creation, pruning) |
| Comment System | 90% | Yes (threading, permissions) |
| Notification System | 90% | Yes (delivery, preferences) |
| Search | 85% | Yes (filtering, permissions) |
| Bulk Operations | 90% | Yes (atomicity, completeness) |
| Tag System | 85% | Yes (assignment, filtering) |
| API Routes | 100% | No (covered by integration tests) |
| UI Components | 70% | No (focus on logic, not presentation) |

### 11.7 Test Data Management

#### Test Database
- Use separate test database
- Reset between test suites
- Seed with realistic data for integration tests

#### Test File Storage
- Use separate GCS bucket for tests
- Clean up after each test
- Mock GCS for unit tests

#### Test Fixtures
```typescript
// test/fixtures/files.ts
export const testFiles = {
  smallPdf: {
    name: 'small.pdf',
    size: 1024,
    mimeType: 'application/pdf',
    content: Buffer.from('PDF content')
  },
  largeVideo: {
    name: 'large.mp4',
    size: 100_000_000,
    mimeType: 'video/mp4',
    content: Buffer.alloc(100_000_000)
  }
};
```


## 12. Implementation Dependencies and Sequencing

### 12.1 Phase 1: Critical Enterprise Features (Q1 2026)

#### 12.1.1 File Version Control
**Dependencies**: None (can start immediately)

**Implementation Order**:
1. Add `fileVersions` table to schema
2. Modify file upload to create version records
3. Implement version list API
4. Implement version download API
5. Implement version restore API
6. Create background job for version pruning
7. Add version history UI component

**Estimated Effort**: 3-4 weeks

#### 12.1.2 Granular Permissions System
**Dependencies**: None (can start immediately)

**Implementation Order**:
1. Add `permissions` table to schema
2. Implement permission service with caching
3. Add permission check middleware
4. Implement permission CRUD APIs
5. Update existing APIs to check permissions
6. Add permission inheritance logic
7. Create permissions manager UI component

**Estimated Effort**: 4-5 weeks

#### 12.1.3 Activity Audit Logs
**Dependencies**: Permission system (for permission change logging)

**Implementation Order**:
1. Add `auditLogs` table to schema
2. Implement audit service with async logging
3. Add audit logging to all operations
4. Implement audit log query API
5. Implement audit log export API
6. Create background job for log pruning
7. Add audit log viewer UI component

**Estimated Effort**: 2-3 weeks

#### 12.1.4 File Comments and Annotations
**Dependencies**: Permission system (for comment access control)

**Implementation Order**:
1. Add `comments` table to schema
2. Implement comment CRUD APIs
3. Add real-time comment updates (WebSocket)
4. Implement comment notifications
5. Create comments panel UI component
6. Add Markdown support for rich text

**Estimated Effort**: 2-3 weeks

**Phase 1 Total**: 11-15 weeks (3-4 months)

### 12.2 Phase 2: Collaboration & Productivity (Q2 2026)

#### 12.2.1 Real-time Notifications
**Dependencies**: Comment system (for comment notifications)

**Implementation Order**:
1. Add `notifications` and `notificationPreferences` tables
2. Set up WebSocket infrastructure (Socket.io)
3. Implement notification service
4. Add notification creation to all relevant operations
5. Implement email notification worker
6. Create notification center UI component
7. Add notification preferences UI

**Estimated Effort**: 3-4 weeks

#### 12.2.2 Advanced Search
**Dependencies**: None (can start immediately)

**Implementation Order**:
1. Add full-text search indexes to database
2. Implement search service with PostgreSQL FTS
3. Implement search API with filters
4. Add permission filtering to search results
5. Create background job for search indexing
6. Create advanced search UI component
7. Add saved searches feature

**Estimated Effort**: 3-4 weeks

#### 12.2.3 File Preview
**Dependencies**: None (can start immediately)

**Implementation Order**:
1. Implement preview generation for PDFs (pdf-lib)
2. Implement image thumbnail generation (Sharp)
3. Implement video thumbnail generation
4. Add preview API endpoints
5. Create file preview UI component
6. Add navigation between files
7. Optimize preview caching

**Estimated Effort**: 2-3 weeks

#### 12.2.4 Bulk Operations
**Dependencies**: Permission system (for bulk permission checks)

**Implementation Order**:
1. Implement bulk download with ZIP creation
2. Implement bulk delete with transaction
3. Implement bulk move with validation
4. Implement bulk share link generation
5. Add background job for large bulk operations
6. Create bulk operations toolbar UI
7. Add progress tracking

**Estimated Effort**: 2-3 weeks

**Phase 2 Total**: 10-14 weeks (2.5-3.5 months)

### 12.3 Phase 3: Organization & Teams (Q3 2026)

#### 12.3.1 File Tags and Metadata
**Dependencies**: None (can start immediately)

**Implementation Order**:
1. Add `tags`, `fileTags`, and `fileMetadata` tables
2. Implement tag CRUD APIs
3. Implement file tagging APIs
4. Add tag filtering to search
5. Implement bulk tag operations
6. Create tag manager UI component
7. Add tag autocomplete

**Estimated Effort**: 2-3 weeks

#### 12.3.2 Team Workspaces
**Dependencies**: Permission system (for workspace permissions)

**Implementation Order**:
1. Add `workspaces` and `workspaceMembers` tables
2. Implement workspace CRUD APIs
3. Implement workspace member management
4. Add workspace-scoped file operations
5. Implement workspace storage quotas
6. Create workspace management UI
7. Add workspace activity dashboard

**Estimated Effort**: 4-5 weeks

#### 12.3.3 File Request Feature
**Dependencies**: None (can start immediately)

**Implementation Order**:
1. Add `fileRequests` table to schema
2. Implement file request creation API
3. Implement anonymous upload endpoint
4. Add email notification for requests
5. Create file request UI component
6. Add file request management interface

**Estimated Effort**: 2-3 weeks

#### 12.3.4 Advanced Share Link Options
**Dependencies**: Existing share link system

**Implementation Order**:
1. Add columns to `shareLinks` table (download limit, email verification, etc.)
2. Implement download limit enforcement
3. Implement email verification flow
4. Add watermarking for view-only links
5. Implement share link analytics
6. Update share dialog UI with new options

**Estimated Effort**: 3-4 weeks

**Phase 3 Total**: 11-15 weeks (3-4 months)

### 12.4 Phase 4: Integrations & Mobile (Q4 2026)

#### 12.4.1 Integration Framework
**Dependencies**: None (can start immediately)

**Implementation Order**:
1. Design OAuth integration framework
2. Implement Google Drive integration
3. Implement Dropbox integration
4. Implement Slack notifications
5. Implement webhook system
6. Create API documentation for third-party developers
7. Add integration management UI

**Estimated Effort**: 6-8 weeks

#### 12.4.2 Mobile-Responsive Improvements
**Dependencies**: None (can start immediately)

**Implementation Order**:
1. Audit current mobile experience
2. Implement touch-optimized file selection
3. Add mobile camera upload
4. Implement PWA with offline support
5. Optimize mobile file preview
6. Add push notifications
7. Test on various devices

**Estimated Effort**: 4-5 weeks

**Phase 4 Total**: 10-13 weeks (2.5-3 months)

### 12.5 Critical Path Analysis

**Longest Dependencies**:
1. Permissions System → Audit Logs → Comments → Notifications (sequential)
2. Search → Advanced Search Features (sequential)
3. Workspaces → Workspace Features (sequential)

**Parallelizable Work**:
- Version Control can be developed in parallel with Permissions
- Search can be developed in parallel with Comments
- Tags can be developed in parallel with Workspaces
- File Preview can be developed in parallel with Bulk Operations

### 12.6 Infrastructure Requirements

#### Before Phase 1
- Redis instance for caching and job queues
- Separate test database
- Test GCS bucket

#### Before Phase 2
- WebSocket server infrastructure
- Email service configuration (SendGrid, AWS SES, etc.)
- Elasticsearch cluster (optional, for advanced search)

#### Before Phase 3
- Increased database capacity (more connections, storage)
- CDN configuration for file downloads

#### Before Phase 4
- OAuth provider registrations (Google, Dropbox, etc.)
- Webhook delivery infrastructure
- Push notification service (Firebase, OneSignal, etc.)

### 12.7 Risk Mitigation

**High-Risk Items**:
1. **Permission System Complexity**: Start with simple implementation, iterate
2. **Real-time Scalability**: Load test early, plan for horizontal scaling
3. **Search Performance**: Monitor query performance, optimize indexes
4. **Version Storage Costs**: Implement aggressive pruning, monitor costs

**Mitigation Strategies**:
- Feature flags for gradual rollout
- Comprehensive testing before production
- Monitoring and alerting for all critical paths
- Regular performance testing and optimization


## 13. Monitoring and Observability

### 13.1 Metrics to Track

#### Application Metrics
```typescript
// server/monitoring/metrics.ts
import { Counter, Histogram, Gauge } from 'prom-client';

// API metrics
export const apiRequestDuration = new Histogram({
  name: 'api_request_duration_seconds',
  help: 'API request duration in seconds',
  labelNames: ['method', 'route', 'status']
});

export const apiRequestTotal = new Counter({
  name: 'api_request_total',
  help: 'Total API requests',
  labelNames: ['method', 'route', 'status']
});

// File operation metrics
export const fileUploadTotal = new Counter({
  name: 'file_upload_total',
  help: 'Total file uploads',
  labelNames: ['status']
});

export const fileUploadSize = new Histogram({
  name: 'file_upload_size_bytes',
  help: 'File upload size in bytes',
  buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600]
});

// Version control metrics
export const versionCreationTotal = new Counter({
  name: 'version_creation_total',
  help: 'Total versions created'
});

export const versionPruningTotal = new Counter({
  name: 'version_pruning_total',
  help: 'Total versions pruned'
});

// Permission metrics
export const permissionCheckTotal = new Counter({
  name: 'permission_check_total',
  help: 'Total permission checks',
  labelNames: ['result']
});

export const permissionCheckDuration = new Histogram({
  name: 'permission_check_duration_seconds',
  help: 'Permission check duration in seconds'
});

// Notification metrics
export const notificationSentTotal = new Counter({
  name: 'notification_sent_total',
  help: 'Total notifications sent',
  labelNames: ['type', 'channel']
});

// Search metrics
export const searchQueryTotal = new Counter({
  name: 'search_query_total',
  help: 'Total search queries'
});

export const searchResultCount = new Histogram({
  name: 'search_result_count',
  help: 'Number of search results',
  buckets: [0, 1, 5, 10, 25, 50, 100, 500]
});

// WebSocket metrics
export const websocketConnectionsActive = new Gauge({
  name: 'websocket_connections_active',
  help: 'Active WebSocket connections'
});

// Job queue metrics
export const jobQueueSize = new Gauge({
  name: 'job_queue_size',
  help: 'Job queue size',
  labelNames: ['queue']
});

export const jobProcessingDuration = new Histogram({
  name: 'job_processing_duration_seconds',
  help: 'Job processing duration in seconds',
  labelNames: ['queue', 'status']
});
```

#### Database Metrics
- Connection pool utilization
- Query duration (p50, p95, p99)
- Slow query count
- Transaction rollback rate
- Table sizes and growth rate

#### Infrastructure Metrics
- CPU utilization
- Memory usage
- Disk I/O
- Network throughput
- GCS API calls and latency

### 13.2 Logging Strategy

#### Structured Logging
```typescript
// server/logging/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'cloudvault' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Usage
logger.info('File uploaded', {
  userId: 'user-123',
  fileId: 'file-456',
  fileName: 'document.pdf',
  size: 1024000
});

logger.error('Permission check failed', {
  userId: 'user-123',
  resourceType: 'file',
  resourceId: 'file-456',
  requiredLevel: 'edit',
  error: error.message
});
```

#### Log Levels
- **ERROR**: System errors, exceptions, failures
- **WARN**: Degraded performance, fallbacks, retries
- **INFO**: Important business events (file upload, permission grant)
- **DEBUG**: Detailed diagnostic information
- **TRACE**: Very detailed diagnostic information

#### Sensitive Data Redaction
```typescript
function redactSensitiveFields(obj: any): any {
  const redacted = { ...obj };
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'sessionId', 'csrfToken'];
  
  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      redacted[key] = '[REDACTED]';
    }
  }
  
  return redacted;
}
```

### 13.3 Alerting Rules

#### Critical Alerts (Page immediately)
- API error rate > 5% for 5 minutes
- Database connection pool exhausted
- GCS API errors > 10% for 5 minutes
- WebSocket server down
- Job queue processing stopped

#### Warning Alerts (Notify during business hours)
- API p95 latency > 1 second for 10 minutes
- Permission check cache hit rate < 80%
- Version pruning job failed
- Email notification delivery rate < 95%
- Search query latency > 2 seconds

#### Info Alerts (Log only)
- New user registration
- Large file upload (> 1GB)
- Bulk operation completed
- Workspace created

### 13.4 Health Check Endpoints

```typescript
// server/routes/health.ts
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      storage: await checkStorage(),
      websocket: await checkWebSocket()
    }
  };

  const isHealthy = Object.values(health.checks).every(check => check.status === 'ok');
  
  res.status(isHealthy ? 200 : 503).json(health);
});

async function checkDatabase(): Promise<HealthCheck> {
  try {
    await db.execute(sql`SELECT 1`);
    return { status: 'ok', latency: 5 };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  try {
    await redisClient.ping();
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

async function checkStorage(): Promise<HealthCheck> {
  try {
    await storage.bucket(BUCKET_NAME).exists();
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}
```

### 13.5 Distributed Tracing

```typescript
// server/tracing/tracer.ts
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('cloudvault');

export function traceAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}

// Usage
async function uploadFile(fileData: Buffer, metadata: FileMetadata) {
  return traceAsync('uploadFile', async () => {
    const span = trace.getActiveSpan();
    span?.setAttribute('file.size', fileData.length);
    span?.setAttribute('file.mimeType', metadata.mimeType);
    
    // Upload logic
    await storage.bucket(BUCKET_NAME).file(metadata.path).save(fileData);
    
    // Create version
    await createVersion(metadata.fileId, metadata.userId);
    
    // Send notification
    await notificationService.create(metadata.userId, 'file_upload', 'File uploaded', '...');
  });
}
```

## 14. Deployment Strategy

### 14.1 Feature Flags

```typescript
// server/featureFlags/flags.ts
export const featureFlags = {
  fileVersionControl: process.env.FEATURE_VERSION_CONTROL === 'true',
  granularPermissions: process.env.FEATURE_PERMISSIONS === 'true',
  auditLogs: process.env.FEATURE_AUDIT_LOGS === 'true',
  comments: process.env.FEATURE_COMMENTS === 'true',
  notifications: process.env.FEATURE_NOTIFICATIONS === 'true',
  advancedSearch: process.env.FEATURE_ADVANCED_SEARCH === 'true',
  filePreview: process.env.FEATURE_FILE_PREVIEW === 'true',
  bulkOperations: process.env.FEATURE_BULK_OPS === 'true',
  tags: process.env.FEATURE_TAGS === 'true',
  workspaces: process.env.FEATURE_WORKSPACES === 'true'
};

export function isFeatureEnabled(feature: keyof typeof featureFlags): boolean {
  return featureFlags[feature] || false;
}

// Usage in routes
app.get('/api/files/:fileId/versions', requireAuth, (req, res, next) => {
  if (!isFeatureEnabled('fileVersionControl')) {
    return res.status(404).json({ error: 'Feature not available' });
  }
  next();
}, getFileVersions);
```

### 14.2 Gradual Rollout

1. **Internal Testing** (Week 1)
   - Enable features for internal users only
   - Monitor metrics and logs
   - Fix critical bugs

2. **Beta Testing** (Week 2-3)
   - Enable for 10% of users
   - Collect feedback
   - Monitor performance impact

3. **Gradual Rollout** (Week 4-6)
   - Increase to 25%, 50%, 75%, 100%
   - Monitor at each stage
   - Rollback if issues detected

4. **General Availability** (Week 7+)
   - Feature enabled for all users
   - Remove feature flag
   - Update documentation

### 14.3 Database Migrations

```bash
# Generate migration
npm run db:generate

# Review migration SQL
cat migrations/0001_add_file_versions.sql

# Apply migration to staging
DATABASE_URL=$STAGING_DB_URL npm run db:migrate

# Verify migration
DATABASE_URL=$STAGING_DB_URL npm run db:verify

# Apply to production (with backup)
pg_dump $PROD_DB_URL > backup_$(date +%Y%m%d).sql
DATABASE_URL=$PROD_DB_URL npm run db:migrate
```

### 14.4 Rollback Plan

**If critical issues detected**:
1. Disable feature flag immediately
2. Rollback database migration if needed
3. Investigate root cause
4. Fix and redeploy
5. Re-enable feature flag

**Rollback Triggers**:
- Error rate > 10%
- API latency > 5 seconds
- Database connection issues
- Data corruption detected
- Security vulnerability discovered


## 15. Documentation Requirements

### 15.1 API Documentation

All new API endpoints must be documented with:
- Endpoint path and HTTP method
- Authentication requirements
- Request parameters and body schema
- Response schema and status codes
- Error codes and meanings
- Example requests and responses
- Rate limiting information

**Location**: `docs/api/`

### 15.2 Architecture Documentation

Update architecture docs to reflect:
- New database tables and relationships
- New services and their responsibilities
- Data flow diagrams for new features
- Security considerations
- Performance characteristics

**Location**: `docs/architecture/`

### 15.3 User Documentation

Create user guides for:
- File version control (viewing, restoring versions)
- Permission management (granting, revoking access)
- Commenting on files
- Using notifications
- Advanced search features
- Bulk operations
- Tag management
- Workspace collaboration

**Location**: `docs/user-guides/`

### 15.4 Developer Documentation

Update developer docs with:
- New database schema
- New API endpoints
- Testing guidelines for new features
- Property-based testing examples
- Integration patterns
- Troubleshooting guides

**Location**: `docs/development/`

## 16. Success Metrics and KPIs

### 16.1 Feature Adoption Metrics

**Version Control**:
- % of files with multiple versions
- Average versions per file
- Version restore operations per week
- Storage cost per version

**Permissions**:
- % of files with shared permissions
- Average permissions per file
- Permission changes per week
- Permission check latency (p95)

**Audit Logs**:
- Audit log queries per week
- Audit log exports per month
- Average query response time
- Storage cost for logs

**Comments**:
- % of files with comments
- Average comments per file
- Comment reply rate
- Real-time delivery success rate

**Notifications**:
- Notification delivery rate (in-app, email)
- Average time to read notification
- Notification preference changes per user
- WebSocket connection stability

**Search**:
- Search queries per user per week
- Search result click-through rate
- Average search latency
- % of searches with zero results

**Bulk Operations**:
- Bulk operations per user per week
- Average items per bulk operation
- Bulk operation success rate
- Average completion time

**Tags**:
- % of files with tags
- Average tags per file
- Tag-based searches per week
- Tag management operations per week

### 16.2 Performance Metrics

**Target SLAs**:
- API response time (p95): < 500ms
- API response time (p99): < 1000ms
- WebSocket message latency: < 100ms
- Search query latency: < 2000ms
- Bulk download generation: < 30s for 100 files
- Version creation: < 200ms
- Permission check: < 50ms (cached), < 200ms (uncached)

**Availability**:
- Uptime: 99.9% (43 minutes downtime per month)
- Database availability: 99.95%
- Storage availability: 99.99%

### 16.3 Business Metrics

**User Engagement**:
- Daily active users (DAU)
- Weekly active users (WAU)
- Monthly active users (MAU)
- Average session duration
- Files uploaded per user per month
- Share links created per user per month

**Collaboration**:
- % of users with shared files
- Average collaborators per file
- Comments per file per week
- Notification engagement rate

**Enterprise Adoption**:
- % of users using workspaces
- Average workspace size
- Workspace activity rate
- Enterprise feature usage rate

**Retention**:
- 7-day retention rate
- 30-day retention rate
- 90-day retention rate
- Churn rate

## 17. Open Questions and Future Considerations

### 17.1 Open Questions

1. **Authentication**: Should we support multiple authentication providers (Google, Microsoft, SAML) in addition to Replit Auth?

2. **Storage Limits**: What are the target storage limits per user and per organization?

3. **Offline Sync**: Do we need offline sync capabilities like Dropbox, or is PWA offline access sufficient?

4. **Native Mobile Apps**: Should we build native iOS/Android apps, or focus on mobile web experience?

5. **Pricing Model**: How will enterprise features be priced? Per-user, per-feature, or tiered plans?

6. **On-Premise**: Do we need to support on-premise deployment for enterprise customers?

7. **File Locking**: Should we support file locking to prevent concurrent editing conflicts?

8. **Customization**: What level of white-labeling and customization do enterprise customers need?

9. **Compliance**: Which compliance certifications are required (SOC 2, HIPAA, ISO 27001)?

10. **Data Residency**: Do we need to support data residency requirements (EU, US, Asia)?

### 17.2 Future Enhancements

**Phase 5+ (2027)**:
- E-signature integration (DocuSign, Adobe Sign)
- Workflow automation with visual builder
- AI-powered features (auto-tagging, smart search, content recommendations)
- Virtual data room for M&A and due diligence
- Advanced compliance and retention policies
- Real-time collaborative editing (like Google Docs)
- Advanced analytics and reporting dashboard
- Custom branding and white-labeling
- API rate limiting per user/organization
- Advanced security features (DLP, anomaly detection)

### 17.3 Technical Debt Considerations

**Areas to Monitor**:
- Permission caching complexity (invalidation strategy)
- Audit log storage growth (consider archival strategy)
- Version storage costs (implement compression)
- WebSocket connection scaling (consider dedicated servers)
- Search index size (consider sharding)
- Database query performance (monitor slow queries)

**Refactoring Opportunities**:
- Extract permission service to microservice (if scaling issues)
- Move search to dedicated Elasticsearch cluster
- Implement event sourcing for audit logs
- Use message queue for async operations (instead of direct job queue)

## 18. Conclusion

This design document provides a comprehensive technical architecture for adding enterprise-grade features to CloudVault. The design prioritizes:

1. **Incremental Implementation**: Features can be built and deployed independently
2. **Backward Compatibility**: Existing functionality remains unchanged
3. **Performance**: Designed for 1000+ concurrent users from the start
4. **Security**: All features include security considerations and audit logging
5. **Testability**: Property-based testing ensures correctness across all inputs
6. **Scalability**: Architecture supports horizontal scaling and caching

The implementation is divided into 4 phases over 12 months, with clear dependencies and sequencing. Each phase delivers valuable features that move CloudVault closer to competing with ShareFile, Box, and Dropbox Business.

**Next Steps**:
1. Review and approve this design document
2. Create detailed task list for Phase 1 implementation
3. Set up infrastructure (Redis, test environments)
4. Begin implementation of File Version Control
5. Establish monitoring and alerting before production deployment

