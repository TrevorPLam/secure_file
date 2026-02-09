# CloudVault Documentation

Welcome to the CloudVault documentation. This repository contains comprehensive documentation for developers working on or integrating with CloudVault.

## 📚 Documentation Structure

```
docs/
├── architecture/     # Core architecture documentation
├── api/             # REST API reference
├── data/            # Database schema and storage
├── integrations/    # Third-party services
├── testing/         # Testing strategy and patterns
├── archive/         # Historical reports and session notes
└── adr/             # Architecture decision records
```

## 🚀 Quick Start

**New to CloudVault?** Start here:

1. **[Architecture Index](./architecture/00_INDEX.md)** - Your entry point to all documentation
2. **[System Overview](./architecture/10_OVERVIEW.md)** - Understand what CloudVault does
3. **[Runtime Topology](./architecture/20_RUNTIME_TOPOLOGY.md)** - Learn how to run it locally

## 📖 Core Documentation

### Architecture Documentation

The architecture folder contains the main architectural documentation:

| Document                                                                        | Description                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------- |
| [00_INDEX.md](./architecture/00_INDEX.md)                                       | Navigation hub and quick reference          |
| [10_OVERVIEW.md](./architecture/10_OVERVIEW.md)                                 | High-level system design and components     |
| [20_RUNTIME_TOPOLOGY.md](./architecture/20_RUNTIME_TOPOLOGY.md)                 | Deployment, environments, and boot sequence |
| [30_MODULES_AND_DEPENDENCIES.md](./architecture/30_MODULES_AND_DEPENDENCIES.md) | Code organization and dependency rules      |
| [40_KEY_FLOWS.md](./architecture/40_KEY_FLOWS.md)                               | Critical user journeys and data paths       |
| [90_GLOSSARY.md](./architecture/90_GLOSSARY.md)                                 | Terms, acronyms, and domain language        |

### Deep-Dive Documentation

| Topic                                      | Description                                   |
| ------------------------------------------ | --------------------------------------------- |
| [Data](./data/00_INDEX.md)                 | Database schema, migrations, storage patterns |
| [API](./api/00_INDEX.md)                   | REST API endpoints and conventions            |
| [Integrations](./integrations/00_INDEX.md) | Third-party services (Replit Auth, GCS)       |
| [Testing](./testing/00_INDEX.md)           | Running tests, coverage, and patterns         |
| [ADR](./adr/README.md)                     | Architecture decision records                 |

## 🎯 Common Tasks

### Setting Up Development Environment

