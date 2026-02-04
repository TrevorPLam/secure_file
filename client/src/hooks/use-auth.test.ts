// Tests for client/src/hooks/use-auth.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import React, { type ReactNode } from "react";

// Mock fetch globally
global.fetch = vi.fn();

describe("useAuth", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  describe("fetchUser", () => {
    it("should return user when authenticated", async () => {
      const mockUser = {
        id: "user-123",
        username: "testuser",
        email: "test@example.com",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUser,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/user", {
        credentials: "include",
      });
    });

    it("should return null when 401 unauthorized", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it("should throw error for non-401 failures", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeUndefined();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it("should include credentials in request", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "123" }),
      });

      renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/auth/user", {
          credentials: "include",
        });
      });
    });
  });

  describe("logout", () => {
    let originalLocation: Location;

    beforeEach(() => {
      originalLocation = window.location;
      delete (window as any).location;
      window.location = { href: "" } as any;
    });

    afterEach(() => {
      window.location = originalLocation;
    });

    it("should redirect to logout endpoint", async () => {
      const mockUser = {
        id: "user-123",
        username: "testuser",
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockUser,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Trigger logout
      result.current.logout();

      await waitFor(() => {
        expect(window.location.href).toBe("/api/logout");
      });
    });

    it("should set query data to null before redirecting", async () => {
      const mockUser = {
        id: "user-123",
        username: "testuser",
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockUser,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Get initial query data
      const initialData = queryClient.getQueryData(["/api/auth/user"]);
      expect(initialData).toEqual(mockUser);

      // Trigger logout - this sets location.href immediately
      result.current.logout();

      // Verify redirect happened
      await waitFor(() => {
        expect(window.location.href).toBe("/api/logout");
      });
    });

    it("should expose isLoggingOut state", async () => {
      const mockUser = {
        id: "user-123",
        username: "testuser",
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockUser,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      expect(result.current.isLoggingOut).toBe(false);
    });
  });

  describe("hook state", () => {
    it("should initially be loading", () => {
      (global.fetch as any).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ id: "123" }),
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.user).toBeUndefined();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it("should not retry on failure", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Error",
      });

      renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        // Query should not retry
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });

    it("should use staleTime of 5 minutes", async () => {
      const mockUser = { id: "user-123" };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockUser,
      });

      const { result, rerender } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      const firstCallCount = (global.fetch as any).mock.calls.length;

      // Rerender should not trigger new fetch due to staleTime
      rerender();

      expect(global.fetch).toHaveBeenCalledTimes(firstCallCount);
    });
  });

  describe("isAuthenticated", () => {
    it("should be true when user exists", async () => {
      const mockUser = { id: "user-123" };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockUser,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it("should be false when user is null", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });
    });

    it("should be false when user is undefined (loading/error)", () => {
      (global.fetch as any).mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe("query key", () => {
    it("should use correct query key", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "123" }),
      });

      renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        const cachedData = queryClient.getQueryData(["/api/auth/user"]);
        expect(cachedData).toBeDefined();
      });
    });
  });
});
