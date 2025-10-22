/**
 * @file errorMiddleware.test.ts
 * @description Test suite for error handling middleware
 *
 * Test Cases:
 * - TC-ERROR-001: Validation error formatting
 * - TC-ERROR-002: Database error handling
 * - TC-ERROR-003: Network error recovery
 * - TC-ERROR-004: Custom error responses
 * - TC-ERROR-005: Stack trace sanitization
 */

import { Request, Response, NextFunction } from 'express';
import {
  ApiError,
  ApiErrors,
  formatErrorResponse,
  handleApiError,
  withErrorHandling,
  errorHandlerMiddleware,
  notFoundMiddleware,
  asyncHandler
} from '../errorMiddleware';

describe('API Gateway Error Middleware', () => {
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
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('TC-ERROR-001: Validation error formatting', () => {
    it('should format validation errors with field details', () => {
      // Arrange
      const validationErrors = {
        email: 'Invalid email format',
        password: 'Password too short'
      };
      const error = ApiErrors.ValidationError(validationErrors);

      // Act
      const response = formatErrorResponse(error);

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toBe('Validation failed');
      expect(response.errorCode).toBe('VALIDATION_ERROR');
      expect(response.details).toEqual({ fields: validationErrors });
    });

    it('should format validation errors with array of errors', () => {
      // Arrange
      const validationErrors = ['Email is required', 'Password is required'];
      const error = ApiErrors.ValidationError(validationErrors);

      // Act
      const response = formatErrorResponse(error);

      // Assert
      expect(response.success).toBe(false);
      expect(response.details).toEqual({ errors: validationErrors });
    });

    it('should handle validation error in Express middleware', () => {
      // Arrange
      const error = ApiErrors.ValidationError({ username: 'Too short' });
      (mockReq as any).id = 'req-123';

      // Act
      errorHandlerMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
          errorCode: 'VALIDATION_ERROR'
        })
      );
    });
  });

  describe('TC-ERROR-002: Database error handling', () => {
    it('should handle Prisma unique constraint violation', () => {
      // Arrange
      const prismaError: any = {
        name: 'PrismaClientValidationError',
        message: 'Unique constraint failed',
        errors: ['Email already exists']
      };

      // Act
      errorHandlerMiddleware(prismaError, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorCode: 'DATABASE_VALIDATION_ERROR'
        })
      );
    });

    it('should format database errors properly', () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      dbError.name = 'DatabaseError';

      // Act
      const response = formatErrorResponse(dbError);

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toBe('Database connection failed');
    });

    it('should handle Sequelize validation errors', () => {
      // Arrange
      const sequelizeError: any = {
        name: 'SequelizeValidationError',
        errors: [{ message: 'Value cannot be null' }]
      };

      // Act
      errorHandlerMiddleware(sequelizeError, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(422);
    });
  });

  describe('TC-ERROR-003: Network error recovery', () => {
    it('should handle service unavailable errors', () => {
      // Arrange
      const error = ApiErrors.ServiceUnavailable('Database temporarily down');

      // Act
      const response = formatErrorResponse(error);

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toBe('Database temporarily down');
      expect(response.errorCode).toBe('SERVICE_UNAVAILABLE');
    });

    it('should return 503 for service unavailable', () => {
      // Arrange
      const error = ApiErrors.ServiceUnavailable();

      // Act
      errorHandlerMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(503);
    });

    it('should handle timeout errors gracefully', () => {
      // Arrange
      const error = new ApiError('Request timeout', 504, 'TIMEOUT');

      // Act
      const response = formatErrorResponse(error);

      // Assert
      expect(response.success).toBe(false);
      expect(response.errorCode).toBe('TIMEOUT');
    });
  });

  describe('TC-ERROR-004: Custom error responses', () => {
    it('should create custom ApiError with all fields', () => {
      // Arrange & Act
      const error = new ApiError(
        'Custom error message',
        418,
        'CUSTOM_ERROR',
        { customField: 'value' },
        true
      );

      // Assert
      expect(error.message).toBe('Custom error message');
      expect(error.statusCode).toBe(418);
      expect(error.errorCode).toBe('CUSTOM_ERROR');
      expect(error.details).toEqual({ customField: 'value' });
      expect(error.isOperational).toBe(true);
    });

    it('should format custom ApiError responses', () => {
      // Arrange
      const error = new ApiError('Test error', 400, 'TEST_ERROR', { test: true });

      // Act
      const response = formatErrorResponse(error);

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toBe('Test error');
      expect(response.errorCode).toBe('TEST_ERROR');
      expect(response.details).toEqual({ test: true });
      expect(response.timestamp).toBeDefined();
    });

    it('should handle string errors', () => {
      // Arrange
      const error = 'Simple string error';

      // Act
      const response = formatErrorResponse(error);

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toBe('Simple string error');
    });

    it('should handle unknown error types', () => {
      // Arrange
      const error = { weird: 'object' };

      // Act
      const response = formatErrorResponse(error);

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toBe('An unexpected error occurred');
    });
  });

  describe('TC-ERROR-005: Stack trace sanitization', () => {
    it('should exclude stack trace in production', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const error = new Error('Production error');

      // Act
      errorHandlerMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.not.objectContaining({
          stack: expect.anything()
        })
      );

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should include stack trace in development', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const error = new Error('Dev error');

      // Act
      errorHandlerMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: expect.any(String)
        })
      );

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should sanitize error messages in production', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const error = new Error('Detailed internal error with sensitive data');

      // Act
      errorHandlerMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      const jsonCall = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.error).toBe('Internal server error');

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Additional Error Scenarios', () => {
    it('should handle JWT errors', () => {
      // Arrange
      const error: any = new Error('Invalid token');
      error.name = 'JsonWebTokenError';

      // Act
      errorHandlerMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'INVALID_TOKEN'
        })
      );
    });

    it('should handle expired token errors', () => {
      // Arrange
      const error: any = new Error('Token expired');
      error.name = 'TokenExpiredError';

      // Act
      errorHandlerMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'TOKEN_EXPIRED'
        })
      );
    });

    it('should handle malformed JSON errors', () => {
      // Arrange
      const error: any = new SyntaxError('Unexpected token');
      (error as any).body = '{ invalid json';

      // Act
      errorHandlerMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'INVALID_JSON'
        })
      );
    });

    it('should handle 404 not found', () => {
      // Arrange
      mockReq.path = '/nonexistent';

      // Act
      notFoundMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: expect.stringContaining('/nonexistent')
        })
      );
    });

    it('should wrap async handlers', async () => {
      // Arrange
      const asyncFn = jest.fn().mockRejectedValue(new Error('Async error'));
      const wrapped = asyncHandler(asyncFn);

      // Act
      await wrapped(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should wrap error handlers with withErrorHandling', async () => {
      // Arrange
      const handler = withErrorHandling(async () => {
        throw new Error('Test error');
      });

      // Act & Assert
      await expect(handler({})).rejects.toThrow(ApiError);
    });

    it('should preserve ApiError in withErrorHandling', async () => {
      // Arrange
      const apiError = ApiErrors.BadRequest('Bad input');
      const handler = withErrorHandling(async () => {
        throw apiError;
      });

      // Act & Assert
      await expect(handler({})).rejects.toThrow(apiError);
    });
  });

  describe('handleApiError', () => {
    it('should log and format errors', () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Test error');

      // Act
      const response = handleApiError(error);

      // Assert
      expect(response.success).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      // Cleanup
      consoleSpy.mockRestore();
    });
  });
});
