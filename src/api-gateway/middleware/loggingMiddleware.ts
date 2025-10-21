import morgan from 'morgan';
import { RequestHandler } from 'express';

/**
 * Request Logging Middleware
 *
 * Uses Morgan to log HTTP requests with different formats:
 * - Production: Combined format (Apache style)
 * - Development: Dev format (colored, concise)
 * - Custom: Structured JSON format
 */

/**
 * Logging configuration
 */
export interface LoggingConfig {
  format?: 'combined' | 'dev' | 'common' | 'short' | 'tiny' | 'json';
  skip?: (req: any, res: any) => boolean;
  stream?: NodeJS.WritableStream;
}

/**
 * Custom token for request ID
 */
morgan.token('request-id', (req: any) => {
  return req.id || req.headers['x-request-id'] || '-';
});

/**
 * Custom token for user ID
 */
morgan.token('user-id', (req: any) => {
  return req.user?.id || req.userId || 'anonymous';
});

/**
 * Custom token for response time in ms
 */
morgan.token('response-time-ms', (req: any, res: any) => {
  if (!req._startAt || !res._startAt) {
    return '-';
  }

  const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
             (res._startAt[1] - req._startAt[1]) * 1e-6;

  return ms.toFixed(3);
});

/**
 * JSON format for structured logging
 */
const jsonFormat = JSON.stringify({
  timestamp: ':date[iso]',
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time-ms ms',
  contentLength: ':res[content-length]',
  requestId: ':request-id',
  userId: ':user-id',
  userAgent: ':user-agent',
  remoteAddr: ':remote-addr'
});

/**
 * Create logging middleware
 * @param config Logging configuration
 * @returns Morgan middleware
 */
export function createLoggingMiddleware(config: LoggingConfig = {}): RequestHandler {
  const {
    format = process.env.NODE_ENV === 'production' ? 'combined' : 'dev',
    skip,
    stream
  } = config;

  // Use JSON format if specified
  const logFormat = format === 'json' ? jsonFormat : format;

  return morgan(logFormat, {
    skip: skip || ((req, res) => {
      // Skip logging for health checks and static assets
      const path = req.path || '';
      return path === '/health' ||
             path === '/ping' ||
             path.startsWith('/static/') ||
             path.startsWith('/assets/');
    }),
    stream: stream || process.stdout
  });
}

/**
 * Production logging middleware
 * Uses combined format with all request details
 */
export const productionLoggingMiddleware = createLoggingMiddleware({
  format: 'combined'
});

/**
 * Development logging middleware
 * Uses dev format with colors and concise output
 */
export const developmentLoggingMiddleware = createLoggingMiddleware({
  format: 'dev'
});

/**
 * Structured JSON logging middleware
 * For log aggregation and analysis
 */
export const jsonLoggingMiddleware = createLoggingMiddleware({
  format: 'json'
});

/**
 * Get appropriate logging middleware based on environment
 * @returns Logging middleware
 */
export function getLoggingMiddleware(): RequestHandler {
  const env = process.env.NODE_ENV || 'development';
  const logFormat = process.env.LOG_FORMAT || '';

  // Use JSON format if specified
  if (logFormat.toLowerCase() === 'json') {
    return jsonLoggingMiddleware;
  }

  // Use environment-specific format
  if (env === 'production') {
    return productionLoggingMiddleware;
  }

  return developmentLoggingMiddleware;
}

/**
 * Error logging function
 * @param error Error to log
 * @param req Request object
 */
export function logError(error: any, req?: any): void {
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: {
      message: error.message || 'Unknown error',
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode
    },
    request: req ? {
      method: req.method,
      url: req.url,
      headers: req.headers,
      requestId: req.id || req.headers['x-request-id'],
      userId: req.user?.id || req.userId
    } : undefined
  };

  console.error('[API Error]', JSON.stringify(errorLog, null, 2));
}

/**
 * Access logging function for custom logs
 * @param message Log message
 * @param data Additional data
 */
export function logAccess(message: string, data?: any): void {
  const accessLog = {
    timestamp: new Date().toISOString(),
    level: 'info',
    message,
    data
  };

  console.log('[API Access]', JSON.stringify(accessLog, null, 2));
}
