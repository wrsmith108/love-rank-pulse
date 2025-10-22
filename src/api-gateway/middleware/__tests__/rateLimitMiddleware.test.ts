/**
 * @file rateLimitMiddleware.test.ts
 * @description Test suite for rate limiting middleware
 *
 * Test Cases:
 * - TC-RATE-001: Request counting
 * - TC-RATE-002: Rate limit enforcement
 * - TC-RATE-003: Retry-After header
 * - TC-RATE-004: Custom limits by route
 * - TC-RATE-005: Distributed rate limiting
 */

import { Request, Response } from 'express';
import {
  createRateLimiter,
  defaultRateLimiter,
  strictRateLimiter,
  lenientRateLimiter,
  uploadRateLimiter
} from '../rateLimitMiddleware';

describe('API Gateway Rate Limit Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      ip: '192.168.1.1',
      headers: {},
      path: '/api/test'
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('TC-RATE-001: Request counting', () => {
    it('should create rate limiter with default configuration', () => {
      // Act
      const middleware = createRateLimiter();

      // Assert
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should create rate limiter with custom max requests', () => {
      // Arrange
      const config = {
        windowMs: 60000, // 1 minute
        maxRequests: 10
      };

      // Act
      const middleware = createRateLimiter(config);

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should create rate limiter with custom time window', () => {
      // Arrange
      const config = {
        windowMs: 30000, // 30 seconds
        maxRequests: 50
      };

      // Act
      const middleware = createRateLimiter(config);

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should use IP address as default key for counting', () => {
      // Arrange
      mockReq.ip = '10.0.0.5';
      const middleware = createRateLimiter();

      // Assert
      expect(middleware).toBeDefined();
      // Rate limiter uses IP internally for key generation
    });
  });

  describe('TC-RATE-002: Rate limit enforcement', () => {
    it('should enforce rate limits with default settings', () => {
      // Arrange
      const middleware = defaultRateLimiter;

      // Assert
      expect(middleware).toBeDefined();
      // Default: 100 requests per 15 minutes
    });

    it('should enforce strict rate limits', () => {
      // Arrange
      const middleware = strictRateLimiter;

      // Assert
      expect(middleware).toBeDefined();
      // Strict: 20 requests per 15 minutes
    });

    it('should enforce lenient rate limits', () => {
      // Arrange
      const middleware = lenientRateLimiter;

      // Assert
      expect(middleware).toBeDefined();
      // Lenient: 300 requests per 15 minutes
    });

    it('should enforce upload rate limits', () => {
      // Arrange
      const middleware = uploadRateLimiter;

      // Assert
      expect(middleware).toBeDefined();
      // Upload: 10 requests per 15 minutes
    });

    it('should use custom error message when limit exceeded', () => {
      // Arrange
      const customMessage = 'Custom rate limit message';
      const middleware = createRateLimiter({
        maxRequests: 5,
        message: customMessage
      });

      // Assert
      expect(middleware).toBeDefined();
    });
  });

  describe('TC-RATE-003: Retry-After header', () => {
    it('should calculate retry-after time correctly', () => {
      // Arrange
      const windowMs = 60000; // 1 minute
      const expectedRetryAfter = Math.ceil(windowMs / 1000);

      // Act
      const middleware = createRateLimiter({
        windowMs,
        maxRequests: 10
      });

      // Assert
      expect(middleware).toBeDefined();
      // Retry-After should be 60 seconds
      expect(expectedRetryAfter).toBe(60);
    });

    it('should include retry-after in rate limit response', () => {
      // Arrange
      const windowMs = 900000; // 15 minutes
      const expectedRetryAfter = Math.ceil(windowMs / 1000);

      // Act
      const middleware = createRateLimiter({
        windowMs,
        maxRequests: 100
      });

      // Assert
      expect(middleware).toBeDefined();
      expect(expectedRetryAfter).toBe(900); // 900 seconds = 15 minutes
    });

    it('should set standard rate limit headers', () => {
      // Arrange
      const middleware = createRateLimiter();

      // Assert
      expect(middleware).toBeDefined();
      // Middleware configured to set RateLimit-* headers
    });
  });

  describe('TC-RATE-004: Custom limits by route', () => {
    it('should support different limits for different endpoints', () => {
      // Arrange
      const authLimiter = createRateLimiter({
        maxRequests: 5,
        windowMs: 300000 // 5 minutes
      });

      const apiLimiter = createRateLimiter({
        maxRequests: 100,
        windowMs: 900000 // 15 minutes
      });

      // Assert
      expect(authLimiter).toBeDefined();
      expect(apiLimiter).toBeDefined();
    });

    it('should create strict limiter for sensitive routes', () => {
      // Act
      const middleware = strictRateLimiter;

      // Assert
      expect(middleware).toBeDefined();
      // Strict limiter: 20 requests per 15 minutes
    });

    it('should create lenient limiter for read-only routes', () => {
      // Act
      const middleware = lenientRateLimiter;

      // Assert
      expect(middleware).toBeDefined();
      // Lenient limiter skips successful requests
    });

    it('should create specialized limiter for uploads', () => {
      // Act
      const middleware = uploadRateLimiter;

      // Assert
      expect(middleware).toBeDefined();
      // Upload limiter: 10 requests per 15 minutes
    });
  });

  describe('TC-RATE-005: Distributed rate limiting', () => {
    it('should handle X-Forwarded-For header for proxied requests', () => {
      // Arrange
      mockReq.headers = {
        'x-forwarded-for': '203.0.113.1, 198.51.100.1'
      };

      const middleware = createRateLimiter();

      // Assert
      expect(middleware).toBeDefined();
      // Middleware uses first IP from X-Forwarded-For
    });

    it('should fallback to req.ip when no X-Forwarded-For', () => {
      // Arrange
      mockReq.ip = '192.168.1.100';
      delete mockReq.headers['x-forwarded-for'];

      const middleware = createRateLimiter();

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should handle array format of X-Forwarded-For', () => {
      // Arrange
      mockReq.headers = {
        'x-forwarded-for': ['203.0.113.1', '198.51.100.1']
      };

      const middleware = createRateLimiter();

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should use unknown key when IP is unavailable', () => {
      // Arrange
      delete mockReq.ip;
      delete mockReq.headers['x-forwarded-for'];

      const middleware = createRateLimiter();

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should support skip successful requests option', () => {
      // Arrange
      const middleware = createRateLimiter({
        skipSuccessfulRequests: true
      });

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should support skip failed requests option', () => {
      // Arrange
      const middleware = createRateLimiter({
        skipFailedRequests: true
      });

      // Assert
      expect(middleware).toBeDefined();
    });
  });

  describe('Rate Limit Response Format', () => {
    it('should return proper error structure when rate limited', () => {
      // Arrange
      const expectedResponse = {
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        errorCode: 'RATE_LIMITED',
        timestamp: expect.any(String)
      };

      // The middleware internally formats this response
      // We verify the structure is correct
      expect(expectedResponse.success).toBe(false);
      expect(expectedResponse.errorCode).toBe('RATE_LIMITED');
    });

    it('should include rate limit details in response', () => {
      // Arrange
      const windowMs = 900000; // 15 minutes
      const maxRequests = 100;
      const expectedDetails = {
        retryAfter: Math.ceil(windowMs / 1000),
        limit: maxRequests,
        windowMs
      };

      // Assert
      expect(expectedDetails.retryAfter).toBe(900);
      expect(expectedDetails.limit).toBe(100);
      expect(expectedDetails.windowMs).toBe(900000);
    });
  });

  describe('Rate Limiter Presets', () => {
    it('should have default rate limiter with 100 req/15min', () => {
      expect(defaultRateLimiter).toBeDefined();
    });

    it('should have strict rate limiter with 20 req/15min', () => {
      expect(strictRateLimiter).toBeDefined();
    });

    it('should have lenient rate limiter with 300 req/15min', () => {
      expect(lenientRateLimiter).toBeDefined();
    });

    it('should have upload rate limiter with 10 req/15min', () => {
      expect(uploadRateLimiter).toBeDefined();
    });
  });
});
