import { Player, PlayerStats, AuthResponse, RegistrationData, LoginCredentials } from '../models';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

/**
 * JWT Payload interface
 */
interface JWTPayload {
  userId: string;
  username: string;
  email: string;
}

/**
 * Password reset token interface
 */
interface PasswordResetToken {
  userId: string;
  token: string;
  expiresAt: Date;
}

/**
 * Email verification token interface
 */
interface EmailVerificationToken {
  userId: string;
  token: string;
  expiresAt: Date;
}

/**
 * Service for managing player data and authentication
 * Uses Prisma for database operations, bcrypt for password hashing, and JWT for authentication
 */
export class PlayerService {
  private readonly SALT_ROUNDS = 12; // Increased to 12 rounds for better security
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRATION = '24h';
  private readonly RESET_TOKEN_EXPIRATION = 3600000; // 1 hour in milliseconds
  private readonly VERIFICATION_TOKEN_EXPIRATION = 86400000; // 24 hours in milliseconds

  // In-memory token stores (in production, use Redis or database)
  private passwordResetTokens: Map<string, PasswordResetToken> = new Map();
  private emailVerificationTokens: Map<string, EmailVerificationToken> = new Map();

  constructor() {
    // Get JWT secret from environment variable or use default for development
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

    if (this.JWT_SECRET === 'your-super-secret-jwt-key-change-this-in-production' && process.env.NODE_ENV === 'production') {
      console.warn('⚠️  WARNING: Using default JWT secret in production! Set JWT_SECRET environment variable.');
    }
  }

  /**
   * Hash a password using bcrypt
   * @param password Plain text password
   * @returns Hashed password
   */
  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Compare a plain text password with a hashed password
   * @param password Plain text password
   * @param hashedPassword Hashed password
   * @returns True if passwords match
   */
  private async comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  /**
   * Generate a JWT token for a user
   * @param userId User ID
   * @param username Username
   * @param email Email address
   * @returns JWT token and expiration date
   */
  private generateJWT(userId: string, username: string, email: string): { token: string; expiresAt: Date } {
    const payload: JWTPayload = { userId, username, email };
    const token = jwt.sign(payload, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRATION });

