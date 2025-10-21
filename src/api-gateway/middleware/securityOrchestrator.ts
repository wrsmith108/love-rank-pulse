import { Express, RequestHandler } from 'express';
import { getSecurityMiddleware } from './securityMiddleware';
import { getCorsMiddleware, handleCorsError } from './corsMiddleware';
import { getLoggingMiddleware } from './loggingMiddleware';
import { defaultRateLimiter, strictRateLimiter, lenientRateLimiter } from './rateLimitMiddleware';
import { errorHandlerMiddleware, notFoundMiddleware } from './errorMiddleware';
import { v4 as uuidv4 } from 'uuid';

/**
 * Security Middleware Orchestrator
 *
 * Coordinates and applies all security middleware in the correct order:
 * 1. Request ID generation
 * 2. Security headers (helmet)
 * 3. CORS configuration
 * 4. Request logging (morgan)
 * 5. Body parsing (express.json)
 * 6. Rate limiting
 * 7. Routes
 * 8. 404 handler
 * 9. Error handler (must be last)
 */

/**
 * Security orchestrator configuration
 */
export interface SecurityOrchestratorConfig {
  enableSecurity?: boolean;
  enableCors?: boolean;
  enableLogging?: boolean;
  enableRateLimit?: boolean;
  rateLimitPreset?: 'default' | 'strict' | 'lenient';
  customMiddleware?: RequestHandler[];
}

/**
 * Request ID middleware
 * Generates a unique ID for each request for tracking and logging
 */
export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  // Use existing request ID from header or generate new one
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  // Add to request object
  (req as any).id = requestId;

  // Add to response headers
  res.setHeader('X-Request-ID', requestId);

  next();
};

/**
 * Response time middleware
 * Tracks request processing time and adds header
 */
export const responseTimeMiddleware: RequestHandler = (req, res, next) => {
  const start = Date.now();

  // Attach finish event listener
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
  });

  next();
};

/**
 * Health check middleware
 * Provides a simple health endpoint that bypasses other middleware
 */
export const healthCheckMiddleware: RequestHandler = (req, res, next) => {
  if (req.path === '/health' || req.path === '/ping') {
    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
    return;
  }

  next();
};

/**
 * Apply all security middleware to Express app
 * @param app Express application
 * @param config Security configuration
 */
export function applySecurityMiddleware(
  app: Express,
  config: SecurityOrchestratorConfig = {}
): void {
  const {
    enableSecurity = true,
    enableCors = true,
    enableLogging = true,
    enableRateLimit = true,
    rateLimitPreset = 'default',
    customMiddleware = []
  } = config;

  // 1. Health check (before other middleware for performance)
  app.use(healthCheckMiddleware);

  // 2. Request ID generation
  app.use(requestIdMiddleware);

  // 3. Response time tracking
  app.use(responseTimeMiddleware);

  // 4. Security headers (helmet)
  if (enableSecurity) {
    app.use(getSecurityMiddleware());
  }

  // 5. CORS configuration
  if (enableCors) {
    app.use(getCorsMiddleware());
  }

  // 6. Request logging (morgan)
  if (enableLogging) {
    app.use(getLoggingMiddleware());
  }

  // 7. Body parsing
  app.use(Express.json({ limit: '10mb' }));
  app.use(Express.urlencoded({ extended: true, limit: '10mb' }));

  // 8. Rate limiting
  if (enableRateLimit) {
    let rateLimiter: RequestHandler;

    switch (rateLimitPreset) {
      case 'strict':
        rateLimiter = strictRateLimiter;
        break;
      case 'lenient':
        rateLimiter = lenientRateLimiter;
        break;
      default:
        rateLimiter = defaultRateLimiter;
    }

    app.use(rateLimiter);
  }

  // 9. Custom middleware (if any)
  if (customMiddleware.length > 0) {
    customMiddleware.forEach(middleware => app.use(middleware));
  }

  // Note: Routes should be added here by the caller
  // Then add the following after routes:

  // 10. CORS error handler
  if (enableCors) {
    app.use(handleCorsError);
  }

  // 11. 404 handler (must be before error handler)
  app.use(notFoundMiddleware);

  // 12. Global error handler (must be last)
  app.use(errorHandlerMiddleware);
}

/**
 * Apply minimal security middleware (for development)
 * @param app Express application
 */
export function applyMinimalSecurityMiddleware(app: Express): void {
  applySecurityMiddleware(app, {
    enableSecurity: false,
    enableCors: true,
    enableLogging: true,
    enableRateLimit: false
  });
}

/**
 * Apply production security middleware (recommended for production)
 * @param app Express application
 */
export function applyProductionSecurityMiddleware(app: Express): void {
  applySecurityMiddleware(app, {
    enableSecurity: true,
    enableCors: true,
    enableLogging: true,
    enableRateLimit: true,
    rateLimitPreset: 'default'
  });
}

/**
 * Apply strict security middleware (for sensitive endpoints)
 * @param app Express application
 */
export function applyStrictSecurityMiddleware(app: Express): void {
  applySecurityMiddleware(app, {
    enableSecurity: true,
    enableCors: true,
    enableLogging: true,
    enableRateLimit: true,
    rateLimitPreset: 'strict'
  });
}

/**
 * Get security middleware stack for manual application
 * @param config Security configuration
 * @returns Array of middleware functions
 */
export function getSecurityMiddlewareStack(
  config: SecurityOrchestratorConfig = {}
): RequestHandler[] {
  const {
    enableSecurity = true,
    enableCors = true,
    enableLogging = true,
    enableRateLimit = true,
    rateLimitPreset = 'default',
    customMiddleware = []
  } = config;

  const middleware: RequestHandler[] = [];

  // Health check
  middleware.push(healthCheckMiddleware);

  // Request ID
  middleware.push(requestIdMiddleware);

  // Response time
  middleware.push(responseTimeMiddleware);

  // Security headers
  if (enableSecurity) {
    middleware.push(getSecurityMiddleware());
  }

  // CORS
  if (enableCors) {
    middleware.push(getCorsMiddleware());
  }

  // Logging
  if (enableLogging) {
    middleware.push(getLoggingMiddleware());
  }

  // Rate limiting
  if (enableRateLimit) {
    switch (rateLimitPreset) {
      case 'strict':
        middleware.push(strictRateLimiter);
        break;
      case 'lenient':
        middleware.push(lenientRateLimiter);
        break;
      default:
        middleware.push(defaultRateLimiter);
    }
  }

  // Custom middleware
  middleware.push(...customMiddleware);

  return middleware;
}
