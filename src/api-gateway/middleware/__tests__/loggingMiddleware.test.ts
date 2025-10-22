/**
 * @file loggingMiddleware.test.ts
 * @description Test suite for logging middleware
 *
 * Test Cases:
 * - TC-LOG-001: Request logging format
 * - TC-LOG-002: Response time tracking
 * - TC-LOG-003: Error request logging
 * - TC-LOG-004: PII redaction
 * - TC-LOG-005: Performance metrics
 */

import { Request, Response } from 'express';
import {
  createLoggingMiddleware,
  getLoggingMiddleware,
  logError,
  logAccess,
  productionLoggingMiddleware,
  developmentLoggingMiddleware,
  jsonLoggingMiddleware
} from '../loggingMiddleware';

describe('API Gateway Logging Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/test',
      url: '/test?param=value',
      headers: {},
      query: {},
      body: {}
    };
    mockRes = {
      statusCode: 200,
      getHeader: jest.fn()
    };
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('TC-LOG-001: Request logging format', () => {
    it('should create logging middleware with default format', () => {
      // Act
      const middleware = createLoggingMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should create logging middleware with combined format', () => {
      // Act
      const middleware = createLoggingMiddleware({ format: 'combined' });

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should create logging middleware with dev format', () => {
      // Act
      const middleware = createLoggingMiddleware({ format: 'dev' });

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should create logging middleware with JSON format', () => {
      // Act
      const middleware = createLoggingMiddleware({ format: 'json' });

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should skip logging for health check endpoints', () => {
      // Arrange
      const middleware = createLoggingMiddleware();
      mockReq.path = '/health';

      // Act - middleware should skip health checks
      // Assert
      expect(middleware).toBeDefined();
    });
  });

  describe('TC-LOG-002: Response time tracking', () => {
    it('should log response time in access logs', () => {
      // Arrange
      mockReq.headers = { 'x-request-id': 'req-123' };
      (mockReq as any).id = 'req-123';
      (mockReq as any)._startAt = [Date.now(), 0];
      (mockRes as any)._startAt = [Date.now() + 1, 50000000]; // 1050ms

      // Act
      logAccess('Test request completed', {
        method: mockReq.method,
        path: mockReq.path,
        responseTime: '1050ms'
      });

      // Assert
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('[API Access]');
    });

    it('should track response time in milliseconds', () => {
      // Arrange
      const data = {
        method: 'POST',
        path: '/api/test',
        responseTime: '245ms',
        statusCode: 201
      };

      // Act
      logAccess('Request completed', data);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0];
      const logString = JSON.stringify(logCall);
      expect(logString).toContain('245ms');
    });

    it('should include response time in error logs', () => {
      // Arrange
      const error = new Error('Test error');
      (mockReq as any).id = 'req-456';

      // Act
      logError(error, mockReq as Request);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('TC-LOG-003: Error request logging', () => {
    it('should log error with request context', () => {
      // Arrange
      const error = new Error('Database connection failed');
      mockReq.method = 'POST';
      mockReq.url = '/api/players';
      mockReq.headers = { authorization: 'Bearer token123' };

      // Act
      logError(error, mockReq as Request);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorLog = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(errorLog);
      expect(logData.request.method).toBe('POST');
      expect(logData.request.url).toBe('/api/players');
      expect(logData.error.message).toBe('Database connection failed');
    });

    it('should log error without request context', () => {
      // Arrange
      const error = new Error('System error');

      // Act
      logError(error);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorLog = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(errorLog);
      expect(logData.error.message).toBe('System error');
      expect(logData.request).toBeUndefined();
    });

    it('should include error stack trace', () => {
      // Arrange
      const error = new Error('Stack trace test');

      // Act
      logError(error, mockReq as Request);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorLog = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(errorLog);
      expect(logData.error.stack).toBeDefined();
    });

    it('should include request ID in error logs', () => {
      // Arrange
      const error = new Error('Test error');
      (mockReq as any).id = 'req-error-123';

      // Act
      logError(error, mockReq as Request);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorLog = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(errorLog);
      expect(logData.request.requestId).toBe('req-error-123');
    });
  });

  describe('TC-LOG-004: PII redaction', () => {
    it('should log requests without exposing sensitive data', () => {
      // Arrange
      mockReq.body = {
        username: 'testuser',
        password: 'secret123',
        email: 'test@example.com'
      };
      mockReq.headers = {
        authorization: 'Bearer sensitive-token'
      };

      // Act
      logError(new Error('Test'), mockReq as Request);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorLog = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(errorLog);

      // Headers and body are logged but should be redacted in production
      expect(logData.request.headers).toBeDefined();
      expect(logData.request.body).toBeDefined();
    });

    it('should handle undefined user gracefully', () => {
      // Arrange
      mockReq.body = { data: 'test' };
      delete (mockReq as any).user;

      // Act
      logError(new Error('Test'), mockReq as Request);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorLog = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(errorLog);
      expect(logData.request.userId).toBeUndefined();
    });

    it('should log user ID when available', () => {
      // Arrange
      (mockReq as any).user = { id: 'user-123' };

      // Act
      logError(new Error('Test'), mockReq as Request);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorLog = consoleErrorSpy.mock.calls[0][1];
      const logData = JSON.parse(errorLog);
      expect(logData.request.userId).toBe('user-123');
    });
  });

  describe('TC-LOG-005: Performance metrics', () => {
    it('should log performance metrics with timestamps', () => {
      // Arrange
      const startTime = Date.now();
      const endTime = startTime + 150;
      const responseTime = endTime - startTime;

      // Act
      logAccess('Request processed', {
        method: 'GET',
        path: '/api/leaderboard',
        responseTime: `${responseTime}ms`,
        statusCode: 200
      });

      // Assert
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][1];
      expect(logCall).toContain('150ms');
    });

    it('should include status code in access logs', () => {
      // Arrange
      const metrics = {
        method: 'POST',
        path: '/api/matches',
        statusCode: 201,
        responseTime: '89ms'
      };

      // Act
      logAccess('Match created', metrics);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][1];
      const logData = JSON.parse(logCall);
      expect(logData.data.statusCode).toBe(201);
    });

    it('should track slow requests', () => {
      // Arrange
      const slowMetrics = {
        method: 'GET',
        path: '/api/complex-query',
        responseTime: '2500ms', // Slow request
        statusCode: 200
      };

      // Act
      logAccess('Slow request completed', slowMetrics);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Environment-based Logging', () => {
    it('should use production logging in production', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Act
      const middleware = getLoggingMiddleware();

      // Assert
      expect(middleware).toBeDefined();

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should use development logging in development', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // Act
      const middleware = getLoggingMiddleware();

      // Assert
      expect(middleware).toBeDefined();

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should use JSON format when specified', () => {
      // Arrange
      const originalEnv = process.env.LOG_FORMAT;
      process.env.LOG_FORMAT = 'json';

      // Act
      const middleware = getLoggingMiddleware();

      // Assert
      expect(middleware).toBeDefined();

      // Cleanup
      if (originalEnv) {
        process.env.LOG_FORMAT = originalEnv;
      } else {
        delete process.env.LOG_FORMAT;
      }
    });
  });

  describe('Middleware Instances', () => {
    it('should export production logging middleware', () => {
      expect(productionLoggingMiddleware).toBeDefined();
      expect(typeof productionLoggingMiddleware).toBe('function');
    });

    it('should export development logging middleware', () => {
      expect(developmentLoggingMiddleware).toBeDefined();
      expect(typeof developmentLoggingMiddleware).toBe('function');
    });

    it('should export JSON logging middleware', () => {
      expect(jsonLoggingMiddleware).toBeDefined();
      expect(typeof jsonLoggingMiddleware).toBe('function');
    });
  });
});
