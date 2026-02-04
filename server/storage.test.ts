// Tests for server/storage.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { InsertFolder, InsertFile, Folder, File, ShareLink } from "@shared/schema";

// Mock the database module first
vi.mock("../server/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

// Import db after mock
import { db } from "../server/db";

// Now import and use actual implementation, we'll test with the real randomBytes
import { DatabaseStorage } from "../server/storage";

describe("DatabaseStorage", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    vi.clearAllMocks();
  });

  describe("createFolder", () => {
    it("should create a folder and return it", async () => {
      const mockFolder: Folder = {
        id: "folder-123",
        name: "Test Folder",
        parentId: null,
        userId: "user-456",
        createdAt: new Date(),
      };

      const insertData: InsertFolder = {
        name: "Test Folder",
        parentId: null,
        userId: "user-456",
      };

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockFolder]),
      };

      (db.insert as any).mockReturnValue(mockInsert);

      const result = await storage.createFolder(insertData);

      expect(result).toEqual(mockFolder);
      expect(db.insert).toHaveBeenCalled();
      expect(mockInsert.values).toHaveBeenCalledWith(insertData);
      expect(mockInsert.returning).toHaveBeenCalled();
    });
  });

  describe("getFoldersByParent", () => {
    it("should get root folders when parentId is null", async () => {
      const mockFolders: Folder[] = [
        {
          id: "folder-1",
          name: "Folder 1",
          parentId: null,
          userId: "user-123",
          createdAt: new Date(),
        },
      ];

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockFolders),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getFoldersByParent("user-123", null);

      expect(result).toEqual(mockFolders);
      expect(db.select).toHaveBeenCalled();
    });

    it("should get child folders when parentId is provided", async () => {
      const mockFolders: Folder[] = [
        {
          id: "folder-2",
          name: "Subfolder",
          parentId: "parent-1",
          userId: "user-123",
          createdAt: new Date(),
        },
      ];

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockFolders),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getFoldersByParent("user-123", "parent-1");

      expect(result).toEqual(mockFolders);
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe("getFolder", () => {
    it("should return a folder when it exists", async () => {
      const mockFolder: Folder = {
        id: "folder-123",
        name: "Test Folder",
        parentId: null,
        userId: "user-456",
        createdAt: new Date(),
      };

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockFolder]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getFolder("folder-123");

      expect(result).toEqual(mockFolder);
    });

    it("should return undefined when folder does not exist", async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getFolder("non-existent");

      expect(result).toBeUndefined();
    });
  });

  describe("getFolderPath", () => {
    it("should return path for single root folder", async () => {
      const mockFolder: Folder = {
        id: "folder-1",
        name: "Root",
        parentId: null,
        userId: "user-123",
        createdAt: new Date(),
      };

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockFolder]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getFolderPath("folder-1");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockFolder);
    });

    it("should return path for nested folder", async () => {
      const rootFolder: Folder = {
        id: "root",
        name: "Root",
        parentId: null,
        userId: "user-123",
        createdAt: new Date(),
      };

      const childFolder: Folder = {
        id: "child",
        name: "Child",
        parentId: "root",
        userId: "user-123",
        createdAt: new Date(),
      };

      const grandchildFolder: Folder = {
        id: "grandchild",
        name: "Grandchild",
        parentId: "child",
        userId: "user-123",
        createdAt: new Date(),
      };

      let callCount = 0;
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => {
          const folders = [grandchildFolder, childFolder, rootFolder];
          return Promise.resolve([folders[callCount++]]);
        }),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getFolderPath("grandchild");

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(rootFolder);
      expect(result[1]).toEqual(childFolder);
      expect(result[2]).toEqual(grandchildFolder);
    });

    it("should return empty array when folder not found", async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getFolderPath("non-existent");

      expect(result).toHaveLength(0);
    });
  });

  describe("deleteFolder", () => {
    it("should delete folder with no children", async () => {
      const mockSelectChild = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const mockSelectFiles = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const mockDelete = {
        where: vi.fn().mockResolvedValue(undefined),
      };

      (db.select as any)
        .mockReturnValueOnce(mockSelectChild) // For child folders
        .mockReturnValueOnce(mockSelectFiles); // For files

      (db.delete as any).mockReturnValue(mockDelete);

      await storage.deleteFolder("folder-123", "user-456");

      expect(db.delete).toHaveBeenCalled();
      expect(mockDelete.where).toHaveBeenCalled();
    });

    it("should recursively delete folder with children", async () => {
      const childFolder: Folder = {
        id: "child-1",
        name: "Child",
        parentId: "parent-1",
        userId: "user-123",
        createdAt: new Date(),
      };

      let selectCallCount = 0;
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => {
          selectCallCount++;
          // First call: child folders of parent
          if (selectCallCount === 1) return Promise.resolve([childFolder]);
          // Second call: child folders of child (none)
          if (selectCallCount === 2) return Promise.resolve([]);
          // Third call: files in child (none)
          if (selectCallCount === 3) return Promise.resolve([]);
          // Fourth call: files in parent (none)
          return Promise.resolve([]);
        }),
      };

      const mockDelete = {
        where: vi.fn().mockResolvedValue(undefined),
      };

      (db.select as any).mockReturnValue(mockSelect);
      (db.delete as any).mockReturnValue(mockDelete);

      await storage.deleteFolder("parent-1", "user-123");

      // Should delete both child and parent
      expect(db.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe("createFile", () => {
    it("should create a file and return it", async () => {
      const mockFile: File = {
        id: "file-123",
        name: "test.pdf",
        size: 1024,
        mimeType: "application/pdf",
        objectPath: "/objects/abc",
        folderId: "folder-123",
        userId: "user-456",
        createdAt: new Date(),
      };

      const insertData: InsertFile = {
        name: "test.pdf",
        size: 1024,
        mimeType: "application/pdf",
        objectPath: "/objects/abc",
        folderId: "folder-123",
        userId: "user-456",
      };

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockFile]),
      };

      (db.insert as any).mockReturnValue(mockInsert);

      const result = await storage.createFile(insertData);

      expect(result).toEqual(mockFile);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("getFilesByFolder", () => {
    it("should get root files when folderId is null", async () => {
      const mockFiles: File[] = [
        {
          id: "file-1",
          name: "file1.txt",
          size: 100,
          mimeType: "text/plain",
          objectPath: "/objects/file1",
          folderId: null,
          userId: "user-123",
          createdAt: new Date(),
        },
      ];

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockFiles),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getFilesByFolder("user-123", null);

      expect(result).toEqual(mockFiles);
    });

    it("should get files in a specific folder", async () => {
      const mockFiles: File[] = [
        {
          id: "file-1",
          name: "file1.txt",
          size: 100,
          mimeType: "text/plain",
          objectPath: "/objects/file1",
          folderId: "folder-123",
          userId: "user-123",
          createdAt: new Date(),
        },
      ];

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockFiles),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getFilesByFolder("user-123", "folder-123");

      expect(result).toEqual(mockFiles);
    });
  });

  describe("getFile", () => {
    it("should return a file when it exists", async () => {
      const mockFile: File = {
        id: "file-123",
        name: "test.pdf",
        size: 1024,
        mimeType: "application/pdf",
        objectPath: "/objects/abc",
        folderId: "folder-123",
        userId: "user-456",
        createdAt: new Date(),
      };

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockFile]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getFile("file-123");

      expect(result).toEqual(mockFile);
    });

    it("should return undefined when file does not exist", async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getFile("non-existent");

      expect(result).toBeUndefined();
    });
  });

  describe("deleteFile", () => {
    it("should delete file and its share links", async () => {
      const mockDelete = {
        where: vi.fn().mockResolvedValue(undefined),
      };

      (db.delete as any).mockReturnValue(mockDelete);

      await storage.deleteFile("file-123", "user-456");

      // Should delete share links first, then file
      expect(db.delete).toHaveBeenCalledTimes(2);
      expect(mockDelete.where).toHaveBeenCalledTimes(2);
    });
  });

  describe("createShareLink", () => {
    it("should create a share link with generated token", async () => {
      const insertData = {
        fileId: "file-123",
        password: null,
        expiresAt: null,
        isActive: true,
      };

      // Mock will be called with the generated token
      const mockInsert = {
        values: vi.fn().mockImplementation((values) => {
          // Return the mock with the actual generated token
          return {
            returning: vi.fn().mockResolvedValue([{
              id: "share-123",
              fileId: "file-123",
              token: values.token, // Use the actual generated token
              expiresAt: null,
              password: null,
              downloadCount: 0,
              isActive: true,
              createdAt: new Date(),
            }]),
          };
        }),
      };

      (db.insert as any).mockReturnValue(mockInsert);

      const result = await storage.createShareLink(insertData);

      expect(result.fileId).toBe("file-123");
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe("string");
      expect(result.token.length).toBe(64); // 32 bytes in hex = 64 characters
    });

    it("should create a share link with password and expiration", async () => {
      const expiresAt = new Date("2025-12-31");
      const insertData = {
        fileId: "file-123",
        password: "hashed-password",
        expiresAt,
        isActive: true,
      };

      // Mock will be called with the generated token
      const mockInsert = {
        values: vi.fn().mockImplementation((values) => {
          return {
            returning: vi.fn().mockResolvedValue([{
              id: "share-123",
              fileId: "file-123",
              token: values.token,
              expiresAt,
              password: "hashed-password",
              downloadCount: 0,
              isActive: true,
              createdAt: new Date(),
            }]),
          };
        }),
      };

      (db.insert as any).mockReturnValue(mockInsert);

      const result = await storage.createShareLink(insertData);

      expect(result.fileId).toBe("file-123");
      expect(result.password).toBe("hashed-password");
      expect(result.expiresAt).toEqual(expiresAt);
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe("string");
      expect(result.token.length).toBe(64); // 32 bytes in hex = 64 characters
    });
  });

  describe("getShareLinksByFile", () => {
    it("should return active share links for a file", async () => {
      const mockShareLinks: ShareLink[] = [
        {
          id: "share-1",
          fileId: "file-123",
          token: "token1",
          expiresAt: null,
          password: null,
          downloadCount: 5,
          isActive: true,
          createdAt: new Date(),
        },
      ];

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockShareLinks),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getShareLinksByFile("file-123");

      expect(result).toEqual(mockShareLinks);
    });
  });

  describe("getShareLink", () => {
    it("should return a share link when it exists", async () => {
      const mockShareLink: ShareLink = {
        id: "share-123",
        fileId: "file-123",
        token: "token123",
        expiresAt: null,
        password: null,
        downloadCount: 0,
        isActive: true,
        createdAt: new Date(),
      };

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockShareLink]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getShareLink("share-123");

      expect(result).toEqual(mockShareLink);
    });

    it("should return undefined when share link does not exist", async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getShareLink("non-existent");

      expect(result).toBeUndefined();
    });
  });

  describe("getShareLinkByToken", () => {
    it("should return a share link when token exists", async () => {
      const mockShareLink: ShareLink = {
        id: "share-123",
        fileId: "file-123",
        token: "valid-token",
        expiresAt: null,
        password: null,
        downloadCount: 0,
        isActive: true,
        createdAt: new Date(),
      };

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockShareLink]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getShareLinkByToken("valid-token");

      expect(result).toEqual(mockShareLink);
    });

    it("should return undefined when token does not exist", async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getShareLinkByToken("invalid-token");

      expect(result).toBeUndefined();
    });
  });

  describe("deleteShareLink", () => {
    it("should delete a share link", async () => {
      const mockDelete = {
        where: vi.fn().mockResolvedValue(undefined),
      };

      (db.delete as any).mockReturnValue(mockDelete);

      await storage.deleteShareLink("share-123");

      expect(db.delete).toHaveBeenCalled();
      expect(mockDelete.where).toHaveBeenCalled();
    });
  });

  describe("incrementDownloadCount", () => {
    it("should increment download count", async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      (db.update as any).mockReturnValue(mockUpdate);

      await storage.incrementDownloadCount("share-123");

      expect(db.update).toHaveBeenCalled();
      expect(mockUpdate.set).toHaveBeenCalled();
      expect(mockUpdate.where).toHaveBeenCalled();
    });
  });

  describe("getStats", () => {
    it("should return user statistics", async () => {
      const mockFileStats = {
        count: 10,
        totalSize: BigInt(1024000),
      };

      const mockFolderStats = {
        count: 5,
      };

      let selectCallCount = 0;
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return Promise.resolve([mockFileStats]);
          } else {
            return Promise.resolve([mockFolderStats]);
          }
        }),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getStats("user-123");

      expect(result).toEqual({
        totalFiles: 10,
        totalFolders: 5,
        totalSize: 1024000,
      });
    });

    it("should return zero stats when user has no data", async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      (db.select as any).mockReturnValue(mockSelect);

      const result = await storage.getStats("user-123");

      expect(result).toEqual({
        totalFiles: 0,
        totalFolders: 0,
        totalSize: 0,
      });
    });
  });
});
