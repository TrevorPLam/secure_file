// AI-META-BEGIN
// AI-META: CSRF protection utilities - token generation and validation for security
// OWNERSHIP: server/security
// ENTRYPOINTS: Used by server/routes.ts middleware and client API calls
// DEPENDENCIES: crypto (Node.js built-in), express-session
// DANGER: CSRF tokens must be validated for all state-changing requests; token lifetime 24 hours
// CHANGE-SAFETY: Never change token generation method without migration plan; timing-safe comparison required
// TESTS: server/csrf.test.ts - comprehensive security testing required
// AI-META-END

import crypto from 'crypto';
import { Request } from 'express';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_SESSION_KEY = 'csrfToken';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a cryptographically secure CSRF token
 * @returns {string} Base64-encoded random token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('base64');
}

/**
 * Validate CSRF token using timing-safe comparison
 * @param {string} token - Token from request
 * @param {string} expectedToken - Expected token from session
 * @returns {boolean} True if tokens match
 */
export function validateCsrfToken(token: string, expectedToken: string): boolean {
  if (!token || !expectedToken) {
    return false;
  }
  
  // Use timing-safe comparison to prevent timing attacks
  if (token.length !== expectedToken.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(token, 'utf8'),
    Buffer.from(expectedToken, 'utf8')
  );
}

/**
 * Middleware to require CSRF token for state-changing requests
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next function
 */
export function requireCsrf(req: Request, res: any, next: any) {
  const session = (req as any).session;
  const storedToken = session?.[CSRF_SESSION_KEY];
  
  // Get token from header or body
  const requestToken = req.headers[CSRF_HEADER_NAME] || req.body?.csrfToken;
  
  if (!validateCsrfToken(requestToken, storedToken)) {
    return res.status(403).json({
      error: 'CSRF token validation failed',
      code: 'CSRF_INVALID'
    });
  }
  
  next();
}

/**
 * Middleware to attach CSRF token to response
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next function
 */
export function attachCsrfToken(req: Request, res: any, next: any) {
  const session = (req as any).session;
  
  // Generate new token if none exists
  if (!session[CSRF_SESSION_KEY]) {
    session[CSRF_SESSION_KEY] = generateCsrfToken();
  }
  
  // Set token in response header for client access
  res.setHeader(CSRF_HEADER_NAME, session[CSRF_SESSION_KEY]);
  
  next();
}

/**
 * Get CSRF token from session
 * @param {Request} req - Express request object
 * @returns {string | undefined} CSRF token or undefined
 */
export function getCsrfToken(req: Request): string | undefined {
  const session = (req as any).session;
  return session?.[CSRF_SESSION_KEY];
}

export { CSRF_SESSION_KEY, CSRF_HEADER_NAME };
