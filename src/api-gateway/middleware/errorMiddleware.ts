import { ApiResponse } from '../types/api';
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { logError } from './loggingMiddleware';

/**
 * Error Handling Middleware
 *
 * Provides consistent error handling and formatting for API responses.
 * Includes Express middleware for global error handling with proper HTTP status codes.
 */

/**
 * API Error class for standardized error handling
 */
export class ApiError extends Error {
  statusCode: number;
  errorCode?: string;
  details?: any;
  isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode?: string,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common API errors
 */
export const ApiErrors = {
  // Authentication errors
  Unauthorized: (message = 'Authentication required') => 
    new ApiError(message, 401, 'UNAUTHORIZED'),
  
  Forbidden: (message = 'Permission denied') => 
    new ApiError(message, 403, 'FORBIDDEN'),
  
  // Resource errors
  NotFound: (resource = 'Resource', id?: string) => 
    new ApiError(
      id ? `${resource} with ID ${id} not found` : `${resource} not found`,
      404,
      'NOT_FOUND'
    ),
  
  // Validation errors
  BadRequest: (message = 'Invalid request', details?: any) => 
    new ApiError(message, 400, 'BAD_REQUEST', details),
  
  ValidationError: (errors: string[] | Record<string, string>) => 
    new ApiError(
      'Validation failed',
      422,
      'VALIDATION_ERROR',
      typeof errors === 'object' && !Array.isArray(errors)
        ? { fields: errors }
        : { errors }
    ),
  
  // Server errors
  InternalError: (message = 'Internal server error') => 
    new ApiError(message, 500, 'INTERNAL_ERROR'),
  
  ServiceUnavailable: (message = 'Service temporarily unavailable') => 
    new ApiError(message, 503, 'SERVICE_UNAVAILABLE'),
  
  // Business logic errors
  Conflict: (message = 'Resource conflict', details?: any) => 
    new ApiError(message, 409, 'CONFLICT', details),
  
  RateLimited: (message = 'Too many requests', retryAfter?: number) => 
    new ApiError(
      message,
      429,
      'RATE_LIMITED',
      retryAfter ? { retryAfter } : undefined
    )
};

/**
 * Format an error as an API response
 * @param error The error to format
 * @returns Formatted API error response
 */
export function formatErrorResponse<T = any>(error: any): ApiResponse<T> {
  // Handle ApiError instances
  if (error instanceof ApiError) {
    return {
      success: false,
      error: error.message,
      errorCode: error.errorCode,
      details: error.details,
      timestamp: new Date().toISOString()
    };
  }
  
  // Handle standard Error instances
  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return {
      success: false,
      error,
      timestamp: new Date().toISOString()
    };
  }
  
  // Handle unknown error types
  return {
    success: false,
    error: 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  };
}

/**
 * Error handler function for API Gateway
 * @param error The error to handle
 * @returns Formatted API error response
 */
export function handleApiError<T = any>(error: any): ApiResponse<T> {
  // Log the error for debugging
  console.error('[API Gateway Error]', error);
  
  return formatErrorResponse<T>(error);
}

/**
 * Create a try-catch wrapper for route handlers
 * @param handler The route handler function
 * @returns Wrapped handler function with error handling
 */
export function withErrorHandling<T = any, R = any>(
  handler: (params: T) => Promise<R> | R
): (params: T) => Promise<R> {
  return async (params: T): Promise<R> => {
    try {
      return await handler(params);
    } catch (error) {
      throw error instanceof ApiError
        ? error
        : ApiErrors.InternalError(
            error instanceof Error ? error.message : 'An unexpected error occurred'
          );
    }
  };
}

/**
 * Express error handling middleware
 * Global error handler that catches all errors and formats them consistently
 *
 * @param err Error object
 * @param req Request object
 * @param res Response object
 * @param next Next function
 */
export const errorHandlerMiddleware: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  logError(err, req);

  // Handle ApiError instances
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      errorCode: err.errorCode,
      details: err.details,
      requestId: (req as any).id || req.headers['x-request-id'],
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    res.status(422).json({
      success: false,
      error: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
      details: err.errors || err.message,
      requestId: (req as any).id || req.headers['x-request-id'],
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      errorCode: 'INVALID_TOKEN',
      requestId: (req as any).id || req.headers['x-request-id'],
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'Token expired',
      errorCode: 'TOKEN_EXPIRED',
      requestId: (req as any).id || req.headers['x-request-id'],
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle Multer errors (file upload)
  if (err.name === 'MulterError') {
    let message = 'File upload error';
    let statusCode = 400;

    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
    }

    res.status(statusCode).json({
      success: false,
      error: message,
      errorCode: 'UPLOAD_ERROR',
      details: { code: err.code },
      requestId: (req as any).id || req.headers['x-request-id'],
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle syntax errors (malformed JSON)
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
      errorCode: 'INVALID_JSON',
      requestId: (req as any).id || req.headers['x-request-id'],
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle database errors
  if (err.name === 'SequelizeValidationError' || err.name === 'PrismaClientValidationError') {
    res.status(422).json({
      success: false,
      error: 'Database validation failed',
      errorCode: 'DATABASE_VALIDATION_ERROR',
      details: err.errors || err.message,
      requestId: (req as any).id || req.headers['x-request-id'],
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Default error response (500 Internal Server Error)
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    success: false,
    error: message,
    errorCode: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    requestId: (req as any).id || req.headers['x-request-id'],
    timestamp: new Date().toISOString()
  });
};

/**
 * Not Found (404) handler middleware
 * Handles routes that don't exist
 *
 * @param req Request object
 * @param res Response object
 * @param next Next function
 */
export const notFoundMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new ApiError(
    `Route ${req.method} ${req.path} not found`,
    404,
    'NOT_FOUND'
  );

  next(error);
};

/**
 * Async handler wrapper for Express routes
 * Catches async errors and passes them to error middleware
 *
 * @param fn Async route handler
 * @returns Wrapped handler
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};