import cors from 'cors';
import { RequestHandler } from 'express';

/**
 * CORS Middleware
 *
 * Configures Cross-Origin Resource Sharing (CORS) to control
 * which domains can access the API.
 *
 * Features:
 * - Origin validation with whitelist
 * - Credentials support
 * - Custom headers support
 * - Method restrictions
 */

/**
 * CORS configuration
 */
export interface CorsConfig {
  allowedOrigins?: string[];
  allowCredentials?: boolean;
  allowedMethods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
}

/**
 * Parse allowed origins from environment variable
 * @returns Array of allowed origins
 */
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '';

  if (!envOrigins) {
    // Default origins for development
    return [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:8080'
    ];
  }

  // Parse comma-separated origins
  return envOrigins.split(',').map(origin => origin.trim()).filter(Boolean);
}

/**
 * Create CORS middleware with custom configuration
 * @param config CORS configuration
 * @returns CORS middleware
 */
export function createCorsMiddleware(config: CorsConfig = {}): RequestHandler {
  const {
    allowedOrigins = getAllowedOrigins(),
    allowCredentials = true,
    allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders = [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-ID',
      'X-API-Key'
    ],
    exposedHeaders = [
      'X-Request-ID',
      'X-Response-Time',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    maxAge = 86400 // 24 hours in seconds
  } = config;

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in the whitelist
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (allowedOrigins.includes('*')) {
        // Allow all origins if wildcard is specified
        callback(null, true);
      } else {
        // Origin not allowed
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        callback(new Error(`Origin ${origin} is not allowed by CORS policy`));
      }
    },
    credentials: allowCredentials,
    methods: allowedMethods,
    allowedHeaders,
    exposedHeaders,
    maxAge,
    optionsSuccessStatus: 204, // Some legacy browsers choke on 204
    preflightContinue: false
  });
}

/**
 * Production CORS middleware
 * Strict origin validation
 */
export const productionCorsMiddleware = createCorsMiddleware({
  allowedOrigins: getAllowedOrigins(),
  allowCredentials: true
});

/**
 * Development CORS middleware
 * Allows all origins for easier development
 */
export const developmentCorsMiddleware = createCorsMiddleware({
  allowedOrigins: ['*'],
  allowCredentials: true
});

/**
 * Strict CORS middleware
 * Only allows specific origins, no credentials
 */
export const strictCorsMiddleware = createCorsMiddleware({
  allowedOrigins: getAllowedOrigins(),
  allowCredentials: false
});

/**
 * Get appropriate CORS middleware based on environment
 * @returns CORS middleware
 */
export function getCorsMiddleware(): RequestHandler {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'production') {
    return productionCorsMiddleware;
  }

  return developmentCorsMiddleware;
}

/**
 * CORS error handler
 * @param err Error object
 * @param req Request object
 * @param res Response object
 * @param next Next function
 */
export function handleCorsError(err: any, req: any, res: any, next: any): void {
  if (err.message && err.message.includes('CORS')) {
    res.status(403).json({
      success: false,
      error: 'CORS policy violation',
      errorCode: 'CORS_ERROR',
      details: {
        origin: req.headers.origin,
        message: err.message
      },
      timestamp: new Date().toISOString()
    });
  } else {
    next(err);
  }
}
