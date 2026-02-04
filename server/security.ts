// AI-META-BEGIN
// AI-META: Security middleware - implements security headers, rate limiting, and request sanitization
// OWNERSHIP: server/security
// ENTRYPOINTS: Applied in server/index.ts before routes
// DEPENDENCIES: express, express-rate-limit (rate limiting)
// DANGER: Rate limiting must not block legitimate traffic; security headers affect browser behavior; CORS policy affects API access
// CHANGE-SAFETY: Safe to adjust rate limits, unsafe to disable security headers without risk assessment
// TESTS: Manual testing via curl, browser DevTools to verify headers
// AI-META-END

import type { Request, Response, NextFunction, Express } from "express";

/**
 * Security Headers Middleware
 * Implements defense-in-depth headers to protect against common web vulnerabilities
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Content Security Policy - Prevents XSS and data injection attacks
  // Allows inline scripts for shadcn/ui and Vite HMR in development
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-inline/eval needed for Vite dev mode and React
    "style-src 'self' 'unsafe-inline'", // unsafe-inline needed for Tailwind and styled components
    "img-src 'self' data: https:", // data: for base64 images, https: for external images
    "font-src 'self' data:",
    "connect-src 'self' https://replit.com", // Allow OIDC endpoints
    "frame-ancestors 'none'", // Prevent clickjacking
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  
  res.setHeader("Content-Security-Policy", cspDirectives);
  
  // Strict-Transport-Security - Force HTTPS (only if behind HTTPS proxy)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  
  // X-Content-Type-Options - Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // X-Frame-Options - Prevent clickjacking (legacy, CSP frame-ancestors is preferred)
  res.setHeader("X-Frame-Options", "DENY");
  
  // X-XSS-Protection - Legacy XSS filter (mostly deprecated, but doesn't hurt)
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Referrer-Policy - Control referrer information leakage
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions-Policy - Control browser features
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  
  next();
}

/**
 * CORS Configuration
 * Implements strict same-origin policy with explicit allowlist for trusted origins
 */
export function corsPolicy(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  
  // Allowlist of trusted origins (update based on deployment domains)
  const allowedOrigins = [
    'https://replit.com',
    'https://*.repl.co',
    'https://*.replit.dev',
  ];
  
  // In production, strictly enforce allowlist
  // In development, allow localhost for testing
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:5000', 'http://localhost:5173');
  }
  
  // Check if origin matches allowlist (simple wildcard support)
  const isAllowed = origin && allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = allowed.replace('*', '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return allowed === origin;
  });
  
  if (isAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours
    return res.status(204).end();
  }
  
  next();
}

/**
 * Rate Limiting Store
 * Simple in-memory store for rate limiting (consider Redis for production clusters)
 */
class RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  
  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const record = this.store.get(key);
    
    if (!record || now > record.resetTime) {
      const newRecord = { count: 1, resetTime: now + windowMs };
      this.store.set(key, newRecord);
      return newRecord;
    }
    
    record.count++;
    return record;
  }
  
  reset(key: string): void {
    this.store.delete(key);
  }
  
  // Cleanup old entries periodically
  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.store.entries());
    for (const [key, record] of entries) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

const rateLimitStore = new RateLimitStore();

// Cleanup rate limit store every 5 minutes
setInterval(() => rateLimitStore.cleanup(), 5 * 60 * 1000);

/**
 * Rate Limiting Middleware Factory
 * Creates rate limiter with configurable limits
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  message?: string;
}) {
  const {
    windowMs,
    maxRequests,
    skipSuccessfulRequests = false,
    keyGenerator = (req) => req.ip || req.socket.remoteAddress || 'unknown',
    message = 'Too many requests, please try again later.',
  } = options;
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const { count, resetTime } = rateLimitStore.increment(key, windowMs);
    
    // Set rate limit headers (count is already incremented, so remaining is max - count)
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());
    
    if (count > maxRequests) {
      res.status(429).json({
        message,
        retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
      });
      return;
    }
    
    // If skipSuccessfulRequests is true, reset counter on successful responses
    if (skipSuccessfulRequests) {
      res.on('finish', () => {
        if (res.statusCode < 400) {
          rateLimitStore.reset(key);
        }
      });
    }
    
    next();
  };
}

/**
 * Authentication Rate Limiter
 * Stricter limits for auth endpoints to prevent brute force attacks
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 requests per 15 minutes
  skipSuccessfulRequests: true, // Reset on successful login
  keyGenerator: (req) => {
    // Rate limit by IP + username if available
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const username = req.body?.username || req.body?.email || '';
    return `auth:${ip}:${username}`;
  },
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

/**
 * Share Link Rate Limiter
 * Moderate limits for public share link access to prevent scraping
 */
export const shareLinkRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 20, // 20 requests per 5 minutes
  message: 'Too many download attempts. Please try again in a few minutes.',
});

/**
 * General API Rate Limiter
 * Broader limits for authenticated API endpoints
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  message: 'Rate limit exceeded. Please slow down your requests.',
});

/**
 * Apply all security middleware to Express app
 */
export function applySecurityMiddleware(app: Express): void {
  // Apply security headers to all routes
  app.use(securityHeaders);
  
  // Apply CORS policy
  app.use(corsPolicy);
  
  // General API rate limiting (applied to all /api routes)
  app.use('/api', apiRateLimiter);
  
  // Note: Specific rate limiters (auth, share) should be applied to individual routes
  // in routes.ts using authRateLimiter and shareLinkRateLimiter exports
}
