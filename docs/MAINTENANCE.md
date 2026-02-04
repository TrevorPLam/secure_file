# Documentation Maintenance Guide

This guide explains how to keep the CloudVault documentation accurate and up-to-date.

## Core Principle

**Documentation should evolve with the code.** When you change code, update the relevant documentation in the same pull request.

## When to Update Documentation

### Code Changes That Require Doc Updates

| Code Change | Documents to Update | Why |
|-------------|---------------------|-----|
| **New API endpoint** | [docs/api/00_INDEX.md](./api/00_INDEX.md) | API consumers need to know about new endpoints |
| **Modified API endpoint** | [docs/api/00_INDEX.md](./api/00_INDEX.md) | Breaking changes must be documented |
| **New user flow** | [docs/architecture/40_KEY_FLOWS.md](./architecture/40_KEY_FLOWS.md) | Developers need to understand critical paths |
| **Modified user flow** | [docs/architecture/40_KEY_FLOWS.md](./architecture/40_KEY_FLOWS.md) | Keep flow documentation accurate |
| **New database table** | [docs/data/00_INDEX.md](./data/00_INDEX.md) | Schema documentation must reflect DB state |
| **Modified schema** | [docs/data/00_INDEX.md](./data/00_INDEX.md) | Column changes, indexes, relations |
| **New module/folder** | [docs/architecture/30_MODULES_AND_DEPENDENCIES.md](./architecture/30_MODULES_AND_DEPENDENCIES.md) | Code organization must be documented |
| **Module refactoring** | [docs/architecture/30_MODULES_AND_DEPENDENCIES.md](./architecture/30_MODULES_AND_DEPENDENCIES.md) | Update dependency graph |
| **New external service** | [docs/integrations/00_INDEX.md](./integrations/00_INDEX.md) | Track third-party dependencies |
| **Changed deployment** | [docs/architecture/20_RUNTIME_TOPOLOGY.md](./architecture/20_RUNTIME_TOPOLOGY.md) | Keep deployment docs current |
| **Architectural decision** | [docs/adr/README.md](./adr/README.md) | Create new ADR file |
| **New component** | [docs/architecture/10_OVERVIEW.md](./architecture/10_OVERVIEW.md) | Major architectural components |

### Changes That DON'T Require Doc Updates

- Bug fixes (unless they change behavior)
- Code refactoring (same behavior)
- Performance improvements (unless architecture changes)
- Test additions
- Dependency version updates (unless breaking changes)

## Update Process

### Step-by-Step

1. **Make your code changes**
2. **Identify affected documentation** (use table above)
3. **Update the documentation files**
   - Modify text to reflect new reality
   - Update file paths in "Evidence" sections
   - Check all internal links still work
4. **Verify accuracy**
   - Re-read your changes
   - Ensure examples work
   - Check file references are correct
5. **Commit together**
   - Include doc updates in same commit as code changes
   - Mention doc updates in commit message

### Example Commit Message

```
feat: Add file download history tracking

- Add downloadHistory table to schema
- Create API endpoint GET /api/files/:id/downloads
- Update file detail page to show download list

Docs updated:
- data/00_INDEX.md: Added downloadHistory table docs
- api/00_INDEX.md: Documented new endpoint
- architecture/40_KEY_FLOWS.md: Updated Flow 3 with history tracking
```

## Documentation Quality Checklist

Before merging a PR with doc changes, verify:

### Accuracy
- [ ] All facts are verifiable from actual code files
- [ ] File paths in "Evidence" sections are correct
- [ ] No outdated information remains
- [ ] Examples have been tested

### Links
- [ ] All internal links work (to other docs)
- [ ] All file path links point to existing files
- [ ] Relative paths use correct format (`./` or `../`)

### Completeness
- [ ] New features are documented
- [ ] Breaking changes are highlighted
- [ ] Migration steps included (if needed)
- [ ] Examples provided where helpful

### Clarity
- [ ] Written for smart beginners
- [ ] Technical jargon explained in Glossary
- [ ] Code examples are clear
- [ ] Diagrams updated (if needed)

## Common Update Scenarios

### Scenario 1: Adding a New API Endpoint

**Example**: You add `POST /api/files/:id/share-bulk`

**Update steps**:

1. **Open** `docs/api/00_INDEX.md`
2. **Find** the relevant section (File Routes)
3. **Add** new endpoint documentation:
   ```markdown
   #### POST /api/files/:id/share-bulk
   
   **Purpose**: Create multiple share links at once
   
   **Auth required**: Yes
   
   **Request body**:
   ```json
   {
     "fileIds": ["file1", "file2"],
     "expiresAt": "2026-12-31T23:59:59Z"
   }
   ```
   
   **Response**: Array of share link objects
   
   **Evidence**: [server/routes.ts](../../server/routes.ts):XXX-YYY
   ```
4. **Update** Evidence section with correct line numbers
5. **Check** if this affects any flows in `40_KEY_FLOWS.md`
6. **Commit** with code changes

### Scenario 2: Refactoring Module Structure

**Example**: You split `server/storage.ts` into `server/storage/folders.ts` and `server/storage/files.ts`

**Update steps**:

1. **Open** `docs/architecture/30_MODULES_AND_DEPENDENCIES.md`
2. **Update** Server Module Structure section:
   ```markdown
   server/
   ├── storage/
   │   ├── folders.ts    # Folder CRUD operations
   │   └── files.ts      # File CRUD operations
   ```
3. **Update** dependency graph if imports changed
4. **Update** Evidence section with new file paths
5. **Search docs** for other references to `storage.ts`
6. **Update** all references (likely in API docs, Key Flows)
7. **Commit** with refactoring

### Scenario 3: Database Schema Change

**Example**: You add `expiresAt` column to `files` table for auto-deletion

