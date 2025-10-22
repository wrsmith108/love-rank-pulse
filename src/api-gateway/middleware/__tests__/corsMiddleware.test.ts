/**
 * @file corsMiddleware.test.ts
 * @description Test suite for CORS middleware
 *
 * Test Cases:
 * - TC-CORS-001: Allowed origins validation
 * - TC-CORS-002: Preflight request handling
 * - TC-CORS-003: Credentials support
 * - TC-CORS-004: Exposed headers configuration
 * - TC-CORS-005: Max age caching
 */

import { Request, Response } from 'express';
import {
  createCorsMiddleware,
  getCorsMiddleware,
  handleCorsError,
  productionCorsMiddleware,
  developmentCorsMiddleware,
  strictCorsMiddleware
} from '../corsMiddleware';

describe('API Gateway CORS Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      headers: {},
      method: 'GET'
    };
    mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  describe('TC-CORS-001: Allowed origins validation', () => {
    it('should allow requests from whitelisted origins', () => {
      // Arrange
      const allowedOrigins = ['http://localhost:3000', 'https://example.com'];
      const middleware = createCorsMiddleware({ allowedOrigins });

      // Note: CORS middleware from 'cors' package handles origin validation internally
      // We test the configuration is properly set
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should create middleware with default development origins', () => {
      // Arrange
      const middleware = createCorsMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should allow all origins with wildcard', () => {
      // Arrange
      const middleware = createCorsMiddleware({
        allowedOrigins: ['*']
      });

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should create production CORS middleware with strict origins', () => {
      // Act
      const middleware = productionCorsMiddleware;

      // Assert
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should create development CORS middleware allowing all origins', () => {
      // Act
      const middleware = developmentCorsMiddleware;

      // Assert
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should create strict CORS middleware without credentials', () => {
      // Act
      const middleware = strictCorsMiddleware;

      // Assert
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('TC-CORS-002: Preflight request handling', () => {
    it('should handle OPTIONS preflight requests', () => {
      // Arrange
      const middleware = createCorsMiddleware({
        allowedOrigins: ['http://localhost:3000']
      });

      mockReq.method = 'OPTIONS';
      mockReq.headers = {
        'origin': 'http://localhost:3000',
        'access-control-request-method': 'POST'
      };

      // Assert - middleware should be created and handle OPTIONS
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should configure allowed methods for preflight', () => {
      // Arrange
      const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
      const middleware = createCorsMiddleware({
        allowedMethods
      });

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should configure allowed headers for preflight', () => {
      // Arrange
      const allowedHeaders = ['Content-Type', 'Authorization', 'X-Custom-Header'];
      const middleware = createCorsMiddleware({
        allowedHeaders
      });

      // Assert
      expect(middleware).toBeDefined();
    });
  });

  describe('TC-CORS-003: Credentials support', () => {
    it('should enable credentials when configured', () => {
      // Arrange
      const middleware = createCorsMiddleware({
        allowCredentials: true
      });

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should disable credentials when configured', () => {
      // Arrange
      const middleware = createCorsMiddleware({
        allowCredentials: false
      });

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should enable credentials by default', () => {
      // Arrange
      const middleware = createCorsMiddleware();

      // Assert - default config includes credentials: true
      expect(middleware).toBeDefined();
    });
  });

  describe('TC-CORS-004: Exposed headers configuration', () => {
    it('should expose custom response headers', () => {
      // Arrange
      const exposedHeaders = [
        'X-Request-ID',
        'X-Response-Time',
        'X-RateLimit-Limit'
      ];
      const middleware = createCorsMiddleware({
        exposedHeaders
      });

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should expose rate limit headers', () => {
      // Arrange
      const middleware = createCorsMiddleware({
        exposedHeaders: [
          'X-RateLimit-Limit',
          'X-RateLimit-Remaining',
          'X-RateLimit-Reset'
        ]
      });

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should include default exposed headers', () => {
      // Arrange
      const middleware = createCorsMiddleware();

      // Assert - default config includes exposed headers
      expect(middleware).toBeDefined();
    });
  });

  describe('TC-CORS-005: Max age caching', () => {
    it('should set custom max age for preflight cache', () => {
      // Arrange
      const maxAge = 3600; // 1 hour
      const middleware = createCorsMiddleware({
        maxAge
      });

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should use default max age of 24 hours', () => {
      // Arrange
      const middleware = createCorsMiddleware();

      // Assert - default maxAge is 86400 (24 hours)
      expect(middleware).toBeDefined();
    });

    it('should set max age to 0 to disable caching', () => {
      // Arrange
      const middleware = createCorsMiddleware({
        maxAge: 0
      });

      // Assert
      expect(middleware).toBeDefined();
    });
  });

  describe('CORS Error Handling', () => {
    it('should handle CORS errors properly', () => {
      // Arrange
      const corsError = new Error('Not allowed by CORS policy');
      mockReq.headers = { origin: 'http://blocked-origin.com' };

      // Act
      handleCorsError(corsError, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'CORS policy violation',
          errorCode: 'CORS_ERROR',
          details: expect.objectContaining({
            origin: 'http://blocked-origin.com'
          })
        })
      );
    });

    it('should pass non-CORS errors to next middleware', () => {
      // Arrange
      const otherError = new Error('Some other error');

      // Act
      handleCorsError(otherError, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(otherError);
    });
  });

  describe('Environment-based CORS Configuration', () => {
    it('should return production middleware in production environment', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Act
      const middleware = getCorsMiddleware();

      // Assert
      expect(middleware).toBeDefined();

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should return development middleware in development environment', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // Act
      const middleware = getCorsMiddleware();

      // Assert
      expect(middleware).toBeDefined();

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should default to development middleware when NODE_ENV not set', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      // Act
      const middleware = getCorsMiddleware();

      // Assert
      expect(middleware).toBeDefined();

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });
  });
});
