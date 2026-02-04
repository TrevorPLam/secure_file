// Tests for client/src/hooks/use-upload.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useUpload } from "./use-upload";
import type { UppyFile } from "@uppy/core";

// Mock fetch globally
global.fetch = vi.fn();

describe("useUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadFile", () => {
    it("should successfully upload a file", async () => {
      const mockFile = new File(["content"], "test.txt", { type: "text/plain" });
      const mockResponse = {
        uploadURL: "https://storage.example.com/presigned-url",
        objectPath: "/objects/test-123",
        metadata: {
          name: "test.txt",
          size: 7,
          contentType: "text/plain",
        },
      };

      // Mock presigned URL request
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Mock file upload to presigned URL
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(() => useUpload({ onSuccess }));

      let uploadResult;
      await act(async () => {
        uploadResult = await result.current.uploadFile(mockFile);
      });

      expect(uploadResult).toEqual(mockResponse);
      expect(onSuccess).toHaveBeenCalledWith(mockResponse);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.progress).toBe(100);
    });

    it("should request presigned URL with correct metadata", async () => {
      const mockFile = new File(["content"], "document.pdf", {
        type: "application/pdf",
      });
      const mockResponse = {
        uploadURL: "https://storage.example.com/url",
        objectPath: "/objects/doc-123",
        metadata: {
          name: "document.pdf",
          size: 7,
          contentType: "application/pdf",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const { result } = renderHook(() => useUpload());

      await act(async () => {
        await result.current.uploadFile(mockFile);
      });

      expect(global.fetch).toHaveBeenNthCalledWith(1, "/api/uploads/request-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "document.pdf",
          size: 7,
          contentType: "application/pdf",
        }),
      });
    });

    it("should use default content type for files without type", async () => {
      const mockFile = new File(["content"], "unknown.bin", { type: "" });
      const mockResponse = {
        uploadURL: "https://storage.example.com/url",
        objectPath: "/objects/bin-123",
        metadata: {
          name: "unknown.bin",
          size: 7,
          contentType: "application/octet-stream",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const { result } = renderHook(() => useUpload());

      await act(async () => {
        await result.current.uploadFile(mockFile);
      });

      const requestBody = JSON.parse(
        (global.fetch as any).mock.calls[0][1].body
      );
      expect(requestBody.contentType).toBe("application/octet-stream");
    });

    it("should upload file to presigned URL with correct headers", async () => {
      const mockFile = new File(["content"], "image.png", { type: "image/png" });
      const mockResponse = {
        uploadURL: "https://storage.example.com/presigned-url",
        objectPath: "/objects/img-123",
        metadata: {
          name: "image.png",
          size: 7,
          contentType: "image/png",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const { result } = renderHook(() => useUpload());

      await act(async () => {
        await result.current.uploadFile(mockFile);
      });

      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        "https://storage.example.com/presigned-url",
        {
          method: "PUT",
          body: mockFile,
          headers: {
            "Content-Type": "image/png",
          },
        }
      );
    });

    it("should handle presigned URL request failure", async () => {
      const mockFile = new File(["content"], "test.txt", { type: "text/plain" });

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Failed to generate URL" }),
      });

      const onError = vi.fn();
      const { result } = renderHook(() => useUpload({ onError }));

      let uploadResult;
      await act(async () => {
        uploadResult = await result.current.uploadFile(mockFile);
      });

      expect(uploadResult).toBeNull();
      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe("Failed to generate URL");
      expect(onError).toHaveBeenCalled();
      expect(result.current.isUploading).toBe(false);
    });

    it("should handle presigned URL request failure without error details", async () => {
      const mockFile = new File(["content"], "test.txt", { type: "text/plain" });

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const { result } = renderHook(() => useUpload());

      let uploadResult;
      await act(async () => {
        uploadResult = await result.current.uploadFile(mockFile);
      });

      expect(uploadResult).toBeNull();
      expect(result.current.error?.message).toBe("Failed to get upload URL");
    });

    it("should handle file upload failure", async () => {
      const mockFile = new File(["content"], "test.txt", { type: "text/plain" });
      const mockResponse = {
        uploadURL: "https://storage.example.com/url",
        objectPath: "/objects/test-123",
        metadata: {
          name: "test.txt",
          size: 7,
          contentType: "text/plain",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
      });

      const onError = vi.fn();
      const { result } = renderHook(() => useUpload({ onError }));

      let uploadResult;
      await act(async () => {
        uploadResult = await result.current.uploadFile(mockFile);
      });

      expect(uploadResult).toBeNull();
      expect(result.current.error?.message).toBe("Failed to upload file to storage");
      expect(onError).toHaveBeenCalled();
    });

    it("should update progress during upload", async () => {
      const mockFile = new File(["content"], "test.txt", { type: "text/plain" });
      const mockResponse = {
        uploadURL: "https://storage.example.com/url",
        objectPath: "/objects/test-123",
        metadata: {
          name: "test.txt",
          size: 7,
          contentType: "text/plain",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const { result } = renderHook(() => useUpload());

      expect(result.current.progress).toBe(0);

      await act(async () => {
        await result.current.uploadFile(mockFile);
      });

      expect(result.current.progress).toBe(100);
    });

    it("should set isUploading state correctly", async () => {
      const mockFile = new File(["content"], "test.txt", { type: "text/plain" });
      const mockResponse = {
        uploadURL: "https://storage.example.com/url",
        objectPath: "/objects/test-123",
        metadata: {
          name: "test.txt",
          size: 7,
          contentType: "text/plain",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const { result } = renderHook(() => useUpload());

      expect(result.current.isUploading).toBe(false);

      const uploadPromise = act(async () => {
        await result.current.uploadFile(mockFile);
      });

      await waitFor(() => {
        expect(result.current.isUploading).toBe(false);
      });

      await uploadPromise;
    });

    it("should clear error on new upload", async () => {
      const mockFile = new File(["content"], "test.txt", { type: "text/plain" });

      // First upload fails
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Failed" }),
      });

      const { result } = renderHook(() => useUpload());

      await act(async () => {
        await result.current.uploadFile(mockFile);
      });

      expect(result.current.error).toBeDefined();

      // Second upload succeeds
      const mockResponse = {
        uploadURL: "https://storage.example.com/url",
        objectPath: "/objects/test-123",
        metadata: {
          name: "test.txt",
          size: 7,
          contentType: "text/plain",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      await act(async () => {
        await result.current.uploadFile(mockFile);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("getUploadParameters", () => {
    it("should return presigned URL parameters for Uppy", async () => {
      const mockUppyFile = {
        name: "uppy-file.jpg",
        size: 12345,
        type: "image/jpeg",
      } as UppyFile<Record<string, unknown>, Record<string, unknown>>;

      const mockResponse = {
        uploadURL: "https://storage.example.com/presigned",
        objectPath: "/objects/uppy-123",
        metadata: {
          name: "uppy-file.jpg",
          size: 12345,
          contentType: "image/jpeg",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useUpload());

      const params = await result.current.getUploadParameters(mockUppyFile);

      expect(params).toEqual({
        method: "PUT",
        url: "https://storage.example.com/presigned",
        headers: {
          "Content-Type": "image/jpeg",
        },
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/uploads/request-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "uppy-file.jpg",
          size: 12345,
          contentType: "image/jpeg",
        }),
      });
    });

    it("should use default content type for Uppy files without type", async () => {
      const mockUppyFile = {
        name: "unknown.bin",
        size: 1024,
        type: "",
      } as UppyFile<Record<string, unknown>, Record<string, unknown>>;

      const mockResponse = {
        uploadURL: "https://storage.example.com/presigned",
        objectPath: "/objects/bin-123",
        metadata: {
          name: "unknown.bin",
          size: 1024,
          contentType: "application/octet-stream",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useUpload());

      const params = await result.current.getUploadParameters(mockUppyFile);

      expect(params.headers?.["Content-Type"]).toBe("application/octet-stream");

      const requestBody = JSON.parse(
        (global.fetch as any).mock.calls[0][1].body
      );
      expect(requestBody.contentType).toBe("application/octet-stream");
    });

    it("should throw error when presigned URL request fails", async () => {
      const mockUppyFile = {
        name: "file.txt",
        size: 100,
        type: "text/plain",
      } as UppyFile<Record<string, unknown>, Record<string, unknown>>;

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
      });

      const { result } = renderHook(() => useUpload());

      await expect(
        result.current.getUploadParameters(mockUppyFile)
      ).rejects.toThrow("Failed to get upload URL");
    });

    it("should handle multiple file uploads independently", async () => {
      const mockUppyFile1 = {
        name: "file1.txt",
        size: 100,
        type: "text/plain",
      } as UppyFile<Record<string, unknown>, Record<string, unknown>>;

      const mockUppyFile2 = {
        name: "file2.jpg",
        size: 200,
        type: "image/jpeg",
      } as UppyFile<Record<string, unknown>, Record<string, unknown>>;

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            uploadURL: "https://storage.example.com/url1",
            objectPath: "/objects/file1",
            metadata: {},
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            uploadURL: "https://storage.example.com/url2",
            objectPath: "/objects/file2",
            metadata: {},
          }),
        });

      const { result } = renderHook(() => useUpload());

      const params1 = await result.current.getUploadParameters(mockUppyFile1);
      const params2 = await result.current.getUploadParameters(mockUppyFile2);

      expect(params1.url).toBe("https://storage.example.com/url1");
      expect(params2.url).toBe("https://storage.example.com/url2");
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    it("should handle non-Error exceptions", async () => {
      const mockFile = new File(["content"], "test.txt", { type: "text/plain" });

      (global.fetch as any).mockRejectedValueOnce("String error");

      const { result } = renderHook(() => useUpload());

      await act(async () => {
        await result.current.uploadFile(mockFile);
      });

      expect(result.current.error?.message).toBe("Upload failed");
    });
  });

  describe("callback options", () => {
    it("should work without callbacks", async () => {
      const mockFile = new File(["content"], "test.txt", { type: "text/plain" });
      const mockResponse = {
        uploadURL: "https://storage.example.com/url",
        objectPath: "/objects/test-123",
        metadata: {
          name: "test.txt",
          size: 7,
          contentType: "text/plain",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const { result } = renderHook(() => useUpload());

      await act(async () => {
        await result.current.uploadFile(mockFile);
      });

      expect(result.current.error).toBeNull();
    });
  });
});
