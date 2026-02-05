// AI-META-BEGIN
// AI-META: Environment configuration validation with Zod schema
// OWNERSHIP: server/config
// ENTRYPOINTS: Used throughout server codebase for validated config access
// DEPENDENCIES: zod, Node.js process.env
// DANGER: Server fails fast if required environment variables missing; validates all config at startup
// CHANGE-SAFETY: Never remove required fields from schema; add optional fields with defaults
// TESTS: server/config.test.ts - comprehensive validation testing required
// AI-META-END

import { z } from 'zod';

const envSchema = z.object({
  // Required database configuration
  DATABASE_URL: z.string().min(1, 'Database connection string is required'),
  
  // Required security configuration
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  
  // Server configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  
  // Optional Replit integration (for Replit deployment)
  REPLIT_ID: z.string().optional(),
  REPLIT_DB: z.string().optional(),
  
  // Optional storage configuration
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GOOGLE_CLOUD_KEY_FILE: z.string().optional(),
  
  // Optional development overrides
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_CORS: z.boolean().default(true),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate and parse environment variables
 * @returns {EnvConfig} Validated configuration object
 * @throws {Error} If required environment variables are missing or invalid
 */
export function validateEnvironmentConfig(): EnvConfig {
  try {
    const config = envSchema.parse(process.env);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingFields = error.issues
        .filter(issue => 
          issue.code === 'missing_enum_value' || 
          issue.code === 'invalid_type'
        )
        .map(issue => issue.path.join('.'))
        .join(', ');
      
      if (missingFields.length > 0) {
        throw new Error(
          `Missing or invalid environment variables: ${missingFields}. ` +
          'Required: DATABASE_URL, SESSION_SECRET. ' +
          'Check your .env file or environment setup.'
        );
      }
      
      const invalidFields = error.issues
        .filter(issue => 
          issue.code !== 'missing_enum_value' && 
          issue.code !== 'invalid_type' &&
          issue.code !== 'missing_enum_value' &&
          issue.code !== 'invalid_literal'
        )
        .map(issue => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');
      
      if (invalidFields.length > 0) {
        throw new Error(
          `Invalid environment variables: ${invalidFields}. ` +
          'Please check your .env file configuration.'
        );
      }
    }
    
    throw new Error(
      `Configuration validation failed: ${error.message}. ` +
      'Please check your environment variables.'
    );
  }
}

/**
 * Get validated configuration with defaults
 * @returns {EnvConfig} Configuration object with validated values or defaults
 */
export function getEnvironmentConfig(): EnvConfig {
  return validateEnvironmentConfig();
}

/**
 * Check if running in development mode
 * @returns {boolean} True if NODE_ENV is 'development'
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 * @returns {boolean} True if NODE_ENV is 'production'
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in test mode
 * @returns {boolean} True if NODE_ENV is 'test'
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Get database URL with validation
 * @returns {string} Validated DATABASE_URL
 */
export function getDatabaseUrl(): string {
  const config = getConfig();
  return config.DATABASE_URL;
}

/**
 * Get session secret with validation
 * @returns {string} Validated SESSION_SECRET
 */
export function getSessionSecret(): string {
  const config = getConfig();
  return config.SESSION_SECRET;
}

/**
 * Get server port with validation
 * @returns {number} Validated PORT
 */
export function getServerPort(): number {
  const config = getConfig();
  return config.PORT;
}

export { validateConfig, getConfig, EnvConfig };