See [Runtime Topology - Local Development Setup](./architecture/20_RUNTIME_TOPOLOGY.md#local-development-setup)

### Understanding the Codebase

1. Read [System Overview](./architecture/10_OVERVIEW.md) for high-level architecture
2. Review [Modules & Dependencies](./architecture/30_MODULES_AND_DEPENDENCIES.md) for code structure
3. Study [Key Flows](./architecture/40_KEY_FLOWS.md) for user journeys

### Adding a New Feature

1. Understand the [Module Structure](./architecture/30_MODULES_AND_DEPENDENCIES.md#adding-new-modules)
2. Review [API Conventions](./api/00_INDEX.md#api-design-principles)
3. Check [Data Model](./data/00_INDEX.md) for database changes
4. Follow patterns in [Key Flows](./architecture/40_KEY_FLOWS.md)

### Debugging Issues

1. Check [Key Flows](./architecture/40_KEY_FLOWS.md) for failure modes
2. Review [API Error Handling](./api/00_INDEX.md#error-handling)
3. Consult [Glossary](./architecture/90_GLOSSARY.md) for unfamiliar terms

## 🔍 Finding Information

### By Topic

- **Authentication**: [Integrations - Replit Auth](./integrations/00_INDEX.md#replit-auth-oidc)
- **File Upload**: [Key Flows - Flow 2](./architecture/40_KEY_FLOWS.md#flow-2-file-upload)
- **Database Schema**: [Data Documentation](./data/00_INDEX.md#schema-documentation)
- **API Endpoints**: [API Documentation](./api/00_INDEX.md#api-endpoints)
- **Code Organization**: [Modules & Dependencies](./architecture/30_MODULES_AND_DEPENDENCIES.md)

### By Role

**Frontend Developer**:

- [System Overview - Frontend](./architecture/10_OVERVIEW.md#1-frontend-client)
- [Modules - Client Structure](./architecture/30_MODULES_AND_DEPENDENCIES.md#client-module-structure)
- [API Documentation](./api/00_INDEX.md)

**Backend Developer**:

- [System Overview - Backend](./architecture/10_OVERVIEW.md#2-backend-server)
- [Modules - Server Structure](./architecture/30_MODULES_AND_DEPENDENCIES.md#server-module-structure)
- [Data Documentation](./data/00_INDEX.md)
- [Integrations](./integrations/00_INDEX.md)

**DevOps/SRE**:

- [Runtime Topology](./architecture/20_RUNTIME_TOPOLOGY.md)
- [Integrations - External Services](./integrations/00_INDEX.md#third-party-services)

**Product Manager**:

- [System Overview](./architecture/10_OVERVIEW.md)
- [Key Flows](./architecture/40_KEY_FLOWS.md)

## 📝 Documentation Principles

All documentation in this repository follows these principles:

1. **Truth Only**: Every claim is traceable to actual code files
2. **Link-First**: Documentation interconnects for easy navigation
3. **Evidence-Based**: Each document cites source files
4. **Beginner-Friendly**: Written for smart beginners, not just experts
5. **Maintenance-Aware**: Clear guidance on keeping docs current

## 🔄 Keeping Documentation Current

### When to Update Docs

| Code Change           | Update These Docs                                                               |
| --------------------- | ------------------------------------------------------------------------------- |
| New feature           | [40_KEY_FLOWS.md](./architecture/40_KEY_FLOWS.md)                               |
| New module/folder     | [30_MODULES_AND_DEPENDENCIES.md](./architecture/30_MODULES_AND_DEPENDENCIES.md) |
| API changes           | [API Documentation](./api/00_INDEX.md)                                          |
| Database schema       | [Data Documentation](./data/00_INDEX.md)                                        |
| New dependency        | [Integrations](./integrations/00_INDEX.md)                                      |
| Architecture decision | [ADR](./adr/README.md) - Create new ADR                                         |

### Documentation Maintenance Rules

1. **Update docs in same PR as code changes**
2. **Link to actual files, not copy-paste code**
3. **Keep "Evidence" sections updated**
4. **Mark deprecated sections clearly**
5. **Test all examples before documenting**

## 🏗️ Documentation Coverage

### What's Documented

✅ System architecture and design  
✅ Runtime topology and deployment  
✅ Module structure and dependencies  
✅ Critical user flows  
✅ Database schema and patterns  
✅ REST API endpoints  
✅ External integrations  
✅ Architecture decisions

### What's Not (Yet) Documented

✅ Testing strategy and patterns  
⚠️ CI/CD pipeline (minimal)  
⚠️ Monitoring and alerting (not implemented)  
⚠️ Disaster recovery procedures  
<<<<<<< HEAD
⚠️ Performance benchmarks  
⚠️ Security audit results
=======
✅ Performance testing setup  
⚠️ Security audit results  
>>>>>>> c19e75b7590a3348a340675404c25d1cc8b5e216

## 📊 Documentation Statistics

- **Total documents**: 14 files
- **Total words**: ~30,000 words
- **Evidence citations**: 100+ file references
- **Diagrams**: 3 ASCII diagrams
- **Code examples**: 50+ examples
- **Last updated**: 2026-02-04

## 💡 Tips for Using This Documentation

1. **Start with the Index**: Always begin at [architecture/00_INDEX.md](./architecture/00_INDEX.md)
2. **Follow Links**: Documentation is interconnected - follow links to related topics
3. **Check Evidence**: Click file paths to see actual source code
4. **Use Search**: Use your editor's search (Ctrl+F) to find specific terms
5. **Read the Glossary**: Unfamiliar term? Check [90_GLOSSARY.md](./architecture/90_GLOSSARY.md)

## 🤝 Contributing to Documentation

### Making Changes

1. Update relevant documentation file(s)
2. Update "Evidence" sections with correct file paths
3. Check all internal links work
4. Update "Last updated" dates
5. Test code examples if you added any

### Creating New Documents

1. Follow existing format and structure
2. Include "Evidence" section with citations
3. Link back to relevant existing docs
4. Add to appropriate index (00_INDEX.md)
5. Follow naming convention (NN_TITLE.md)

### Review Checklist

- [ ] All facts are verifiable from source files
- [ ] Links to other docs work
- [ ] File paths in "Evidence" sections are correct
- [ ] No outdated information
- [ ] Clear and concise language
- [ ] Appropriate level of detail

## 📚 Related Documentation

- **[replit.md](../replit.md)** - Original project documentation (now complemented by this doc set)
- **[AI_META_HEADER_REPORT.md](../AI_META_HEADER_REPORT.md)** - Meta-header documentation

## 📧 Questions or Issues?

If you find errors or have questions about the documentation:

1. Check the [Glossary](./architecture/90_GLOSSARY.md) for term definitions
2. Search across all docs for related information
3. Look at cited source files ("Evidence" sections)
4. Open an issue describing what's unclear or incorrect

## 🎓 Learning Path

**Recommended reading order for new developers:**

1. [Architecture Index](./architecture/00_INDEX.md) - 5 minutes
2. [System Overview](./architecture/10_OVERVIEW.md) - 15 minutes
3. [Runtime Topology](./architecture/20_RUNTIME_TOPOLOGY.md) - 15 minutes
4. [Modules & Dependencies](./architecture/30_MODULES_AND_DEPENDENCIES.md) - 20 minutes
5. [Key Flows](./architecture/40_KEY_FLOWS.md) - 30 minutes
6. [Data Documentation](./data/00_INDEX.md) - 20 minutes
7. [API Documentation](./api/00_INDEX.md) - 20 minutes
8. [Integrations](./integrations/00_INDEX.md) - 15 minutes
9. [Glossary](./architecture/90_GLOSSARY.md) - Reference as needed
10. [ADR](./adr/README.md) - 10 minutes

**Total time**: ~2.5 hours for complete overview

## 📈 Architecture Summary (5-Minute Version)

**CloudVault** is a secure file sharing and storage application.

**Stack**: React + Express + PostgreSQL + Google Cloud Storage

**Architecture**: Monolithic full-stack app on Replit platform

**Key Patterns**:

- Session-based authentication (Replit Auth)
- Direct file uploads via presigned URLs
- Type-safe API with Drizzle ORM + Zod
- shadcn/ui component library
- Monorepo with shared types

**Critical Flows**:

1. Authentication (OIDC)
2. File upload (presigned URLs)
3. File sharing (token-based links)
4. Folder management (hierarchical)

**Read more**: [System Overview](./architecture/10_OVERVIEW.md)

---

**Last Updated**: 2026-02-04  
**Documentation Version**: 1.0  
**Repository**: [TrevorPLam/secure_file](https://github.com/TrevorPLam/secure_file)
