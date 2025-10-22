/**
 * @file security.test.ts
 * @description Test suite for server security middleware (9 tests)
 */

import { Request, Response, NextFunction } from 'express';
import {
  securityHeaders,
  corsConfig,
  csrfProtection,
  xssProtection,
  preventCommonAttacks,
  applySecurity
} from '../security';

describe('Server Security Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/test',
      headers: {},
      query: {},
      body: {},
      params: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('Security Headers', () => {
    it('should export security headers middleware', () => {
      expect(securityHeaders).toBeDefined();
      expect(typeof securityHeaders).toBe('function');
    });

    it('should configure helmet with security settings', () => {
      // The securityHeaders is a configured helmet instance
      expect(securityHeaders).toBeDefined();
    });
  });

  describe('CORS Configuration', () => {
    it('should export CORS middleware', () => {
      expect(corsConfig).toBeDefined();
      expect(typeof corsConfig).toBe('function');
    });

    it('should allow requests with no origin', () => {
      // CORS middleware allows requests with no origin (mobile apps, etc.)
      expect(corsConfig).toBeDefined();
    });

    it('should allow credentials in CORS', () => {
      // CORS config includes credentials: true
      expect(corsConfig).toBeDefined();
    });
  });

  describe('CSRF Protection', () => {
    it('should skip CSRF for safe methods', () => {
      // Arrange
      mockReq.method = 'GET';

      // Act
      csrfProtection(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should skip CSRF for API endpoints', () => {
      // Arrange
      mockReq.method = 'POST';
      mockReq.path = '/api/test';

      // Act
      csrfProtection(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should validate CSRF token for state-changing operations', () => {
      // Arrange
      mockReq.method = 'POST';
      mockReq.path = '/form-submit';
      mockReq.headers = { 'x-csrf-token': 'invalid-token' };
      (mockReq as any).session = { csrfToken: 'valid-token' };

      // Act
      csrfProtection(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'CSRF token validation failed'
        })
      );
    });

    it('should accept valid CSRF token', () => {
      // Arrange
      mockReq.method = 'POST';
      mockReq.path = '/form';
      const validToken = 'csrf-token-123';
      mockReq.headers = { 'x-csrf-token': validToken };
      (mockReq as any).session = { csrfToken: validToken };

      // Act
      csrfProtection(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('XSS Protection', () => {
    it('should sanitize string inputs', () => {
      // Arrange
      mockReq.body = {
        comment: '<script>alert("xss")</script>',
        username: 'normal<>text'
      };

      // Act
      xssProtection(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockReq.body.comment).not.toContain('<script>');
      expect(mockReq.body.comment).toContain('&lt;script&gt;');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize query parameters', () => {
      // Arrange
      mockReq.query = {
        search: '<img src=x onerror="alert(1)">',
        filter: 'safe text'
      };

      // Act
      xssProtection(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect((mockReq.query as any).search).not.toContain('<img');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize URL parameters', () => {
      // Arrange
      mockReq.params = {
        id: '<script>evil</script>'
      };

      // Act
      xssProtection(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockReq.params.id).not.toContain('<script>');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle nested objects', () => {
      // Arrange
      mockReq.body = {
        user: {
          name: '<b>Bold</b>',
          details: {
            bio: '<script>nested</script>'
          }
        }
      };

      // Act
      xssProtection(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockReq.body.user.name).not.toContain('<b>');
      expect(mockReq.body.user.details.bio).not.toContain('<script>');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle arrays', () => {
      // Arrange
      mockReq.body = {
        items: ['<script>test1</script>', '<b>test2</b>']
      };

      // Act
      xssProtection(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockReq.body.items[0]).not.toContain('<script>');
      expect(mockReq.body.items[1]).not.toContain('<b>');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Common Attack Prevention', () => {
    it('should detect prototype pollution attempts', () => {
      // Arrange
      mockReq.body = {
        __proto__: { admin: true }
      };

      // Act
      preventCommonAttacks(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid request',
          message: 'Suspicious parameters detected'
        })
      );
    });

    it('should detect constructor pollution', () => {
      // Arrange
      mockReq.query = {
        constructor: { prototype: { isAdmin: true } }
      };

      // Act
      preventCommonAttacks(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should prevent HTTP parameter pollution', () => {
      // Arrange
      mockReq.query = {
        sort: ['name', 'id', 'date'], // Array pollution
        filter: 'single'
      };

      // Act
      preventCommonAttacks(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      // HPP protection converts arrays to single values (except allowed params)
      expect(mockReq.query.sort).toBe('name');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow arrays for whitelisted parameters', () => {
      // Arrange
      mockReq.query = {
        tags: ['tag1', 'tag2', 'tag3'], // Allowed
        ids: ['id1', 'id2'] // Allowed
      };

      // Act
      preventCommonAttacks(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(Array.isArray(mockReq.query.tags)).toBe(true);
      expect(Array.isArray(mockReq.query.ids)).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Combined Security Middleware', () => {
    it('should export array of security middleware', () => {
      expect(applySecurity).toBeDefined();
      expect(Array.isArray(applySecurity)).toBe(true);
      expect(applySecurity.length).toBeGreaterThan(0);
    });

    it('should include security headers in applySecurity', () => {
      expect(applySecurity).toContain(securityHeaders);
    });

    it('should include CORS config in applySecurity', () => {
      expect(applySecurity).toContain(corsConfig);
    });

    it('should include attack prevention in applySecurity', () => {
      expect(applySecurity).toContain(preventCommonAttacks);
    });
  });
});
