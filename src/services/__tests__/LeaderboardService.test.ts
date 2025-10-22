/**
 * LeaderboardService Unit Tests
 *
 * Test Coverage:
 * - Ranking calculations and tiebreakers
 * - Redis caching and invalidation
 * - Multi-scope leaderboards (global, country, session)
 * - Pagination and limits
 * - Player rank lookups
 * - Trending players algorithm
 * - Statistics calculations
 * - Error handling and fallbacks
 *
 * Target: 90%+ coverage
 */

import { PrismaClient, LeaderboardType, Player, LeaderboardEntry } from '@prisma/client';
import { LeaderboardService, LeaderboardScope } from '../LeaderboardService';
import { createClient } from 'redis';

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

// Mock Prisma Client
const mockPrisma = {
  player: {
    findUnique: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
  leaderboardEntry: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  match: {
    count: jest.fn(),
  },
  $transaction: jest.fn(),
} as unknown as PrismaClient;

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  quit: jest.fn(),
  ping: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  zAdd: jest.fn(),
  zRange: jest.fn(),
  zRangeWithScores: jest.fn(),
  publish: jest.fn(),
  multi: jest.fn(),
  on: jest.fn(),
};

// Mock multi for Redis transactions
const mockMulti = {
  zAdd: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([]),
};

