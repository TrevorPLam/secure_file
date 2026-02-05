// Tests for server/routes.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express, { Express } from 'express'
import request from 'supertest'
import { createServer } from 'http'

// Mock dependencies before imports
vi.mock('./storage', () => ({
  storage: {
    getFoldersByParent: vi.fn(),
    getFolder: vi.fn(),
    getFolderPath: vi.fn(),
    createFolder: vi.fn(),
    deleteFolder: vi.fn(),
    getFilesByFolder: vi.fn(),
    getFile: vi.fn(),
    createFile: vi.fn(),
    deleteFile: vi.fn(),
    getShareLinksByFile: vi.fn(),
    getShareLink: vi.fn(),
    getShareLinkByToken: vi.fn(),
    createShareLink: vi.fn(),
    deleteShareLink: vi.fn(),
    incrementDownloadCount: vi.fn(),
    getStats: vi.fn(),
  },
}))

vi.mock('./replit_integrations/auth', () => ({
  setupAuth: vi.fn().mockResolvedValue(undefined),
  registerAuthRoutes: vi.fn(),
  isAuthenticated: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { claims: { sub: 'test-user-123' } }
      next()
    } else {
      res.status(401).json({ message: 'Unauthorized' })
    }
  },
}))

vi.mock('./replit_integrations/object_storage', () => {
  class MockObjectStorageService {
    normalizeObjectEntityPath(path: string) {
      return path
    }
  }

  return {
    registerObjectStorageRoutes: vi.fn(),
    ObjectStorageService: MockObjectStorageService,
  }
})

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(password => Promise.resolve(`hashed_${password}`)),
    compare: vi.fn((password, hash) => Promise.resolve(hash === `hashed_${password}`)),
  },
}))

import { registerRoutes } from './routes'
import { storage } from './storage'
import bcrypt from 'bcryptjs'

