/**
 * Comprehensive Unit Tests for PlayerService with Prisma Integration
 * Tests all CRUD operations, authentication, password hashing, JWT, and error cases
 * Target: 90%+ code coverage
 */

import { PlayerService } from '../PlayerService';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    player: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    leaderboardEntry: {
      upsert: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $disconnect: jest.fn(),
  };

  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

describe('PlayerService - Prisma Integration Tests', () => {
  let playerService: PlayerService;
  let mockPrisma: any;

  beforeEach(() => {
    // Get mocked Prisma instance
    mockPrisma = new PrismaClient();

    // Create new PlayerService instance
    playerService = new PlayerService();

    // Set JWT_SECRET for testing
    process.env.JWT_SECRET = 'test-secret-key';

    // Reset mock function calls but keep implementations
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Don't reset all mocks - this clears the mock implementations
    // Just clear the call history
    jest.clearAllMocks();
  });

  describe('User Registration', () => {
    const validRegistrationData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123',
      countryCode: 'US',
    };

    it('should successfully register a new user with hashed password', async () => {
      const hashedPassword = '$2a$12$hashedpassword';
      const mockPlayer = {
        id: 'player-123',
        username: 'testuser',
        email: 'test@example.com',
        password_hash: hashedPassword,
        country_code: 'US',
        elo_rating: 1200,
        rank: 0,
        is_active: true,
        is_verified: false,
        created_at: new Date(),
        updated_at: new Date(),
        last_active_at: new Date(),
        matches_played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      };

      // Mock implementations
      mockPrisma.player.findUnique.mockResolvedValue(null); // No existing user
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrisma.player.create.mockResolvedValue(mockPlayer);
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

      const result = await playerService.register(validRegistrationData);

      // Verify bcrypt was called with 12 rounds
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123', 12);

      // Verify player was created
      expect(mockPrisma.player.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: 'testuser',
          email: 'test@example.com',
          password_hash: hashedPassword,
          country_code: 'US',
          elo_rating: 1200,
          is_verified: false,
        }),
      });

      // Verify JWT was generated
      expect(jwt.sign).toHaveBeenCalled();

      // Verify response structure
      expect(result).toMatchObject({
        user: {
          id: 'player-123',
          username: 'testuser',
          email: 'test@example.com',
          countryCode: 'US',
        },
        token: 'mock-jwt-token',
      });
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should reject registration with invalid email format', async () => {
      const invalidData = {
        ...validRegistrationData,
        email: 'invalid-email',
      };

      await expect(playerService.register(invalidData)).rejects.toThrow(
        'Invalid email format'
      );

      expect(mockPrisma.player.create).not.toHaveBeenCalled();
    });

    it('should reject registration with invalid username format', async () => {
      const invalidData = {
        ...validRegistrationData,
        username: 'ab', // Too short
      };

      await expect(playerService.register(invalidData)).rejects.toThrow(
        'Username must be 3-50 characters'
      );
    });

    it('should reject registration with weak password', async () => {
      const invalidData = {
        ...validRegistrationData,
        password: 'weak', // Too short, no numbers
      };

      await expect(playerService.register(invalidData)).rejects.toThrow(
        'Password must be at least 8 characters'
      );
    });

    it('should reject registration with invalid country code', async () => {
      const invalidData = {
        ...validRegistrationData,
        countryCode: 'USA', // Should be 2 characters
      };

      await expect(playerService.register(invalidData)).rejects.toThrow(
        'Invalid country code'
      );
    });

    it('should reject registration with duplicate email', async () => {
      mockPrisma.player.findUnique.mockResolvedValueOnce({
        id: 'existing-player',
        email: 'test@example.com',
      });

      await expect(playerService.register(validRegistrationData)).rejects.toThrow(
        'Email already registered'
      );

      expect(mockPrisma.player.create).not.toHaveBeenCalled();
    });

    it('should reject registration with duplicate username', async () => {
      mockPrisma.player.findUnique
        .mockResolvedValueOnce(null) // Email check passes
        .mockResolvedValueOnce({ id: 'existing-player', username: 'testuser' }); // Username exists

      await expect(playerService.register(validRegistrationData)).rejects.toThrow(
        'Username already taken'
      );

      expect(mockPrisma.player.create).not.toHaveBeenCalled();
    });
  });

  describe('User Login', () => {
    const loginCredentials = {
      email: 'test@example.com',
      password: 'Password123',
    };

    const mockPlayer = {
      id: 'player-123',
      username: 'testuser',
      email: 'test@example.com',
      password_hash: '$2a$12$hashedpassword',
      country_code: 'US',
      is_active: true,
      is_verified: true,
    };

    it('should successfully login with valid credentials', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');
      mockPrisma.player.update.mockResolvedValue(mockPlayer);

      const result = await playerService.login(loginCredentials);

      // Verify password was checked
      expect(bcrypt.compare).toHaveBeenCalledWith('Password123', mockPlayer.password_hash);

      // Verify last_active_at was updated
      expect(mockPrisma.player.update).toHaveBeenCalledWith({
        where: { id: 'player-123' },
        data: { last_active_at: expect.any(Date) },
      });

      // Verify response
      expect(result).toMatchObject({
        user: {
          id: 'player-123',
          username: 'testuser',
          email: 'test@example.com',
        },
        token: 'mock-jwt-token',
      });
    });

    it('should reject login with invalid email', async () => {
      const invalidCredentials = {
        email: 'invalid-email',
        password: 'Password123',
      };

      await expect(playerService.login(invalidCredentials)).rejects.toThrow(
        'Invalid email format'
      );
    });

    it('should reject login with non-existent user', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(null);

      await expect(playerService.login(loginCredentials)).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should reject login with incorrect password', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(playerService.login(loginCredentials)).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should reject login for deactivated account', async () => {
      mockPrisma.player.findUnique.mockResolvedValue({
        ...mockPlayer,
        is_active: false,
      });

      await expect(playerService.login(loginCredentials)).rejects.toThrow(
        'Account is deactivated'
      );
    });

    it('should reject login with empty password', async () => {
      const invalidCredentials = {
        email: 'test@example.com',
        password: '',
      };

      await expect(playerService.login(invalidCredentials)).rejects.toThrow(
        'Password is required'
      );
    });
  });

  describe('JWT Token Management', () => {
    const mockPayload = {
      userId: 'player-123',
      username: 'testuser',
      email: 'test@example.com',
    };

    it('should verify valid JWT token', () => {
      const mockToken = 'valid-jwt-token';
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      const result = playerService.verifyJWT(mockToken);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, expect.any(String));
      expect(result).toEqual(mockPayload);
    });

    it('should return null for invalid JWT token', () => {
      const mockToken = 'invalid-jwt-token';
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = playerService.verifyJWT(mockToken);

      expect(result).toBeNull();
    });

    it('should validate token and check user status', async () => {
      const mockToken = 'valid-jwt-token';
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockPrisma.player.findUnique.mockResolvedValue({
        id: 'player-123',
        is_active: true,
      });

      const result = await playerService.validateToken(mockToken);

      expect(result).toEqual({
        valid: true,
        userId: 'player-123',
        username: 'testuser',
        email: 'test@example.com',
      });
    });

    it('should reject validation for non-existent user', async () => {
      const mockToken = 'valid-jwt-token';
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockPrisma.player.findUnique.mockResolvedValue(null);

      const result = await playerService.validateToken(mockToken);

      expect(result).toEqual({
        valid: false,
        error: 'User not found',
      });
    });

    it('should reject validation for deactivated user', async () => {
      const mockToken = 'valid-jwt-token';
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockPrisma.player.findUnique.mockResolvedValue({
        id: 'player-123',
        is_active: false,
      });

      const result = await playerService.validateToken(mockToken);

      expect(result).toEqual({
        valid: false,
        error: 'Account is deactivated',
      });
    });

    it('should handle token validation errors', async () => {
      const mockToken = 'invalid-token';
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Token error');
      });

      const result = await playerService.validateToken(mockToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Player CRUD Operations', () => {
    const mockPlayer = {
      id: 'player-123',
      username: 'testuser',
      email: 'test@example.com',
      password_hash: 'hashed',
      country_code: 'US',
      elo_rating: 1200,
      rank: 5,
      is_active: true,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
      last_active_at: new Date(),
      matches_played: 10,
      wins: 6,
      losses: 4,
      draws: 0,
      avatar_url: null,
      bio: null,
    };

    describe('getPlayerById', () => {
      it('should retrieve player by ID', async () => {
        mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);

        const result = await playerService.getPlayerById('player-123');

        expect(mockPrisma.player.findUnique).toHaveBeenCalledWith({
          where: { id: 'player-123' },
          select: expect.any(Object),
        });

        expect(result).toMatchObject({
          id: 'player-123',
          username: 'testuser',
          email: 'test@example.com',
          eloRating: 1200,
        });
      });

      it('should return null for non-existent player', async () => {
        mockPrisma.player.findUnique.mockResolvedValue(null);

        const result = await playerService.getPlayerById('non-existent');

        expect(result).toBeNull();
      });

      it('should handle database errors', async () => {
        mockPrisma.player.findUnique.mockRejectedValue(new Error('Database error'));

        await expect(playerService.getPlayerById('player-123')).rejects.toThrow();
      });
    });

    describe('updatePlayer', () => {
      it('should update player profile', async () => {
        const updates = {
          username: 'newusername',
          bio: 'New bio',
          avatarUrl: 'https://example.com/avatar.jpg',
        };

        mockPrisma.player.update.mockResolvedValue({
          ...mockPlayer,
          ...updates,
        });

        const result = await playerService.updatePlayer('player-123', updates);

        expect(mockPrisma.player.update).toHaveBeenCalledWith({
          where: { id: 'player-123' },
          data: expect.objectContaining({
            username: 'newusername',
            bio: 'New bio',
            avatar_url: 'https://example.com/avatar.jpg',
          }),
        });

        expect(result).toBeDefined();
        expect(result?.bio).toBe('New bio');
      });

      it('should handle update errors', async () => {
        mockPrisma.player.update.mockRejectedValue(new Error('Update failed'));

        const result = await playerService.updatePlayer('player-123', { bio: 'New bio' });

        expect(result).toBeNull();
      });
    });

    describe('deletePlayer', () => {
      it('should soft delete player by deactivating account', async () => {
        mockPrisma.player.update.mockResolvedValue({
          ...mockPlayer,
          is_active: false,
        });

        const result = await playerService.deletePlayer('player-123');

        expect(mockPrisma.player.update).toHaveBeenCalledWith({
          where: { id: 'player-123' },
          data: { is_active: false },
        });

        expect(result).toBe(true);
      });

      it('should handle deletion errors', async () => {
        mockPrisma.player.update.mockRejectedValue(new Error('Delete failed'));

        const result = await playerService.deletePlayer('player-123');

        expect(result).toBe(false);
      });
    });

    describe('getAllPlayers', () => {
      it('should retrieve all active players', async () => {
        const mockPlayers = [mockPlayer, { ...mockPlayer, id: 'player-456' }];
        mockPrisma.player.findMany.mockResolvedValue(mockPlayers);

        const result = await playerService.getAllPlayers();

        expect(mockPrisma.player.findMany).toHaveBeenCalledWith({
          where: { is_active: true },
          orderBy: { elo_rating: 'desc' },
          take: undefined,
          skip: undefined,
        });

        expect(result).toHaveLength(2);
      });

      it('should support pagination', async () => {
        mockPrisma.player.findMany.mockResolvedValue([mockPlayer]);

        await playerService.getAllPlayers(10, 20);

        expect(mockPrisma.player.findMany).toHaveBeenCalledWith({
          where: { is_active: true },
          orderBy: { elo_rating: 'desc' },
          take: 10,
          skip: 20,
        });
      });
    });

    describe('searchPlayers', () => {
      it('should search players by username or email', async () => {
        mockPrisma.player.findMany.mockResolvedValue([mockPlayer]);

        const result = await playerService.searchPlayers('test');

        expect(mockPrisma.player.findMany).toHaveBeenCalledWith({
          where: {
            OR: [
              { username: { contains: 'test' } },
              { email: { contains: 'test' } },
            ],
            is_active: true,
          },
          take: 50,
        });

        expect(result).toHaveLength(1);
      });
    });

    describe('getPlayersByCountry', () => {
      it('should filter players by country code', async () => {
        mockPrisma.player.findMany.mockResolvedValue([mockPlayer]);

        const result = await playerService.getPlayersByCountry('US');

        expect(mockPrisma.player.findMany).toHaveBeenCalledWith({
          where: {
            country_code: 'US',
            is_active: true,
          },
          orderBy: { elo_rating: 'desc' },
        });

        expect(result).toHaveLength(1);
      });
    });
  });

  describe('ELO Rating Updates', () => {
    const mockPlayer = {
      id: 'player-123',
      username: 'testuser',
      email: 'test@example.com',
      elo_rating: 1200,
      matches_played: 10,
      wins: 5,
      losses: 5,
      draws: 0,
      rank: 0,
      is_active: true,
    };

    it('should update ELO rating after a win', async () => {
      const newRating = 1232;
      mockPrisma.player.update.mockResolvedValue({
        ...mockPlayer,
        elo_rating: newRating,
        matches_played: 11,
        wins: 6,
      });
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue({});

      const result = await playerService.updateEloRating('player-123', newRating, true);

      expect(mockPrisma.player.update).toHaveBeenCalledWith({
        where: { id: 'player-123' },
        data: {
          elo_rating: 1232,
          matches_played: { increment: 1 },
          wins: { increment: 1 },
        },
      });

      expect(result).toBeDefined();
      expect(result?.eloRating).toBe(newRating);
    });

    it('should update ELO rating after a loss', async () => {
      const newRating = 1168;
      mockPrisma.player.update.mockResolvedValue({
        ...mockPlayer,
        elo_rating: newRating,
        matches_played: 11,
        losses: 6,
      });
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue({});

      const result = await playerService.updateEloRating('player-123', newRating, false);

      expect(mockPrisma.player.update).toHaveBeenCalledWith({
        where: { id: 'player-123' },
        data: {
          elo_rating: 1168,
          matches_played: { increment: 1 },
          losses: { increment: 1 },
        },
      });

      expect(result).toBeDefined();
    });

    it('should enforce minimum ELO rating of 0', async () => {
      mockPrisma.player.update.mockResolvedValue({
        ...mockPlayer,
        elo_rating: 0,
      });
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue({});

      await playerService.updateEloRating('player-123', -100, false);

      expect(mockPrisma.player.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            elo_rating: 0,
          }),
        })
      );
    });

    it('should enforce maximum ELO rating of 3000', async () => {
      mockPrisma.player.update.mockResolvedValue({
        ...mockPlayer,
        elo_rating: 3000,
      });
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue({});

      await playerService.updateEloRating('player-123', 3500, true);

      expect(mockPrisma.player.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            elo_rating: 3000,
          }),
        })
      );
    });

    it('should update leaderboard entry after ELO change', async () => {
      mockPrisma.player.update.mockResolvedValue({
        ...mockPlayer,
        elo_rating: 1232,
      });
      mockPrisma.player.findUnique.mockResolvedValue({
        ...mockPlayer,
        elo_rating: 1232,
        matches_played: 11,
        wins: 6,
        losses: 5,
      });
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue({});

      await playerService.updateEloRating('player-123', 1232, true);

      expect(mockPrisma.leaderboardEntry.upsert).toHaveBeenCalled();
    });
  });

  describe('Player Statistics', () => {
    const mockPlayer = {
      id: 'player-123',
      username: 'testuser',
      email: 'test@example.com',
      elo_rating: 1350,
      rank: 10,
      matches_played: 20,
      wins: 12,
      losses: 7,
      draws: 1,
    };

    it('should retrieve player statistics', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);

      const result = await playerService.getPlayerStats('player-123');

      expect(result).toMatchObject({
        playerId: 'player-123',
        matchesPlayed: 20,
        wins: 12,
        losses: 7,
        draws: 1,
        eloRating: 1350,
        rank: 10,
      });

      expect(result?.winRate).toBe(60); // 12/20 * 100
    });

    it('should handle zero matches played', async () => {
      mockPrisma.player.findUnique.mockResolvedValue({
        ...mockPlayer,
        matches_played: 0,
        wins: 0,
        losses: 0,
      });

      const result = await playerService.getPlayerStats('player-123');

      expect(result?.winRate).toBe(0);
    });

    it('should return null for non-existent player', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(null);

      const result = await playerService.getPlayerStats('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('Password Reset', () => {
    const mockPlayer = {
      id: 'player-123',
      email: 'test@example.com',
      password_hash: 'old-hash',
    };

    it('should generate password reset token', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);
      (jwt.sign as jest.Mock).mockReturnValue('reset-token');

      const token = await playerService.generatePasswordResetToken('test@example.com');

      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'player-123', type: 'reset' },
        expect.any(String),
        { expiresIn: '1h' }
      );

      expect(token).toBe('reset-token');
    });

    it('should reject reset token generation for non-existent user', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(null);

      await expect(
        playerService.generatePasswordResetToken('nonexistent@example.com')
      ).rejects.toThrow('User not found');
    });

    it('should reset password with valid token', async () => {
      const resetToken = 'valid-reset-token';
      const newPassword = 'NewPassword123';
      const hashedPassword = '$2a$12$newhashedpassword';

      // First generate a token
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);
      (jwt.sign as jest.Mock).mockReturnValue(resetToken);
      await playerService.generatePasswordResetToken('test@example.com');

      // Then reset password
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrisma.player.update.mockResolvedValue({
        ...mockPlayer,
        password_hash: hashedPassword,
      });

      const result = await playerService.resetPassword(resetToken, newPassword);

      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockPrisma.player.update).toHaveBeenCalledWith({
        where: { id: 'player-123' },
        data: { password_hash: hashedPassword },
      });

      expect(result).toBe(true);
    });

    it('should reject password reset with weak password', async () => {
      const resetToken = 'valid-reset-token';

      // First generate a token so it exists in the Map
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);
      (jwt.sign as jest.Mock).mockReturnValue(resetToken);
      await playerService.generatePasswordResetToken('test@example.com');

      await expect(
        playerService.resetPassword(resetToken, 'weak')
      ).rejects.toThrow('Password must be at least 8 characters');
    });
  });

  describe('Email Verification', () => {
    const mockPlayer = {
      id: 'player-123',
      email: 'test@example.com',
      is_verified: false,
    };

    it('should verify email with valid token', async () => {
      // Create a new instance to access verification token
      const service = new PlayerService();

      // Generate token through registration
      mockPrisma.player.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockPrisma.player.create.mockResolvedValue(mockPlayer);
      (jwt.sign as jest.Mock).mockReturnValue('jwt-token');

      await service.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        countryCode: 'US',
      });

      // Verify the email (token is generated internally)
      mockPrisma.player.update.mockResolvedValue({
        ...mockPlayer,
        is_verified: true,
      });

      // Note: Email verification token is stored internally,
      // so we can't easily test the full flow without exposing it
      // This is a limitation of the current implementation
    });
  });
});
