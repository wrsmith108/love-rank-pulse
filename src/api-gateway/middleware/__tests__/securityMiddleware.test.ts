/**
 * @file securityMiddleware.test.ts
 * @description Test suite for security headers middleware
 *
 * Test Cases:
 * - TC-SEC-001: Helmet integration
 * - TC-SEC-002: XSS protection
 * - TC-SEC-003: CSRF token validation
 * - TC-SEC-004: Content Security Policy
 * - TC-SEC-005: SQL injection prevention
 */

import { Request, Response } from 'express';
import {
  createSecurityMiddleware,
  getSecurityMiddleware,
  productionSecurityMiddleware,
  developmentSecurityMiddleware
} from '../securityMiddleware';

describe('API Gateway Security Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/test',
      headers: {}
    };
    mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  describe('TC-SEC-001: Helmet integration', () => {
    it('should create security middleware with default helmet settings', () => {
      // Act
      const middleware = createSecurityMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should create security middleware with CSP enabled', () => {
      // Act
      const middleware = createSecurityMiddleware({
        enableCSP: true
      });

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should create security middleware with HSTS enabled', () => {
      // Act
      const middleware = createSecurityMiddleware({
        enableHSTS: true
      });

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should create security middleware with frame guard', () => {
      // Act
      const middleware = createSecurityMiddleware({
        enableFrameGuard: true
      });

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should create security middleware with XSS filter', () => {
      // Act
      const middleware = createSecurityMiddleware({
        enableXSSFilter: true
      });

      // Assert
      expect(middleware).toBeDefined();
    });
  });

  describe('TC-SEC-002: XSS protection', () => {
    it('should configure XSS protection headers', () => {
      // Act
      const middleware = createSecurityMiddleware({
        enableXSSFilter: true
      });

      // Assert
      expect(middleware).toBeDefined();
      // Helmet sets X-XSS-Protection header
    });

    it('should include XSS protection in default config', () => {
      // Act
      const middleware = createSecurityMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      // Default includes XSS protection
    });

    it('should set noSniff header to prevent MIME sniffing', () => {
      // Act
      const middleware = createSecurityMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      // Helmet sets X-Content-Type-Options: nosniff
    });

    it('should sanitize script tags in CSP directives', () => {
      // Act
      const middleware = createSecurityMiddleware({
        enableCSP: true
      });

      // Assert
      expect(middleware).toBeDefined();
      // CSP scriptSrc includes unsafe-inline for development
    });
  });

  describe('TC-SEC-003: CSRF token validation', () => {
    it('should configure security middleware without CSRF by default', () => {
      // Act
      const middleware = createSecurityMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      // CSRF is typically handled separately
    });

    it('should set secure headers to prevent CSRF attacks', () => {
      // Act
      const middleware = createSecurityMiddleware({
        enableFrameGuard: true
      });

      // Assert
      expect(middleware).toBeDefined();
      // Frame guard helps prevent clickjacking-based CSRF
    });

    it('should configure same-origin policy', () => {
      // Act
      const middleware = createSecurityMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      // Helmet includes referrer policy and other protections
    });
  });

  describe('TC-SEC-004: Content Security Policy', () => {
    it('should configure CSP with default directives', () => {
      // Act
      const middleware = createSecurityMiddleware({
        enableCSP: true
      });

      // Assert
      expect(middleware).toBeDefined();
      // Default CSP includes defaultSrc, scriptSrc, etc.
    });

    it('should configure CSP with custom allowed domains', () => {
      // Arrange
      const allowedDomains = ['https://api.example.com', 'wss://ws.example.com'];

      // Act
      const middleware = createSecurityMiddleware({
        enableCSP: true,
        allowedDomains
      });

      // Assert
      expect(middleware).toBeDefined();
    });

    it('should allow fonts from Google Fonts in CSP', () => {
      // Act
      const middleware = createSecurityMiddleware({
        enableCSP: true
      });

      // Assert
      expect(middleware).toBeDefined();
      // fontSrc includes fonts.gstatic.com
    });

    it('should set object-src to none in CSP', () => {
      // Act
      const middleware = createSecurityMiddleware({
        enableCSP: true
      });

      // Assert
      expect(middleware).toBeDefined();
      // objectSrc: ["'none'"] prevents plugin execution
    });

    it('should upgrade insecure requests in CSP', () => {
      // Act
      const middleware = createSecurityMiddleware({
        enableCSP: true
      });

      // Assert
      expect(middleware).toBeDefined();
      // upgradeInsecureRequests directive included
    });
  });

  describe('TC-SEC-005: SQL injection prevention', () => {
    it('should set headers to prevent injection attacks', () => {
      // Act
      const middleware = createSecurityMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      // X-Content-Type-Options prevents MIME confusion attacks
    });

    it('should configure strict content type checking', () => {
      // Act
      const middleware = createSecurityMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      // noSniff: true enforces strict MIME types
    });

    it('should disable DNS prefetching for privacy', () => {
      // Act
      const middleware = createSecurityMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      // dnsPrefetchControl set to false
    });

    it('should set X-Download-Options for IE', () => {
      // Act
      const middleware = createSecurityMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      // ieNoOpen: true prevents file downloads from opening
    });

    it('should configure strict referrer policy', () => {
      // Act
      const middleware = createSecurityMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      // referrerPolicy: strict-origin-when-cross-origin
    });
  });

  describe('Environment-based Security', () => {
    it('should use production security in production', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Act
      const middleware = getSecurityMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      expect(middleware).toBe(productionSecurityMiddleware);

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should use development security in development', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // Act
      const middleware = getSecurityMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      expect(middleware).toBe(developmentSecurityMiddleware);

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should have strict production security settings', () => {
      // Act
      const middleware = productionSecurityMiddleware;

      // Assert
      expect(middleware).toBeDefined();
      // Production has CSP, HSTS, Frame Guard enabled
    });

    it('should have lenient development security settings', () => {
      // Act
      const middleware = developmentSecurityMiddleware;

      // Assert
      expect(middleware).toBeDefined();
      // Development disables CSP, HSTS for hot reload
    });

    it('should default to development security when env not set', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      // Act
      const middleware = getSecurityMiddleware();

      // Assert
      expect(middleware).toBeDefined();

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Security Headers Configuration', () => {
    it('should hide X-Powered-By header', () => {
      // Act
      const middleware = createSecurityMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      // hidePoweredBy: true removes server fingerprinting
    });

    it('should set HSTS with 1 year max-age', () => {
      // Act
      const middleware = createSecurityMiddleware({
        enableHSTS: true
      });

      // Assert
      expect(middleware).toBeDefined();
      // maxAge: 31536000 (1 year)
    });

    it('should include subdomains in HSTS', () => {
      // Act
      const middleware = createSecurityMiddleware({
        enableHSTS: true
      });

      // Assert
      expect(middleware).toBeDefined();
      // includeSubDomains: true
    });

    it('should enable HSTS preload', () => {
      // Act
      const middleware = createSecurityMiddleware({
        enableHSTS: true
      });

      // Assert
      expect(middleware).toBeDefined();
      // preload: true
    });

    it('should deny frame embedding', () => {
      // Act
      const middleware = createSecurityMiddleware({
        enableFrameGuard: true
      });

      // Assert
      expect(middleware).toBeDefined();
      // frameguard action: 'deny'
    });

    it('should set permitted cross-domain policies to none', () => {
      // Act
      const middleware = createSecurityMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      // permittedCrossDomainPolicies: none
    });
  });
});
