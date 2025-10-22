/**
 * CachedLeaderboardService Tests
 * Tests for Redis-cached leaderboard service
 */

import { CachedLeaderboardService } from '../../services/CachedLeaderboardService';
import { createMockPrismaClient, mockPrismaLeaderboardEntry } from '../utils/mockPrisma';
import { createMockRedisClient } from '../utils/mockRedis';
import { createLeaderboardEntriesFactory } from '../utils/testDataFactories';

// Mock dependencies
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: createMockPrismaClient()
}));

jest.mock('../../services/redis', () => ({
  redis: createMockRedisClient()
}));

describe('CachedLeaderboardService', () => {
  let mockPrisma: any;
  let mockRedis: any;
  let service: CachedLeaderboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = require('../../lib/prisma').default;
    mockRedis = require('../../services/redis').redis;
    service = new CachedLeaderboardService();
  });

  describe('getGlobalLeaderboard', () => {
    it('should return cached leaderboard when available', async () => {
      const entries = createLeaderboardEntriesFactory(10);
      mockRedis.get.mockResolvedValue(JSON.stringify(entries));

      const result = await service.getGlobalLeaderboard(10);

      expect(result).toHaveLength(10);
      expect(mockRedis.get).toHaveBeenCalledWith('leaderboard:global:10');
      expect(mockPrisma.leaderboardEntry.findMany).not.toHaveBeenCalled();
    });

    it('should fetch from database when cache miss', async () => {
      const entries = createLeaderboardEntriesFactory(10);
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue(entries);
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.getGlobalLeaderboard(10);

      expect(result).toHaveLength(10);
      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should cache fetched leaderboard', async () => {
      const entries = createLeaderboardEntriesFactory(10);
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue(entries);
      mockRedis.setex.mockResolvedValue('OK');

      await service.getGlobalLeaderboard(10);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'leaderboard:global:10',
        300, // 5 minutes TTL
        JSON.stringify(entries)
      );
    });

    it('should order by ELO rating descending', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);
      mockRedis.setex.mockResolvedValue('OK');

      await service.getGlobalLeaderboard(10);

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { elo_rating: 'desc' }
        })
      );
    });

    it('should filter active players only', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);
      mockRedis.setex.mockResolvedValue('OK');

      await service.getGlobalLeaderboard(10);

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: true
          })
        })
      );
    });
  });

  describe('getPlayerRank', () => {
    it('should return player rank from cache', async () => {
      mockRedis.get.mockResolvedValue('42');

      const rank = await service.getPlayerRank('player-123');

      expect(rank).toBe(42);
      expect(mockRedis.get).toHaveBeenCalledWith('player:player-123:rank');
    });

    it('should fetch rank from database on cache miss', async () => {
      const entry = mockPrismaLeaderboardEntry({
        player_id: 'player-123',
        rank: 15
      });

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.findFirst.mockResolvedValue(entry);
      mockRedis.setex.mockResolvedValue('OK');

      const rank = await service.getPlayerRank('player-123');

      expect(rank).toBe(15);
      expect(mockPrisma.leaderboardEntry.findFirst).toHaveBeenCalled();
    });

    it('should cache player rank', async () => {
      const entry = mockPrismaLeaderboardEntry({
        player_id: 'player-123',
        rank: 25
      });

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.findFirst.mockResolvedValue(entry);
      mockRedis.setex.mockResolvedValue('OK');

      await service.getPlayerRank('player-123');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'player:player-123:rank',
        300,
        '25'
      );
    });

    it('should return -1 when player not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.findFirst.mockResolvedValue(null);

      const rank = await service.getPlayerRank('nonexistent');

      expect(rank).toBe(-1);
    });
  });

  describe('invalidateLeaderboardCache', () => {
    it('should delete global leaderboard cache keys', async () => {
      mockRedis.keys.mockResolvedValue([
        'leaderboard:global:10',
        'leaderboard:global:50',
        'leaderboard:global:100'
      ]);
      mockRedis.del.mockResolvedValue(1);

      await service.invalidateLeaderboardCache();

      expect(mockRedis.keys).toHaveBeenCalledWith('leaderboard:global:*');
      expect(mockRedis.del).toHaveBeenCalledTimes(3);
    });

    it('should handle empty cache', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await service.invalidateLeaderboardCache();

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('invalidatePlayerRankCache', () => {
    it('should delete player rank cache', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.invalidatePlayerRankCache('player-123');

      expect(mockRedis.del).toHaveBeenCalledWith('player:player-123:rank');
    });
  });

  describe('updatePlayerRank', () => {
    it('should update player rank in database and invalidate cache', async () => {
      const entry = mockPrismaLeaderboardEntry({
        player_id: 'player-123',
        rank: 10,
        previous_rank: 15
      });

      mockPrisma.leaderboardEntry.update.mockResolvedValue(entry);
      mockRedis.del.mockResolvedValue(1);
      mockRedis.keys.mockResolvedValue([]);

      const result = await service.updatePlayerRank('player-123', 10);

      expect(result?.rank).toBe(10);
      expect(mockPrisma.leaderboardEntry.update).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('player:player-123:rank');
    });

    it('should calculate rank change', async () => {
      const entry = mockPrismaLeaderboardEntry({
        player_id: 'player-123',
        rank: 10,
        previous_rank: 15,
        rank_change: 5
      });

      mockPrisma.leaderboardEntry.findFirst.mockResolvedValue({
        ...entry,
        rank: 15
      });
      mockPrisma.leaderboardEntry.update.mockResolvedValue(entry);
      mockRedis.del.mockResolvedValue(1);
      mockRedis.keys.mockResolvedValue([]);

      const result = await service.updatePlayerRank('player-123', 10);

      expect(mockPrisma.leaderboardEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rank_change: 5
          })
        })
      );
    });

    it('should invalidate leaderboard cache after update', async () => {
      const entry = mockPrismaLeaderboardEntry();
      mockPrisma.leaderboardEntry.update.mockResolvedValue(entry);
      mockRedis.del.mockResolvedValue(1);
      mockRedis.keys.mockResolvedValue([
        'leaderboard:global:10',
        'leaderboard:global:50'
      ]);

      await service.updatePlayerRank('player-123', 10);

      expect(mockRedis.keys).toHaveBeenCalledWith('leaderboard:global:*');
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('recalculateRanks', () => {
    it('should recalculate all player ranks', async () => {
      const entries = createLeaderboardEntriesFactory(100);

      mockPrisma.leaderboardEntry.findMany.mockResolvedValue(entries);
      mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));
      mockPrisma.leaderboardEntry.update.mockResolvedValue({});
      mockRedis.keys.mockResolvedValue([]);

      await service.recalculateRanks();

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { is_active: true },
          orderBy: { elo_rating: 'desc' }
        })
      );

      expect(mockPrisma.leaderboardEntry.update).toHaveBeenCalledTimes(100);
    });

    it('should assign ranks based on ELO rating order', async () => {
      const entries = createLeaderboardEntriesFactory(5);

      mockPrisma.leaderboardEntry.findMany.mockResolvedValue(entries);
      mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));
      mockPrisma.leaderboardEntry.update.mockResolvedValue({});
      mockRedis.keys.mockResolvedValue([]);

      await service.recalculateRanks();

      // Verify first player gets rank 1
      expect(mockPrisma.leaderboardEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rank: 1
          })
        })
      );
    });

    it('should invalidate all caches after recalculation', async () => {
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));
      mockRedis.keys.mockResolvedValue([
        'leaderboard:global:10',
        'player:p1:rank',
        'player:p2:rank'
      ]);
      mockRedis.del.mockResolvedValue(1);

      await service.recalculateRanks();

      expect(mockRedis.keys).toHaveBeenCalledWith('leaderboard:*');
      expect(mockRedis.keys).toHaveBeenCalledWith('player:*:rank');
    });
  });

  // Performance tests
  describe('Performance', () => {
    it('should retrieve cached leaderboard in under 10ms', async () => {
      const entries = createLeaderboardEntriesFactory(100);
      mockRedis.get.mockResolvedValue(JSON.stringify(entries));

      const start = performance.now();
      await service.getGlobalLeaderboard(100);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it('should retrieve cached player rank in under 5ms', async () => {
      mockRedis.get.mockResolvedValue('42');

      const start = performance.now();
      await service.getPlayerRank('player-123');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5);
    });

    it('should handle large leaderboard efficiently', async () => {
      const entries = createLeaderboardEntriesFactory(1000);
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue(entries);
      mockRedis.setex.mockResolvedValue('OK');

      const start = performance.now();
      await service.getGlobalLeaderboard(1000);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(200);
    });
  });

  // Edge cases
  describe('Edge Cases', () => {
    it('should handle Redis connection failures gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);

      const result = await service.getGlobalLeaderboard(10);

      expect(result).toEqual([]);
      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalled();
    });

    it('should handle JSON parse errors', async () => {
      mockRedis.get.mockResolvedValue('invalid json');
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);

      const result = await service.getGlobalLeaderboard(10);

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalled();
    });

    it('should handle database query failures', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.findMany.mockRejectedValue(
        new Error('Database error')
      );

      const result = await service.getGlobalLeaderboard(10);

      expect(result).toEqual([]);
    });
  });
});
