/**
 * @file validation.test.ts
 * @description Test suite for server validation middleware (8 tests)
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import {
  validate,
  registerSchema,
  loginSchema,
  createMatchSchema,
  submitResultSchema,
  updateProfileSchema,
  paginationSchema,
  uuidParamSchema,
  countryParamSchema,
  sanitizeString,
  isValidEmail,
  isValidUUID,
  validatePasswordStrength,
  customValidation
} from '../validation';

describe('Server Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  describe('Validation Middleware Factory', () => {
    it('should validate request body successfully', () => {
      // Arrange
      const schema = z.object({
        email: z.string().email(),
        name: z.string()
      });
      mockReq.body = {
        email: 'test@example.com',
        name: 'Test User'
      };
      const middleware = validate(schema, 'body');

      // Act
      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return validation errors for invalid data', () => {
      // Arrange
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18)
      });
      mockReq.body = {
        email: 'invalid-email',
        age: 15
      };
      const middleware = validate(schema, 'body');

      // Act
      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation error',
          errors: expect.any(Array)
        })
      );
    });

    it('should validate query parameters', () => {
      // Arrange
      const schema = z.object({
        page: z.string().regex(/^\d+$/)
      });
      mockReq.query = { page: '1' };
      const middleware = validate(schema, 'query');

      // Act
      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate URL parameters', () => {
      // Arrange
      const schema = z.object({
        id: z.string().uuid()
      });
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      const middleware = validate(schema, 'params');

      // Act
      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Registration Schema', () => {
    it('should validate complete registration data', () => {
      // Arrange
      const validData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123',
        displayName: 'Test User',
        countryCode: 'US'
      };

      // Act
      const result = registerSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should reject invalid username', () => {
      // Arrange
      const invalidData = {
        username: 'ab', // Too short
        email: 'test@example.com',
        password: 'SecurePass123',
        displayName: 'Test',
        countryCode: 'US'
      };

      // Act
      const result = registerSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should reject weak password', () => {
      // Arrange
      const invalidData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'weak', // No uppercase, no numbers
        displayName: 'Test',
        countryCode: 'US'
      };

      // Act
      const result = registerSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe('Login Schema', () => {
    it('should validate login credentials', () => {
      // Arrange
      const validData = {
        email: 'user@example.com',
        password: 'anypassword'
      };

      // Act
      const result = loginSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should normalize email to lowercase', () => {
      // Arrange
      const data = {
        email: 'User@Example.COM',
        password: 'password'
      };

      // Act
      const result = loginSchema.parse(data);

      // Assert
      expect(result.email).toBe('user@example.com');
    });
  });

  describe('Match Creation Schema', () => {
    it('should validate match creation data', () => {
      // Arrange
      const validData = {
        player1Id: '123e4567-e89b-12d3-a456-426614174000',
        player2Id: '123e4567-e89b-12d3-a456-426614174001',
        matchType: 'RANKED',
        bestOf: 3
      };

      // Act
      const result = createMatchSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should accept optional fields', () => {
      // Arrange
      const minimalData = {
        player1Id: '123e4567-e89b-12d3-a456-426614174000',
        player2Id: '123e4567-e89b-12d3-a456-426614174001'
      };

      // Act
      const result = createMatchSchema.safeParse(minimalData);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('Pagination Schema', () => {
    it('should validate pagination parameters', () => {
      // Arrange
      const validData = {
        page: '2',
        limit: '20'
      };

      // Act
      const result = paginationSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should use default values when not provided', () => {
      // Arrange
      const emptyData = {};

      // Act
      const result = paginationSchema.parse(emptyData);

      // Assert
      expect(result.page).toBe('1');
      expect(result.limit).toBe('10');
    });

    it('should reject invalid page numbers', () => {
      // Arrange
      const invalidData = {
        page: 'abc',
        limit: '10'
      };

      // Act
      const result = paginationSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe('Sanitization Functions', () => {
    it('should sanitize string inputs', () => {
      // Arrange
      const input = '  <script>alert("xss")</script>  ';

      // Act
      const sanitized = sanitizeString(input);

      // Assert
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized.trim()).toBe(sanitized); // No leading/trailing spaces
    });

    it('should limit string length', () => {
      // Arrange
      const longInput = 'a'.repeat(2000);

      // Act
      const sanitized = sanitizeString(longInput);

      // Assert
      expect(sanitized.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Validation Helper Functions', () => {
    it('should validate email format correctly', () => {
      // Assert
      expect(isValidEmail('valid@example.com')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });

    it('should validate UUID format correctly', () => {
      // Assert
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123-456-789')).toBe(false);
    });

    it('should validate password strength', () => {
      // Arrange
      const weakPassword = 'password';
      const strongPassword = 'SecurePass123!';

      // Act
      const weakResult = validatePasswordStrength(weakPassword);
      const strongResult = validatePasswordStrength(strongPassword);

      // Assert
      expect(weakResult.success).toBe(false);
      expect(weakResult.errors).toBeDefined();
      expect(strongResult.success).toBe(true);
      expect(strongResult.errors).toBeUndefined();
    });
  });

  describe('Custom Validation Middleware', () => {
    it('should execute custom validator successfully', async () => {
      // Arrange
      const validator = jest.fn().mockResolvedValue({ success: true });
      const middleware = customValidation(validator);

      // Act
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(validator).toHaveBeenCalledWith(mockReq);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return errors from custom validator', async () => {
      // Arrange
      const validator = jest.fn().mockResolvedValue({
        success: false,
        errors: [{ field: 'custom', message: 'Custom validation failed' }]
      });
      const middleware = customValidation(validator);

      // Act
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation error'
        })
      );
    });

    it('should handle validator exceptions', async () => {
      // Arrange
      const error = new Error('Validator error');
      const validator = jest.fn().mockRejectedValue(error);
      const middleware = customValidation(validator);

      // Act
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
