/**
 * AuthService - Real authentication service with Prisma & JWT
 *
 * Features:
 * - User registration with password hashing (bcrypt)
 * - Login with JWT token generation
 * - Token verification and validation
 * - Session management
 * - Password reset functionality
 */

import { PrismaClient } from '@prisma/client';
import prisma from '../lib/prisma';
import { AuthUtils, JWTPayload } from '../lib/auth';

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  countryCode?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    username: string;
    eloRating: number;
    avatarUrl?: string | null;
    countryCode?: string | null;
  };
  error?: string;
}

export class AuthService {
  /**
   * Register a new user
   */
  static async register(input: RegisterInput): Promise<AuthResponse> {
    try {
      // Validate input
      if (!input.email || !input.username || !input.password) {
        return {
          success: false,
          error: 'Email, username, and password are required'
        };
      }

      // Check if user already exists
      const existingUser = await prisma.player.findFirst({
        where: {
          OR: [
            { email: input.email.toLowerCase() },
            { username: input.username }
          ]
        }
      });

      if (existingUser) {
        return {
          success: false,
          error: existingUser.email === input.email.toLowerCase()
            ? 'Email already registered'
            : 'Username already taken'
        };
      }

      // Hash password
      const hashedPassword = await AuthUtils.hashPassword(input.password);

      // Create user
      const user = await prisma.player.create({
        data: {
          email: input.email.toLowerCase(),
          username: input.username,
          password_hash: hashedPassword,
          country_code: input.countryCode || null,
          elo_rating: 1200, // Default ELO rating
          rank: 0,
          is_active: true,
          is_verified: false
        }
      });

      // Create initial leaderboard entry
      await prisma.leaderboardEntry.create({
        data: {
          player_id: user.id,
          rank: 0, // Will be updated by rank calculation job
          elo_rating: 1200,
          leaderboard_type: 'GLOBAL',
          is_active: true
        }
      });

      // Generate JWT token
      const payload: JWTPayload = {
        userId: user.id,
        username: user.username,
        email: user.email
      };
      const token = AuthUtils.generateToken(payload);

      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          eloRating: user.elo_rating,
          avatarUrl: user.avatar_url,
          countryCode: user.country_code
        }
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  /**
   * Login user
   */
  static async login(input: LoginInput): Promise<AuthResponse> {
    try {
      // Validate input
      if (!input.email || !input.password) {
        return {
          success: false,
          error: 'Email and password are required'
        };
      }

      // Find user by email
      const user = await prisma.player.findUnique({
        where: {
          email: input.email.toLowerCase()
        },
        select: {
          id: true,
          email: true,
          username: true,
          password_hash: true,
          elo_rating: true,
          avatar_url: true,
          country_code: true,
          is_active: true
        }
      });

      if (!user) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Check if account is active
      if (!user.is_active) {
        return {
          success: false,
          error: 'Account is deactivated'
        };
      }

      // Verify password
      const isPasswordValid = await AuthUtils.comparePassword(
        input.password,
        user.password_hash
      );

      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Update last active timestamp
      await prisma.player.update({
        where: { id: user.id },
        data: { last_active_at: new Date() }
      });

      // Generate JWT token
      const payload: JWTPayload = {
        userId: user.id,
        username: user.username,
        email: user.email
      };
      const token = AuthUtils.generateToken(payload);

      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          eloRating: user.elo_rating,
          avatarUrl: user.avatar_url,
          countryCode: user.country_code
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  /**
   * Verify JWT token and get user
   */
  static async verifyToken(token: string): Promise<AuthResponse> {
    try {
      // Verify and decode token
      const payload = AuthUtils.verifyToken(token);

      // Get user from database
      const user = await prisma.player.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          username: true,
          elo_rating: true,
          avatar_url: true,
          country_code: true,
          is_active: true
        }
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      if (!user.is_active) {
        return {
          success: false,
          error: 'Account is deactivated'
        };
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          eloRating: user.elo_rating,
          avatarUrl: user.avatar_url,
          countryCode: user.country_code
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid token'
      };
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string) {
    try {
      const user = await prisma.player.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          elo_rating: true,
          rank: true,
          avatar_url: true,
          bio: true,
          country_code: true,
          is_active: true,
          is_verified: true,
          matches_played: true,
          wins: true,
          losses: true,
          draws: true,
          created_at: true,
          last_active_at: true
        }
      });

      return user;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, updates: {
    username?: string;
    bio?: string;
    avatarUrl?: string;
    countryCode?: string;
  }) {
    try {
      // Check if username is taken (if updating username)
      if (updates.username) {
        const existing = await prisma.player.findFirst({
          where: {
            username: updates.username,
            NOT: { id: userId }
          }
        });

        if (existing) {
          throw new Error('Username already taken');
        }
      }

      const user = await prisma.player.update({
        where: { id: userId },
        data: {
          username: updates.username,
          bio: updates.bio,
          avatar_url: updates.avatarUrl,
          country_code: updates.countryCode,
          updated_at: new Date()
        },
        select: {
          id: true,
          email: true,
          username: true,
          elo_rating: true,
          avatar_url: true,
          bio: true,
          country_code: true
        }
      });

      return user;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  /**
   * Change password
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    try {
      // Get user with password hash
      const user = await prisma.player.findUnique({
        where: { id: userId },
        select: { password_hash: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValid = await AuthUtils.comparePassword(currentPassword, user.password_hash);
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await AuthUtils.hashPassword(newPassword);

      // Update password
      await prisma.player.update({
        where: { id: userId },
        data: { password_hash: hashedPassword }
      });

      return true;
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
