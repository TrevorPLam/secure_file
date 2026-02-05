// AI-META-BEGIN
// AI-META: Database storage layer - provides CRUD operations for folders, files, and share links with Drizzle ORM
// OWNERSHIP: server/storage
// ENTRYPOINTS: Imported as singleton 'storage' in server/routes.ts and other server modules
// DEPENDENCIES: drizzle-orm (ORM queries), ./db (database connection), @shared/schema (table definitions), crypto (randomBytes for tokens)
// DANGER: Delete operations cascade to children; getFolderPath recursive query can be slow on deep hierarchies; token generation must be cryptographically secure
// CHANGE-SAFETY: Safe to add new methods, unsafe to change return types or query filters without auditing all callers
// TESTS: Run `npm run check` for type safety, integration tests should validate cascade deletes and folder path traversal
// AI-META-END

import {
  folders,
  files,
  shareLinks,
  type Folder,
  type InsertFolder,
  type File,
  type InsertFile,
  type ShareLink,
  type InsertShareLink,
} from '@shared/schema'
import { db } from './db'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'

export interface IStorage {
  createFolder(data: InsertFolder): Promise<Folder>
  getFoldersByParent(userId: string, parentId: string | null): Promise<Folder[]>
  getFolderPath(folderId: string): Promise<Folder[]>
  getFolder(id: string): Promise<Folder | undefined>
  deleteFolder(id: string, userId: string): Promise<void>

  createFile(data: InsertFile): Promise<File>
  getFilesByFolder(userId: string, folderId: string | null): Promise<File[]>
  getFile(id: string): Promise<File | undefined>
  deleteFile(id: string, userId: string): Promise<void>

  createShareLink(data: Omit<InsertShareLink, 'token'>): Promise<ShareLink>
  getShareLinksByFile(fileId: string): Promise<ShareLink[]>
  getShareLink(id: string): Promise<ShareLink | undefined>
  getShareLinkByToken(token: string): Promise<ShareLink | undefined>
  deleteShareLink(id: string): Promise<void>
  incrementDownloadCount(id: string): Promise<void>

  getStats(userId: string): Promise<{ totalFiles: number; totalFolders: number; totalSize: number }>
}

export class DatabaseStorage implements IStorage {
  async createFolder(data: InsertFolder): Promise<Folder> {
    const [folder] = await db.insert(folders).values(data).returning()
    return folder
  }

  async getFoldersByParent(userId: string, parentId: string | null): Promise<Folder[]> {
    if (parentId === null) {
      return db
        .select()
        .from(folders)
        .where(and(eq(folders.userId, userId), isNull(folders.parentId)))
    }
    return db
      .select()
      .from(folders)
      .where(and(eq(folders.userId, userId), eq(folders.parentId, parentId)))
  }

  async getFolderPath(folderId: string): Promise<Folder[]> {
    // AI-NOTE: Recursive path traversal up to root - can be slow on deep hierarchies (consider WITH RECURSIVE in future)
    const path: Folder[] = []
    let currentId: string | null = folderId

    while (currentId) {
      const [folder] = await db.select().from(folders).where(eq(folders.id, currentId))
      if (!folder) break
      path.unshift(folder)
      currentId = folder.parentId
    }

    return path
  }

  async getFolder(id: string): Promise<Folder | undefined> {
    const [folder] = await db.select().from(folders).where(eq(folders.id, id))
    return folder
  }

  async deleteFolder(id: string, userId: string): Promise<void> {
    // AI-NOTE: Cascade delete - recursively removes all child folders and files; must verify userId to prevent unauthorized deletions
    const childFolders = await db.select().from(folders).where(eq(folders.parentId, id))
    for (const child of childFolders) {
      await this.deleteFolder(child.id, userId)
    }

    const folderFiles = await db.select().from(files).where(eq(files.folderId, id))
    for (const file of folderFiles) {
      await this.deleteFile(file.id, userId)
    }

    await db.delete(folders).where(and(eq(folders.id, id), eq(folders.userId, userId)))
  }

  async createFile(data: InsertFile): Promise<File> {
    const [file] = await db.insert(files).values(data).returning()
    return file
  }

  async getFilesByFolder(userId: string, folderId: string | null): Promise<File[]> {
    if (folderId === null) {
      return db
        .select()
        .from(files)
        .where(and(eq(files.userId, userId), isNull(files.folderId)))
    }
    return db
      .select()
      .from(files)
      .where(and(eq(files.userId, userId), eq(files.folderId, folderId)))
  }

  async getFile(id: string): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id))
    return file
  }

  async deleteFile(id: string, userId: string): Promise<void> {
    await db.delete(shareLinks).where(eq(shareLinks.fileId, id))
    await db.delete(files).where(and(eq(files.id, id), eq(files.userId, userId)))
  }

  async createShareLink(data: Omit<InsertShareLink, 'token'>): Promise<ShareLink> {
    // AI-NOTE: Cryptographically secure token generation - 32 bytes = 256 bits of entropy prevents brute force attacks
    const token = randomBytes(32).toString('hex')
    const [shareLink] = await db
      .insert(shareLinks)
      .values({
        ...data,
        token,
      })
      .returning()
    return shareLink
  }

  async getShareLinksByFile(fileId: string): Promise<ShareLink[]> {
    return db
      .select()
      .from(shareLinks)
      .where(and(eq(shareLinks.fileId, fileId), eq(shareLinks.isActive, true)))
  }

  async getShareLink(id: string): Promise<ShareLink | undefined> {
    const [shareLink] = await db.select().from(shareLinks).where(eq(shareLinks.id, id))
    return shareLink
  }

  async getShareLinkByToken(token: string): Promise<ShareLink | undefined> {
    const [shareLink] = await db.select().from(shareLinks).where(eq(shareLinks.token, token))
    return shareLink
  }

  async deleteShareLink(id: string): Promise<void> {
    await db.delete(shareLinks).where(eq(shareLinks.id, id))
  }

  async incrementDownloadCount(id: string): Promise<void> {
    await db
      .update(shareLinks)
      .set({ downloadCount: sql`${shareLinks.downloadCount} + 1` })
      .where(eq(shareLinks.id, id))
  }

  async getStats(
    userId: string
  ): Promise<{ totalFiles: number; totalFolders: number; totalSize: number }> {
    const [fileStats] = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalSize: sql<number>`coalesce(sum(${files.size}), 0)::bigint`,
      })
      .from(files)
      .where(eq(files.userId, userId))

    const [folderStats] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(folders)
      .where(eq(folders.userId, userId))

    return {
      totalFiles: fileStats?.count || 0,
      totalFolders: folderStats?.count || 0,
      totalSize: Number(fileStats?.totalSize || 0),
    }
  }
}

export const storage = new DatabaseStorage()
