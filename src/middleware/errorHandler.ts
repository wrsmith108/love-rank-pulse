import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * Error response interface
 */
interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  stack?: string;
  details?: any;
}

/**
 * Custom error class with status code
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public details?: any;

  constructor(message: string, statusCode: number = 500, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

/**
 * Bad Request Error
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: any) {
    super(message, 400, details);
  }
}

/**
 * Unauthorized Error
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * Forbidden Error
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * Conflict Error
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
  }
}

/**
 * Validation Error
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: any) {
    super(message, 422, details);
  }
}

/**
 * Environment configuration
 */
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';

/**
 * Log error to console or logging service
 */
const logError = (error: Error, req: Request) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    user: (req as any).user?.id,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  };

  // In production, send to logging service (e.g., Sentry, Winston, etc.)
  console.error('Error:', JSON.stringify(errorLog, null, 2));
};

/**
 * Send error response to client
 */
const sendErrorResponse = (
  error: AppError | Error,
  req: Request,
  res: Response
): void => {
  // Default error values
  let statusCode = 500;
  let message = 'Internal server error';
  let errorName = 'ServerError';
  let details: any = undefined;

  // Handle known errors
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    errorName = error.name;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Validation error';
    errorName = 'ValidationError';
    details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message
    }));
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    errorName = 'AuthenticationError';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    errorName = 'AuthenticationError';
  } else if (error.name === 'PrismaClientKnownRequestError') {
    // Handle Prisma errors
    const prismaError = error as any;

    if (prismaError.code === 'P2002') {
      statusCode = 409;
      message = 'Resource already exists';
      errorName = 'ConflictError';
      details = { field: prismaError.meta?.target };
    } else if (prismaError.code === 'P2025') {
      statusCode = 404;
      message = 'Resource not found';
      errorName = 'NotFoundError';
    }
  }

  // Create error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: errorName,
    message,
    ...(details && { details })
  };

  // Include stack trace in development
  if (isDevelopment && error.stack) {
    errorResponse.stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Global error handler middleware
 * Must be the last middleware in the chain
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error
  logError(error, req);

  // Send error response
  sendErrorResponse(error, req, res);
};

/**
 * 404 Not Found handler
 * Should be placed after all routes
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validate request and throw error if invalid
 */
export const validateOrThrow = (condition: boolean, message: string, statusCode: number = 400) => {
  if (!condition) {
    throw new AppError(message, statusCode);
  }
};