**Update steps**:

1. **Open** `docs/data/00_INDEX.md`
2. **Find** Files Table section
3. **Add** new column:
   ```markdown
   expiresAt: timestamp (nullable) - Auto-delete time
   ```
4. **Update** Invariants section:
   ```markdown
   - Expired files (`expiresAt < now`) should be deleted by cleanup job
   ```
5. **Consider**: Do you need a new ADR?
   - If significant architectural change → Create ADR in `docs/adr/`
6. **Check**: Does this affect any flows?
   - Update `docs/architecture/40_KEY_FLOWS.md` if needed
7. **Commit** with schema migration

## File-by-File Maintenance Guide

### docs/architecture/00_INDEX.md
**Update when**: Any structural change to docs, new important files, changed commands

**What to check**:
- Table of key technologies is current
- Common commands still work
- Entry points are correct
- Document map is complete

### docs/architecture/10_OVERVIEW.md
**Update when**: Adding/removing major components, changing data flow, new integrations

**What to check**:
- Component diagram is accurate
- Component boundaries are correct
- Architectural principles still apply
- Evidence links are valid

### docs/architecture/20_RUNTIME_TOPOLOGY.md
**Update when**: Deployment changes, new environments, port changes, boot sequence changes

**What to check**:
- Port numbers are correct
- Environment variables are complete
- Boot sequence reflects actual code
- Commands work

### docs/architecture/30_MODULES_AND_DEPENDENCIES.md
**Update when**: New folders, moved files, changed imports, new dependencies

**What to check**:
- Directory tree is accurate
- Dependency rules are enforced
- Path aliases are correct
- Evidence links point to real files

### docs/architecture/40_KEY_FLOWS.md
**Update when**: New user flows, flow changes, new failure modes

**What to check**:
- Step-by-step flows match code
- Modules touched are correct
- Validation tips work
- Failure modes are complete

### docs/architecture/90_GLOSSARY.md
**Update when**: New terminology, new technology, changed definitions

**What to check**:
- All terms used in docs are defined
- External links still work
- Examples are accurate

### docs/data/00_INDEX.md
**Update when**: Schema changes, new tables, changed indexes, new migration patterns

**What to check**:
- Table definitions match schema.ts
- Indexes are documented
- Invariants are enforced
- Query patterns are current

### docs/api/00_INDEX.md
**Update when**: New endpoints, changed endpoints, new error codes, auth changes

**What to check**:
- All endpoints documented
- Request/response examples accurate
- Error codes complete
- Auth requirements correct

### docs/integrations/00_INDEX.md
**Update when**: New external services, changed APIs, new environment variables

**What to check**:
- All third-party services listed
- Configuration is complete
- Secrets are documented (not exposed)
- Integration flows are accurate

### docs/adr/README.md
**Update when**: Making architectural decisions, superseding old decisions

**What to check**:
- Implied decisions are documented
- New ADRs follow template
- Status values are correct
- Links to code are valid

## Automated Checks (Future)

**Not currently implemented**, but recommended:

### Link Checker
```bash
# Check all markdown links
npm run docs:check-links
```

### Freshness Checker
```bash
# Find docs older than 6 months
npm run docs:check-freshness
```

### Orphan Detector
```bash
# Find docs not linked from any other doc
npm run docs:find-orphans
```

## Documentation Reviews

### When to Review

- **Quarterly**: Full documentation review
- **After major release**: Ensure docs match released features
- **During onboarding**: New developers find missing/unclear docs

### Review Checklist

- [ ] All links work
- [ ] All code examples run
- [ ] All file paths exist
- [ ] No contradictions between docs
- [ ] Glossary is complete
- [ ] New features are documented
- [ ] Deprecated features are marked

## Getting Help

### If Documentation is Wrong

1. **Check the code**: Documentation might be outdated
2. **Fix the docs**: Submit a PR with corrections
3. **Ask maintainers**: If you're unsure what's correct

### If Documentation is Unclear

1. **Ask for clarification**: Open an issue
2. **Improve it**: Submit a PR with clearer language
3. **Add examples**: Code examples help understanding

## Documentation Style Guide

### Writing Style

- **Be concise**: No fluff, get to the point
- **Use examples**: Show, don't just tell
- **Link liberally**: Connect related information
- **Cite sources**: Every fact needs evidence
- **Write for beginners**: Explain jargon

### Formatting

- **Headers**: Use consistent hierarchy (H1 → H2 → H3)
- **Code blocks**: Always specify language (```typescript)
- **Lists**: Use bullets for unordered, numbers for steps
- **Tables**: Use for structured comparisons
- **Bold**: For emphasis on important points
- **Italic**: For introducing new terms

### File Naming

- **Numbers**: Use leading zeros (00, 10, 20, not 0, 1, 2)
- **Uppercase**: Major sections (INDEX, OVERVIEW, GLOSSARY)
- **Underscores**: Separate words (KEY_FLOWS not KeyFlows)

## Maintenance Schedule

| Frequency | Task |
|-----------|------|
| **On every PR** | Update docs affected by code changes |
| **Monthly** | Check for broken links |
| **Quarterly** | Full documentation review |
| **Bi-annually** | Review and update implied ADRs |
| **Annually** | Refresh all screenshots and diagrams |

## Success Metrics

Good documentation maintenance means:

- ✅ New developers can get started in < 1 hour
- ✅ No more than 5% of links are broken
- ✅ All code examples run without modification
- ✅ No questions about features documented in last 6 months
- ✅ Documentation PR comments are rare

## Questions?

If you have questions about maintaining these docs:

1. Read this guide again
2. Check existing docs for examples
3. Ask the team in your PR
4. Open an issue for discussion

---

**Remember**: Documentation is code. Treat it with the same care as your application code.
