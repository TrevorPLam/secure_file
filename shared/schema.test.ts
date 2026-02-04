// Tests for shared/schema.ts
import { describe, it, expect } from "vitest";
import { 
  insertFolderSchema, 
  insertFileSchema, 
  insertShareLinkSchema 
} from "@shared/schema";
import type { InsertFolder, InsertFile, InsertShareLink } from "@shared/schema";

describe("insertFolderSchema", () => {
  it("should validate a valid folder with all fields", () => {
    const validFolder: InsertFolder = {
      name: "My Folder",
      parentId: "parent-123",
      userId: "user-456",
    };
    const result = insertFolderSchema.safeParse(validFolder);
    expect(result.success).toBe(true);
  });

  it("should validate a folder with null parentId", () => {
    const validFolder: InsertFolder = {
      name: "Root Folder",
      parentId: null,
      userId: "user-456",
    };
    const result = insertFolderSchema.safeParse(validFolder);
    expect(result.success).toBe(true);
  });

  it("should reject folder without name", () => {
    const invalidFolder = {
      parentId: "parent-123",
      userId: "user-456",
    };
    const result = insertFolderSchema.safeParse(invalidFolder);
    expect(result.success).toBe(false);
  });

  it("should reject folder without userId", () => {
    const invalidFolder = {
      name: "My Folder",
      parentId: "parent-123",
    };
    const result = insertFolderSchema.safeParse(invalidFolder);
    expect(result.success).toBe(false);
  });

  it("should accept folder with empty name (no validation on empty strings)", () => {
    const folder = {
      name: "",
      parentId: "parent-123",
      userId: "user-456",
    };
    const result = insertFolderSchema.safeParse(folder);
    // Schema allows empty strings since there's no min length validation
    expect(result.success).toBe(true);
  });
});

describe("insertFileSchema", () => {
  it("should validate a valid file with all required fields", () => {
    const validFile: InsertFile = {
      name: "document.pdf",
      size: 1024000,
      mimeType: "application/pdf",
      objectPath: "/objects/abc123",
      folderId: "folder-123",
      userId: "user-456",
    };
    const result = insertFileSchema.safeParse(validFile);
    expect(result.success).toBe(true);
  });

  it("should validate a file with null folderId", () => {
    const validFile: InsertFile = {
      name: "document.pdf",
      size: 1024000,
      mimeType: "application/pdf",
      objectPath: "/objects/abc123",
      folderId: null,
      userId: "user-456",
    };
    const result = insertFileSchema.safeParse(validFile);
    expect(result.success).toBe(true);
  });

  it("should reject file without name", () => {
    const invalidFile = {
      size: 1024000,
      mimeType: "application/pdf",
      objectPath: "/objects/abc123",
      folderId: "folder-123",
      userId: "user-456",
    };
    const result = insertFileSchema.safeParse(invalidFile);
    expect(result.success).toBe(false);
  });

  it("should reject file without size", () => {
    const invalidFile = {
      name: "document.pdf",
      mimeType: "application/pdf",
      objectPath: "/objects/abc123",
      folderId: "folder-123",
      userId: "user-456",
    };
    const result = insertFileSchema.safeParse(invalidFile);
    expect(result.success).toBe(false);
  });

  it("should reject file without mimeType", () => {
    const invalidFile = {
      name: "document.pdf",
      size: 1024000,
      objectPath: "/objects/abc123",
      folderId: "folder-123",
      userId: "user-456",
    };
    const result = insertFileSchema.safeParse(invalidFile);
    expect(result.success).toBe(false);
  });

  it("should reject file without objectPath", () => {
    const invalidFile = {
      name: "document.pdf",
      size: 1024000,
      mimeType: "application/pdf",
      folderId: "folder-123",
      userId: "user-456",
    };
    const result = insertFileSchema.safeParse(invalidFile);
    expect(result.success).toBe(false);
  });

  it("should reject file without userId", () => {
    const invalidFile = {
      name: "document.pdf",
      size: 1024000,
      mimeType: "application/pdf",
      objectPath: "/objects/abc123",
      folderId: "folder-123",
    };
    const result = insertFileSchema.safeParse(invalidFile);
    expect(result.success).toBe(false);
  });

  it("should validate file with zero size", () => {
    const validFile: InsertFile = {
      name: "empty.txt",
      size: 0,
      mimeType: "text/plain",
      objectPath: "/objects/empty",
      folderId: null,
      userId: "user-456",
    };
    const result = insertFileSchema.safeParse(validFile);
    expect(result.success).toBe(true);
  });
});

describe("insertShareLinkSchema", () => {
  it("should validate a share link with all optional fields and token", () => {
    const validShareLink = {
      fileId: "file-123",
      token: "generated-token",
      expiresAt: new Date("2025-12-31"),
      password: "hashed-password",
      isActive: true,
    };
    const result = insertShareLinkSchema.safeParse(validShareLink);
    expect(result.success).toBe(true);
  });

  it("should validate a share link with fileId and token", () => {
    const validShareLink = {
      fileId: "file-123",
      token: "generated-token",
    };
    const result = insertShareLinkSchema.safeParse(validShareLink);
    expect(result.success).toBe(true);
  });

  it("should validate a share link with null optional fields", () => {
    const validShareLink = {
      fileId: "file-123",
      token: "generated-token",
      expiresAt: null,
      password: null,
      isActive: true,
    };
    const result = insertShareLinkSchema.safeParse(validShareLink);
    expect(result.success).toBe(true);
  });

  it("should reject share link without fileId", () => {
    const invalidShareLink = {
      token: "some-token",
      password: "hashed-password",
      isActive: true,
    };
    const result = insertShareLinkSchema.safeParse(invalidShareLink);
    expect(result.success).toBe(false);
  });

  it("should reject share link without token", () => {
    const invalidShareLink = {
      fileId: "file-123",
      password: "hashed-password",
    };
    const result = insertShareLinkSchema.safeParse(invalidShareLink);
    expect(result.success).toBe(false);
  });

  it("should accept share link with empty fileId (no min length validation)", () => {
    const shareLink = {
      fileId: "",
      token: "some-token",
      password: "hashed-password",
    };
    const result = insertShareLinkSchema.safeParse(shareLink);
    // Schema allows empty strings since there's no min length validation
    expect(result.success).toBe(true);
  });
});
