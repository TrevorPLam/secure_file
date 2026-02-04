// Tests for client/src/lib/auth-utils.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isUnauthorizedError, redirectToLogin } from "@/lib/auth-utils";

describe("isUnauthorizedError", () => {
  it("should return true for 401 unauthorized error message", () => {
    const error = new Error("401: Unauthorized");
    expect(isUnauthorizedError(error)).toBe(true);
  });

  it("should return true for 401 error with detailed message", () => {
    const error = new Error("401: Unauthorized - Session expired");
    expect(isUnauthorizedError(error)).toBe(true);
  });

  it("should return false for non-401 error", () => {
    const error = new Error("404: Not Found");
    expect(isUnauthorizedError(error)).toBe(false);
  });

  it("should return false for 400 error", () => {
    const error = new Error("400: Bad Request");
    expect(isUnauthorizedError(error)).toBe(false);
  });

  it("should return false for 500 error", () => {
    const error = new Error("500: Internal Server Error");
    expect(isUnauthorizedError(error)).toBe(false);
  });

  it("should return false for generic error message", () => {
    const error = new Error("Something went wrong");
    expect(isUnauthorizedError(error)).toBe(false);
  });

  it("should return false for error with 401 not at start", () => {
    const error = new Error("Error 401: Unauthorized");
    expect(isUnauthorizedError(error)).toBe(false);
  });

  it("should return false for empty error message", () => {
    const error = new Error("");
    expect(isUnauthorizedError(error)).toBe(false);
  });
});

describe("redirectToLogin", () => {
  let originalLocation: Location;
  let originalSetTimeout: typeof setTimeout;

  beforeEach(() => {
    // Save original window.location
    originalLocation = window.location;
    originalSetTimeout = global.setTimeout;

    // Mock window.location
    delete (window as any).location;
    window.location = { href: "" } as any;

    // Mock setTimeout to execute immediately
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore original window.location
    window.location = originalLocation;
    vi.useRealTimers();
  });

  it("should redirect to /api/login after 500ms", () => {
    redirectToLogin();
    
    // Initially, href should not be set
    expect(window.location.href).toBe("");
    
    // Fast-forward time
    vi.advanceTimersByTime(500);
    
    // Now href should be set
    expect(window.location.href).toBe("/api/login");
  });

  it("should call toast before redirecting", () => {
    const mockToast = vi.fn();
    
    redirectToLogin(mockToast);
    
    // Toast should be called immediately
    expect(mockToast).toHaveBeenCalledOnce();
    expect(mockToast).toHaveBeenCalledWith({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    
    // Redirect should happen after timeout
    expect(window.location.href).toBe("");
    vi.advanceTimersByTime(500);
    expect(window.location.href).toBe("/api/login");
  });

  it("should work without toast parameter", () => {
    redirectToLogin();
    
    vi.advanceTimersByTime(500);
    
    expect(window.location.href).toBe("/api/login");
  });

  it("should not redirect immediately", () => {
    redirectToLogin();
    
    expect(window.location.href).toBe("");
    
    vi.advanceTimersByTime(250);
    expect(window.location.href).toBe("");
    
    vi.advanceTimersByTime(250);
    expect(window.location.href).toBe("/api/login");
  });
});
