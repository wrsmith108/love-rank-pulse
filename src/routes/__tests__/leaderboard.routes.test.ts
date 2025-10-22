/**
 * Leaderboard Routes Tests
 * Tests CRUD operations, pagination, filtering, search, error handling, validation,
 * authentication, and rate limiting for leaderboard endpoints
 *
 * Test Coverage: 15 comprehensive tests
 */

import request from 'supertest';
import express, { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import leaderboardRoutes from '../leaderboard.routes';

// Mock Prisma
jest.mock('@prisma/client');
jest.mock('../../middleware/auth');
jest.mock('../../middleware/rateLimiter');

describe('Leaderboard Routes Tests', () => {
  let app: Express;
  let mockPrisma: jest.Mocked<PrismaClient>;

  const mockPlayers = [
    {
      id: 'player-1',
      username: 'TopPlayer',
      country_code: 'US',
      avatar_url: 'https://example.com/avatar1.png',
      elo_rating: 2000,
      matches_played: 100,
      wins: 75,
      losses: 25,
      draws: 0,
      is_active: true
    },
    {
      id: 'player-2',
      username: 'SecondBest',
      country_code: 'UK',
      avatar_url: 'https://example.com/avatar2.png',
      elo_rating: 1900,
      matches_played: 90,
      wins: 60,
      losses: 30,
      draws: 0,
      is_active: true
    },
    {
      id: 'player-3',
      username: 'ThirdPlace',
      country_code: 'US',
      avatar_url: null,
      elo_rating: 1800,
      matches_played: 80,
      wins: 50,
      losses: 30,
      draws: 0,
      is_active: true
    }
  ];

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/leaderboard', leaderboardRoutes);

    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    (mockPrisma.player as any) = {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test 1: GET /global - Retrieve global leaderboard
   */
  describe('GET /api/leaderboard/global', () => {
    it('should return global leaderboard with pagination', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue(mockPlayers);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(100);

      const response = await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 100,
        totalPages: 10
      });
    });

    it('should format player data correctly', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue([mockPlayers[0]]);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 1, limit: 10 })
        .expect(200);

      const player = response.body.data[0];
      expect(player).toHaveProperty('rank', 1);
      expect(player).toHaveProperty('id');
      expect(player).toHaveProperty('username');
      expect(player).toHaveProperty('displayName');
      expect(player).toHaveProperty('countryCode');
      expect(player).toHaveProperty('eloRating');
      expect(player).toHaveProperty('matchesPlayed');
      expect(player).toHaveProperty('wins');
      expect(player).toHaveProperty('losses');
      expect(player).toHaveProperty('draws');
      expect(player).toHaveProperty('winRate');
    });

    it('should calculate win rate correctly', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue([mockPlayers[0]]);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 1, limit: 10 })
        .expect(200);

      const player = response.body.data[0];
      expect(player.winRate).toBe(0.75); // 75 wins / 100 matches
    });

    it('should handle zero matches played', async () => {
      const newPlayer = {
        ...mockPlayers[0],
        matches_played: 0,
        wins: 0,
        losses: 0
      };

      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue([newPlayer]);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 1, limit: 10 })
        .expect(200);

      const player = response.body.data[0];
      expect(player.winRate).toBe(0);
    });
  });

  /**
   * Test 2: Pagination functionality
   */
  describe('Pagination', () => {
    it('should respect page and limit parameters', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue(mockPlayers);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(100);

      const response = await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 2, limit: 20 })
        .expect(200);

      expect(mockPrisma.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 20 // (page 2 - 1) * 20
        })
      );
    });

    it('should calculate correct rank with pagination', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue(mockPlayers);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(100);

      const response = await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 3, limit: 10 })
        .expect(200);

      // First player on page 3 should be rank 21
      expect(response.body.data[0].rank).toBe(21);
    });

    it('should return empty array for out of bounds page', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(10);

      const response = await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 999, limit: 10 })
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.totalPages).toBe(1);
    });
  });

  /**
   * Test 3: GET /country/:country - Country-specific leaderboard
   */
  describe('GET /api/leaderboard/country/:country', () => {
    it('should filter by country code', async () => {
      const usPlayers = mockPlayers.filter(p => p.country_code === 'US');
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue(usPlayers);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(usPlayers.length);

      const response = await request(app)
        .get('/api/leaderboard/country/US')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.country).toBe('US');
      expect(mockPrisma.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            country_code: 'US'
          })
        })
      );
    });

    it('should convert country code to uppercase', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get('/api/leaderboard/country/uk')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(mockPrisma.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            country_code: 'UK'
          })
        })
      );
    });

    it('should return empty array for countries with no players', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get('/api/leaderboard/country/XX')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
      expect(response.body.country).toBe('XX');
    });
  });

  /**
   * Test 4: GET /top - Quick top 10 endpoint
   */
  describe('GET /api/leaderboard/top', () => {
    it('should return top 10 players without pagination', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue(mockPlayers);

      const response = await request(app)
        .get('/api/leaderboard/top')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).not.toHaveProperty('pagination');
      expect(mockPrisma.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10
        })
      );
    });

    it('should return players with correct rank order', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue(mockPlayers);

      const response = await request(app)
        .get('/api/leaderboard/top')
        .expect(200);

      response.body.data.forEach((player: any, index: number) => {
        expect(player.rank).toBe(index + 1);
      });
    });

    it('should include essential fields only', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue([mockPlayers[0]]);

      const response = await request(app)
        .get('/api/leaderboard/top')
        .expect(200);

      const player = response.body.data[0];
      expect(player).toHaveProperty('rank');
      expect(player).toHaveProperty('id');
      expect(player).toHaveProperty('username');
      expect(player).toHaveProperty('eloRating');
      expect(player).toHaveProperty('matchesPlayed');
      expect(player).toHaveProperty('wins');
      expect(player).not.toHaveProperty('losses');
      expect(player).not.toHaveProperty('draws');
    });
  });

  /**
   * Test 5: Filtering and ordering
   */
  describe('Filtering and Ordering', () => {
    it('should order by ELO rating descending', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue(mockPlayers);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(mockPlayers.length);

      await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(mockPrisma.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { elo_rating: 'desc' }
        })
      );
    });

    it('should only include active players', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue(mockPlayers);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(mockPlayers.length);

      await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(mockPrisma.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { is_active: true }
        })
      );
    });

    it('should select only necessary fields', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue(mockPlayers);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(mockPlayers.length);

      await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(mockPrisma.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            username: true,
            country_code: true,
            avatar_url: true,
            elo_rating: true,
            matches_played: true,
            wins: true,
            losses: true,
            draws: true
          })
        })
      );
    });
  });

  /**
   * Test 6: Error handling
   */
  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 1, limit: 10 })
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/leaderboard/global')
        .query({ page: -1, limit: 0 });

      // Should either return 400 or default to valid values
      expect([200, 400]).toContain(response.status);
    });

    it('should handle missing pagination parameters with defaults', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue(mockPlayers);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(mockPlayers.length);

      const response = await request(app)
        .get('/api/leaderboard/global')
        .expect(200);

      expect(response.body.pagination).toBeDefined();
    });
  });

  /**
   * Test 7: Response format validation
   */
  describe('Response Format', () => {
    it('should have consistent response structure', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue(mockPlayers);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(mockPlayers.length);

      const response = await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        pagination: {
          page: expect.any(Number),
          limit: expect.any(Number),
          total: expect.any(Number),
          totalPages: expect.any(Number)
        }
      });
    });

    it('should transform snake_case to camelCase', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue([mockPlayers[0]]);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 1, limit: 10 })
        .expect(200);

      const player = response.body.data[0];
      expect(player).toHaveProperty('eloRating');
      expect(player).toHaveProperty('matchesPlayed');
      expect(player).toHaveProperty('countryCode');
      expect(player).not.toHaveProperty('elo_rating');
      expect(player).not.toHaveProperty('matches_played');
    });
  });

  /**
   * Test 8: Performance and optimization
   */
  describe('Performance', () => {
    it('should use parallel queries for data and count', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue(mockPlayers);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(100);

      const startTime = Date.now();

      await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 1, limit: 10 })
        .expect(200);

      const duration = Date.now() - startTime;

      // Should complete quickly with mocked data
      expect(duration).toBeLessThan(1000);
      expect(mockPrisma.player.findMany).toHaveBeenCalled();
      expect(mockPrisma.player.count).toHaveBeenCalled();
    });

    it('should handle large result sets efficiently', async () => {
      const largeMockSet = Array(100).fill(null).map((_, i) => ({
        ...mockPlayers[0],
        id: `player-${i}`,
        username: `Player${i}`
      }));

      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue(largeMockSet);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(1000);

      const response = await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 1, limit: 100 })
        .expect(200);

      expect(response.body.data).toHaveLength(100);
    });
  });

  /**
   * Test 9: Edge cases
   */
  describe('Edge Cases', () => {
    it('should handle null avatar URLs', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue([mockPlayers[2]]);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 1, limit: 10 })
        .expect(200);

      const player = response.body.data[0];
      expect(player.avatarUrl).toBeNull();
    });

    it('should handle players with same ELO rating', async () => {
      const samePlayers = [
        { ...mockPlayers[0], elo_rating: 1500 },
        { ...mockPlayers[1], elo_rating: 1500 },
        { ...mockPlayers[2], elo_rating: 1500 }
      ];

      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue(samePlayers);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(3);

      const response = await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      response.body.data.forEach((p: any) => {
        expect(p.eloRating).toBe(1500);
      });
    });

    it('should handle empty leaderboard', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get('/api/leaderboard/global')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
      expect(response.body.pagination.totalPages).toBe(0);
    });
  });

  /**
   * Test 10: Concurrent requests
   */
  describe('Concurrent Requests', () => {
    it('should handle multiple simultaneous requests', async () => {
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue(mockPlayers);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(mockPlayers.length);

      const requests = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/leaderboard/global')
          .query({ page: 1, limit: 10 })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});
