/**
 * AuthService Tests
 * Comprehensive tests for authentication service
 */

import { AuthService } from '../../services/AuthService';
import { createMockPrismaClient, mockPrismaPlayer } from '../utils/mockPrisma';
import { samplePlayers, samplePasswords } from '../fixtures/sampleData';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: createMockPrismaClient()
}));

// Mock AuthUtils
jest.mock('../../lib/auth', () => ({
  AuthUtils: {
    hashPassword: jest.fn((password: string) => Promise.resolve(`$2b$10$hashed_${password}`)),
    comparePassword: jest.fn((plain: string, hashed: string) => {
      // Simple mock comparison
      return Promise.resolve(hashed === `$2b$10$hashed_${plain}`);
    }),
    generateToken: jest.fn((payload: any) => `jwt_token_${payload.userId}`),
    verifyToken: jest.fn((token: string) => {
      if (token.startsWith('jwt_token_')) {
        const userId = token.replace('jwt_token_', '');
        return { userId, username: 'testuser', email: 'test@example.com' };
      }
      throw new Error('Invalid token');
    })
  }
}));

describe('AuthService', () => {
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = require('../../lib/prisma').default;
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const newUser = mockPrismaPlayer({
        id: 'new-player-id',
        email: 'newuser@example.com',
        username: 'newuser'
      });

      mockPrisma.player.findFirst.mockResolvedValue(null);
      mockPrisma.player.create.mockResolvedValue(newUser);
      mockPrisma.leaderboardEntry.create.mockResolvedValue({});

      const result = await AuthService.register({
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'password123',
        countryCode: 'US'
      });

      expect(result.success).toBe(true);
      expect(result.token).toBe('jwt_token_new-player-id');
      expect(result.user).toMatchObject({
        id: 'new-player-id',
        email: 'newuser@example.com',
        username: 'newuser'
      });
      expect(mockPrisma.player.create).toHaveBeenCalled();
      expect(mockPrisma.leaderboardEntry.create).toHaveBeenCalled();
    });

    it('should fail when email is missing', async () => {
      const result = await AuthService.register({
        email: '',
        username: 'testuser',
        password: 'password123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should fail when username is missing', async () => {
      const result = await AuthService.register({
        email: 'test@example.com',
        username: '',
        password: 'password123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should fail when password is missing', async () => {
      const result = await AuthService.register({
        email: 'test@example.com',
        username: 'testuser',
        password: ''
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should fail when email already exists', async () => {
      mockPrisma.player.findFirst.mockResolvedValue(
        mockPrismaPlayer({ email: 'existing@example.com' })
      );

      const result = await AuthService.register({
        email: 'existing@example.com',
        username: 'newuser',
        password: 'password123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Email already registered');
    });

    it('should fail when username already exists', async () => {
      mockPrisma.player.findFirst.mockResolvedValue(
        mockPrismaPlayer({ username: 'existinguser' })
      );

      const result = await AuthService.register({
        email: 'new@example.com',
        username: 'existinguser',
        password: 'password123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Username already taken');
    });

    it('should lowercase email before storage', async () => {
      mockPrisma.player.findFirst.mockResolvedValue(null);
      mockPrisma.player.create.mockResolvedValue(
        mockPrismaPlayer({ email: 'test@example.com' })
      );
      mockPrisma.leaderboardEntry.create.mockResolvedValue({});

      await AuthService.register({
        email: 'TEST@EXAMPLE.COM',
        username: 'testuser',
        password: 'password123'
      });

      expect(mockPrisma.player.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com'
          })
        })
      );
    });

    it('should set default ELO rating to 1200', async () => {
      mockPrisma.player.findFirst.mockResolvedValue(null);
      mockPrisma.player.create.mockResolvedValue(mockPrismaPlayer());
      mockPrisma.leaderboardEntry.create.mockResolvedValue({});

      await AuthService.register({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123'
      });

      expect(mockPrisma.player.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            elo_rating: 1200
          })
        })
      );
    });

    it('should create initial leaderboard entry', async () => {
      const newUser = mockPrismaPlayer({ id: 'new-player-id' });
      mockPrisma.player.findFirst.mockResolvedValue(null);
      mockPrisma.player.create.mockResolvedValue(newUser);
      mockPrisma.leaderboardEntry.create.mockResolvedValue({});

      await AuthService.register({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123'
      });

      expect(mockPrisma.leaderboardEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            player_id: 'new-player-id',
            elo_rating: 1200,
            leaderboard_type: 'GLOBAL'
          })
        })
      );
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const user = mockPrismaPlayer({
        id: 'player-123',
        email: 'test@example.com',
        password_hash: '$2b$10$hashed_password123'
      });

      mockPrisma.player.findUnique.mockResolvedValue(user);
      mockPrisma.player.update.mockResolvedValue(user);

      const result = await AuthService.login({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(result.success).toBe(true);
      expect(result.token).toBe('jwt_token_player-123');
      expect(result.user).toMatchObject({
        id: 'player-123',
        email: 'test@example.com'
      });
    });

    it('should fail when email is missing', async () => {
      const result = await AuthService.login({
        email: '',
        password: 'password123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should fail when password is missing', async () => {
      const result = await AuthService.login({
        email: 'test@example.com',
        password: ''
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should fail when user does not exist', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(null);

      const result = await AuthService.login({
        email: 'nonexistent@example.com',
        password: 'password123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email or password');
    });

    it('should fail when password is incorrect', async () => {
      const user = mockPrismaPlayer({
        password_hash: '$2b$10$hashed_correctpassword'
      });

      mockPrisma.player.findUnique.mockResolvedValue(user);

      const result = await AuthService.login({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email or password');
    });

    it('should fail when account is deactivated', async () => {
      const user = mockPrismaPlayer({
        is_active: false,
        password_hash: '$2b$10$hashed_password123'
      });

      mockPrisma.player.findUnique.mockResolvedValue(user);

      const result = await AuthService.login({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Account is deactivated');
    });

    it('should update last_active_at on successful login', async () => {
      const user = mockPrismaPlayer({
        id: 'player-123',
        password_hash: '$2b$10$hashed_password123'
      });

      mockPrisma.player.findUnique.mockResolvedValue(user);
      mockPrisma.player.update.mockResolvedValue(user);

      await AuthService.login({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(mockPrisma.player.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'player-123' },
          data: expect.objectContaining({
            last_active_at: expect.any(Date)
          })
        })
      );
    });

    it('should lowercase email before lookup', async () => {
      const user = mockPrismaPlayer({ password_hash: '$2b$10$hashed_password123' });
      mockPrisma.player.findUnique.mockResolvedValue(user);
      mockPrisma.player.update.mockResolvedValue(user);

      await AuthService.login({
        email: 'TEST@EXAMPLE.COM',
        password: 'password123'
      });

      expect(mockPrisma.player.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'test@example.com' }
        })
      );
    });
  });

  describe('verifyToken', () => {
    it('should successfully verify valid token', async () => {
      const user = mockPrismaPlayer({
        id: 'player-123',
        is_active: true
      });

      mockPrisma.player.findUnique.mockResolvedValue(user);

      const result = await AuthService.verifyToken('jwt_token_player-123');

      expect(result.success).toBe(true);
      expect(result.user).toMatchObject({
        id: 'player-123'
      });
    });

    it('should fail when token is invalid', async () => {
      const result = await AuthService.verifyToken('invalid_token');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should fail when user not found', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(null);

      const result = await AuthService.verifyToken('jwt_token_player-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('User not found');
    });

    it('should fail when account is deactivated', async () => {
      const user = mockPrismaPlayer({
        id: 'player-123',
        is_active: false
      });

      mockPrisma.player.findUnique.mockResolvedValue(user);

      const result = await AuthService.verifyToken('jwt_token_player-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Account is deactivated');
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const user = mockPrismaPlayer({ id: 'player-123' });
      mockPrisma.player.findUnique.mockResolvedValue(user);

      const result = await AuthService.getUserById('player-123');

      expect(result).toBeTruthy();
      expect(result?.id).toBe('player-123');
    });

    it('should return null when user not found', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(null);

      const result = await AuthService.getUserById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockPrisma.player.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await AuthService.getUserById('player-123');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should successfully update profile', async () => {
      const updatedUser = mockPrismaPlayer({
        id: 'player-123',
        username: 'newusername',
        bio: 'New bio'
      });

      mockPrisma.player.findFirst.mockResolvedValue(null);
      mockPrisma.player.update.mockResolvedValue(updatedUser);

      const result = await AuthService.updateProfile('player-123', {
        username: 'newusername',
        bio: 'New bio'
      });

      expect(result.username).toBe('newusername');
      expect(result.bio).toBe('New bio');
    });

    it('should fail when username already taken', async () => {
      mockPrisma.player.findFirst.mockResolvedValue(
        mockPrismaPlayer({ id: 'other-player', username: 'takenusername' })
      );

      await expect(
        AuthService.updateProfile('player-123', {
          username: 'takenusername'
        })
      ).rejects.toThrow('Username already taken');
    });

    it('should allow updating username to same value', async () => {
      mockPrisma.player.findFirst.mockResolvedValue(null);
      mockPrisma.player.update.mockResolvedValue(
        mockPrismaPlayer({ id: 'player-123', username: 'sameusername' })
      );

      const result = await AuthService.updateProfile('player-123', {
        username: 'sameusername'
      });

      expect(result.username).toBe('sameusername');
    });
  });

  describe('changePassword', () => {
    it('should successfully change password', async () => {
      const user = mockPrismaPlayer({
        id: 'player-123',
        password_hash: '$2b$10$hashed_oldpassword'
      });

      mockPrisma.player.findUnique.mockResolvedValue(user);
      mockPrisma.player.update.mockResolvedValue(user);

      const result = await AuthService.changePassword(
        'player-123',
        'oldpassword',
        'newpassword'
      );

      expect(result).toBe(true);
      expect(mockPrisma.player.update).toHaveBeenCalled();
    });

    it('should fail when user not found', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(null);

      await expect(
        AuthService.changePassword('nonexistent', 'oldpass', 'newpass')
      ).rejects.toThrow('User not found');
    });

    it('should fail when current password is incorrect', async () => {
      const user = mockPrismaPlayer({
        password_hash: '$2b$10$hashed_differentpassword'
      });

      mockPrisma.player.findUnique.mockResolvedValue(user);

      await expect(
        AuthService.changePassword('player-123', 'wrongpassword', 'newpassword')
      ).rejects.toThrow('Current password is incorrect');
    });
  });

  // Performance tests
  describe('Performance', () => {
    it('should handle registration in under 100ms', async () => {
      mockPrisma.player.findFirst.mockResolvedValue(null);
      mockPrisma.player.create.mockResolvedValue(mockPrismaPlayer());
      mockPrisma.leaderboardEntry.create.mockResolvedValue({});

      const start = performance.now();
      await AuthService.register({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123'
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should handle login in under 100ms', async () => {
      const user = mockPrismaPlayer({ password_hash: '$2b$10$hashed_password123' });
      mockPrisma.player.findUnique.mockResolvedValue(user);
      mockPrisma.player.update.mockResolvedValue(user);

      const start = performance.now();
      await AuthService.login({
        email: 'test@example.com',
        password: 'password123'
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
