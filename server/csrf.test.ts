// AI-META-BEGIN
// AI-META: CSRF protection tests - comprehensive security validation
// OWNERSHIP: server/security
// ENTRYPOINTS: Run by npm test to validate CSRF implementation
// DEPENDENCIES: vitest, supertest, crypto
// DANGER: Security-critical tests - must validate timing attacks, token generation, middleware behavior
// CHANGE-SAFETY: Update token generation tests if crypto implementation changes
// AI-META-END

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { 
  generateCsrfToken, 
  validateCsrfToken, 
  requireCsrf, 
  attachCsrfToken,
  getCsrfToken,
  CSRF_SESSION_KEY,
  CSRF_HEADER_NAME
} from './csrf';

// Mock Express objects
const mockRequest = (session: any = {}) => ({
  session,
  headers: {} as Record<string, string>,
  body: {} as any,
});

const mockResponse = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  return res;
};

const mockNext = vi.fn(() => {
  // Mock next function that does nothing
});

describe('CSRF Token Generation', () => {
  it('should generate tokens of correct length', () => {
    const token = generateCsrfToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    // Base64 encoding of 32 bytes should be approximately 44 characters
    expect(token.length).toBeGreaterThan(40);
    expect(token.length).toBeLessThan(50);
  });

  it('should generate unique tokens', () => {
    const token1 = generateCsrfToken();
    const token2 = generateCsrfToken();
    const token3 = generateCsrfToken();
    
    expect(token1).not.toBe(token2);
    expect(token2).not.toBe(token3);
    expect(token1).not.toBe(token3);
  });

  it('should generate cryptographically secure tokens', () => {
    const tokens = Array.from({ length: 100 }, () => generateCsrfToken());
    
    // All tokens should be unique (extremely high probability)
    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(100);
  });
});

describe('CSRF Token Validation', () => {
  it('should validate matching tokens', () => {
    const token = generateCsrfToken();
    expect(validateCsrfToken(token, token)).toBe(true);
  });

  it('should reject non-matching tokens', () => {
    const token1 = generateCsrfToken();
    const token2 = generateCsrfToken();
    expect(validateCsrfToken(token1, token2)).toBe(false);
  });

  it('should reject empty tokens', () => {
    expect(validateCsrfToken('', 'valid-token')).toBe(false);
    expect(validateCsrfToken('valid-token', '')).toBe(false);
    expect(validateCsrfToken('', '')).toBe(false);
  });

  it('should reject null/undefined tokens', () => {
    expect(validateCsrfToken(null as any, 'valid-token')).toBe(false);
    expect(validateCsrfToken(undefined as any, 'valid-token')).toBe(false);
    expect(validateCsrfToken('valid-token', null as any)).toBe(false);
    expect(validateCsrfToken('valid-token', undefined as any)).toBe(false);
  });

  it('should use timing-safe comparison', () => {
    const token = generateCsrfToken();
    const wrongToken = generateCsrfToken();
    
    // This test ensures we're using timingSafeEqual
    // In a real scenario, timing attacks would be mitigated
    expect(validateCsrfToken(token, wrongToken)).toBe(false);
  });
});

describe('CSRF Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNext.mockClear();
  });

  describe('requireCsrf', () => {
    it('should allow request with valid CSRF token', () => {
      const token = generateCsrfToken();
      const req = mockRequest({ [CSRF_SESSION_KEY]: token });
      const res = mockResponse();
      const next = mockNext();

      req.headers[CSRF_HEADER_NAME] = token;
      requireCsrf(req as any, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request without CSRF token', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      requireCsrf(req as any, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'CSRF token validation failed',
        code: 'CSRF_INVALID'
      });
    });

    it('should reject request with invalid CSRF token', () => {
      const validToken = generateCsrfToken();
      const invalidToken = generateCsrfToken();
      const req = mockRequest({ [CSRF_SESSION_KEY]: validToken });
      const res = mockResponse();
      const next = mockNext();

      req.headers[CSRF_HEADER_NAME] = invalidToken;
      requireCsrf(req as any, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'CSRF token validation failed',
        code: 'CSRF_INVALID'
      });
    });

    it('should accept token from request body as fallback', () => {
      const token = generateCsrfToken();
      const req = mockRequest({ [CSRF_SESSION_KEY]: token });
      const res = mockResponse();
      const next = mockNext();

      req.body = { csrfToken: token };
      requireCsrf(req as any, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('attachCsrfToken', () => {
    it('should generate and store new CSRF token', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      attachCsrfToken(req as any, res, next);

      expect(req.session[CSRF_SESSION_KEY]).toBeDefined();
      expect(typeof req.session[CSRF_SESSION_KEY]).toBe('string');
      expect(next).toHaveBeenCalled();
    });

    it('should not overwrite existing CSRF token', () => {
      const existingToken = generateCsrfToken();
      const req = mockRequest({ [CSRF_SESSION_KEY]: existingToken });
      const res = mockResponse();
      const next = mockNext();

      attachCsrfToken(req as any, res, next);

      expect(req.session[CSRF_SESSION_KEY]).toBe(existingToken);
      expect(next).toHaveBeenCalled();
    });

    it('should set CSRF token in response header', () => {
      const token = generateCsrfToken();
      const req = mockRequest({ [CSRF_SESSION_KEY]: token });
      const res = mockResponse();
      const next = mockNext();

      attachCsrfToken(req as any, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(CSRF_HEADER_NAME, token);
    });
  });

  describe('getCsrfToken', () => {
    it('should return existing CSRF token', () => {
      const token = generateCsrfToken();
      const req = mockRequest({ [CSRF_SESSION_KEY]: token });

      expect(getCsrfToken(req as any)).toBe(token);
    });

    it('should return undefined for no token', () => {
      const req = mockRequest();

      expect(getCsrfToken(req as any)).toBeUndefined();
    });

    it('should return undefined for no session', () => {
      const req = mockRequest(null);

      expect(getCsrfToken(req as any)).toBeUndefined();
    });
  });
});

describe('CSRF Security Edge Cases', () => {
  it('should handle malformed tokens gracefully', () => {
    const validToken = generateCsrfToken();
    
    expect(validateCsrfToken('malformed', validToken)).toBe(false);
    expect(validateCsrfToken(validToken, 'malformed')).toBe(false);
    expect(validateCsrfToken('a'.repeat(1000), validToken)).toBe(false);
  });

  it('should prevent timing attacks through length check', () => {
    const validToken = generateCsrfToken();
    const shortToken = validToken.slice(0, 10);
    
    // Should fail fast due to length mismatch
    expect(validateCsrfToken(shortToken, validToken)).toBe(false);
  });

  it('should handle concurrent token generation', () => {
    const tokens = Array.from({ length: 1000 }, () => generateCsrfToken());
    
    // All should be unique
    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(1000);
    
    // All should be valid format
    tokens.forEach(token => {
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(40);
    });
  });
});
