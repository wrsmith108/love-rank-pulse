import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

/**
 * Validation result interface
 */
interface ValidationResult {
  success: boolean;
  data?: any;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Validation middleware factory
 * Creates middleware that validates request data against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param source - Which part of request to validate ('body', 'query', 'params')
 */
export const validate = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[source];
      const validated = schema.parse(data);

      // Replace request data with validated/sanitized data
      req[source] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));

        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Invalid request data',
          errors
        });
      }

      // Pass unexpected errors to error handler
      next(error);
    }
  };
};

/**
 * Common validation schemas
 */

// Player registration schema
export const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z.string()
    .email('Invalid email address')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  displayName: z.string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be at most 50 characters')
    .trim(),
  countryCode: z.string()
    .length(2, 'Country code must be 2 characters')
    .toUpperCase()
});

// Player login schema
export const loginSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(1, 'Password is required')
});

// Match creation schema
export const createMatchSchema = z.object({
  player1Id: z.string().uuid('Invalid player1 ID'),
  player2Id: z.string().uuid('Invalid player2 ID'),
  matchType: z.enum(['RANKED', 'CASUAL', 'TOURNAMENT', 'FRIENDLY']).optional(),
  scheduledAt: z.string().datetime().optional().or(z.date().optional()),
  bestOf: z.number().int().min(1).max(7).optional(),
  timeLimit: z.number().int().min(1).optional(),
  tournamentId: z.string().uuid().optional(),
  roundNumber: z.number().int().min(1).optional(),
  notes: z.string().max(500).optional()
});

// Match result submission schema
export const submitResultSchema = z.object({
  matchId: z.string().uuid('Invalid match ID'),
  player1Score: z.number().int().min(0),
  player2Score: z.number().int().min(0),
  resultType: z.enum(['WIN', 'LOSS', 'DRAW', 'FORFEIT', 'NO_CONTEST']).optional(),
  verifiedBy: z.string().uuid().optional()
});

// Player profile update schema
export const updateProfileSchema = z.object({
  displayName: z.string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be at most 50 characters')
    .trim()
    .optional(),
  countryCode: z.string()
    .length(2, 'Country code must be 2 characters')
    .toUpperCase()
    .optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional(),
  settings: z.object({
    notifications: z.boolean().optional(),
    privacy: z.enum(['public', 'friends_only', 'private']).optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    language: z.string().length(2).optional()
  }).optional()
});

// Pagination query schema
export const paginationSchema = z.object({
  page: z.string()
    .regex(/^\d+$/, 'Page must be a number')
    .transform(Number)
    .refine(n => n > 0, 'Page must be greater than 0')
    .optional()
    .default('1'),
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(Number)
    .refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100')
    .optional()
    .default('10')
});

// UUID parameter schema
export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format')
});

// Country code parameter schema
export const countryParamSchema = z.object({
  country: z.string()
    .length(2, 'Country code must be 2 characters')
    .toUpperCase()
});

/**
 * Sanitize string input
 */
export const sanitizeString = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 1000); // Limit length
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate UUID format
 */
export const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Validate password strength
 */
export const validatePasswordStrength = (password: string): ValidationResult => {
  const errors: Array<{ field: string; message: string }> = [];

  if (password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  }

  if (!/[A-Z]/.test(password)) {
    errors.push({ field: 'password', message: 'Password must contain at least one uppercase letter' });
  }

  if (!/[a-z]/.test(password)) {
    errors.push({ field: 'password', message: 'Password must contain at least one lowercase letter' });
  }

  if (!/[0-9]/.test(password)) {
    errors.push({ field: 'password', message: 'Password must contain at least one number' });
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push({ field: 'password', message: 'Password should contain at least one special character' });
  }

  return {
    success: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
};

/**
 * Custom validation middleware for complex validations
 */
export const customValidation = (
  validator: (req: Request) => ValidationResult | Promise<ValidationResult>
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await validator(req);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Invalid request data',
          errors: result.errors
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
