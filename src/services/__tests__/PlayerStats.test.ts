/**
 * Unit tests for Player Statistics calculation functions
 * Tests cover all new statistics methods including streaks, scores, and ELO tracking
 */

import { PlayerService } from '../PlayerService';
import prisma from '../../lib/prisma';

// Mock Prisma client
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    player: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    matchResult: {
      findMany: jest.fn(),
    },
    leaderboardEntry: {
      upsert: jest.fn(),
    },
  },
}));

// Mock session manager
jest.mock('../../lib/sessionManager', () => ({
  sessionManager: {
    createSession: jest.fn(),
    getSession: jest.fn(),
    updateActivity: jest.fn(),
    isTokenBlacklisted: jest.fn().mockResolvedValue(false),
    blacklistToken: jest.fn(),
    deleteSession: jest.fn(),
    getUserSessions: jest.fn().mockResolvedValue([]),
    deleteUserSessions: jest.fn(),
  },
}));

describe('PlayerService - Statistics Calculations', () => {
  let playerService: PlayerService;
  const mockPlayerId = 'player-123';

  beforeEach(() => {
    playerService = new PlayerService();
    jest.clearAllMocks();
  });

  describe('calculateCurrentStreak', () => {
    it('should return 0 when player has no matches', async () => {
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue([]);

      const streak = await playerService.calculateCurrentStreak(mockPlayerId);

      expect(streak).toBe(0);
      expect(prisma.matchResult.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { winner_id: mockPlayerId },
            { loser_id: mockPlayerId }
          ]
        },
        include: {
          match: {
            select: {
              completed_at: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        },
        take: 100
      });
    });

    it('should calculate positive streak for consecutive wins', async () => {
      const mockMatches = [
        { winner_id: mockPlayerId, loser_id: 'other-1', result_type: 'WIN', match: { completed_at: new Date() } },
        { winner_id: mockPlayerId, loser_id: 'other-2', result_type: 'WIN', match: { completed_at: new Date() } },
        { winner_id: mockPlayerId, loser_id: 'other-3', result_type: 'WIN', match: { completed_at: new Date() } },
      ];
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue(mockMatches);

      const streak = await playerService.calculateCurrentStreak(mockPlayerId);

      expect(streak).toBe(3);
    });

    it('should calculate negative streak for consecutive losses', async () => {
      const mockMatches = [
        { winner_id: 'other-1', loser_id: mockPlayerId, result_type: 'LOSS', match: { completed_at: new Date() } },
        { winner_id: 'other-2', loser_id: mockPlayerId, result_type: 'LOSS', match: { completed_at: new Date() } },
      ];
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue(mockMatches);

      const streak = await playerService.calculateCurrentStreak(mockPlayerId);

      expect(streak).toBe(-2);
    });

    it('should stop counting when streak is broken', async () => {
      const mockMatches = [
        { winner_id: mockPlayerId, loser_id: 'other-1', result_type: 'WIN', match: { completed_at: new Date() } },
        { winner_id: mockPlayerId, loser_id: 'other-2', result_type: 'WIN', match: { completed_at: new Date() } },
        { winner_id: 'other-3', loser_id: mockPlayerId, result_type: 'LOSS', match: { completed_at: new Date() } }, // Streak breaks here
        { winner_id: mockPlayerId, loser_id: 'other-4', result_type: 'WIN', match: { completed_at: new Date() } },
      ];
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue(mockMatches);

      const streak = await playerService.calculateCurrentStreak(mockPlayerId);

      expect(streak).toBe(2); // Only counts the first 2 wins
    });

    it('should handle draws without breaking streak but not counting them', async () => {
      const mockMatches = [
        { winner_id: null, loser_id: null, result_type: 'DRAW', match: { completed_at: new Date() } },
        { winner_id: mockPlayerId, loser_id: 'other-1', result_type: 'WIN', match: { completed_at: new Date() } },
      ];
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue(mockMatches);

      const streak = await playerService.calculateCurrentStreak(mockPlayerId);

      expect(streak).toBe(0); // Draw at the start
    });
  });

  describe('calculateBestStreak', () => {
    it('should return 0 when player has no matches', async () => {
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue([]);

      const bestStreak = await playerService.calculateBestStreak(mockPlayerId);

      expect(bestStreak).toBe(0);
    });

    it('should find the longest winning streak', async () => {
      const mockMatches = [
        { winner_id: mockPlayerId, loser_id: 'other-1', result_type: 'WIN' },
        { winner_id: mockPlayerId, loser_id: 'other-2', result_type: 'WIN' },
        { winner_id: mockPlayerId, loser_id: 'other-3', result_type: 'WIN' },
        { winner_id: 'other-4', loser_id: mockPlayerId, result_type: 'LOSS' },
        { winner_id: mockPlayerId, loser_id: 'other-5', result_type: 'WIN' },
        { winner_id: mockPlayerId, loser_id: 'other-6', result_type: 'WIN' },
        { winner_id: mockPlayerId, loser_id: 'other-7', result_type: 'WIN' },
        { winner_id: mockPlayerId, loser_id: 'other-8', result_type: 'WIN' },
        { winner_id: mockPlayerId, loser_id: 'other-9', result_type: 'WIN' },
      ];
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue(mockMatches);

      const bestStreak = await playerService.calculateBestStreak(mockPlayerId);

      expect(bestStreak).toBe(5); // Best streak is the second winning streak (5 consecutive wins)
    });

    it('should handle a single match win', async () => {
      const mockMatches = [
        { winner_id: mockPlayerId, loser_id: 'other-1', result_type: 'WIN' },
      ];
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue(mockMatches);

      const bestStreak = await playerService.calculateBestStreak(mockPlayerId);

      expect(bestStreak).toBe(1);
    });

    it('should continue streak through draws (draws do not break streak)', async () => {
      const mockMatches = [
        { winner_id: mockPlayerId, loser_id: 'other-1', result_type: 'WIN' },
        { winner_id: mockPlayerId, loser_id: 'other-2', result_type: 'WIN' },
        { winner_id: null, loser_id: null, result_type: 'DRAW' },
        { winner_id: mockPlayerId, loser_id: 'other-3', result_type: 'WIN' },
      ];
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue(mockMatches);

      const bestStreak = await playerService.calculateBestStreak(mockPlayerId);

      expect(bestStreak).toBe(3); // Draws don't break streak, so all 3 wins count
    });
  });

  describe('calculateAverageScore', () => {
    it('should return 0 when player has no matches', async () => {
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue([]);

      const avgScore = await playerService.calculateAverageScore(mockPlayerId);

      expect(avgScore).toBe(0);
    });

    it('should calculate average score correctly as player1', async () => {
      const mockMatches = [
        { player1_score: 100, player2_score: 80, match: { player1_id: mockPlayerId, player2_id: 'other-1' } },
        { player1_score: 150, player2_score: 120, match: { player1_id: mockPlayerId, player2_id: 'other-2' } },
        { player1_score: 200, player2_score: 180, match: { player1_id: mockPlayerId, player2_id: 'other-3' } },
      ];
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue(mockMatches);

      const avgScore = await playerService.calculateAverageScore(mockPlayerId);

      expect(avgScore).toBe(150); // (100 + 150 + 200) / 3
    });

    it('should calculate average score correctly as player2', async () => {
      const mockMatches = [
        { player1_score: 80, player2_score: 100, match: { player1_id: 'other-1', player2_id: mockPlayerId } },
        { player1_score: 120, player2_score: 150, match: { player1_id: 'other-2', player2_id: mockPlayerId } },
      ];
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue(mockMatches);

      const avgScore = await playerService.calculateAverageScore(mockPlayerId);

      expect(avgScore).toBe(125); // (100 + 150) / 2
    });

    it('should handle single match', async () => {
      const mockMatches = [
        { player1_score: 100, player2_score: 80, match: { player1_id: mockPlayerId, player2_id: 'other-1' } },
      ];
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue(mockMatches);

      const avgScore = await playerService.calculateAverageScore(mockPlayerId);

      expect(avgScore).toBe(100);
    });
  });

  describe('calculateTotalScore', () => {
    it('should return 0 when player has no matches', async () => {
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue([]);

      const totalScore = await playerService.calculateTotalScore(mockPlayerId);

      expect(totalScore).toBe(0);
    });

    it('should sum all scores correctly', async () => {
      const mockMatches = [
        { player1_score: 100, player2_score: 80, match: { player1_id: mockPlayerId, player2_id: 'other-1' } },
        { player1_score: 120, player2_score: 150, match: { player1_id: 'other-2', player2_id: mockPlayerId } },
        { player1_score: 200, player2_score: 180, match: { player1_id: mockPlayerId, player2_id: 'other-3' } },
      ];
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue(mockMatches);

      const totalScore = await playerService.calculateTotalScore(mockPlayerId);

      expect(totalScore).toBe(450); // 100 + 150 + 200
    });

    it('should handle single match', async () => {
      const mockMatches = [
        { player1_score: 250, player2_score: 200, match: { player1_id: mockPlayerId, player2_id: 'other-1' } },
      ];
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue(mockMatches);

      const totalScore = await playerService.calculateTotalScore(mockPlayerId);

      expect(totalScore).toBe(250);
    });
  });

  describe('getPlayerStats - Integration', () => {
    it('should return complete stats with all calculated fields', async () => {
      const mockPlayer = {
        id: mockPlayerId,
        username: 'testplayer',
        email: 'test@example.com',
        elo_rating: 1500,
        rank: 10,
        matches_played: 10,
        wins: 6,
        losses: 3,
        draws: 1,
        peakElo: 1600,
        lowestElo: 1400,
      };

      (prisma.player.findUnique as jest.Mock).mockResolvedValue(mockPlayer);

      // Mock all statistics calculation methods
      const mockMatches = [
        { winner_id: mockPlayerId, loser_id: 'other-1', result_type: 'WIN', match: { completed_at: new Date() } },
        { winner_id: mockPlayerId, loser_id: 'other-2', result_type: 'WIN', match: { completed_at: new Date() } },
      ];
      (prisma.matchResult.findMany as jest.Mock).mockResolvedValue(mockMatches);

      const stats = await playerService.getPlayerStats(mockPlayerId);

      expect(stats).toBeTruthy();
      expect(stats?.playerId).toBe(mockPlayerId);
      expect(stats?.matchesPlayed).toBe(10);
      expect(stats?.wins).toBe(6);
      expect(stats?.losses).toBe(3);
      expect(stats?.draws).toBe(1);
      expect(stats?.winRate).toBe(60); // 6/10 * 100
      expect(stats?.eloRating).toBe(1500);
      expect(stats?.rank).toBe(10);
      expect(stats?.peakElo).toBe(1600);
      expect(stats?.lowestElo).toBe(1400);

      // Verify that calculation methods were called
      expect(prisma.matchResult.findMany).toHaveBeenCalled();
    });

    it('should return null when player does not exist', async () => {
      (prisma.player.findUnique as jest.Mock).mockResolvedValue(null);

      const stats = await playerService.getPlayerStats('non-existent-player');

      expect(stats).toBeNull();
    });
  });

  describe('updateEloRating - Peak/Lowest tracking', () => {
    it('should update peakElo when new rating is higher', async () => {
      const mockPlayer = {
        id: mockPlayerId,
        elo_rating: 1500,
        peakElo: 1500,
        lowestElo: 1200,
        matches_played: 5,
      };

      (prisma.player.findUnique as jest.Mock).mockResolvedValue(mockPlayer);
      (prisma.player.update as jest.Mock).mockResolvedValue({
        ...mockPlayer,
        elo_rating: 1600,
        peakElo: 1600,
        matches_played: 6,
      });
      (prisma.leaderboardEntry.upsert as jest.Mock).mockResolvedValue({});

      await playerService.updateEloRating(mockPlayerId, 1600, true);

      expect(prisma.player.update).toHaveBeenCalledWith({
        where: { id: mockPlayerId },
        data: expect.objectContaining({
          elo_rating: 1600,
          peakElo: 1600,
          matches_played: { increment: 1 },
          wins: { increment: 1 },
        })
      });
    });

    it('should update lowestElo when new rating is lower', async () => {
      const mockPlayer = {
        id: mockPlayerId,
        elo_rating: 1300,
        peakElo: 1500,
        lowestElo: 1200,
        matches_played: 5,
      };

      (prisma.player.findUnique as jest.Mock).mockResolvedValue(mockPlayer);
      (prisma.player.update as jest.Mock).mockResolvedValue({
        ...mockPlayer,
        elo_rating: 1100,
        lowestElo: 1100,
        matches_played: 6,
      });
      (prisma.leaderboardEntry.upsert as jest.Mock).mockResolvedValue({});

      await playerService.updateEloRating(mockPlayerId, 1100, false);

      expect(prisma.player.update).toHaveBeenCalledWith({
        where: { id: mockPlayerId },
        data: expect.objectContaining({
          elo_rating: 1100,
          lowestElo: 1100,
          matches_played: { increment: 1 },
          losses: { increment: 1 },
        })
      });
    });

    it('should not update peak/lowest when new rating is in between', async () => {
      const mockPlayer = {
        id: mockPlayerId,
        elo_rating: 1400,
        peakElo: 1600,
        lowestElo: 1200,
        matches_played: 5,
      };

      (prisma.player.findUnique as jest.Mock).mockResolvedValue(mockPlayer);
      (prisma.player.update as jest.Mock).mockResolvedValue({
        ...mockPlayer,
        elo_rating: 1450,
        matches_played: 6,
      });
      (prisma.leaderboardEntry.upsert as jest.Mock).mockResolvedValue({});

      await playerService.updateEloRating(mockPlayerId, 1450);

      expect(prisma.player.update).toHaveBeenCalledWith({
        where: { id: mockPlayerId },
        data: expect.objectContaining({
          elo_rating: 1450,
          matches_played: { increment: 1 },
        })
      });

      // Should not include peakElo or lowestElo updates
      const updateCall = (prisma.player.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.peakElo).toBeUndefined();
      expect(updateCall.data.lowestElo).toBeUndefined();
    });
  });
});
