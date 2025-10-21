import rateLimit from 'express-rate-limit';

/**
 * Rate Limiting Middleware
 *
 * Protects API endpoints from abuse by limiting the number of requests
 * per IP address within a specified time window.
 *
 * Configuration:
 * - 100 requests per 15 minutes per IP address
 * - Returns 429 status code when limit is exceeded
 * - Includes retry-after header
 */

/**
 * Rate limiter configuration options
 */
export interface RateLimitConfig {
  windowMs?: number; // Time window in milliseconds
  maxRequests?: number; // Maximum requests per window
  message?: string; // Error message when limit exceeded
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

/**
 * Create a rate limiter middleware instance
 * @param config Rate limiter configuration
 * @returns Rate limiter middleware
 */
export function createRateLimiter(config: RateLimitConfig = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    message = 'Too many requests from this IP, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = config;

  return rateLimit({
    windowMs,
    max: maxRequests,
    message: {
      success: false,
      error: message,
      errorCode: 'RATE_LIMITED',
      timestamp: new Date().toISOString()
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    skipSuccessfulRequests,
    skipFailedRequests,
    // Custom key generator (uses IP address by default)
    keyGenerator: (req) => {
      // Use X-Forwarded-For header if behind proxy, otherwise use req.ip
      const forwardedFor = req.headers['x-forwarded-for'];
      if (forwardedFor) {
        const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
        return ips.split(',')[0].trim();
      }
      return req.ip || 'unknown';
    },
    // Custom handler for when limit is exceeded
    handler: (req, res) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.status(429).json({
        success: false,
        error: message,
        errorCode: 'RATE_LIMITED',
        details: {
          retryAfter,
          limit: maxRequests,
          windowMs
        },
        timestamp: new Date().toISOString()
      });
    }
  });
}

/**
 * Default rate limiter for general API endpoints
 * 100 requests per 15 minutes
 */
export const defaultRateLimiter = createRateLimiter();

/**
 * Strict rate limiter for sensitive endpoints (auth, etc.)
 * 20 requests per 15 minutes
 */
export const strictRateLimiter = createRateLimiter({
  maxRequests: 20,
  message: 'Too many attempts, please try again later.'
});

/**
 * Lenient rate limiter for read-only endpoints
 * 300 requests per 15 minutes
 */
export const lenientRateLimiter = createRateLimiter({
  maxRequests: 300,
  skipSuccessfulRequests: true
});

/**
 * Rate limiter for file uploads
 * 10 uploads per 15 minutes
 */
export const uploadRateLimiter = createRateLimiter({
  maxRequests: 10,
  message: 'Too many upload requests, please try again later.'
});
