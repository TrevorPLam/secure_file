// AI-META-BEGIN
// AI-META: Security middleware tests - validates security headers, rate limiting, and CORS
// OWNERSHIP: server/security
// ENTRYPOINTS: Vitest test suite
// DEPENDENCIES: vitest, supertest, express, ../security
// DANGER: Tests verify critical security controls - do not disable
// CHANGE-SAFETY: Safe to add tests, unsafe to remove security validations
// TESTS: Run `npm run test` to execute
// AI-META-END

import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import {
  securityHeaders,
  corsPolicy,
  createRateLimiter,
  applySecurityMiddleware,
} from "./security";

describe("Security Middleware", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe("securityHeaders", () => {
    beforeEach(() => {
      app.use(securityHeaders);
      app.get("/test", (_req, res) => res.json({ ok: true }));
    });

    it("should set Content-Security-Policy header", async () => {
      const response = await request(app).get("/test");
      expect(response.headers["content-security-policy"]).toBeDefined();
      expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
    });

    it("should set X-Content-Type-Options header", async () => {
      const response = await request(app).get("/test");
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("should set X-Frame-Options header", async () => {
      const response = await request(app).get("/test");
      expect(response.headers["x-frame-options"]).toBe("DENY");
    });

    it("should set Referrer-Policy header", async () => {
      const response = await request(app).get("/test");
      expect(response.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    });

    it("should set Permissions-Policy header", async () => {
      const response = await request(app).get("/test");
      expect(response.headers["permissions-policy"]).toContain("geolocation=()");
    });

    it("should set HSTS header for HTTPS requests", async () => {
      const response = await request(app)
        .get("/test")
        .set("X-Forwarded-Proto", "https");
      expect(response.headers["strict-transport-security"]).toBeDefined();
      expect(response.headers["strict-transport-security"]).toContain("max-age=31536000");
    });

    it("should not set HSTS header for HTTP requests", async () => {
      const response = await request(app).get("/test");
      expect(response.headers["strict-transport-security"]).toBeUndefined();
    });
  });

  describe("corsPolicy", () => {
    beforeEach(() => {
      app.use(corsPolicy);
      app.get("/test", (_req, res) => res.json({ ok: true }));
      app.post("/test", (_req, res) => res.json({ ok: true }));
    });

    it("should allow requests without origin in development", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      
      const response = await request(app).get("/test");
      expect(response.status).toBe(200);
      
      process.env.NODE_ENV = originalEnv;
    });

    it("should handle OPTIONS preflight requests", async () => {
      const response = await request(app)
        .options("/test")
        .set("Origin", "http://localhost:5000");
      
      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-methods"]).toContain("POST");
    });

    it("should set CORS headers for allowed origins", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      
      const response = await request(app)
        .get("/test")
        .set("Origin", "http://localhost:5000");
      
      expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5000");
      expect(response.headers["access-control-allow-credentials"]).toBe("true");
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limits", async () => {
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 3,
        keyGenerator: () => 'test-key-enforce', // Unique key for this test
      });

      app.use("/limited", rateLimiter);
      app.get("/limited", (_req, res) => res.json({ ok: true }));

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const response = await request(app).get("/limited");
        expect(response.status).toBe(200);
        expect(response.headers["x-ratelimit-limit"]).toBe("3");
      }

      // 4th request should be rate limited
      const response = await request(app).get("/limited");
      expect(response.status).toBe(429);
      expect(response.body.message).toContain("Too many requests");
      expect(response.body.retryAfter).toBeDefined();
    });

    it("should set rate limit headers", async () => {
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyGenerator: () => 'test-key-headers', // Unique key for this test
      });

      app.use("/limited2", rateLimiter);
      app.get("/limited2", (_req, res) => res.json({ ok: true }));

      const response = await request(app).get("/limited2");
      expect(response.headers["x-ratelimit-limit"]).toBe("5");
      // After first request, count is 1, so remaining is 5-1 = 4
      expect(response.headers["x-ratelimit-remaining"]).toBe("4");
      expect(response.headers["x-ratelimit-reset"]).toBeDefined();
      
      // Second request
      const response2 = await request(app).get("/limited2");
      expect(response2.headers["x-ratelimit-remaining"]).toBe("3");
    });

    it("should use custom key generator", async () => {
      const keyGenerator = vi.fn(() => "custom-key-unique");
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyGenerator,
      });

      app.use("/limited3", rateLimiter);
      app.get("/limited3", (_req, res) => res.json({ ok: true }));

      await request(app).get("/limited3");
      expect(keyGenerator).toHaveBeenCalled();
    });

    it("should reset counter on successful requests when skipSuccessfulRequests is true", async () => {
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        skipSuccessfulRequests: true,
        keyGenerator: () => 'test-key-skip', // Unique key for this test
      });

      app.use("/limited4", rateLimiter);
      app.get("/limited4", (_req, res) => res.json({ ok: true }));

      // Multiple successful requests should not hit rate limit
      // because counter is reset after each successful response
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get("/limited4");
        expect(response.status).toBe(200);
        // Wait for response to complete and counter to reset
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    });

    it("should provide custom error message", async () => {
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        message: "Custom rate limit message",
        keyGenerator: () => 'test-key-message', // Unique key for this test
      });

      app.use("/limited5", rateLimiter);
      app.get("/limited5", (_req, res) => res.json({ ok: true }));

      await request(app).get("/limited5");
      const response = await request(app).get("/limited5");
      
      expect(response.status).toBe(429);
      expect(response.body.message).toBe("Custom rate limit message");
    });
  });

  describe("applySecurityMiddleware", () => {
    beforeEach(() => {
      applySecurityMiddleware(app);
      app.get("/test", (_req, res) => res.json({ ok: true }));
      app.get("/api/test", (_req, res) => res.json({ ok: true }));
    });

    it("should apply security headers to all routes", async () => {
      const response = await request(app).get("/test");
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-frame-options"]).toBe("DENY");
    });

    it("should apply CORS policy to all routes", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      
      const response = await request(app)
        .get("/test")
        .set("Origin", "http://localhost:5000");
      
      expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5000");
      
      process.env.NODE_ENV = originalEnv;
    });

    it("should apply rate limiting to /api routes", async () => {
      // This test just verifies the middleware is applied
      // Rate limiting specifics are tested in other tests
      const response = await request(app).get("/api/test");
      expect(response.headers["x-ratelimit-limit"]).toBeDefined();
    });
  });
});
