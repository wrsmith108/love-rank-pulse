import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import RedisClient from '../lib/redis';

/**
 * Rate limiter configuration
 */
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '900000'); // 15 minutes
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100');
const RATE_LIMIT_MAX_AUTHENTICATED = parseInt(process.env.RATE_LIMIT_MAX_AUTHENTICATED || '200');

/**
 * Redis store for distributed rate limiting
 * Falls back to memory store if Redis is unavailable
 */
const createRedisStore = async () => {
  try {
    const redis = await RedisClient.getInstance();

    return {
      async increment(key: string): Promise<{ totalHits: number; resetTime: Date | undefined }> {
        const hits = await redis.incr(key);

        if (hits === 1) {
          await redis.expire(key, RATE_LIMIT_WINDOW / 1000);
        }

        const ttl = await redis.ttl(key);
        const resetTime = ttl > 0 ? new Date(Date.now() + ttl * 1000) : undefined;

        return {
          totalHits: hits,
          resetTime
        };
      },
      async decrement(key: string): Promise<void> {
        await redis.decr(key);
      },
      async resetKey(key: string): Promise<void> {
        await redis.del(key);
      }
    };
  } catch (error) {
    console.warn('Redis not available, using memory store for rate limiting');
    return undefined;
  }
};

/**
 * Custom key generator that considers authentication status
 */
const keyGenerator = (req: Request): string => {
  // Use user ID if authenticated, otherwise use IP
  const user = (req as any).user;
  if (user?.id) {
    return `ratelimit:user:${user.id}`;
  }

  // Get real IP from various headers
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.socket.remoteAddress || 'unknown';

  return `ratelimit:ip:${ip}`;
};

/**
 * Skip rate limiting for certain conditions
 */
const skipSuccessfulRequests = (req: Request, res: Response): boolean => {
  // Skip counting successful requests (only count errors/attacks)
  return res.statusCode < 400;
};

/**
 * Skip rate limiting for trusted sources
 */
const skipFailedRequests = (req: Request, res: Response): boolean => {
  // Don't skip any requests by default
  return false;
};

/**
 * Custom error handler for rate limit exceeded
 */
const handler = (req: Request, res: Response) => {
  res.status(429).json({
    success: false,
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: res.getHeader('Retry-After')
  });
};

/**
 * Standard rate limiter - 100 requests per 15 minutes for unauthenticated users
 */
export const standardRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT_MAX,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  keyGenerator,
  handler,
  skip: (req: Request) => {
    // Skip for authenticated users (they have separate limits)
    return !!(req as any).user;
  }
});

/**
 * Authenticated user rate limiter - 200 requests per 15 minutes
 */
export const authenticatedRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT_MAX_AUTHENTICATED,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler,
  skip: (req: Request) => {
    // Only apply to authenticated users
    return !(req as any).user;
  }
});

/**
 * Strict rate limiter for sensitive endpoints (auth, password reset)
 * 5 requests per 15 minutes
 */
export const strictRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: 5,
  message: 'Too many attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler
});

/**
 * API rate limiter for public endpoints
 * 30 requests per minute
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 30,
  message: 'API rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler
});

/**
 * Combined rate limiter that adapts based on authentication
 */
export const adaptiveRateLimiter = async (req: Request, res: Response, next: any) => {
  const user = (req as any).user;

  if (user) {
    return authenticatedRateLimiter(req, res, next);
  } else {
    return standardRateLimiter(req, res, next);
  }
};

/**
 * Initialize Redis store for rate limiting
 */
export const initializeRateLimitStore = async () => {
  return await createRedisStore();
};
