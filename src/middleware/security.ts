import helmet from 'helmet';
import cors from 'cors';
import { Request, Response, NextFunction } from 'express';

/**
 * Environment configuration
 */
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [FRONTEND_URL];

/**
 * Security headers middleware using Helmet
 * Configures various HTTP headers for security
 */
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Adjust based on needs
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ...ALLOWED_ORIGINS],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: NODE_ENV === 'production' ? [] : null
    }
  },

  // X-DNS-Prefetch-Control
  dnsPrefetchControl: {
    allow: false
  },

  // X-Frame-Options
  frameguard: {
    action: 'deny'
  },

  // Hide X-Powered-By header
  hidePoweredBy: true,

  // Strict-Transport-Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },

  // X-Download-Options
  ieNoOpen: true,

  // X-Content-Type-Options
  noSniff: true,

  // X-Permitted-Cross-Domain-Policies
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none'
  },

  // Referrer-Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },

  // X-XSS-Protection (deprecated but still useful for older browsers)
  xssFilter: true
});

/**
 * CORS configuration
 * Allows requests from specified origins
 */
export const corsConfig = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (ALLOWED_ORIGINS.includes(origin) || NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
});

/**
 * CSRF protection middleware for state-changing operations
 * Simple token-based implementation
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for API endpoints using JWT (stateless)
  if (req.path.startsWith('/api/')) {
    return next();
  }

  // For form submissions, verify CSRF token
  const token = req.headers['x-csrf-token'] || req.body?._csrf;
  const sessionToken = (req as any).session?.csrfToken;

  if (!token || token !== sessionToken) {
    return res.status(403).json({
      success: false,
      error: 'CSRF token validation failed',
      message: 'Invalid or missing CSRF token'
    });
  }

  next();
};

/**
 * XSS protection middleware
 * Sanitizes request data to prevent XSS attacks
 */
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  // Basic XSS sanitization (use a library like DOMPurify for production)
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }

    return obj;
  };

  // Sanitize request body, query, and params
  if (req.body) {
    req.body = sanitize(req.body);
  }

  if (req.query) {
    req.query = sanitize(req.query);
  }

  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
};

/**
 * Security middleware to prevent common attacks
 */
export const preventCommonAttacks = (req: Request, res: Response, next: NextFunction) => {
  // Prevent parameter pollution
  const suspiciousParams = ['__proto__', 'constructor', 'prototype'];

  const checkObject = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false;

    for (const key in obj) {
      if (suspiciousParams.includes(key)) {
        return true;
      }

      if (typeof obj[key] === 'object' && checkObject(obj[key])) {
        return true;
      }
    }

    return false;
  };

  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request',
      message: 'Suspicious parameters detected'
    });
  }

  // Prevent HPP (HTTP Parameter Pollution)
  for (const key in req.query) {
    if (Array.isArray(req.query[key]) && key !== 'tags' && key !== 'ids') {
      // Only allow arrays for specific parameters
      req.query[key] = (req.query[key] as any)[0];
    }
  }

  next();
};

/**
 * Combine all security middleware
 */
export const applySecurity = [
  securityHeaders,
  corsConfig,
  preventCommonAttacks
];