describe('server/routes', () => {
  let app: Express
  let server: any

  beforeEach(async () => {
    vi.clearAllMocks()
    app = express()
    app.use(express.json())
    const httpServer = createServer(app)
    server = await registerRoutes(httpServer, app)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/folders', () => {
    it('should return folders for authenticated user', async () => {
      const mockFolders = [
        {
          id: '1',
          name: 'Folder 1',
          userId: 'test-user-123',
          parentId: null,
          createdAt: new Date(),
        },
      ]
      ;(storage.getFoldersByParent as any).mockResolvedValue(mockFolders)

      const response = await request(app)
        .get('/api/folders')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(1)
      expect(response.body[0].id).toBe('1')
      expect(response.body[0].name).toBe('Folder 1')
      expect(storage.getFoldersByParent).toHaveBeenCalledWith('test-user-123', null)
    })

    it('should return folders with parentId', async () => {
      const mockFolders = [
        {
          id: '2',
          name: 'Subfolder',
          userId: 'test-user-123',
          parentId: 'parent-1',
          createdAt: new Date(),
        },
      ]
      ;(storage.getFoldersByParent as any).mockResolvedValue(mockFolders)

      const response = await request(app)
        .get('/api/folders?parentId=parent-1')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(1)
      expect(response.body[0].id).toBe('2')
      expect(response.body[0].parentId).toBe('parent-1')
      expect(storage.getFoldersByParent).toHaveBeenCalledWith('test-user-123', 'parent-1')
    })

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/folders')

      expect(response.status).toBe(401)
      expect(response.body.message).toBe('Unauthorized')
    })

    it('should return 500 on storage error', async () => {
      ;(storage.getFoldersByParent as any).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .get('/api/folders')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('Failed to fetch folders')
    })
  })

  describe('GET /api/folders/path/:folderId', () => {
    it('should return folder path for owned folder', async () => {
      const mockFolder = {
        id: 'folder-1',
        name: 'My Folder',
        userId: 'test-user-123',
        parentId: null,
      }
      const mockPath = [mockFolder]
      ;(storage.getFolder as any).mockResolvedValue(mockFolder)
      ;(storage.getFolderPath as any).mockResolvedValue(mockPath)

      const response = await request(app)
        .get('/api/folders/path/folder-1')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockPath)
    })

    it('should return 404 if folder not found', async () => {
      ;(storage.getFolder as any).mockResolvedValue(undefined)

      const response = await request(app)
        .get('/api/folders/path/nonexistent')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('Folder not found')
    })

    it('should return 403 if user does not own folder', async () => {
      const mockFolder = { id: 'folder-1', name: "Someone else's folder", userId: 'other-user' }
      ;(storage.getFolder as any).mockResolvedValue(mockFolder)

      const response = await request(app)
        .get('/api/folders/path/folder-1')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(403)
      expect(response.body.message).toBe('Not authorized')
    })

    it('should return 500 on storage error', async () => {
      ;(storage.getFolder as any).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .get('/api/folders/path/folder-1')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('Failed to fetch folder path')
    })
  })

  describe('POST /api/folders', () => {
    it('should create folder with valid data', async () => {
      const mockFolder = {
        id: 'new-folder-1',
        name: 'New Folder',
        userId: 'test-user-123',
        parentId: null,
        createdAt: new Date(),
      }
      ;(storage.createFolder as any).mockResolvedValue(mockFolder)

      const response = await request(app)
        .post('/api/folders')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'New Folder' })

      expect(response.status).toBe(201)
      expect(response.body.name).toBe('New Folder')
      expect(response.body.userId).toBe('test-user-123')
      expect(storage.createFolder).toHaveBeenCalledWith({
        name: 'New Folder',
        userId: 'test-user-123',
        parentId: null,
      })
    })

    it('should create folder with parentId', async () => {
      const mockFolder = {
        id: 'new-folder-2',
        name: 'Subfolder',
        userId: 'test-user-123',
        parentId: 'parent-1',
        createdAt: new Date(),
      }
      ;(storage.createFolder as any).mockResolvedValue(mockFolder)

      const response = await request(app)
        .post('/api/folders')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Subfolder', parentId: 'parent-1' })

      expect(response.status).toBe(201)
      expect(response.body.name).toBe('Subfolder')
      expect(response.body.parentId).toBe('parent-1')
      expect(storage.createFolder).toHaveBeenCalledWith({
        name: 'Subfolder',
        userId: 'test-user-123',
        parentId: 'parent-1',
      })
    })

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/folders')
        .set('Authorization', 'Bearer valid-token')
        .send({}) // Invalid: missing name

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('Invalid folder data')
    })

    it('should return 500 on storage error', async () => {
      ;(storage.createFolder as any).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .post('/api/folders')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'New Folder' })

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('Failed to create folder')
    })
  })

  describe('DELETE /api/folders/:id', () => {
    it('should delete folder', async () => {
      ;(storage.deleteFolder as any).mockResolvedValue(undefined)

      const response = await request(app)
        .delete('/api/folders/folder-1')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(204)
      expect(storage.deleteFolder).toHaveBeenCalledWith('folder-1', 'test-user-123')
    })

    it('should return 500 on storage error', async () => {
      ;(storage.deleteFolder as any).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .delete('/api/folders/folder-1')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('Failed to delete folder')
    })
  })

  describe('GET /api/files', () => {
    it('should return files for authenticated user', async () => {
      const mockFiles = [
        {
          id: '1',
          name: 'file1.pdf',
          userId: 'test-user-123',
          folderId: null,
          size: 1024,
          mimeType: 'application/pdf',
          objectPath: '/obj/1',
        },
      ]
      ;(storage.getFilesByFolder as any).mockResolvedValue(mockFiles)

      const response = await request(app)
        .get('/api/files')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockFiles)
      expect(storage.getFilesByFolder).toHaveBeenCalledWith('test-user-123', null)
    })

    it('should return files in specific folder', async () => {
      const mockFiles = [
        {
          id: '2',
          name: 'file2.pdf',
          userId: 'test-user-123',
          folderId: 'folder-1',
          size: 2048,
          mimeType: 'application/pdf',
          objectPath: '/obj/2',
        },
      ]
      ;(storage.getFilesByFolder as any).mockResolvedValue(mockFiles)

      const response = await request(app)
        .get('/api/files?folderId=folder-1')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockFiles)
      expect(storage.getFilesByFolder).toHaveBeenCalledWith('test-user-123', 'folder-1')
    })

    it('should return 500 on storage error', async () => {
      ;(storage.getFilesByFolder as any).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .get('/api/files')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('Failed to fetch files')
    })
  })

  describe('POST /api/files', () => {
    it('should create file with valid data', async () => {
      const mockFile = {
        id: 'file-1',
        name: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        objectPath: '/objects/abc',
        userId: 'test-user-123',
        folderId: null,
        createdAt: new Date(),
      }
      ;(storage.createFile as any).mockResolvedValue(mockFile)

      const response = await request(app)
        .post('/api/files')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'test.pdf',
          size: 1024,
          mimeType: 'application/pdf',
          objectPath: '/objects/abc',
        })

      expect(response.status).toBe(201)
      expect(response.body.name).toBe('test.pdf')
      expect(response.body.size).toBe(1024)
    })

    it('should create file in folder', async () => {
      const mockFile = {
        id: 'file-2',
        name: 'doc.pdf',
        size: 2048,
        mimeType: 'application/pdf',
        objectPath: '/objects/def',
        userId: 'test-user-123',
        folderId: 'folder-1',
        createdAt: new Date(),
      }
      ;(storage.createFile as any).mockResolvedValue(mockFile)

      const response = await request(app)
        .post('/api/files')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'doc.pdf',
          size: 2048,
          mimeType: 'application/pdf',
          objectPath: '/objects/def',
          folderId: 'folder-1',
        })

      expect(response.status).toBe(201)
      expect(response.body.name).toBe('doc.pdf')
      expect(response.body.folderId).toBe('folder-1')
    })

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/files')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'test.pdf' }) // Missing required fields

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('Invalid file data')
    })

    it('should return 500 on storage error', async () => {
      ;(storage.createFile as any).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .post('/api/files')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'test.pdf',
          size: 1024,
          mimeType: 'application/pdf',
          objectPath: '/objects/abc',
        })

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('Failed to create file')
    })
  })

  describe('DELETE /api/files/:id', () => {
    it('should delete file', async () => {
      ;(storage.deleteFile as any).mockResolvedValue(undefined)

      const response = await request(app)
        .delete('/api/files/file-1')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(204)
      expect(storage.deleteFile).toHaveBeenCalledWith('file-1', 'test-user-123')
    })

    it('should return 500 on storage error', async () => {
      ;(storage.deleteFile as any).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .delete('/api/files/file-1')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('Failed to delete file')
    })
  })

  describe('GET /api/files/:fileId/shares', () => {
    it('should return share links for owned file', async () => {
      const mockFile = { id: 'file-1', userId: 'test-user-123', name: 'test.pdf' }
      const mockShares = [{ id: 'share-1', fileId: 'file-1', token: 'abc123' }]
      ;(storage.getFile as any).mockResolvedValue(mockFile)
      ;(storage.getShareLinksByFile as any).mockResolvedValue(mockShares)

      const response = await request(app)
        .get('/api/files/file-1/shares')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockShares)
    })

    it('should return 404 if file not found', async () => {
      ;(storage.getFile as any).mockResolvedValue(undefined)

      const response = await request(app)
        .get('/api/files/nonexistent/shares')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('File not found')
    })

    it('should return 403 if user does not own file', async () => {
      const mockFile = { id: 'file-1', userId: 'other-user', name: 'test.pdf' }
      ;(storage.getFile as any).mockResolvedValue(mockFile)

      const response = await request(app)
        .get('/api/files/file-1/shares')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(403)
      expect(response.body.message).toBe('Not authorized')
    })

    it('should return 500 on storage error', async () => {
      ;(storage.getFile as any).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .get('/api/files/file-1/shares')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('Failed to fetch share links')
    })
  })

  describe('POST /api/shares', () => {
    it('should create share link without password', async () => {
      const mockFile = { id: 'file-1', userId: 'test-user-123', name: 'test.pdf' }
      const mockShareLink = {
        id: 'share-1',
        fileId: 'file-1',
        token: 'abc123',
        password: null,
        expiresAt: null,
        isActive: true,
      }
      ;(storage.getFile as any).mockResolvedValue(mockFile)
      ;(storage.createShareLink as any).mockResolvedValue(mockShareLink)

      const response = await request(app)
        .post('/api/shares')
        .set('Authorization', 'Bearer valid-token')
        .send({ fileId: 'file-1' })

      expect(response.status).toBe(201)
      expect(response.body).toEqual(mockShareLink)
      expect(bcrypt.hash).not.toHaveBeenCalled()
    })

    it('should create share link with password', async () => {
      const mockFile = { id: 'file-1', userId: 'test-user-123', name: 'test.pdf' }
      const mockShareLink = {
        id: 'share-1',
        fileId: 'file-1',
        token: 'abc123',
        password: 'hashed_mypassword',
        expiresAt: null,
        isActive: true,
      }
      ;(storage.getFile as any).mockResolvedValue(mockFile)
      ;(storage.createShareLink as any).mockResolvedValue(mockShareLink)

      const response = await request(app)
        .post('/api/shares')
        .set('Authorization', 'Bearer valid-token')
        .send({ fileId: 'file-1', password: 'mypassword' })

      expect(response.status).toBe(201)
      expect(bcrypt.hash).toHaveBeenCalledWith('mypassword', 10)
      expect(storage.createShareLink).toHaveBeenCalledWith({
        fileId: 'file-1',
        password: 'hashed_mypassword',
        expiresAt: null,
        isActive: true,
      })
    })

    it('should create share link with expiration', async () => {
      const mockFile = { id: 'file-1', userId: 'test-user-123', name: 'test.pdf' }
      const expiresAt = '2025-12-31T23:59:59.000Z'
      const mockShareLink = {
        id: 'share-1',
        fileId: 'file-1',
        token: 'abc123',
        password: null,
        expiresAt: new Date(expiresAt),
        isActive: true,
      }
      ;(storage.getFile as any).mockResolvedValue(mockFile)
      ;(storage.createShareLink as any).mockResolvedValue(mockShareLink)

      const response = await request(app)
        .post('/api/shares')
        .set('Authorization', 'Bearer valid-token')
        .send({ fileId: 'file-1', expiresAt })

      expect(response.status).toBe(201)
      expect(storage.createShareLink).toHaveBeenCalledWith({
        fileId: 'file-1',
        password: null,
        expiresAt: new Date(expiresAt),
        isActive: true,
      })
    })

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/shares')
        .set('Authorization', 'Bearer valid-token')
        .send({}) // Missing fileId

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('Invalid request data')
    })

    it('should return 404 if file not found', async () => {
      ;(storage.getFile as any).mockResolvedValue(undefined)

      const response = await request(app)
        .post('/api/shares')
        .set('Authorization', 'Bearer valid-token')
        .send({ fileId: 'nonexistent' })

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('File not found')
    })

    it('should return 403 if user does not own file', async () => {
      const mockFile = { id: 'file-1', userId: 'other-user', name: 'test.pdf' }
      ;(storage.getFile as any).mockResolvedValue(mockFile)

      const response = await request(app)
        .post('/api/shares')
        .set('Authorization', 'Bearer valid-token')
        .send({ fileId: 'file-1' })

      expect(response.status).toBe(403)
      expect(response.body.message).toBe('Not authorized')
    })

    it('should return 500 on storage error', async () => {
      const mockFile = { id: 'file-1', userId: 'test-user-123', name: 'test.pdf' }
      ;(storage.getFile as any).mockResolvedValue(mockFile)
      ;(storage.createShareLink as any).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .post('/api/shares')
        .set('Authorization', 'Bearer valid-token')
        .send({ fileId: 'file-1' })

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('Failed to create share link')
    })
  })

  describe('DELETE /api/shares/:id', () => {
    it('should delete share link', async () => {
      const mockShareLink = { id: 'share-1', fileId: 'file-1', token: 'abc123' }
      const mockFile = { id: 'file-1', userId: 'test-user-123', name: 'test.pdf' }
      ;(storage.getShareLink as any).mockResolvedValue(mockShareLink)
      ;(storage.getFile as any).mockResolvedValue(mockFile)
      ;(storage.deleteShareLink as any).mockResolvedValue(undefined)

      const response = await request(app)
        .delete('/api/shares/share-1')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(204)
      expect(storage.deleteShareLink).toHaveBeenCalledWith('share-1')
    })

    it('should return 404 if share link not found', async () => {
      ;(storage.getShareLink as any).mockResolvedValue(undefined)

      const response = await request(app)
        .delete('/api/shares/nonexistent')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('Share link not found')
    })

    it('should return 403 if user does not own file', async () => {
      const mockShareLink = { id: 'share-1', fileId: 'file-1', token: 'abc123' }
      const mockFile = { id: 'file-1', userId: 'other-user', name: 'test.pdf' }
      ;(storage.getShareLink as any).mockResolvedValue(mockShareLink)
      ;(storage.getFile as any).mockResolvedValue(mockFile)

      const response = await request(app)
        .delete('/api/shares/share-1')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(403)
      expect(response.body.message).toBe('Not authorized')
    })

    it('should return 403 if file not found', async () => {
      const mockShareLink = { id: 'share-1', fileId: 'file-1', token: 'abc123' }
      ;(storage.getShareLink as any).mockResolvedValue(mockShareLink)
      ;(storage.getFile as any).mockResolvedValue(undefined)

      const response = await request(app)
        .delete('/api/shares/share-1')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(403)
      expect(response.body.message).toBe('Not authorized')
    })

    it('should return 500 on storage error', async () => {
      ;(storage.getShareLink as any).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .delete('/api/shares/share-1')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('Failed to delete share link')
    })
  })

  describe('GET /api/shares/info/:token', () => {
    it('should return share link info (no auth required)', async () => {
      const mockShareLink = {
        id: 'share-1',
        fileId: 'file-1',
        token: 'abc123',
        password: null,
        expiresAt: null,
        isActive: true,
        downloadCount: 5,
      }
      const mockFile = {
        id: 'file-1',
        name: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      }
      ;(storage.getShareLinkByToken as any).mockResolvedValue(mockShareLink)
      ;(storage.getFile as any).mockResolvedValue(mockFile)

      const response = await request(app).get('/api/shares/info/abc123')

      expect(response.status).toBe(200)
      expect(response.body.id).toBe('share-1')
      expect(response.body.fileName).toBe('test.pdf')
      expect(response.body.fileSize).toBe(1024)
      expect(response.body.hasPassword).toBe(false)
      expect(response.body.isExpired).toBeFalsy() // null when expiresAt is null
      expect(response.body.downloadCount).toBe(5)
    })

    it('should indicate password protection', async () => {
      const mockShareLink = {
        id: 'share-1',
        fileId: 'file-1',
        token: 'abc123',
        password: 'hashed_password',
        expiresAt: null,
        isActive: true,
        downloadCount: 0,
      }
      const mockFile = {
        id: 'file-1',
        name: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      }
      ;(storage.getShareLinkByToken as any).mockResolvedValue(mockShareLink)
      ;(storage.getFile as any).mockResolvedValue(mockFile)

      const response = await request(app).get('/api/shares/info/abc123')

      expect(response.status).toBe(200)
      expect(response.body.hasPassword).toBe(true)
    })

    it('should indicate expiration status', async () => {
      const pastDate = new Date(Date.now() - 86400000) // Yesterday
      const mockShareLink = {
        id: 'share-1',
        fileId: 'file-1',
        token: 'abc123',
        password: null,
        expiresAt: pastDate,
        isActive: true,
        downloadCount: 0,
      }
      const mockFile = {
        id: 'file-1',
        name: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      }
      ;(storage.getShareLinkByToken as any).mockResolvedValue(mockShareLink)
      ;(storage.getFile as any).mockResolvedValue(mockFile)

      const response = await request(app).get('/api/shares/info/abc123')

      expect(response.status).toBe(200)
      expect(response.body.isExpired).toBe(true)
    })

    it('should return 404 for nonexistent token', async () => {
      ;(storage.getShareLinkByToken as any).mockResolvedValue(undefined)

      const response = await request(app).get('/api/shares/info/invalid')

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('Share link not found')
    })

    it('should return 404 for inactive share link', async () => {
      const mockShareLink = {
        id: 'share-1',
        fileId: 'file-1',
        token: 'abc123',
        isActive: false,
      }
      ;(storage.getShareLinkByToken as any).mockResolvedValue(mockShareLink)

      const response = await request(app).get('/api/shares/info/abc123')

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('Share link not found')
    })

    it('should return 404 if file not found', async () => {
      const mockShareLink = {
        id: 'share-1',
        fileId: 'file-1',
        token: 'abc123',
        isActive: true,
      }
      ;(storage.getShareLinkByToken as any).mockResolvedValue(mockShareLink)
      ;(storage.getFile as any).mockResolvedValue(undefined)

      const response = await request(app).get('/api/shares/info/abc123')

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('File not found')
    })

    it('should return 500 on storage error', async () => {
      ;(storage.getShareLinkByToken as any).mockRejectedValue(new Error('Database error'))

      const response = await request(app).get('/api/shares/info/abc123')

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('Failed to fetch share info')
    })
  })

  describe('POST /api/shares/:token/download', () => {
    it('should allow download without password', async () => {
      const mockShareLink = {
        id: 'share-1',
        fileId: 'file-1',
        token: 'abc123',
        password: null,
        expiresAt: null,
        isActive: true,
      }
      const mockFile = {
        id: 'file-1',
        name: 'test.pdf',
        objectPath: '/objects/abc',
      }
      ;(storage.getShareLinkByToken as any).mockResolvedValue(mockShareLink)
      ;(storage.getFile as any).mockResolvedValue(mockFile)
      ;(storage.incrementDownloadCount as any).mockResolvedValue(undefined)

      const response = await request(app).post('/api/shares/abc123/download')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        downloadUrl: '/objects/abc',
        fileName: 'test.pdf',
      })
      expect(storage.incrementDownloadCount).toHaveBeenCalledWith('share-1')
    })

    it('should allow download with correct password', async () => {
      const mockShareLink = {
        id: 'share-1',
        fileId: 'file-1',
        token: 'abc123',
        password: 'hashed_mypassword',
        expiresAt: null,
        isActive: true,
      }
      const mockFile = {
        id: 'file-1',
        name: 'test.pdf',
        objectPath: '/objects/abc',
      }
      ;(storage.getShareLinkByToken as any).mockResolvedValue(mockShareLink)
      ;(storage.getFile as any).mockResolvedValue(mockFile)
      ;(storage.incrementDownloadCount as any).mockResolvedValue(undefined)

      const response = await request(app)
        .post('/api/shares/abc123/download')
        .send({ password: 'mypassword' })

      expect(response.status).toBe(200)
      expect(bcrypt.compare).toHaveBeenCalledWith('mypassword', 'hashed_mypassword')
    })

    it('should reject download with incorrect password', async () => {
      const mockShareLink = {
        id: 'share-1',
        fileId: 'file-1',
        token: 'abc123',
        password: 'hashed_correctpassword',
        expiresAt: null,
        isActive: true,
      }
      ;(storage.getShareLinkByToken as any).mockResolvedValue(mockShareLink)

      const response = await request(app)
        .post('/api/shares/abc123/download')
        .send({ password: 'wrongpassword' })

      expect(response.status).toBe(401)
      expect(response.body.message).toBe('Incorrect password')
    })

    it('should reject download without password when required', async () => {
      const mockShareLink = {
        id: 'share-1',
        fileId: 'file-1',
        token: 'abc123',
        password: 'hashed_password',
        expiresAt: null,
        isActive: true,
      }
      ;(storage.getShareLinkByToken as any).mockResolvedValue(mockShareLink)

      const response = await request(app).post('/api/shares/abc123/download').send({}) // No password provided

      expect(response.status).toBe(401)
      expect(response.body.message).toBe('Password required')
    })

    it('should reject expired share link', async () => {
      const pastDate = new Date(Date.now() - 86400000) // Yesterday
      const mockShareLink = {
        id: 'share-1',
        fileId: 'file-1',
        token: 'abc123',
        password: null,
        expiresAt: pastDate,
        isActive: true,
      }
      ;(storage.getShareLinkByToken as any).mockResolvedValue(mockShareLink)

      const response = await request(app).post('/api/shares/abc123/download')

      expect(response.status).toBe(410)
      expect(response.body.message).toBe('Share link has expired')
    })

    it('should return 404 for nonexistent token', async () => {
      ;(storage.getShareLinkByToken as any).mockResolvedValue(undefined)

      const response = await request(app).post('/api/shares/invalid/download')

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('Share link not found')
    })

    it('should return 404 for inactive share link', async () => {
      const mockShareLink = {
        id: 'share-1',
        fileId: 'file-1',
        token: 'abc123',
        isActive: false,
      }
      ;(storage.getShareLinkByToken as any).mockResolvedValue(mockShareLink)

      const response = await request(app).post('/api/shares/abc123/download')

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('Share link not found')
    })

    it('should return 404 if file not found', async () => {
      const mockShareLink = {
        id: 'share-1',
        fileId: 'file-1',
        token: 'abc123',
        password: null,
        expiresAt: null,
        isActive: true,
      }
      ;(storage.getShareLinkByToken as any).mockResolvedValue(mockShareLink)
      ;(storage.getFile as any).mockResolvedValue(undefined)

      const response = await request(app).post('/api/shares/abc123/download')

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('File not found')
    })

    it('should return 500 on storage error', async () => {
      ;(storage.getShareLinkByToken as any).mockRejectedValue(new Error('Database error'))

      const response = await request(app).post('/api/shares/abc123/download')

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('Failed to process download')
    })
  })

  describe('GET /api/stats', () => {
    it('should return stats for authenticated user', async () => {
      const mockStats = {
        totalFiles: 10,
        totalFolders: 5,
        totalSize: 1024000,
      }
      ;(storage.getStats as any).mockResolvedValue(mockStats)

      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockStats)
      expect(storage.getStats).toHaveBeenCalledWith('test-user-123')
    })

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/stats')

      expect(response.status).toBe(401)
      expect(response.body.message).toBe('Unauthorized')
    })

    it('should return 500 on storage error', async () => {
      ;(storage.getStats as any).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', 'Bearer valid-token')

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('Failed to fetch stats')
    })
  })
})