describe('LeaderboardService', () => {
  let service: LeaderboardService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Redis mock
    (createClient as jest.Mock).mockReturnValue(mockRedisClient);
    mockRedisClient.connect.mockResolvedValue(undefined);
    mockRedisClient.ping.mockResolvedValue('PONG');
    mockRedisClient.multi.mockReturnValue(mockMulti);

    service = new LeaderboardService(mockPrisma);
  });

  describe('getGlobalLeaderboard', () => {
    const mockLeaderboardEntries = [
      {
        id: '1',
        player_id: 'player1',
        rank: 1,
        elo_rating: 2000,
        previous_elo: 1950,
        wins: 50,
        losses: 10,
        draws: 5,
        matches_played: 65,
        win_rate: 76.92,
        current_streak: 5,
        rank_change: 2,
        peak_elo: 2050,
        lowest_elo: 1200,
        last_match_at: new Date('2025-10-21'),
        leaderboard_type: LeaderboardType.GLOBAL,
        is_active: true,
        season_id: null,
        last_updated: new Date(),
        created_at: new Date(),
        previous_rank: 3,
        best_win_streak: 8,
        player: {
          id: 'player1',
          username: 'topplayer',
          avatar_url: 'https://example.com/avatar1.jpg',
          country_code: 'US',
        },
      },
      {
        id: '2',
        player_id: 'player2',
        rank: 2,
        elo_rating: 1900,
        previous_elo: 1880,
        wins: 45,
        losses: 15,
        draws: 3,
        matches_played: 63,
        win_rate: 71.43,
        current_streak: 3,
        rank_change: 0,
        peak_elo: 1920,
        lowest_elo: 1200,
        last_match_at: new Date('2025-10-21'),
        leaderboard_type: LeaderboardType.GLOBAL,
        is_active: true,
        season_id: null,
        last_updated: new Date(),
        created_at: new Date(),
        previous_rank: 2,
        best_win_streak: 6,
        player: {
          id: 'player2',
          username: 'challenger',
          avatar_url: 'https://example.com/avatar2.jpg',
          country_code: 'UK',
        },
      },
    ];

    it('should return cached global leaderboard if available', async () => {
      const cachedData = JSON.stringify(mockLeaderboardEntries[0]);
      mockRedisClient.zRangeWithScores.mockResolvedValue([
        { score: 2000, value: cachedData },
      ]);

      const result = await service.getGlobalLeaderboard(10, 0);

      expect(result).toHaveLength(1);
      expect(result[0].rank).toBe(1);
      expect(result[0].player.username).toBe('topplayer');
      expect(mockRedisClient.zRangeWithScores).toHaveBeenCalledWith(
        'leaderboard:global',
        0,
        9,
        { REV: true }
      );
    });

    it('should fetch from database if cache misses', async () => {
      mockRedisClient.zRangeWithScores.mockResolvedValue([]);
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue(
        mockLeaderboardEntries
      );

      const result = await service.getGlobalLeaderboard(10, 0);

      expect(result).toHaveLength(2);
      expect(result[0].elo_rating).toBe(2000);
      expect(result[1].elo_rating).toBe(1900);
      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            leaderboard_type: LeaderboardType.GLOBAL,
            is_active: true,
          }),
          take: 10,
          skip: 0,
        })
      );
    });

    it('should handle pagination correctly', async () => {
      mockRedisClient.zRangeWithScores.mockResolvedValue([]);
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue([
        mockLeaderboardEntries[1],
      ]);

      await service.getGlobalLeaderboard(10, 10);

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 10,
        })
      );
    });

    it('should cache database results after fetch', async () => {
      mockRedisClient.zRangeWithScores.mockResolvedValue([]);
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue(
        mockLeaderboardEntries
      );

      await service.getGlobalLeaderboard(10, 0);

      expect(mockMulti.zAdd).toHaveBeenCalledTimes(2);
      expect(mockMulti.expire).toHaveBeenCalledWith('leaderboard:global', 300);
      expect(mockMulti.exec).toHaveBeenCalled();
    });

    it('should handle cache read failures gracefully', async () => {
      mockRedisClient.zRangeWithScores.mockRejectedValue(new Error('Redis error'));
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue(
        mockLeaderboardEntries
      );

      const result = await service.getGlobalLeaderboard(10, 0);

      expect(result).toHaveLength(2);
      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalled();
    });
  });

  describe('getCountryLeaderboard', () => {
    it('should filter by country code', async () => {
      mockRedisClient.zRangeWithScores.mockResolvedValue([]);
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue([]);

      await service.getCountryLeaderboard('US', 10, 0);

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            leaderboard_type: LeaderboardType.REGIONAL,
            player: { country_code: 'US' },
          }),
        })
      );
    });

    it('should use country-specific cache key', async () => {
      mockRedisClient.zRangeWithScores.mockResolvedValue([]);
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue([]);

      await service.getCountryLeaderboard('UK', 10, 0);

      expect(mockRedisClient.zRangeWithScores).toHaveBeenCalledWith(
        'leaderboard:country:UK',
        0,
        9,
        { REV: true }
      );
    });
  });

  describe('getSessionLeaderboard', () => {
    it('should filter by session ID', async () => {
      mockRedisClient.zRangeWithScores.mockResolvedValue([]);
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue([]);

      await service.getSessionLeaderboard('season-2025-winter', 10, 0);

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            leaderboard_type: LeaderboardType.SEASONAL,
            season_id: 'season-2025-winter',
          }),
        })
      );
    });

    it('should use session-specific cache key', async () => {
      mockRedisClient.zRangeWithScores.mockResolvedValue([]);
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue([]);

      await service.getSessionLeaderboard('tournament-123', 10, 0);

      expect(mockRedisClient.zRangeWithScores).toHaveBeenCalledWith(
        'leaderboard:session:tournament-123',
        0,
        9,
        { REV: true }
      );
    });
  });

  describe('getPlayerRank', () => {
    const mockPlayerEntry = {
      id: 'entry1',
      player_id: 'player1',
      rank: 5,
      elo_rating: 1800,
      wins: 40,
      losses: 20,
      matches_played: 60,
      win_rate: 66.67,
      leaderboard_type: LeaderboardType.GLOBAL,
      is_active: true,
      player: {
        elo_rating: 1800,
        wins: 40,
        losses: 20,
        matches_played: 60,
      },
    };

    it('should return player rank info for global scope', async () => {
      (mockPrisma.leaderboardEntry.findFirst as jest.Mock).mockResolvedValue(
        mockPlayerEntry
      );
      (mockPrisma.leaderboardEntry.count as jest.Mock).mockResolvedValue(100);

      const result = await service.getPlayerRank('player1', 'global');

      expect(result).toEqual({
        player_id: 'player1',
        rank: 5,
        total_players: 100,
        percentile: 95,
        elo_rating: 1800,
        wins: 40,
        losses: 20,
        win_rate: 66.67,
      });
    });

    it('should return null if player not found', async () => {
      (mockPrisma.leaderboardEntry.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getPlayerRank('nonexistent', 'global');

      expect(result).toBeNull();
    });

    it('should calculate percentile correctly', async () => {
      (mockPrisma.leaderboardEntry.findFirst as jest.Mock).mockResolvedValue({
        ...mockPlayerEntry,
        rank: 1,
      });
      (mockPrisma.leaderboardEntry.count as jest.Mock).mockResolvedValue(50);

      const result = await service.getPlayerRank('player1', 'global');

      expect(result?.percentile).toBe(98);
    });

    it('should handle country scope correctly', async () => {
      (mockPrisma.leaderboardEntry.findFirst as jest.Mock).mockResolvedValue(
        mockPlayerEntry
      );
      (mockPrisma.leaderboardEntry.count as jest.Mock).mockResolvedValue(50);

      await service.getPlayerRank('player1', 'country', 'US');

      expect(mockPrisma.leaderboardEntry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            leaderboard_type: LeaderboardType.REGIONAL,
            player: { country_code: 'US' },
          }),
        })
      );
    });
  });

  describe('updateLeaderboard', () => {
    const mockPlayer = {
      id: 'player1',
      elo_rating: 1850,
      wins: 45,
      losses: 15,
      draws: 3,
      matches_played: 63,
      country_code: 'US',
      created_at: new Date('2024-01-01'),
    };

    it('should update leaderboard entry after ELO change', async () => {
      (mockPrisma.player.findUnique as jest.Mock).mockResolvedValue(mockPlayer);
      (mockPrisma.leaderboardEntry.upsert as jest.Mock).mockResolvedValue({});
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([]);
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.publish.mockResolvedValue(1);

      await service.updateLeaderboard('player1');

      expect(mockPrisma.leaderboardEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            unique_leaderboard_entry: expect.objectContaining({
              player_id: 'player1',
              leaderboard_type: LeaderboardType.GLOBAL,
            }),
          }),
          update: expect.objectContaining({
            elo_rating: 1850,
            wins: 45,
            losses: 15,
            draws: 3,
            matches_played: 63,
          }),
        })
      );
    });

    it('should invalidate global and country caches', async () => {
      (mockPrisma.player.findUnique as jest.Mock).mockResolvedValue(mockPlayer);
      (mockPrisma.leaderboardEntry.upsert as jest.Mock).mockResolvedValue({});
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([]);
      mockRedisClient.del.mockResolvedValue(1);

      await service.updateLeaderboard('player1');

      expect(mockRedisClient.del).toHaveBeenCalledWith('leaderboard:global');
      expect(mockRedisClient.del).toHaveBeenCalledWith('leaderboard:country:US');
    });

    it('should publish update event', async () => {
      (mockPrisma.player.findUnique as jest.Mock).mockResolvedValue(mockPlayer);
      (mockPrisma.leaderboardEntry.upsert as jest.Mock).mockResolvedValue({});
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([]);
      mockRedisClient.publish.mockResolvedValue(1);

      await service.updateLeaderboard('player1');

      expect(mockRedisClient.publish).toHaveBeenCalledWith(
        'leaderboard:updates',
        expect.stringContaining('player1')
      );
    });

    it('should throw error if player not found', async () => {
      (mockPrisma.player.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.updateLeaderboard('nonexistent')).rejects.toThrow(
        'Player not found: nonexistent'
      );
    });
  });

  describe('invalidateCache', () => {
    it('should delete cache key for global scope', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await service.invalidateCache('global');

      expect(mockRedisClient.del).toHaveBeenCalledWith('leaderboard:global');
    });

    it('should delete cache key for country scope', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await service.invalidateCache('country', 'FR');

      expect(mockRedisClient.del).toHaveBeenCalledWith('leaderboard:country:FR');
    });

    it('should delete cache key for session scope', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await service.invalidateCache('session', 'season-2025');

      expect(mockRedisClient.del).toHaveBeenCalledWith('leaderboard:session:season-2025');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      await expect(service.invalidateCache('global')).resolves.not.toThrow();
    });
  });

  describe('getLeaderboardStats', () => {
    const mockStats = {
      total_players: 1000,
      active_players: 850,
      average_elo: 1450,
      median_elo: 1420,
      highest_elo: 2500,
      total_matches: 50000,
      matches_today: 125,
    };

    it('should return cached stats if available', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockStats));

      const result = await service.getLeaderboardStats();

      expect(result).toEqual(mockStats);
      expect(mockRedisClient.get).toHaveBeenCalledWith('leaderboard:stats');
    });

    it('should calculate stats from database if cache misses', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      (mockPrisma.player.count as jest.Mock)
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(850)
        .mockResolvedValueOnce(500);
      (mockPrisma.player.aggregate as jest.Mock).mockResolvedValue({
        _avg: { elo_rating: 1450 },
        _max: { elo_rating: 2500 },
        _sum: { matches_played: 50000 },
      });
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue([
        { elo_rating: 1420 },
      ]);
      (mockPrisma.match.count as jest.Mock).mockResolvedValue(125);

      const result = await service.getLeaderboardStats();

      expect(result.total_players).toBe(1000);
      expect(result.active_players).toBe(850);
      expect(result.average_elo).toBe(1450);
      expect(result.median_elo).toBe(1420);
    });

    it('should cache stats after calculation', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      (mockPrisma.player.count as jest.Mock)
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(850)
        .mockResolvedValueOnce(500);
      (mockPrisma.player.aggregate as jest.Mock).mockResolvedValue({
        _avg: { elo_rating: 1450 },
        _max: { elo_rating: 2500 },
        _sum: { matches_played: 50000 },
      });
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue([
        { elo_rating: 1420 },
      ]);
      (mockPrisma.match.count as jest.Mock).mockResolvedValue(125);

      await service.getLeaderboardStats();

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'leaderboard:stats',
        300,
        expect.any(String)
      );
    });
  });

  describe('getTrendingPlayers', () => {
    const mockTrendingEntries = [
      {
        rank: 5,
        elo_rating: 1850,
        previous_elo: 1700,
        rank_change: 10,
        wins: 15,
        player: {
          id: 'trending1',
          username: 'rising_star',
          avatar_url: 'https://example.com/trending1.jpg',
        },
      },
    ];

    it('should return cached trending players if available', async () => {
      const cached = [
        {
          player_id: 'trending1',
          username: 'rising_star',
          avatar_url: 'https://example.com/trending1.jpg',
          elo_rating: 1850,
          elo_gain_24h: 150,
          rank: 5,
          rank_change: 10,
          wins_24h: 15,
        },
      ];
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getTrendingPlayers(10);

      expect(result).toEqual(cached);
      expect(mockRedisClient.get).toHaveBeenCalledWith('leaderboard:trending');
    });

    it('should calculate trending players from database if cache misses', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue(
        mockTrendingEntries
      );

      const result = await service.getTrendingPlayers(10);

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('rising_star');
      expect(result[0].elo_gain_24h).toBe(150);
      expect(result[0].rank_change).toBe(10);
    });

    it('should filter by last 24 hours activity', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue([]);

      await service.getTrendingPlayers(10);

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            last_match_at: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        })
      );
    });
  });

  describe('warmCache', () => {
    it('should warm global leaderboard, stats, and trending on startup', async () => {
      mockRedisClient.zRangeWithScores.mockResolvedValue([]);
      mockRedisClient.get.mockResolvedValue(null);
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.player.count as jest.Mock).mockResolvedValue(1000);
      (mockPrisma.player.aggregate as jest.Mock).mockResolvedValue({
        _avg: { elo_rating: 1450 },
        _max: { elo_rating: 2500 },
        _sum: { matches_played: 50000 },
      });
      (mockPrisma.player.findMany as jest.Mock).mockResolvedValue([
        { elo_rating: 1420 },
      ]);
      (mockPrisma.match.count as jest.Mock).mockResolvedValue(125);

      await service.warmCache();

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalled();
    });

    it('should handle cache warming errors gracefully', async () => {
      mockRedisClient.zRangeWithScores.mockRejectedValue(new Error('Redis error'));

      await expect(service.warmCache()).resolves.not.toThrow();
    });
  });

  describe('Ranking Algorithm', () => {
    it('should order by ELO rating first', async () => {
      mockRedisClient.zRangeWithScores.mockResolvedValue([]);
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue([]);

      await service.getGlobalLeaderboard(10, 0);

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.arrayContaining([
            { elo_rating: 'desc' },
          ]),
        })
      );
    });

    it('should use wins as tiebreaker', async () => {
      mockRedisClient.zRangeWithScores.mockResolvedValue([]);
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue([]);

      await service.getGlobalLeaderboard(10, 0);

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.arrayContaining([
            { elo_rating: 'desc' },
            { wins: 'desc' },
          ]),
        })
      );
    });

    it('should use account age as final tiebreaker', async () => {
      mockRedisClient.zRangeWithScores.mockResolvedValue([]);
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue([]);

      await service.getGlobalLeaderboard(10, 0);

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.arrayContaining([
            { elo_rating: 'desc' },
            { wins: 'desc' },
            { player: { created_at: 'asc' } },
          ]),
        })
      );
    });
  });
});
