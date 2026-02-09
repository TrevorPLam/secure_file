# CloudVault Product Overview

CloudVault is a secure file sharing and storage platform that enables users to upload, organize, and share files with password protection and time-limited access.

## Core Features

- **File Management**: Upload and organize files in hierarchical folders with drag-and-drop support
- **Secure Sharing**: Generate shareable links with optional password protection, expiration dates, and download tracking
- **Authentication**: Secure access via Replit Auth (OpenID Connect)
- **Direct Uploads**: Files upload directly to Google Cloud Storage using presigned URLs (no server bottleneck)

## User Workflows

1. **Upload**: User authenticates → creates/navigates folders → uploads files to cloud storage
2. **Share**: User selects file → generates share link with optional password/expiration → shares token URL
3. **Download**: Recipient accesses share link → enters password (if required) → downloads file if not expired

## Architecture Philosophy

- **Monolithic full-stack**: Single Node.js process for simplicity
- **Type-safe**: Shared TypeScript types between client and server
- **Session-based auth**: Stateful authentication with PostgreSQL-backed sessions
- **Direct storage access**: Presigned URLs for scalable uploads/downloads
