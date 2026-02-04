// Tests for server/replit_integrations/object_storage/objectStorage.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Google Cloud Storage
vi.mock("@google-cloud/storage", () => {
  const mockFile = {
    exists: vi.fn().mockResolvedValue([true]),
    getMetadata: vi.fn().mockResolvedValue([{ contentType: "text/plain", size: 1024 }]),
    createReadStream: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      pipe: vi.fn(),
    }),
  };

  const mockBucket = {
    file: vi.fn().mockReturnValue(mockFile),
  };

  class MockStorage {
    bucket() {
      return mockBucket;
    }
  }

  return {
    Storage: MockStorage,
    File: class MockFile {},
  };
});

// Mock crypto with proper default export
vi.mock("crypto", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    default: actual.default || actual,
    randomUUID: vi.fn(() => "test-uuid-1234"),
  };
});

// Mock fetch for signed URL generation
global.fetch = vi.fn();

import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../../../server/replit_integrations/object_storage/objectStorage";

describe("ObjectStorageService", () => {
  let service: ObjectStorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PUBLIC_OBJECT_SEARCH_PATHS = "/test-bucket/public,/test-bucket/assets";
    process.env.PRIVATE_OBJECT_DIR = "/test-bucket/private";
    service = new ObjectStorageService();
  });

  describe("getPublicObjectSearchPaths", () => {
    it("should return array of public search paths", () => {
      const paths = service.getPublicObjectSearchPaths();
      expect(paths).toEqual(["/test-bucket/public", "/test-bucket/assets"]);
    });

    it("should remove duplicate paths", () => {
      process.env.PUBLIC_OBJECT_SEARCH_PATHS = "/bucket/path1,/bucket/path1,/bucket/path2";
      const paths = service.getPublicObjectSearchPaths();
      expect(paths).toEqual(["/bucket/path1", "/bucket/path2"]);
    });

    it("should trim whitespace from paths", () => {
      process.env.PUBLIC_OBJECT_SEARCH_PATHS = " /bucket/path1 , /bucket/path2 ";
      const paths = service.getPublicObjectSearchPaths();
      expect(paths).toEqual(["/bucket/path1", "/bucket/path2"]);
    });

    it("should filter out empty paths", () => {
      process.env.PUBLIC_OBJECT_SEARCH_PATHS = "/bucket/path1,,/bucket/path2,";
      const paths = service.getPublicObjectSearchPaths();
      expect(paths).toEqual(["/bucket/path1", "/bucket/path2"]);
    });

    it("should throw error when PUBLIC_OBJECT_SEARCH_PATHS is not set", () => {
      delete process.env.PUBLIC_OBJECT_SEARCH_PATHS;
      expect(() => service.getPublicObjectSearchPaths()).toThrow(
        "PUBLIC_OBJECT_SEARCH_PATHS not set"
      );
    });

    it("should throw error when PUBLIC_OBJECT_SEARCH_PATHS is empty", () => {
      process.env.PUBLIC_OBJECT_SEARCH_PATHS = "";
      expect(() => service.getPublicObjectSearchPaths()).toThrow(
        "PUBLIC_OBJECT_SEARCH_PATHS not set"
      );
    });

    it("should throw error when PUBLIC_OBJECT_SEARCH_PATHS contains only whitespace", () => {
      process.env.PUBLIC_OBJECT_SEARCH_PATHS = "   ,  ,   ";
      expect(() => service.getPublicObjectSearchPaths()).toThrow(
        "PUBLIC_OBJECT_SEARCH_PATHS not set"
      );
    });
  });

  describe("getPrivateObjectDir", () => {
    it("should return private object directory", () => {
      const dir = service.getPrivateObjectDir();
      expect(dir).toBe("/test-bucket/private");
    });

    it("should throw error when PRIVATE_OBJECT_DIR is not set", () => {
      delete process.env.PRIVATE_OBJECT_DIR;
      expect(() => service.getPrivateObjectDir()).toThrow(
        "PRIVATE_OBJECT_DIR not set"
      );
    });

    it("should throw error when PRIVATE_OBJECT_DIR is empty", () => {
      process.env.PRIVATE_OBJECT_DIR = "";
      expect(() => service.getPrivateObjectDir()).toThrow(
        "PRIVATE_OBJECT_DIR not set"
      );
    });
  });

  describe("normalizeObjectEntityPath", () => {
    it("should return path as-is if not a Google Storage URL", () => {
      const result = service.normalizeObjectEntityPath("/objects/file123");
      expect(result).toBe("/objects/file123");
    });

    it("should normalize Google Storage URL to /objects/ path", () => {
      const result = service.normalizeObjectEntityPath(
        "https://storage.googleapis.com/test-bucket/private/uploads/file123"
      );
      expect(result).toBe("/objects/uploads/file123");
    });

    it("should handle URL with query parameters", () => {
      const result = service.normalizeObjectEntityPath(
        "https://storage.googleapis.com/test-bucket/private/uploads/file123?token=abc"
      );
      expect(result).toBe("/objects/uploads/file123");
    });

    it("should return pathname if not under private directory", () => {
      const result = service.normalizeObjectEntityPath(
        "https://storage.googleapis.com/other-bucket/public/file123"
      );
      expect(result).toBe("/other-bucket/public/file123");
    });

    it("should handle private directory without trailing slash", () => {
      process.env.PRIVATE_OBJECT_DIR = "/test-bucket/private";
      const result = service.normalizeObjectEntityPath(
        "https://storage.googleapis.com/test-bucket/private/file123"
      );
      expect(result).toBe("/objects/file123");
    });

    it("should handle private directory with trailing slash", () => {
      process.env.PRIVATE_OBJECT_DIR = "/test-bucket/private/";
      const result = service.normalizeObjectEntityPath(
        "https://storage.googleapis.com/test-bucket/private/file123"
      );
      expect(result).toBe("/objects/file123");
    });

    it("should preserve nested paths in entity ID", () => {
      const result = service.normalizeObjectEntityPath(
        "https://storage.googleapis.com/test-bucket/private/folder1/folder2/file123"
      );
      expect(result).toBe("/objects/folder1/folder2/file123");
    });
  });

  describe("getObjectEntityFile", () => {
    it("should throw ObjectNotFoundError for invalid path prefix", async () => {
      await expect(service.getObjectEntityFile("/invalid/path")).rejects.toThrow(
        ObjectNotFoundError
      );
    });

    it("should throw ObjectNotFoundError for path with insufficient parts", async () => {
      await expect(service.getObjectEntityFile("/objects")).rejects.toThrow(
        ObjectNotFoundError
      );
    });
  });

  describe("getObjectEntityUploadURL", () => {
    it("should throw error when PRIVATE_OBJECT_DIR is not set", async () => {
      delete process.env.PRIVATE_OBJECT_DIR;

      await expect(service.getObjectEntityUploadURL()).rejects.toThrow(
        "PRIVATE_OBJECT_DIR not set"
      );
    });
  });
});

describe("ObjectNotFoundError", () => {
  it("should create error with correct message", () => {
    const error = new ObjectNotFoundError();
    expect(error.message).toBe("Object not found");
    expect(error.name).toBe("ObjectNotFoundError");
  });

  it("should be instance of Error", () => {
    const error = new ObjectNotFoundError();
    expect(error).toBeInstanceOf(Error);
  });

  it("should be instance of ObjectNotFoundError", () => {
    const error = new ObjectNotFoundError();
    expect(error).toBeInstanceOf(ObjectNotFoundError);
  });
});
