import { MatchService, CreateMatchInput, SubmitMatchResultInput } from '../MatchService';
import { PrismaClient, MatchStatus, MatchType, ResultType, VerificationStatus } from '@prisma/client';
import { ELOCalculator } from '../../lib/elo';

// Mock Redis before importing MatchService
jest.mock('../../lib/redis', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockResolvedValue({
      get: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    }),
  },
  CacheKeys: {},
  CacheTTL: {},
}));

// Mock Prisma Client
const mockPrismaClient = {
  player: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  match: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  matchResult: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  leaderboardEntry: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
  $disconnect: jest.fn(),
} as unknown as PrismaClient;

describe('MatchService', () => {
  let matchService: MatchService;

  beforeEach(() => {
    jest.clearAllMocks();
    matchService = new MatchService(mockPrismaClient, false); // Disable caching for tests
  });

  afterEach(async () => {
    await matchService.disconnect();
  });

  describe('createMatch', () => {
    const player1 = {
      id: 'player1',
      username: 'alice',
      email: 'alice@test.com',
      elo_rating: 1500,
      matches_played: 10,
    };

    const player2 = {
      id: 'player2',
      username: 'bob',
      email: 'bob@test.com',
      elo_rating: 1600,
      matches_played: 15,
    };

    it('should create a new ranked match successfully', async () => {
      const input: CreateMatchInput = {
        player1Id: 'player1',
        player2Id: 'player2',
        matchType: MatchType.RANKED,
      };

      (mockPrismaClient.player.findUnique as jest.Mock)
        .mockResolvedValueOnce(player1)
        .mockResolvedValueOnce(player2);

      const createdMatch = {
        id: 'match1',
        player1_id: 'player1',
        player2_id: 'player2',
        match_type: MatchType.RANKED,
        status: MatchStatus.IN_PROGRESS,
        best_of: 1,
        started_at: new Date(),
        player1: {
          id: player1.id,
          username: player1.username,
          elo_rating: player1.elo_rating,
        },
        player2: {
          id: player2.id,
          username: player2.username,
          elo_rating: player2.elo_rating,
        },
        result: null,
      };

      (mockPrismaClient.match.create as jest.Mock).mockResolvedValue(createdMatch);

      const result = await matchService.createMatch(input);

      expect(result).toEqual(createdMatch);
      expect(mockPrismaClient.player.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrismaClient.match.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            player1_id: 'player1',
            player2_id: 'player2',
            match_type: MatchType.RANKED,
            status: MatchStatus.IN_PROGRESS,
          }),
        })
      );
    });

    it('should create a scheduled match with scheduled_at date', async () => {
      const scheduledDate = new Date('2025-11-01T15:00:00Z');
      const input: CreateMatchInput = {
        player1Id: 'player1',
        player2Id: 'player2',
        scheduledAt: scheduledDate,
      };

      (mockPrismaClient.player.findUnique as jest.Mock)
        .mockResolvedValueOnce(player1)
        .mockResolvedValueOnce(player2);

      const createdMatch = {
        id: 'match2',
        status: MatchStatus.SCHEDULED,
        scheduled_at: scheduledDate,
        started_at: null,
      };

      (mockPrismaClient.match.create as jest.Mock).mockResolvedValue(createdMatch);

      const result = await matchService.createMatch(input);

      expect(result.status).toBe(MatchStatus.SCHEDULED);
      expect(mockPrismaClient.match.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: MatchStatus.SCHEDULED,
            scheduled_at: scheduledDate,
          }),
        })
      );
    });

    it('should throw error if player1 not found', async () => {
      const input: CreateMatchInput = {
        player1Id: 'nonexistent',
        player2Id: 'player2',
      };

      (mockPrismaClient.player.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(player2);

      await expect(matchService.createMatch(input)).rejects.toThrow('One or both players not found');
    });

    it('should throw error if player2 not found', async () => {
      const input: CreateMatchInput = {
        player1Id: 'player1',
        player2Id: 'nonexistent',
      };

      (mockPrismaClient.player.findUnique as jest.Mock)
        .mockResolvedValueOnce(player1)
        .mockResolvedValueOnce(null);

      await expect(matchService.createMatch(input)).rejects.toThrow('One or both players not found');
    });

    it('should throw error if player tries to play against themselves', async () => {
      const input: CreateMatchInput = {
        player1Id: 'player1',
        player2Id: 'player1',
      };

      (mockPrismaClient.player.findUnique as jest.Mock)
        .mockResolvedValueOnce(player1)
        .mockResolvedValueOnce(player1);

      await expect(matchService.createMatch(input)).rejects.toThrow(
        'A player cannot play against themselves'
      );
    });

    it('should create tournament match with tournament metadata', async () => {
      const input: CreateMatchInput = {
        player1Id: 'player1',
        player2Id: 'player2',
        matchType: MatchType.TOURNAMENT,
        tournamentId: 'tournament1',
        roundNumber: 2,
        bestOf: 3,
      };

      (mockPrismaClient.player.findUnique as jest.Mock)
        .mockResolvedValueOnce(player1)
        .mockResolvedValueOnce(player2);

      (mockPrismaClient.match.create as jest.Mock).mockResolvedValue({
        id: 'match3',
        tournament_id: 'tournament1',
        round_number: 2,
        best_of: 3,
      });

      await matchService.createMatch(input);

      expect(mockPrismaClient.match.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tournament_id: 'tournament1',
            round_number: 2,
            best_of: 3,
          }),
        })
      );
    });
  });

  describe('submitMatchResult and ELO Calculations', () => {
    const player1 = {
      id: 'player1',
      username: 'alice',
      elo_rating: 1500,
      matches_played: 25, // Established player
    };

    const player2 = {
      id: 'player2',
      username: 'bob',
      elo_rating: 1600,
      matches_played: 35, // Established player
    };

    const match = {
      id: 'match1',
      player1_id: 'player1',
      player2_id: 'player2',
      status: MatchStatus.IN_PROGRESS,
      player1,
      player2,
      result: null,
    };

    beforeEach(() => {
      // Mock the transaction to execute the callback
      (mockPrismaClient.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(mockPrismaClient);
      });
    });

    it('should calculate ELO correctly when player1 wins (lower rated beats higher rated)', async () => {
      const input: SubmitMatchResultInput = {
        matchId: 'match1',
        player1Score: 2,
        player2Score: 1,
      };

      (mockPrismaClient.match.findUnique as jest.Mock).mockResolvedValue(match);

      const expectedEloResult = ELOCalculator.calculateNewRatings(
        player1.elo_rating,
        player2.elo_rating,
        player1.matches_played,
        player2.matches_played,
        false
      );

      const matchResult = {
        id: 'result1',
        match_id: 'match1',
        winner_id: 'player1',
        loser_id: 'player2',
        result_type: ResultType.WIN,
        player1_score: 2,
        player2_score: 1,
        rating_change: expectedEloResult.ratingChange,
        winner_new_elo: expectedEloResult.winnerNewElo,
        loser_new_elo: expectedEloResult.loserNewElo,
        k_factor: 32,
        verification_status: VerificationStatus.PENDING,
      };

      (mockPrismaClient.matchResult.create as jest.Mock).mockResolvedValue(matchResult);
      (mockPrismaClient.player.update as jest.Mock).mockResolvedValue({});
      (mockPrismaClient.match.update as jest.Mock).mockResolvedValue({});

      const result = await matchService.submitMatchResult(input);

      expect(result).toEqual(matchResult);
      expect(result.winner_new_elo).toBe(expectedEloResult.winnerNewElo);
      expect(result.loser_new_elo).toBe(expectedEloResult.loserNewElo);
      expect(result.rating_change).toBe(expectedEloResult.ratingChange);

      // Verify player1 (winner) stats were updated
      expect(mockPrismaClient.player.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'player1' },
          data: expect.objectContaining({
            elo_rating: expectedEloResult.winnerNewElo,
            matches_played: { increment: 1 },
            wins: { increment: 1 },
          }),
        })
      );

      // Verify player2 (loser) stats were updated
      expect(mockPrismaClient.player.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'player2' },
          data: expect.objectContaining({
            elo_rating: expectedEloResult.loserNewElo,
            matches_played: { increment: 1 },
            losses: { increment: 1 },
          }),
        })
      );
    });

    it('should calculate ELO correctly when player2 wins (higher rated beats lower rated)', async () => {
      const input: SubmitMatchResultInput = {
        matchId: 'match1',
        player1Score: 0,
        player2Score: 3,
      };

      (mockPrismaClient.match.findUnique as jest.Mock).mockResolvedValue(match);

      // Player2 is winner, player1 is loser
      const expectedEloResult = ELOCalculator.calculateNewRatings(
        player2.elo_rating,
        player1.elo_rating,
        player2.matches_played,
        player1.matches_played,
        false
      );

      const matchResult = {
        id: 'result2',
        winner_id: 'player2',
        loser_id: 'player1',
        winner_new_elo: expectedEloResult.winnerNewElo,
        loser_new_elo: expectedEloResult.loserNewElo,
        rating_change: expectedEloResult.ratingChange,
      };

      (mockPrismaClient.matchResult.create as jest.Mock).mockResolvedValue(matchResult);
      (mockPrismaClient.player.update as jest.Mock).mockResolvedValue({});
      (mockPrismaClient.match.update as jest.Mock).mockResolvedValue({});

      const result = await matchService.submitMatchResult(input);

      expect(result.winner_new_elo).toBe(expectedEloResult.winnerNewElo);
      expect(result.loser_new_elo).toBe(expectedEloResult.loserNewElo);
    });

    it('should handle draw correctly with equal rating changes', async () => {
      const input: SubmitMatchResultInput = {
        matchId: 'match1',
        player1Score: 1,
        player2Score: 1,
      };

      (mockPrismaClient.match.findUnique as jest.Mock).mockResolvedValue(match);

      const expectedEloResult = ELOCalculator.calculateNewRatings(
        player1.elo_rating,
        player2.elo_rating,
        player1.matches_played,
        player2.matches_played,
        true // isDraw
      );

      const matchResult = {
        id: 'result3',
        winner_id: null,
        loser_id: null,
        result_type: ResultType.DRAW,
        player1_score: 1,
        player2_score: 1,
        rating_change: expectedEloResult.ratingChange,
      };

      (mockPrismaClient.matchResult.create as jest.Mock).mockResolvedValue(matchResult);
      (mockPrismaClient.player.update as jest.Mock).mockResolvedValue({});
      (mockPrismaClient.match.update as jest.Mock).mockResolvedValue({});

      const result = await matchService.submitMatchResult(input);

      expect(result.winner_id).toBeNull();
      expect(result.loser_id).toBeNull();
      expect(result.result_type).toBe(ResultType.DRAW);

      // Both players should have draws incremented
      expect(mockPrismaClient.player.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'player1' },
          data: expect.objectContaining({
            draws: { increment: 1 },
          }),
        })
      );

      expect(mockPrismaClient.player.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'player2' },
          data: expect.objectContaining({
            draws: { increment: 1 },
          }),
        })
      );
    });

    it('should apply different K-factors for new players (<30 games)', async () => {
      const newPlayer1 = { ...player1, matches_played: 10 }; // K-factor = 40
      const newPlayer2 = { ...player2, matches_played: 15 }; // K-factor = 40

      const newMatch = { ...match, player1: newPlayer1, player2: newPlayer2 };

      const input: SubmitMatchResultInput = {
        matchId: 'match1',
        player1Score: 1,
        player2Score: 0,
      };

      (mockPrismaClient.match.findUnique as jest.Mock).mockResolvedValue(newMatch);

      // ELOCalculator will use K-factor of 40 for new players
      const expectedEloResult = ELOCalculator.calculateNewRatings(
        newPlayer1.elo_rating,
        newPlayer2.elo_rating,
        newPlayer1.matches_played,
        newPlayer2.matches_played,
        false
      );

      (mockPrismaClient.matchResult.create as jest.Mock).mockResolvedValue({
        rating_change: expectedEloResult.ratingChange,
        winner_new_elo: expectedEloResult.winnerNewElo,
        loser_new_elo: expectedEloResult.loserNewElo,
      });
      (mockPrismaClient.player.update as jest.Mock).mockResolvedValue({});
      (mockPrismaClient.match.update as jest.Mock).mockResolvedValue({});

      const result = await matchService.submitMatchResult(input);

      // New players should have larger rating changes
      expect(Math.abs(result.rating_change)).toBeGreaterThan(0);
    });

    it('should throw error if match not found', async () => {
      const input: SubmitMatchResultInput = {
        matchId: 'nonexistent',
        player1Score: 2,
        player2Score: 1,
      };

      (mockPrismaClient.match.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(matchService.submitMatchResult(input)).rejects.toThrow('Match not found');
    });

    it('should throw error if result already submitted', async () => {
      const matchWithResult = {
        ...match,
        result: { id: 'existing-result' },
      };

      const input: SubmitMatchResultInput = {
        matchId: 'match1',
        player1Score: 2,
        player2Score: 1,
      };

      (mockPrismaClient.match.findUnique as jest.Mock).mockResolvedValue(matchWithResult);

      await expect(matchService.submitMatchResult(input)).rejects.toThrow(
        'Match result already submitted'
      );
    });

    it('should throw error if match is already completed', async () => {
      const completedMatch = {
        ...match,
        status: MatchStatus.COMPLETED,
      };

      const input: SubmitMatchResultInput = {
        matchId: 'match1',
        player1Score: 2,
        player2Score: 1,
      };

      (mockPrismaClient.match.findUnique as jest.Mock).mockResolvedValue(completedMatch);

      await expect(matchService.submitMatchResult(input)).rejects.toThrow(
        'Match is already completed'
      );
    });

    it('should mark match as verified when verifiedBy is provided', async () => {
      const input: SubmitMatchResultInput = {
        matchId: 'match1',
        player1Score: 2,
        player2Score: 1,
        verifiedBy: 'admin123',
      };

      (mockPrismaClient.match.findUnique as jest.Mock).mockResolvedValue(match);
      (mockPrismaClient.matchResult.create as jest.Mock).mockResolvedValue({
        verification_status: VerificationStatus.VERIFIED,
        verified_by: 'admin123',
      });
      (mockPrismaClient.player.update as jest.Mock).mockResolvedValue({});
      (mockPrismaClient.match.update as jest.Mock).mockResolvedValue({});

      const result = await matchService.submitMatchResult(input);

      expect(mockPrismaClient.matchResult.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verification_status: VerificationStatus.VERIFIED,
            verified_by: 'admin123',
            verified_at: expect.any(Date),
          }),
        })
      );
    });

    it('should update match status to COMPLETED after result submission', async () => {
      const input: SubmitMatchResultInput = {
        matchId: 'match1',
        player1Score: 2,
        player2Score: 1,
      };

      (mockPrismaClient.match.findUnique as jest.Mock).mockResolvedValue(match);
      (mockPrismaClient.matchResult.create as jest.Mock).mockResolvedValue({});
      (mockPrismaClient.player.update as jest.Mock).mockResolvedValue({});
      (mockPrismaClient.match.update as jest.Mock).mockResolvedValue({});

      await matchService.submitMatchResult(input);

      expect(mockPrismaClient.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'match1' },
          data: expect.objectContaining({
            status: MatchStatus.COMPLETED,
            completed_at: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('getMatchById', () => {
    it('should retrieve match with player details', async () => {
      const matchWithPlayers = {
        id: 'match1',
        player1: {
          id: 'player1',
          username: 'alice',
          elo_rating: 1500,
        },
        player2: {
          id: 'player2',
          username: 'bob',
          elo_rating: 1600,
        },
        result: null,
      };

      (mockPrismaClient.match.findUnique as jest.Mock).mockResolvedValue(matchWithPlayers);

      const result = await matchService.getMatchById('match1');

      expect(result).toEqual(matchWithPlayers);
      expect(mockPrismaClient.match.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'match1' },
          include: expect.objectContaining({
            player1: expect.any(Object),
            player2: expect.any(Object),
            result: true,
          }),
        })
      );
    });

    it('should return null if match not found', async () => {
      (mockPrismaClient.match.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await matchService.getMatchById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getPlayerMatchHistory', () => {
    it('should retrieve match history for a player', async () => {
      const matches = [
        {
          id: 'match1',
          player1_id: 'player1',
          player2_id: 'player2',
          created_at: new Date('2025-10-20'),
        },
        {
          id: 'match2',
          player1_id: 'player3',
          player2_id: 'player1',
          created_at: new Date('2025-10-19'),
        },
      ];

      (mockPrismaClient.match.findMany as jest.Mock).mockResolvedValue(matches);

      const result = await matchService.getPlayerMatchHistory('player1', 10);

      expect(result).toEqual(matches);
      expect(mockPrismaClient.match.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ player1_id: 'player1' }, { player2_id: 'player1' }],
          },
          take: 10,
          orderBy: { created_at: 'desc' },
        })
      );
    });

    it('should use default limit of 10 if not specified', async () => {
      (mockPrismaClient.match.findMany as jest.Mock).mockResolvedValue([]);

      await matchService.getPlayerMatchHistory('player1');

      expect(mockPrismaClient.match.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });
  });

  describe('verifyMatchResult', () => {
    it('should verify a pending match result', async () => {
      const matchResult = {
        id: 'result1',
        match_id: 'match1',
        verification_status: VerificationStatus.PENDING,
      };

      const verifiedResult = {
        ...matchResult,
        verification_status: VerificationStatus.VERIFIED,
        verified_by: 'admin123',
        verified_at: expect.any(Date),
      };

      (mockPrismaClient.matchResult.findUnique as jest.Mock).mockResolvedValue(matchResult);
      (mockPrismaClient.matchResult.update as jest.Mock).mockResolvedValue(verifiedResult);

      const result = await matchService.verifyMatchResult('match1', 'admin123');

      expect(result.verification_status).toBe(VerificationStatus.VERIFIED);
      expect(mockPrismaClient.matchResult.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'result1' },
          data: expect.objectContaining({
            verification_status: VerificationStatus.VERIFIED,
            verified_by: 'admin123',
            verified_at: expect.any(Date),
          }),
        })
      );
    });

    it('should throw error if match result not found', async () => {
      (mockPrismaClient.matchResult.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(matchService.verifyMatchResult('match1', 'admin123')).rejects.toThrow(
        'Match result not found'
      );
    });
  });

  describe('startMatch', () => {
    it('should start a scheduled match', async () => {
      const scheduledMatch = {
        id: 'match1',
        status: MatchStatus.SCHEDULED,
      };

      const startedMatch = {
        ...scheduledMatch,
        status: MatchStatus.IN_PROGRESS,
        started_at: expect.any(Date),
      };

      (mockPrismaClient.match.findUnique as jest.Mock).mockResolvedValue(scheduledMatch);
      (mockPrismaClient.match.update as jest.Mock).mockResolvedValue(startedMatch);

      const result = await matchService.startMatch('match1');

      expect(result.status).toBe(MatchStatus.IN_PROGRESS);
      expect(mockPrismaClient.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'match1' },
          data: expect.objectContaining({
            status: MatchStatus.IN_PROGRESS,
            started_at: expect.any(Date),
          }),
        })
      );
    });

    it('should throw error if match not found', async () => {
      (mockPrismaClient.match.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(matchService.startMatch('nonexistent')).rejects.toThrow('Match not found');
    });

    it('should throw error if trying to start completed match', async () => {
      const completedMatch = {
        id: 'match1',
        status: MatchStatus.COMPLETED,
      };

      (mockPrismaClient.match.findUnique as jest.Mock).mockResolvedValue(completedMatch);

      await expect(matchService.startMatch('match1')).rejects.toThrow(
        'Cannot start a completed match'
      );
    });
  });

  describe('cancelMatch', () => {
    it('should cancel a scheduled match', async () => {
      const scheduledMatch = {
        id: 'match1',
        status: MatchStatus.SCHEDULED,
      };

      const cancelledMatch = {
        ...scheduledMatch,
        status: MatchStatus.CANCELLED,
      };

      (mockPrismaClient.match.findUnique as jest.Mock).mockResolvedValue(scheduledMatch);
      (mockPrismaClient.match.update as jest.Mock).mockResolvedValue(cancelledMatch);

      const result = await matchService.cancelMatch('match1');

      expect(result.status).toBe(MatchStatus.CANCELLED);
    });

    it('should throw error if trying to cancel completed match', async () => {
      const completedMatch = {
        id: 'match1',
        status: MatchStatus.COMPLETED,
      };

      (mockPrismaClient.match.findUnique as jest.Mock).mockResolvedValue(completedMatch);

      await expect(matchService.cancelMatch('match1')).rejects.toThrow(
        'Cannot cancel a completed match'
      );
    });
  });

  describe('ELO Edge Cases', () => {
    it('should handle extreme rating differences correctly', async () => {
      const lowRatedPlayer = {
        id: 'player1',
        elo_rating: 800,
        matches_played: 30,
      };

      const highRatedPlayer = {
        id: 'player2',
        elo_rating: 2400,
        matches_played: 100,
      };

      // Low rated player wins (huge upset)
      const eloResult = ELOCalculator.calculateNewRatings(
        lowRatedPlayer.elo_rating,
        highRatedPlayer.elo_rating,
        lowRatedPlayer.matches_played,
        highRatedPlayer.matches_played,
        false
      );

      // Rating change should be significant for upset
      expect(eloResult.ratingChange).toBeGreaterThan(15);
      expect(eloResult.winnerNewElo).toBeGreaterThan(lowRatedPlayer.elo_rating);
      expect(eloResult.loserNewElo).toBeLessThan(highRatedPlayer.elo_rating);
    });

    it('should handle equal ratings correctly', async () => {
      const player1 = {
        id: 'player1',
        elo_rating: 1500,
        matches_played: 30,
      };

      const player2 = {
        id: 'player2',
        elo_rating: 1500,
        matches_played: 30,
      };

      const eloResult = ELOCalculator.calculateNewRatings(
        player1.elo_rating,
        player2.elo_rating,
        player1.matches_played,
        player2.matches_played,
        false
      );

      // With equal ratings, winner should gain exactly what loser loses
      expect(eloResult.winnerNewElo - player1.elo_rating).toBe(
        -(eloResult.loserNewElo - player2.elo_rating)
      );
    });
  });
});
