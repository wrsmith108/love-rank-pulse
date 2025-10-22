/**
 * @file errorHandler.test.ts
 * @description Test suite for server error handler middleware (10 tests)
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';
import {
  AppError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validateOrThrow
} from '../errorHandler';

describe('Server Error Handler Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/test',
      query: {},
      body: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Custom Error Classes', () => {
    it('should create AppError with all properties', () => {
      // Arrange & Act
      const error = new AppError('Test error', 400, { detail: 'test' });

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.isOperational).toBe(true);
    });

    it('should create NotFoundError with default message', () => {
      // Arrange & Act
      const error = new NotFoundError();

      // Assert
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('not found');
    });

    it('should create BadRequestError with custom message', () => {
      // Arrange & Act
      const error = new BadRequestError('Invalid input', { field: 'email' });

      // Assert
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should create UnauthorizedError', () => {
      // Arrange & Act
      const error = new UnauthorizedError('Login required');

      // Assert
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Login required');
    });

    it('should create ForbiddenError', () => {
      // Arrange & Act
      const error = new ForbiddenError('Access denied');

      // Assert
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Access denied');
    });

    it('should create ConflictError', () => {
      // Arrange & Act
      const error = new ConflictError('Duplicate entry');

      // Assert
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Duplicate entry');
    });

    it('should create ValidationError', () => {
      // Arrange & Act
      const error = new ValidationError('Validation failed', { email: 'Invalid' });

      // Assert
      expect(error.statusCode).toBe(422);
      expect(error.message).toBe('Validation failed');
      expect(error.details).toEqual({ email: 'Invalid' });
    });
  });

  describe('Error Handler Middleware', () => {
    it('should handle AppError and return appropriate response', () => {
      // Arrange
      const error = new BadRequestError('Invalid data');

      // Act
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'BadRequestError',
          message: 'Invalid data'
        })
      );
    });

    it('should handle Zod validation errors', () => {
      // Arrange
      const schema = z.object({ email: z.string().email() });
      let zodError: ZodError;

      try {
        schema.parse({ email: 'invalid' });
      } catch (err) {
        zodError = err as ZodError;
      }

      // Act
      errorHandler(zodError!, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'ValidationError',
          details: expect.any(Array)
        })
      );
    });

    it('should handle JWT errors', () => {
      // Arrange
      const error: any = new Error('Invalid token');
      error.name = 'JsonWebTokenError';

      // Act
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'AuthenticationError',
          message: 'Invalid token'
        })
      );
    });

    it('should handle expired token errors', () => {
      // Arrange
      const error: any = new Error('Token expired');
      error.name = 'TokenExpiredError';

      // Act
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'AuthenticationError',
          message: 'Token expired'
        })
      );
    });

    it('should handle Prisma duplicate errors', () => {
      // Arrange
      const error: any = new Error('Unique constraint failed');
      error.name = 'PrismaClientKnownRequestError';
      error.code = 'P2002';
      error.meta = { target: ['email'] };

      // Act
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'ConflictError',
          message: 'Resource already exists'
        })
      );
    });

    it('should handle Prisma not found errors', () => {
      // Arrange
      const error: any = new Error('Record not found');
      error.name = 'PrismaClientKnownRequestError';
      error.code = 'P2025';

      // Act
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'NotFoundError',
          message: 'Resource not found'
        })
      );
    });

    it('should include stack trace in development', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const error = new Error('Dev error');

      // Act
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: expect.any(String)
        })
      );

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should exclude stack trace in production', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const error = new Error('Prod error');

      // Act
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      const jsonCall = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.stack).toBeUndefined();

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Not Found Handler', () => {
    it('should create 404 error for non-existent routes', () => {
      // Arrange
      mockReq.method = 'GET';
      mockReq.path = '/nonexistent';

      // Act
      notFoundHandler(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: expect.stringContaining('GET /nonexistent')
        })
      );
    });
  });

  describe('Async Handler', () => {
    it('should catch async errors and pass to next', async () => {
      // Arrange
      const asyncFn = jest.fn().mockRejectedValue(new Error('Async error'));
      const wrapped = asyncHandler(asyncFn);

      // Act
      await wrapped(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call handler successfully', async () => {
      // Arrange
      const asyncFn = jest.fn().mockResolvedValue('success');
      const wrapped = asyncHandler(asyncFn);

      // Act
      await wrapped(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(asyncFn).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Validation Helper', () => {
    it('should not throw when condition is true', () => {
      // Act & Assert
      expect(() => validateOrThrow(true, 'Should not throw')).not.toThrow();
    });

    it('should throw AppError when condition is false', () => {
      // Act & Assert
      expect(() => validateOrThrow(false, 'Validation failed')).toThrow(AppError);
    });

    it('should throw with custom status code', () => {
      // Act
      try {
        validateOrThrow(false, 'Custom error', 422);
      } catch (error) {
        // Assert
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(422);
      }
    });
  });
});
