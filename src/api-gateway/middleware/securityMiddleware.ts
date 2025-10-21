import helmet from 'helmet';
import { RequestHandler } from 'express';

/**
 * Security Headers Middleware
 *
 * Uses Helmet to set various HTTP security headers:
 * - Content-Security-Policy (CSP)
 * - X-DNS-Prefetch-Control
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - Strict-Transport-Security (HSTS)
 * - X-Download-Options
 * - X-Permitted-Cross-Domain-Policies
 */

/**
 * Security middleware configuration
 */
export interface SecurityConfig {
  enableCSP?: boolean;
  enableHSTS?: boolean;
  enableFrameGuard?: boolean;
  enableXSSFilter?: boolean;
  allowedDomains?: string[];
}

/**
 * Create security middleware with custom configuration
 * @param config Security configuration
 * @returns Helmet middleware
 */
export function createSecurityMiddleware(config: SecurityConfig = {}): RequestHandler {
  const {
    enableCSP = true,
    enableHSTS = true,
    enableFrameGuard = true,
    enableXSSFilter = true,
    allowedDomains = []
  } = config;

  // Build Content Security Policy directives
  const cspDirectives: Record<string, string[]> = {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-eval needed for Vite
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", ...allowedDomains],
    frameSrc: ["'self'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: []
  };

  return helmet({
    // Content Security Policy
    contentSecurityPolicy: enableCSP ? {
      directives: cspDirectives
    } : false,

    // HTTP Strict Transport Security
    hsts: enableHSTS ? {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true
    } : false,

    // X-Frame-Options
    frameguard: enableFrameGuard ? {
      action: 'deny'
    } : false,

    // X-Content-Type-Options
    noSniff: true,

    // X-DNS-Prefetch-Control
    dnsPrefetchControl: {
      allow: false
    },

    // X-Download-Options
    ieNoOpen: true,

    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none'
    },

    // Referrer-Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },

    // Remove X-Powered-By header
    hidePoweredBy: true
  });
}

/**
 * Default security middleware for production
 */
export const productionSecurityMiddleware = createSecurityMiddleware({
  enableCSP: true,
  enableHSTS: true,
  enableFrameGuard: true,
  enableXSSFilter: true
});

/**
 * Lenient security middleware for development
 */
export const developmentSecurityMiddleware = createSecurityMiddleware({
  enableCSP: false, // Disabled for hot reload
  enableHSTS: false, // Not needed for localhost
  enableFrameGuard: false,
  enableXSSFilter: true
});

/**
 * Get appropriate security middleware based on environment
 * @returns Security middleware
 */
export function getSecurityMiddleware(): RequestHandler {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'production') {
    return productionSecurityMiddleware;
  }

  return developmentSecurityMiddleware;
}