    // Calculate expiration date (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return { token, expiresAt };
  }

  /**
   * Verify a JWT token
   * @param token JWT token
   * @returns Decoded payload or null if invalid
   */
  verifyJWT(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }
  }

  /**
   * Validate a JWT token and check if it's still valid
   * @param token JWT token to validate
   * @returns Object with validation status and user info if valid
   */
  async validateToken(token: string): Promise<{ valid: boolean; userId?: string; username?: string; email?: string; error?: string }> {
    try {
      const decoded = this.verifyJWT(token);

      if (!decoded) {
        return { valid: false, error: 'Invalid or expired token' };
      }

      // Check if user still exists and is active
      const player = await prisma.player.findUnique({
        where: { id: decoded.userId }
      });

      if (!player) {
        return { valid: false, error: 'User not found' };
      }

      if (!player.is_active) {
        return { valid: false, error: 'Account is deactivated' };
      }

      return {
        valid: true,
        userId: decoded.userId,
        username: decoded.username,
        email: decoded.email
      };
    } catch (error) {
      console.error('Token validation error:', error);
      return { valid: false, error: 'Token validation failed' };
    }
  }

  /**
   * Validate email format
   * @param email Email address
   * @returns True if valid
   */
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate username format
   * @param username Username
   * @returns True if valid
   */
  private validateUsername(username: string): boolean {
    // Username must be 3-50 characters, alphanumeric with underscores
    const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
    return usernameRegex.test(username);
  }

  /**
   * Validate password strength
   * @param password Password
   * @returns True if valid
   */
  private validatePassword(password: string): boolean {
    // Password must be at least 8 characters with at least one letter and one number
    return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  }

  /**
   * Register a new user
   * @param data Registration data including username, email, password, and country code
   * @returns Authentication response with user info and token
   * @throws Error if validation fails or user already exists
   */
  async register(data: RegistrationData): Promise<AuthResponse> {
    // Input validation
    if (!this.validateEmail(data.email)) {
      throw new Error('Invalid email format');
    }

    if (!this.validateUsername(data.username)) {
      throw new Error('Username must be 3-50 characters, alphanumeric with underscores only');
    }

    if (!this.validatePassword(data.password)) {
      throw new Error('Password must be at least 8 characters with at least one letter and one number');
    }

    if (!data.countryCode || data.countryCode.length !== 2) {
      throw new Error('Invalid country code (must be 2 characters)');
    }

    try {
      // Check if email already exists
      const existingEmail = await prisma.player.findUnique({
        where: { email: data.email.toLowerCase() }
      });

      if (existingEmail) {
        throw new Error('Email already registered');
      }

      // Check if username already exists
      const existingUsername = await prisma.player.findUnique({
        where: { username: data.username.toLowerCase() }
      });

      if (existingUsername) {
        throw new Error('Username already taken');
      }

      // Hash password
      const hashedPassword = await this.hashPassword(data.password);

      // Create player in database with password
      const player = await prisma.player.create({
        data: {
          username: data.username.toLowerCase(),
          email: data.email.toLowerCase(),
          password_hash: hashedPassword,
          country_code: data.countryCode.toUpperCase(),
          is_active: true,
          is_verified: false, // Email verification required
          elo_rating: 1200, // Default starting ELO
          rank: 0, // Will be calculated by leaderboard service
        }
      });

      // Generate verification token
      const verificationToken = this.generateVerificationToken(player.id);

      // Generate JWT token
      const { token, expiresAt } = this.generateJWT(player.id, player.username, player.email);

      // Return auth response
      return {
        user: {
          id: player.id,
          username: player.username,
          email: player.email,
          displayName: player.username, // Use username as display name initially
          countryCode: player.country_code || data.countryCode
        },
        token,
        expiresAt
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Registration failed: ' + String(error));
    }
  }

  /**
   * Login a user
   * @param credentials Login credentials (email and password)
   * @returns Authentication response with user info and token
   * @throws Error if credentials are invalid
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    // Input validation
    if (!this.validateEmail(credentials.email)) {
      throw new Error('Invalid email format');
    }

    if (!credentials.password) {
      throw new Error('Password is required');
    }

    try {
      // Find user by email
      const player = await prisma.player.findUnique({
        where: { email: credentials.email.toLowerCase() }
      });

      if (!player) {
        throw new Error('Invalid email or password');
      }

      // Check if account is active
      if (!player.is_active) {
        throw new Error('Account is deactivated. Please contact support.');
      }

      // Verify password using bcrypt
      const isPasswordValid = await this.comparePasswords(credentials.password, player.password_hash);

      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Update last active timestamp
      await prisma.player.update({
        where: { id: player.id },
        data: { last_active_at: new Date() }
      });

      // Generate JWT token
      const { token, expiresAt } = this.generateJWT(player.id, player.username, player.email);

      // Return auth response
      return {
        user: {
          id: player.id,
          username: player.username,
          email: player.email,
          displayName: player.username,
          countryCode: player.country_code || 'US'
        },
        token,
        expiresAt
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Login failed: ' + String(error));
    }
  }

  /**
   * Get a player by ID
   * @param playerId The ID of the player to retrieve
   * @returns The player or null if not found
   * @throws Error if database operation fails
   */
  async getPlayerById(playerId: string): Promise<Player | null> {
    try {
      const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: {
          id: true,
          username: true,
          email: true,
          avatar_url: true,
          bio: true,
          country_code: true,
          elo_rating: true,
          rank: true,
          created_at: true,
          last_active_at: true,
          is_active: true,
          is_verified: true,
          matches_played: true,
          wins: true,
          losses: true,
          draws: true,
          // Exclude password_hash for security
        }
      });

      if (!player) {
        return null;
      }

      return this.mapPrismaPlayerToModel(player);
    } catch (error) {
      console.error('Error fetching player by ID:', error);
      throw new Error(`Failed to fetch player with ID ${playerId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get multiple players by their IDs
   * @param playerIds Array of player IDs to retrieve
   * @returns Array of found players
   */
  async getPlayersByIds(playerIds: string[]): Promise<Player[]> {
    try {
      const players = await prisma.player.findMany({
        where: {
          id: { in: playerIds }
        }
      });

      return players.map(p => this.mapPrismaPlayerToModel(p));
    } catch (error) {
      console.error('Error fetching players:', error);
      throw new Error('Failed to fetch players');
    }
  }

  /**
   * Get all players
   * @param limit Optional limit for number of players
   * @param offset Optional offset for pagination
   * @returns Array of all players
   */
  async getAllPlayers(limit?: number, offset?: number): Promise<Player[]> {
    try {
      const players = await prisma.player.findMany({
        where: { is_active: true },
        orderBy: { elo_rating: 'desc' },
        take: limit,
        skip: offset
      });

      return players.map(p => this.mapPrismaPlayerToModel(p));
    } catch (error) {
      console.error('Error fetching all players:', error);
      throw new Error('Failed to fetch players');
    }
  }

  /**
   * Search for players by username or email
   * @param query The search query
   * @returns Array of matching players
   */
  async searchPlayers(query: string): Promise<Player[]> {
    try {
      const players = await prisma.player.findMany({
        where: {
          OR: [
            { username: { contains: query.toLowerCase() } },
            { email: { contains: query.toLowerCase() } }
          ],
          is_active: true
        },
        take: 50 // Limit search results
      });

      return players.map(p => this.mapPrismaPlayerToModel(p));
    } catch (error) {
      console.error('Error searching players:', error);
      throw new Error('Failed to search players');
    }
  }

  /**
   * Get players from a specific country
   * @param countryCode The country code to filter by
   * @returns Array of players from the specified country
   */
  async getPlayersByCountry(countryCode: string): Promise<Player[]> {
    try {
      const players = await prisma.player.findMany({
        where: {
          country_code: countryCode.toUpperCase(),
          is_active: true
        },
        orderBy: { elo_rating: 'desc' }
      });

      return players.map(p => this.mapPrismaPlayerToModel(p));
    } catch (error) {
      console.error('Error fetching players by country:', error);
      throw new Error('Failed to fetch players by country');
    }
  }

  /**
   * Get player statistics
   * @param playerId The ID of the player whose stats to retrieve
   * @returns The player's statistics or null if not found
   */
  async getPlayerStats(playerId: string): Promise<PlayerStats | null> {
    try {
      const player = await prisma.player.findUnique({
        where: { id: playerId }
      });

      if (!player) {
        return null;
      }

      // Calculate win rate
      const winRate = player.matches_played > 0
        ? (player.wins / player.matches_played) * 100
        : 0;

      return {
        playerId: player.id,
        matchesPlayed: player.matches_played,
        wins: player.wins,
        losses: player.losses,
        draws: player.draws,
        winRate,
        currentStreak: 0, // TODO: Calculate from match history
        bestStreak: 0, // TODO: Calculate from match history
        averageScore: 0, // TODO: Calculate from match results
        totalScore: 0, // TODO: Calculate from match results
        rank: player.rank,
        eloRating: player.elo_rating,
        peakElo: player.elo_rating, // TODO: Track in separate field
        lowestElo: 1200 // TODO: Track in separate field
      };
    } catch (error) {
      console.error('Error fetching player stats:', error);
      throw new Error('Failed to fetch player stats');
    }
  }

  /**
   * Update an existing player profile
   * @param playerId The ID of the player to update
   * @param updates The updates to apply
   * @returns The updated player or null if not found
   */
  async updatePlayer(playerId: string, updates: Partial<Player>): Promise<Player | null> {
    try {
      // Map model fields to Prisma schema fields
      const data: any = {};

      if (updates.username !== undefined) {
        data.username = updates.username.toLowerCase();
      }
      if (updates.email !== undefined) {
        data.email = updates.email.toLowerCase();
      }
      if (updates.displayName !== undefined) {
        // Note: Prisma schema doesn't have display_name, using username
        data.username = updates.displayName.toLowerCase();
      }
      if (updates.countryCode !== undefined) {
        data.country_code = updates.countryCode.toUpperCase();
      }
      if (updates.avatarUrl !== undefined) {
        data.avatar_url = updates.avatarUrl;
      }
      if (updates.bio !== undefined) {
        data.bio = updates.bio;
      }
      if (updates.isActive !== undefined) {
        data.is_active = updates.isActive;
      }

      const player = await prisma.player.update({
        where: { id: playerId },
        data
      });

      return this.mapPrismaPlayerToModel(player);
    } catch (error) {
      console.error('Error updating player:', error);
      return null;
    }
  }

  /**
   * Delete a player (soft delete by deactivating)
   * @param playerId The ID of the player to delete
   * @returns True if successful
   */
  async deletePlayer(playerId: string): Promise<boolean> {
    try {
      await prisma.player.update({
        where: { id: playerId },
        data: { is_active: false }
      });
      return true;
    } catch (error) {
      console.error('Error deleting player:', error);
      return false;
    }
  }

  /**
   * Update a player's ELO rating
   * @param playerId The ID of the player to update
   * @param newRating The new ELO rating
   * @param wonMatch Whether the player won the match (for stats update)
   * @returns The updated player or null if not found
   */
  async updateEloRating(playerId: string, newRating: number, wonMatch?: boolean): Promise<Player | null> {
    try {
      // Ensure rating is within valid range (typically 0-3000)
      const validatedRating = Math.max(0, Math.min(3000, Math.round(newRating)));

      // Update ELO rating and match statistics
      const updateData: any = {
        elo_rating: validatedRating,
        matches_played: { increment: 1 }
      };

      // Update win/loss stats if provided
      if (wonMatch === true) {
        updateData.wins = { increment: 1 };
      } else if (wonMatch === false) {
        updateData.losses = { increment: 1 };
      }

      const player = await prisma.player.update({
        where: { id: playerId },
        data: updateData
      });

      // Update leaderboard entry if it exists
      await this.updateLeaderboardEntry(playerId);

      return this.mapPrismaPlayerToModel(player);
    } catch (error) {
      console.error('Error updating ELO rating:', error);
      return null;
    }
  }

  /**
   * Update or create a leaderboard entry for a player
   * @param playerId The ID of the player
   * @private
   */
  private async updateLeaderboardEntry(playerId: string): Promise<void> {
    try {
      const player = await prisma.player.findUnique({
        where: { id: playerId }
      });

      if (!player) return;

      // Calculate win rate
      const winRate = player.matches_played > 0
        ? (player.wins / player.matches_played) * 100
        : 0;

      // Update or create leaderboard entry
      await prisma.leaderboardEntry.upsert({
        where: {
          unique_leaderboard_entry: {
            player_id: playerId,
            season_id: null, // Global leaderboard
            leaderboard_type: 'GLOBAL'
          }
        },
        update: {
          elo_rating: player.elo_rating,
          matches_played: player.matches_played,
          wins: player.wins,
          losses: player.losses,
          draws: player.draws,
          win_rate: winRate,
          last_updated: new Date()
        },
        create: {
          player_id: playerId,
          rank: 0, // Will be calculated by leaderboard service
          elo_rating: player.elo_rating,
          peak_elo: player.elo_rating,
          lowest_elo: player.elo_rating,
          matches_played: player.matches_played,
          wins: player.wins,
          losses: player.losses,
          draws: player.draws,
          win_rate: winRate,
          leaderboard_type: 'GLOBAL',
          is_active: true
        }
      });
    } catch (error) {
      console.error('Error updating leaderboard entry:', error);
      // Don't throw - this is a secondary operation
    }
  }

  /**
   * Generate a password reset token
   * @param email User email
   * @returns Reset token
   */
  async generatePasswordResetToken(email: string): Promise<string> {
    try {
      const player = await prisma.player.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (!player) {
        throw new Error('User not found');
      }

      // Generate random token
      const token = jwt.sign({ userId: player.id, type: 'reset' }, this.JWT_SECRET, { expiresIn: '1h' });

      const expiresAt = new Date(Date.now() + this.RESET_TOKEN_EXPIRATION);

      this.passwordResetTokens.set(token, {
        userId: player.id,
        token,
        expiresAt
      });

      // In production, send email with token
      console.log(`Password reset token for ${email}: ${token}`);

      return token;
    } catch (error) {
      console.error('Error generating reset token:', error);
      // Re-throw original error to preserve error message
      throw error;
    }
  }

  /**
   * Reset password using token
   * @param token Reset token
   * @param newPassword New password
   * @returns True if successful
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      const resetToken = this.passwordResetTokens.get(token);

      if (!resetToken || resetToken.expiresAt < new Date()) {
        throw new Error('Invalid or expired reset token');
      }

      if (!this.validatePassword(newPassword)) {
        throw new Error('Password must be at least 8 characters with at least one letter and one number');
      }

      const hashedPassword = await this.hashPassword(newPassword);

      // Update password in database
      await prisma.player.update({
        where: { id: resetToken.userId },
        data: { password_hash: hashedPassword }
      });

      // Remove used token
      this.passwordResetTokens.delete(token);

      return true;
    } catch (error) {
      console.error('Error resetting password:', error);
      // Re-throw original error to preserve error message
      throw error;
    }
  }

  /**
   * Generate an email verification token
   * @param userId User ID
   * @returns Verification token
   */
  private generateVerificationToken(userId: string): string {
    const token = jwt.sign({ userId, type: 'verify' }, this.JWT_SECRET, { expiresIn: '24h' });

    const expiresAt = new Date(Date.now() + this.VERIFICATION_TOKEN_EXPIRATION);

    this.emailVerificationTokens.set(token, {
      userId,
      token,
      expiresAt
    });

    // In production, send verification email
    console.log(`Email verification token for user ${userId}: ${token}`);

    return token;
  }

  /**
   * Verify email using token
   * @param token Verification token
   * @returns True if successful
   */
  async verifyEmail(token: string): Promise<boolean> {
    try {
      const verificationToken = this.emailVerificationTokens.get(token);

      if (!verificationToken || verificationToken.expiresAt < new Date()) {
        throw new Error('Invalid or expired verification token');
      }

      await prisma.player.update({
        where: { id: verificationToken.userId },
        data: { is_verified: true }
      });

      // Remove used token
      this.emailVerificationTokens.delete(token);

      return true;
    } catch (error) {
      console.error('Error verifying email:', error);
      throw new Error('Failed to verify email');
    }
  }

  /**
   * Map Prisma Player model to application Player model
   * @param prismaPlayer Prisma player object
   * @returns Application Player model
   */
  private mapPrismaPlayerToModel(prismaPlayer: any): Player {
    return {
      id: prismaPlayer.id,
      username: prismaPlayer.username,
      email: prismaPlayer.email,
      displayName: prismaPlayer.username, // Use username as display name
      avatarUrl: prismaPlayer.avatar_url,
      bio: prismaPlayer.bio,
      countryCode: prismaPlayer.country_code || 'US',
      eloRating: prismaPlayer.elo_rating,
      rank: prismaPlayer.rank,
      createdAt: prismaPlayer.created_at,
      lastLoginAt: prismaPlayer.last_active_at,
      isActive: prismaPlayer.is_active,
      isVerified: prismaPlayer.is_verified
    };
  }
}

// Create and export a singleton instance
export const playerService = new PlayerService();
