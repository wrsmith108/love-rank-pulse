/**
 * LeaderboardService Unit Tests
 *
 * Tests for real-time leaderboard with Prisma & Redis caching
 */

import { LeaderboardType } from '@prisma/client';
import { LeaderboardService } from '../services/LeaderboardService';
import prisma from '../lib/prisma';
import RedisClient from '../lib/redis';

// Mock dependencies
jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    leaderboardEntry: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../lib/redis', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(),
  },
  CacheKeys: {
    playerRank: (playerId: string, scope: string) => `player:${playerId}:rank:${scope}`,
  },
  CacheTTL: {
    LEADERBOARD: 60,
    PLAYER_STATS: 300,
  },
}));

describe('LeaderboardService', () => {
  let leaderboardService: LeaderboardService;
  let mockRedisClient: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock Redis client
    mockRedisClient = {
      get: jest.fn(),
      setEx: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
    };

    (RedisClient.getInstance as jest.Mock).mockResolvedValue(mockRedisClient);

    leaderboardService = new LeaderboardService();
  });

  describe('getLeaderboard', () => {
    it('should return paginated leaderboard data from database', async () => {
      const mockEntries = [
        {
          id: '1',
          player_id: 'player-1',
          rank: 1,
          elo_rating: 2100,
          previous_rank: 2,
          rank_change: 1,
          matches_played: 50,
          wins: 35,
          losses: 15,
          draws: 0,
          win_rate: 0.7,
          current_streak: 5,
          is_active: true,
          last_match_at: new Date(),
          player: {
            id: 'player-1',
            username: 'TopPlayer',
            avatar_url: 'https://example.com/avatar.jpg',
            country_code: 'US',
            is_active: true,
          },
        },
      ];

      (prisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);
      (prisma.leaderboardEntry.count as jest.Mock).mockResolvedValue(100);
      mockRedisClient.get.mockResolvedValue(null); // Cache miss

      const result = await leaderboardService.getLeaderboard({
        page: 1,
        limit: 50,
      });

      expect(result).toMatchObject({
        totalPlayers: 100,
        page: 1,
        limit: 50,
        hasMore: true,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toMatchObject({
        playerId: 'player-1',
        username: 'TopPlayer',
        rank: 1,
        eloRating: 2100,
      });

      // Verify cache was set
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });

    it('should return cached data when available', async () => {
      const cachedData = {
        entries: [],
        totalPlayers: 100,
        page: 1,
        limit: 50,
        hasMore: true,
        lastUpdated: new Date(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await leaderboardService.getLeaderboard({
        page: 1,
        limit: 50,
      });

      expect(result.totalPlayers).toBe(100);
      expect(prisma.leaderboardEntry.findMany).not.toHaveBeenCalled();
    });

    it('should throw error for invalid pagination', async () => {
      await expect(
        leaderboardService.getLeaderboard({ page: 0, limit: 50 })
      ).rejects.toThrow('Invalid pagination parameters');

      await expect(
        leaderboardService.getLeaderboard({ page: 1, limit: 101 })
      ).rejects.toThrow('Invalid pagination parameters');
    });
  });

  describe('getLeaderboardByRankRange', () => {
    it('should return entries within rank range', async () => {
      const mockEntries = [
        {
          id: '1',
          rank: 1,
          elo_rating: 2100,
          player: {
            id: 'player-1',
            username: 'Player1',
            is_active: true,
          },
          matches_played: 50,
          wins: 35,
          losses: 15,
          draws: 0,
          win_rate: 0.7,
          current_streak: 5,
          is_active: true,
        },
      ];

      (prisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);
      mockRedisClient.get.mockResolvedValue(null);

      const result = await leaderboardService.getLeaderboardByRankRange(1, 10);

      expect(result).toHaveLength(1);
      expect(result[0].rank).toBe(1);
    });

    it('should throw error for invalid rank range', async () => {
      await expect(
        leaderboardService.getLeaderboardByRankRange(0, 10)
      ).rejects.toThrow('Invalid rank range');

      await expect(
        leaderboardService.getLeaderboardByRankRange(10, 5)
      ).rejects.toThrow('Invalid rank range');
    });
  });

  describe('getPlayerRank', () => {
    it('should return player rank information', async () => {
      const mockEntry = {
        rank: 42,
      };

      (prisma.leaderboardEntry.findFirst as jest.Mock).mockResolvedValue(mockEntry);
      (prisma.leaderboardEntry.count as jest.Mock).mockResolvedValue(1000);
      mockRedisClient.get.mockResolvedValue(null);

      const result = await leaderboardService.getPlayerRank('player-1');

      expect(result).toMatchObject({
        playerId: 'player-1',
        rank: 42,
        totalPlayers: 1000,
      });

      expect(result?.percentile).toBeCloseTo(95.8, 1);
    });

    it('should return null for non-existent player', async () => {
      (prisma.leaderboardEntry.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await leaderboardService.getPlayerRank('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getTopPlayers', () => {
    it('should return top N players', async () => {
      const mockEntries = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        rank: i + 1,
        elo_rating: 2000 - i * 10,
        player: {
          id: `player-${i + 1}`,
          username: `Player${i + 1}`,
          is_active: true,
        },
        matches_played: 50,
        wins: 35,
        losses: 15,
        draws: 0,
        win_rate: 0.7,
        current_streak: 5,
        is_active: true,
      }));

      (prisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);
      mockRedisClient.get.mockResolvedValue(null);

      const result = await leaderboardService.getTopPlayers(10);

      expect(result).toHaveLength(10);
      expect(result[0].rank).toBe(1);
      expect(result[9].rank).toBe(10);
    });

    it('should throw error for invalid limit', async () => {
      await expect(leaderboardService.getTopPlayers(0)).rejects.toThrow(
        'Limit must be between 1 and 100'
      );

      await expect(leaderboardService.getTopPlayers(101)).rejects.toThrow(
        'Limit must be between 1 and 100'
      );
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate all leaderboard caches', async () => {
      const mockKeys = [
        'leaderboard:page:1:limit:50:type:GLOBAL:season:null:active:true',
        'leaderboard:page:2:limit:50:type:GLOBAL:season:null:active:true',
      ];

      mockRedisClient.keys.mockResolvedValue(mockKeys);

      await leaderboardService.invalidateCache();

      expect(mockRedisClient.keys).toHaveBeenCalledWith('leaderboard:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(mockKeys);
    });

    it('should invalidate player-specific caches', async () => {
      const mockLeaderboardKeys = ['leaderboard:page:1:limit:50'];
      const mockPlayerKeys = ['player:player-1:rank:GLOBAL'];

      mockRedisClient.keys
        .mockResolvedValueOnce(mockLeaderboardKeys)
        .mockResolvedValueOnce(mockPlayerKeys);

      await leaderboardService.invalidateCache('player-1');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('player:player-1:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(mockPlayerKeys);
    });
  });

  describe('updateLeaderboardEntry', () => {
    it('should update entry and invalidate cache', async () => {
      (prisma.leaderboardEntry.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      mockRedisClient.keys.mockResolvedValue([]);

      await leaderboardService.updateLeaderboardEntry(
        'player-1',
        {
          eloRating: 2100,
          wins: 36,
          losses: 15,
          currentStreak: 6,
        }
      );

      expect(prisma.leaderboardEntry.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            player_id: 'player-1',
          }),
        })
      );

      // Verify cache was invalidated
      expect(mockRedisClient.keys).toHaveBeenCalled();
    });
  });

  describe('recalculateRanks', () => {
    it('should recalculate ranks for all entries', async () => {
      const mockEntries = [
        { id: '1', rank: 2 },
        { id: '2', rank: 1 },
        { id: '3', rank: 3 },
      ];

      (prisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);
      mockRedisClient.keys.mockResolvedValue([]);

      await leaderboardService.recalculateRanks();

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockRedisClient.keys).toHaveBeenCalled(); // Cache invalidation
    });
  });

  describe('Redis fallback', () => {
    it('should work without Redis when unavailable', async () => {
      // Simulate Redis initialization failure
      (RedisClient.getInstance as jest.Mock).mockRejectedValue(new Error('Redis unavailable'));

      const serviceWithoutRedis = new LeaderboardService();

      const mockEntries = [
        {
          id: '1',
          rank: 1,
          elo_rating: 2100,
          player: {
            id: 'player-1',
            username: 'Player1',
            is_active: true,
          },
          matches_played: 50,
          wins: 35,
          losses: 15,
          draws: 0,
          win_rate: 0.7,
          current_streak: 5,
          is_active: true,
        },
      ];

      (prisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);
      (prisma.leaderboardEntry.count as jest.Mock).mockResolvedValue(100);

      const result = await serviceWithoutRedis.getLeaderboard({
        page: 1,
        limit: 50,
      });

      expect(result.entries).toHaveLength(1);
      // Should not attempt to use Redis
      expect(mockRedisClient.setEx).not.toHaveBeenCalled();
    });
  });
});
