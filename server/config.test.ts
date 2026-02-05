// AI-META-BEGIN
// AI-META: Environment configuration tests - comprehensive validation testing
// OWNERSHIP: server/config
// ENTRYPOINTS: Run by npm test to validate config implementation
// DEPENDENCIES: vitest, zod
// DANGER: Configuration-critical tests - must validate all environment scenarios
// CHANGE-SAFETY: Update tests if schema fields change or validation logic changes
// AI-META-END

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateEnvironmentConfig, getEnvironmentConfig, EnvConfig } from './config';

describe('Environment Configuration', () => {
  beforeEach(() => {
    // Clear environment variables before each test
    vi.clearAllMocks();
    delete process.env.DATABASE_URL;
    delete process.env.SESSION_SECRET;
    delete process.env.NODE_ENV;
    delete process.env.PORT;
  });

  describe('validateEnvironmentConfig', () => {
    it('should validate with all required environment variables', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.SESSION_SECRET = 'a'.repeat(32);
      
      const config = validateEnvironmentConfig();
      
      expect(config.DATABASE_URL).toBe('postgresql://localhost:5432/test');
      expect(config.SESSION_SECRET).toBe('a'.repeat(32));
      expect(config.NODE_ENV).toBe('development');
      expect(config.PORT).toBe(5000);
    });

    it('should throw error for missing DATABASE_URL', () => {
      process.env.SESSION_SECRET = 'a'.repeat(32);
      delete process.env.DATABASE_URL;
      
      expect(() => validateEnvironmentConfig()).toThrow(
        'Missing or invalid environment variables: DATABASE_URL. Required: DATABASE_URL, SESSION_SECRET. Check your .env file or environment setup.'
      );
    });

    it('should throw error for missing SESSION_SECRET', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      delete process.env.SESSION_SECRET;
      
      expect(() => validateEnvironmentConfig()).toThrow(
        'Missing or invalid environment variables: SESSION_SECRET. Required: DATABASE_URL, SESSION_SECRET. Check your .env file or environment setup.'
      );
    });

    it('should throw error for short SESSION_SECRET', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.SESSION_SECRET = 'short';
      
      expect(() => validateEnvironmentConfig()).toThrow(
        'Invalid environment variables: SESSION_SECRET: String must contain at least 32 character(s). Please check your .env file configuration.'
      );
    });

    it('should use default values for optional fields', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.SESSION_SECRET = 'a'.repeat(32);
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      
      const config = validateEnvironmentConfig();
      
      expect(config.NODE_ENV).toBe('development');
      expect(config.PORT).toBe(5000);
    });

    it('should validate NODE_ENV enum values', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.SESSION_SECRET = 'a'.repeat(32);
      
      // Test valid values
      process.env.NODE_ENV = 'production';
      let config = validateEnvironmentConfig();
      expect(config.NODE_ENV).toBe('production');
      
      process.env.NODE_ENV = 'test';
      config = validateEnvironmentConfig();
      expect(config.NODE_ENV).toBe('test');
      
      // Test invalid value
      process.env.NODE_ENV = 'invalid';
      expect(() => validateEnvironmentConfig()).toThrow(
        /Invalid environment variables.*NODE_ENV.*Invalid literal value/
      );
    });

    it('should coerce PORT to number', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.SESSION_SECRET = 'a'.repeat(32);
      process.env.PORT = '3000';
      
      const config = validateEnvironmentConfig();
      expect(config.PORT).toBe(3000);
    });

    it('should handle optional Replit fields', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.SESSION_SECRET = 'a'.repeat(32);
      process.env.REPLIT_ID = 'replit123';
      process.env.REPLIT_DB = 'replit_db';
      
      const config = validateEnvironmentConfig();
      expect(config.REPLIT_ID).toBe('replit123');
      expect(config.REPLIT_DB).toBe('replit_db');
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should return validated config', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.SESSION_SECRET = 'a'.repeat(32);
      
      const config = getEnvironmentConfig();
      
      expect(config).toEqual({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        SESSION_SECRET: 'a'.repeat(32),
        NODE_ENV: 'development',
        PORT: 5000,
        REPLIT_ID: 'replit123',
        REPLIT_DB: 'replit_db',
        GOOGLE_CLOUD_PROJECT_ID: undefined,
        GOOGLE_CLOUD_KEY_FILE: undefined,
        LOG_LEVEL: 'info',
        ENABLE_CORS: true
      });
    });

    it('should cache validation result', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.SESSION_SECRET = 'a'.repeat(32);
      
      // Call multiple times to test caching
      const config1 = getEnvironmentConfig();
      const config2 = getEnvironmentConfig();
      
      // Should return the same validated object (cached)
      expect(config1).toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle empty DATABASE_URL gracefully', () => {
      process.env.SESSION_SECRET = 'a'.repeat(32);
      process.env.DATABASE_URL = '';
      
      expect(() => validateEnvironmentConfig()).toThrow(
        /Invalid environment variables.*DATABASE_URL.*String must contain at least 1 character\(s\)/
      );
    });

    it('should handle malformed DATABASE_URL', () => {
      process.env.SESSION_SECRET = 'a'.repeat(32);
      process.env.DATABASE_URL = 'not-a-valid-url';
      
      expect(() => validateEnvironmentConfig()).toThrow(
        /Invalid environment variables.*DATABASE_URL.*Invalid url/
      );
    });

    it('should handle non-numeric PORT', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.SESSION_SECRET = 'a'.repeat(32);
      process.env.PORT = 'invalid-port';
      
      expect(() => validateEnvironmentConfig()).toThrow(
        /Invalid environment variables.*PORT.*Expected number/
      );
    });

    it('should handle negative PORT', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.SESSION_SECRET = 'a'.repeat(32);
      process.env.PORT = '-1';
      
      expect(() => validateEnvironmentConfig()).toThrow(
        /Invalid environment variables.*PORT.*Expected number/
      );
    });

    it('should handle zero PORT', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.SESSION_SECRET = 'a'.repeat(32);
      process.env.PORT = '0';
      
      expect(() => validateEnvironmentConfig()).toThrow(
        /Invalid environment variables.*PORT.*Expected number/
      );
    });
  });

  describe('Configuration Security', () => {
    it('should not expose sensitive data in error messages', () => {
      process.env.SESSION_SECRET = 'super-secret-key';
      delete process.env.DATABASE_URL;
      
      try {
        validateEnvironmentConfig();
      } catch (error) {
        // Error message should not contain the actual secret
        expect(error.message).not.toContain('super-secret-key');
        expect(error.message).toContain('SESSION_SECRET');
      }
    });

    it('should validate all required fields in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/prod';
      process.env.SESSION_SECRET = 'a'.repeat(32);
      
      const config = validateEnvironmentConfig();
      
      expect(config.DATABASE_URL).toBe('postgresql://localhost:5432/prod');
      expect(config.SESSION_SECRET).toBe('a'.repeat(32));
      expect(config.NODE_ENV).toBe('production');
    });
  });
});
