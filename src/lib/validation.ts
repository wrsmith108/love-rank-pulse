/**
 * Request Validation Utilities
 *
 * Provides comprehensive request validation using Zod schemas
 * for type-safe validation with detailed error messages.
 */

import { z } from 'zod';

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  /**
   * UUID validation
   */
  uuid: z.string().uuid({ message: 'Invalid UUID format' }),

  /**
   * Email validation
   */
  email: z.string().email({ message: 'Invalid email format' }),

  /**
   * Username validation (3-50 alphanumeric with underscores)
   */
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),

  /**
   * Password validation (8+ chars with letter and number)
   */
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),

  /**
   * Country code validation (ISO 3166-1 alpha-2)
   */
  countryCode: z
    .string()
    .length(2, 'Country code must be 2 characters')
    .regex(/^[A-Z]{2}$/, 'Country code must be uppercase letters'),

  /**
   * Pagination limit (1-100)
   */
  paginationLimit: z
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20),

  /**
   * Pagination offset (0+)
   */
  paginationOffset: z
    .number()
    .int()
    .min(0, 'Offset must be non-negative')
    .default(0),

  /**
   * ELO rating (100-3000)
   */
  eloRating: z
    .number()
    .int()
    .min(100, 'ELO rating must be at least 100')
    .max(3000, 'ELO rating cannot exceed 3000'),

  /**
   * Match score (0+)
   */
  matchScore: z
    .number()
    .int()
    .min(0, 'Score must be non-negative'),
};

/**
 * Authentication schemas
 */
export const AuthSchemas = {
  /**
   * User registration
   */
  register: z.object({
    email: CommonSchemas.email,
    username: CommonSchemas.username,
    password: CommonSchemas.password,
    countryCode: CommonSchemas.countryCode.optional(),
  }),

  /**
   * User login
   */
  login: z.object({
    email: CommonSchemas.email,
    password: z.string().min(1, 'Password is required'),
  }),

  /**
   * Token validation
   */
  token: z.object({
    token: z.string().min(1, 'Token is required'),
  }),

  /**
   * Password reset request
   */
  passwordResetRequest: z.object({
    email: CommonSchemas.email,
  }),

  /**
   * Password reset
   */
  passwordReset: z.object({
    token: z.string().min(1, 'Token is required'),
    newPassword: CommonSchemas.password,
  }),

  /**
   * Email verification
   */
  emailVerification: z.object({
    token: z.string().min(1, 'Token is required'),
  }),
};

/**
 * Player schemas
 */
export const PlayerSchemas = {
  /**
   * Get player by ID
   */
  getById: z.object({
    playerId: CommonSchemas.uuid,
  }),

  /**
   * Update player profile
   */
  updateProfile: z.object({
    playerId: CommonSchemas.uuid,
    username: CommonSchemas.username.optional(),
    bio: z.string().max(500, 'Bio cannot exceed 500 characters').optional(),
    avatarUrl: z.string().url('Invalid avatar URL').optional(),
    countryCode: CommonSchemas.countryCode.optional(),
  }),

  /**
   * Get players with pagination
   */
  getPlayers: z.object({
    limit: CommonSchemas.paginationLimit,
    offset: CommonSchemas.paginationOffset,
    countryCode: CommonSchemas.countryCode.optional(),
  }),

  /**
   * Search players
   */
  searchPlayers: z.object({
    query: z.string().min(1, 'Search query is required').max(100),
    limit: CommonSchemas.paginationLimit,
  }),
};

/**
 * Match schemas
 */
export const MatchSchemas = {
  /**
   * Create match
   */
  createMatch: z.object({
    player1Id: CommonSchemas.uuid,
    player2Id: CommonSchemas.uuid,
    matchType: z.enum(['RANKED', 'CASUAL', 'TOURNAMENT', 'PRACTICE']).default('RANKED'),
    scheduledAt: z.date().optional(),
    bestOf: z.number().int().min(1).max(7).default(1),
    timeLimit: z.number().int().min(60).max(7200).optional(), // 1 min to 2 hours
    tournamentId: CommonSchemas.uuid.optional(),
    roundNumber: z.number().int().min(1).optional(),
    notes: z.string().max(1000).optional(),
  }).refine(data => data.player1Id !== data.player2Id, {
    message: 'A player cannot play against themselves',
    path: ['player2Id'],
  }),

  /**
   * Submit match result
   */
  submitResult: z.object({
    matchId: CommonSchemas.uuid,
    player1Score: CommonSchemas.matchScore,
    player2Score: CommonSchemas.matchScore,
    resultType: z.enum(['WIN', 'LOSS', 'DRAW', 'FORFEIT', 'NO_CONTEST']).optional(),
    verifiedBy: CommonSchemas.uuid.optional(),
  }),

  /**
   * Get match by ID
   */
  getById: z.object({
    matchId: CommonSchemas.uuid,
  }),

  /**
   * Get matches with filters
   */
  getMatches: z.object({
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
    matchType: z.enum(['RANKED', 'CASUAL', 'TOURNAMENT', 'PRACTICE']).optional(),
    limit: CommonSchemas.paginationLimit,
    offset: CommonSchemas.paginationOffset,
  }),

  /**
   * Get player match history
   */
  getPlayerHistory: z.object({
    playerId: CommonSchemas.uuid,
    limit: CommonSchemas.paginationLimit,
  }),

  /**
   * Verify match result
   */
  verifyResult: z.object({
    matchId: CommonSchemas.uuid,
    verifiedBy: CommonSchemas.uuid,
  }),
};

/**
 * Leaderboard schemas
 */
export const LeaderboardSchemas = {
  /**
   * Get global leaderboard
   */
  getGlobal: z.object({
    limit: CommonSchemas.paginationLimit,
    offset: CommonSchemas.paginationOffset,
  }),

  /**
   * Get country leaderboard
   */
  getCountry: z.object({
    countryCode: CommonSchemas.countryCode,
    limit: CommonSchemas.paginationLimit,
    offset: CommonSchemas.paginationOffset,
  }),

  /**
   * Get session leaderboard
   */
  getSession: z.object({
    sessionId: CommonSchemas.uuid,
    limit: CommonSchemas.paginationLimit,
    offset: CommonSchemas.paginationOffset,
  }),

  /**
   * Get player rank
   */
  getPlayerRank: z.object({
    playerId: CommonSchemas.uuid,
    scope: z.enum(['global', 'country', 'session']).default('global'),
    identifier: z.string().optional(),
  }),
};

/**
 * Validation error formatter
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Format Zod validation errors
 */
export function formatValidationErrors(error: z.ZodError): ValidationError[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

/**
 * Validate data against a schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
} {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: formatValidationErrors(error)
      };
    }
    throw error;
  }
}

/**
 * Create a validation middleware wrapper
 */
export function createValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    const result = validate(schema, data);
    if (!result.success) {
      const errorMessage = result.errors
        ?.map(e => `${e.field}: ${e.message}`)
        .join(', ');
      throw new Error(`Validation failed: ${errorMessage}`);
    }
    return result.data!;
  };
}
