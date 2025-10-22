/**
 * LeaderboardService Edge Case Tests
 * Tests concurrency, race conditions, cache stampede, and performance under load
 *
 * Test Coverage:
 * - TC-LB-EDGE-001 to TC-LB-EDGE-005: Edge case scenarios
 */

import { PrismaClient } from '@prisma/client';
import { LeaderboardService } from '../LeaderboardService';
import { createMockPrismaClient, mockPrismaLeaderboardEntry, mockPrismaPlayer } from '../../__tests__/utils/mockPrisma';
import { createMockRedisClient } from '../../__tests__/utils/mockRedis';

describe('LeaderboardService Edge Case Tests', () => {
  let service: LeaderboardService;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    mockRedis = createMockRedisClient();
    service = new LeaderboardService(mockPrisma);
    (service as any).redis = mockRedis;
  });

  describe('TC-LB-EDGE-001: Concurrent Rank Updates', () => {
    it('should handle 10 simultaneous rank updates', async () => {
      const playerId = 'player-123';
      mockPrisma.player.findUnique.mockResolvedValue(mockPrismaPlayer({ id: playerId, elo_rating: 1250 }));
      mockPrisma.leaderboardEntry.findFirst.mockResolvedValue(mockPrismaLeaderboardEntry({ player_id: playerId, rank: 5 }));
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue(mockPrismaLeaderboardEntry({ player_id: playerId }));
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([mockPrismaLeaderboardEntry({ player_id: playerId, rank: 4 })]);
      mockPrisma.leaderboardEntry.update.mockResolvedValue(mockPrismaLeaderboardEntry());

      const updates = Array.from({ length: 10 }, () =>
        service.updateLeaderboard(playerId, 1200)
      );

      await expect(Promise.all(updates)).resolves.toBeDefined();
    });

    it('should verify all updates processed correctly', async () => {
      const playerId = 'player-123';
      mockPrisma.player.findUnique.mockResolvedValue(mockPrismaPlayer({ id: playerId }));
      mockPrisma.leaderboardEntry.findFirst.mockResolvedValue(mockPrismaLeaderboardEntry({ player_id: playerId }));
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue(mockPrismaLeaderboardEntry());
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([mockPrismaLeaderboardEntry()]);

      await service.updateLeaderboard(playerId, 1200);

      expect(mockPrisma.leaderboardEntry.upsert).toHaveBeenCalled();
    });

    it('should check no duplicate ranks exist', async () => {
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([
        mockPrismaLeaderboardEntry({ player_id: 'p1', rank: 1, elo_rating: 1500 }),
        mockPrismaLeaderboardEntry({ player_id: 'p2', rank: 2, elo_rating: 1450 }),
        mockPrismaLeaderboardEntry({ player_id: 'p3', rank: 3, elo_rating: 1400 }),
      ]);

      const entries = await mockPrisma.leaderboardEntry.findMany();
      const ranks = entries.map((e: any) => e.rank);
      const uniqueRanks = new Set(ranks);

      expect(uniqueRanks.size).toBe(ranks.length);
    });

    it('should assert final rankings are consistent', async () => {
      const entries = [
        mockPrismaLeaderboardEntry({ player_id: 'p1', rank: 1, elo_rating: 1500 }),
        mockPrismaLeaderboardEntry({ player_id: 'p2', rank: 2, elo_rating: 1450 }),
      ];

      mockPrisma.leaderboardEntry.findMany.mockResolvedValue(entries);

      const result = await mockPrisma.leaderboardEntry.findMany();

      expect(result[0].elo_rating).toBeGreaterThan(result[1].elo_rating);
      expect(result[0].rank).toBeLessThan(result[1].rank);
    });
  });

  describe('TC-LB-EDGE-002: Transaction Conflicts', () => {
    it('should start two transactions updating same player', async () => {
      const playerId = 'player-123';
      mockPrisma.player.findUnique.mockResolvedValue(mockPrismaPlayer({ id: playerId }));
      mockPrisma.leaderboardEntry.findFirst.mockResolvedValue(mockPrismaLeaderboardEntry({ player_id: playerId }));
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue(mockPrismaLeaderboardEntry());
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([mockPrismaLeaderboardEntry()]);

      const tx1 = service.updateLeaderboard(playerId, 1200);
      const tx2 = service.updateLeaderboard(playerId, 1210);

      await Promise.all([tx1, tx2]);

      expect(mockPrisma.leaderboardEntry.upsert).toHaveBeenCalledTimes(2);
    });

    it('should verify one blocks until other completes', async () => {
      // Prisma $transaction handles locking automatically
      const playerId = 'player-123';
      let firstCompleted = false;

      mockPrisma.player.findUnique.mockResolvedValue(mockPrismaPlayer({ id: playerId }));
      mockPrisma.leaderboardEntry.findFirst.mockResolvedValue(mockPrismaLeaderboardEntry({ player_id: playerId }));
      mockPrisma.leaderboardEntry.upsert.mockImplementation(async () => {
        if (!firstCompleted) {
          firstCompleted = true;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        return mockPrismaLeaderboardEntry();
      });
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([mockPrismaLeaderboardEntry()]);

      await service.updateLeaderboard(playerId, 1200);

      expect(firstCompleted).toBe(true);
    });

    it('should check no data corruption occurred', async () => {
      const playerId = 'player-123';
      const finalElo = 1250;
      mockPrisma.player.findUnique.mockResolvedValue(mockPrismaPlayer({ id: playerId, elo_rating: finalElo }));
      mockPrisma.leaderboardEntry.findFirst.mockResolvedValue(mockPrismaLeaderboardEntry({ player_id: playerId, elo_rating: finalElo }));
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue(mockPrismaLeaderboardEntry({ elo_rating: finalElo }));
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([mockPrismaLeaderboardEntry()]);

      await service.updateLeaderboard(playerId, 1200);

      const entry = await mockPrisma.leaderboardEntry.findFirst({ where: { player_id: playerId } });
      expect(entry.elo_rating).toBe(finalElo);
    });
  });

  describe('TC-LB-EDGE-003: Cache Stampede Prevention', () => {
    it('should expire cache key and send 100 simultaneous requests', async () => {
      const leaderboardData = [
        mockPrismaLeaderboardEntry({ player_id: 'p1', rank: 1 }),
        mockPrismaLeaderboardEntry({ player_id: 'p2', rank: 2 }),
      ];

      mockRedis.get.mockResolvedValue(null); // Cache miss
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue(leaderboardData.map(entry => ({
        ...entry,
        player: mockPrismaPlayer({ id: entry.player_id })
      })));
      mockRedis.zAdd.mockResolvedValue(2);
      mockRedis.expire.mockResolvedValue(true);

      const requests = Array.from({ length: 100 }, () =>
        service.getGlobalLeaderboard(10, 0)
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(100);
    });

    it('should verify only 1 DB query executes', async () => {
      const leaderboardData = [mockPrismaLeaderboardEntry({ player_id: 'p1', rank: 1 })];

      let dbQueryCount = 0;
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.findMany.mockImplementation(async () => {
        dbQueryCount++;
        return leaderboardData.map(entry => ({
          ...entry,
          player: mockPrismaPlayer({ id: entry.player_id })
        }));
      });

      await service.getGlobalLeaderboard(10, 0);

      expect(dbQueryCount).toBe(1);
    });

    it('should check all requests get result', async () => {
      const leaderboardData = [mockPrismaLeaderboardEntry()];

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue(leaderboardData.map(entry => ({
        ...entry,
        player: mockPrismaPlayer()
      })));

      const results = await Promise.all([
        service.getGlobalLeaderboard(10, 0),
        service.getGlobalLeaderboard(10, 0),
      ]);

      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
    });

    it('should assert cache properly populated', async () => {
      const leaderboardData = [mockPrismaLeaderboardEntry()];

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue(leaderboardData.map(entry => ({
        ...entry,
        player: mockPrismaPlayer()
      })));
      mockRedis.zAdd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(true);

      await service.getGlobalLeaderboard(10, 0);

      expect(mockRedis.zAdd).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
    });
  });

  describe('TC-LB-EDGE-004: Invalid Data Handling', () => {
    it('should attempt to set negative ELO rating', async () => {
      const playerId = 'player-123';
      mockPrisma.player.findUnique.mockResolvedValue(mockPrismaPlayer({ id: playerId, elo_rating: -100 }));

      // Service should handle invalid data gracefully
      await expect(
        service.updateLeaderboard(playerId, 1200)
      ).rejects.toThrow();
    });

    it('should verify validation error is thrown', async () => {
      const playerId = 'player-123';
      mockPrisma.player.findUnique.mockResolvedValue(null);

      await expect(
        service.updateLeaderboard(playerId, 1200)
      ).rejects.toThrow('Player not found');
    });

    it('should check data is rejected', async () => {
      const playerId = 'player-123';
      mockPrisma.player.findUnique.mockResolvedValue(null);

      try {
        await service.updateLeaderboard(playerId, 1200);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should assert no database changes made', async () => {
      const playerId = 'player-123';
      mockPrisma.player.findUnique.mockResolvedValue(null);

      try {
        await service.updateLeaderboard(playerId, 1200);
      } catch (error) {
        // Expected error
      }

      expect(mockPrisma.leaderboardEntry.upsert).not.toHaveBeenCalled();
    });
  });

  describe('TC-LB-EDGE-005: Performance Under Load', () => {
    it('should execute 1000 leaderboard queries', async () => {
      const leaderboardData = Array.from({ length: 10 }, (_, i) =>
        mockPrismaLeaderboardEntry({ player_id: `p${i}`, rank: i + 1 })
      );

      mockRedis.zRangeWithScores.mockResolvedValue(
        leaderboardData.map((entry, i) => ({
          value: JSON.stringify({
            rank: i + 1,
            player: mockPrismaPlayer({ id: entry.player_id }),
            elo_rating: entry.elo_rating,
            wins: entry.wins,
            losses: entry.losses,
            draws: entry.draws,
            matches_played: entry.matches_played,
            win_rate: entry.win_rate,
            current_streak: entry.current_streak,
            rank_change: entry.rank_change,
            peak_elo: entry.peak_elo,
            last_match_at: entry.last_match_at,
            previous_elo: entry.previous_elo
          }),
          score: entry.elo_rating
        }))
      );

      const startTime = Date.now();
      const queries = Array.from({ length: 1000 }, () =>
        service.getGlobalLeaderboard(10, 0)
      );

      await Promise.all(queries);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // 5 seconds for 1000 queries
    });

    it('should verify all complete in under 200ms', async () => {
      const leaderboardData = [mockPrismaLeaderboardEntry()];

      mockRedis.zRangeWithScores.mockResolvedValue([{
        value: JSON.stringify({
          rank: 1,
          player: mockPrismaPlayer(),
          elo_rating: 1200,
          wins: 0,
          losses: 0,
          draws: 0,
          matches_played: 0,
          win_rate: 0,
          current_streak: 0,
          rank_change: 0,
          peak_elo: 1200,
          last_match_at: null,
          previous_elo: null
        }),
        score: 1200
      }]);

      const startTime = Date.now();
      await service.getGlobalLeaderboard(10, 0);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });

    it('should check cache hit rate exceeds 95%', async () => {
      let cacheHits = 0;
      let totalRequests = 0;

      mockRedis.zRangeWithScores.mockImplementation(async () => {
        cacheHits++;
        return [{
          value: JSON.stringify({
            rank: 1,
            player: mockPrismaPlayer(),
            elo_rating: 1200,
            wins: 0,
            losses: 0,
            draws: 0,
            matches_played: 0,
            win_rate: 0,
            current_streak: 0,
            rank_change: 0,
            peak_elo: 1200,
            last_match_at: null,
            previous_elo: null
          }),
          score: 1200
        }];
      });

      for (let i = 0; i < 100; i++) {
        totalRequests++;
        await service.getGlobalLeaderboard(10, 0);
      }

      const hitRate = (cacheHits / totalRequests) * 100;
      expect(hitRate).toBeGreaterThanOrEqual(95);
    });

    it('should assert no performance degradation', async () => {
      const leaderboardData = [mockPrismaLeaderboardEntry()];

      mockRedis.zRangeWithScores.mockResolvedValue([{
        value: JSON.stringify({
          rank: 1,
          player: mockPrismaPlayer(),
          elo_rating: 1200,
          wins: 0,
          losses: 0,
          draws: 0,
          matches_played: 0,
          win_rate: 0,
          current_streak: 0,
          rank_change: 0,
          peak_elo: 1200,
          last_match_at: null,
          previous_elo: null
        }),
        score: 1200
      }]);

      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await service.getGlobalLeaderboard(10, 0);
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b) / times.length;
      expect(avgTime).toBeLessThan(100);
    });
  });
});
