// Test setup file - runs before all tests
import { beforeAll, afterAll, afterEach, vi } from "vitest";

// Mock environment variables for tests
beforeAll(() => {
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test-secret-key-for-testing-only";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test_db";
  process.env.PUBLIC_OBJECT_SEARCH_PATHS = "/test-bucket/public";
  process.env.PRIVATE_OBJECT_DIR = "/test-bucket/private";
});

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});
