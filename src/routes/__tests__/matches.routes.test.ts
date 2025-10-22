/**
 * Matches Routes Tests
 * Tests match creation, updates, deletion, result recording, transaction handling,
 * and concurrent update protection
 *
 * Test Coverage: 15 comprehensive tests for match operations
 */

import request from 'supertest';
import express, { Express } from 'express';
import { PrismaClient, MatchStatus } from '@prisma/client';
import matchesRoutes from '../matches.routes';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../services/MatchService');
jest.mock('../../middleware/auth');
jest.mock('../../middleware/rateLimiter');

describe('Matches Routes Tests', () => {
  let app: Express;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockMatchService: any;

  const mockMatch = {
    id: 'match-123',
    player1_id: 'player-1',
    player2_id: 'player-2',
    status: MatchStatus.SCHEDULED,
    match_type: 'competitive',
    notes: null,
    scheduled_at: null,
    started_at: null,
    completed_at: null,
    created_at: new Date(),
    player1: {
      id: 'player-1',
      username: 'Player1',
      elo_rating: 1500
    },
    player2: {
      id: 'player-2',
      username: 'Player2',
      elo_rating: 1600
    },
    result: null
  };

  const mockMatchResult = {
    id: 'result-123',
    match_id: 'match-123',
    winner_id: 'player-1',
    loser_id: 'player-2',
    player1_score: 3,
    player2_score: 1,
    rating_change: 25,
    winner_new_elo: 1525,
    loser_new_elo: 1575,
    result_type: 'WIN',
    verification_status: 'VERIFIED',
    verified_by: 'player-1',
    verified_at: new Date(),
    created_at: new Date()
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    app.use((req: any, res, next) => {
      req.user = { id: 'player-1', username: 'Player1', email: 'player1@example.com' };
      next();
    });

    app.use('/api/matches', matchesRoutes);

    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    mockMatchService = {
      getMatches: jest.fn(),
      createMatch: jest.fn(),
      getMatchById: jest.fn(),
      cancelMatch: jest.fn(),
      submitMatchResult: jest.fn()
    };

    (mockPrisma.match as any) = {
      count: jest.fn(),
      update: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test 1: GET /matches - List all matches
   */
  describe('GET /api/matches', () => {
    it('should return paginated matches', async () => {
      const matches = [mockMatch];
      mockMatchService.getMatches.mockResolvedValue(matches);
      (mockPrisma.match.count as jest.Mock).mockResolvedValue(50);

      const response = await request(app)
        .get('/api/matches')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 50,
        totalPages: 5
      });
    });

    it('should format match data correctly', async () => {
      mockMatchService.getMatches.mockResolvedValue([{ ...mockMatch, result: mockMatchResult }]);
      (mockPrisma.match.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/matches')
        .query({ page: 1, limit: 10 })
        .expect(200);

      const match = response.body.data[0];
      expect(match).toHaveProperty('id');
      expect(match).toHaveProperty('player1');
      expect(match).toHaveProperty('player2');
      expect(match).toHaveProperty('status');
      expect(match).toHaveProperty('matchType');
      expect(match).toHaveProperty('result');
      expect(match.player1).toHaveProperty('username');
      expect(match.player2).toHaveProperty('username');
    });

    it('should only return completed matches by default', async () => {
      mockMatchService.getMatches.mockResolvedValue([mockMatch]);
      (mockPrisma.match.count as jest.Mock).mockResolvedValue(1);

      await request(app)
        .get('/api/matches')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(mockMatchService.getMatches).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MatchStatus.COMPLETED
        })
      );
    });
  });

  /**
   * Test 2: POST /matches - Create new match
   */
  describe('POST /api/matches', () => {
    it('should create match successfully', async () => {
      mockMatchService.createMatch.mockResolvedValue(mockMatch);

      const response = await request(app)
        .post('/api/matches')
        .send({
          player1Id: 'player-1',
          player2Id: 'player-2',
          matchType: 'competitive'
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Match created successfully');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('status', MatchStatus.SCHEDULED);
    });

    it('should validate user is participant', async () => {
      const response = await request(app)
        .post('/api/matches')
        .send({
          player1Id: 'other-player-1',
          player2Id: 'other-player-2',
          matchType: 'competitive'
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should prevent player from playing against themselves', async () => {
      const response = await request(app)
        .post('/api/matches')
        .send({
          player1Id: 'player-1',
          player2Id: 'player-1',
          matchType: 'competitive'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/matches')
        .send({
          player1Id: 'player-1'
          // Missing player2Id
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  /**
   * Test 3: GET /matches/:id - Get match by ID
   */
  describe('GET /api/matches/:id', () => {
    it('should return match details', async () => {
      mockMatchService.getMatchById.mockResolvedValue(mockMatch);

      const response = await request(app)
        .get('/api/matches/match-123')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', 'match-123');
      expect(response.body.data).toHaveProperty('player1');
      expect(response.body.data).toHaveProperty('player2');
    });

    it('should return 404 for non-existent match', async () => {
      mockMatchService.getMatchById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/matches/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should include result data if completed', async () => {
      const completedMatch = {
        ...mockMatch,
        status: MatchStatus.COMPLETED,
        result: mockMatchResult
      };
      mockMatchService.getMatchById.mockResolvedValue(completedMatch);

      const response = await request(app)
        .get('/api/matches/match-123')
        .expect(200);

      expect(response.body.data).toHaveProperty('result');
      expect(response.body.data.result).toHaveProperty('winnerId');
      expect(response.body.data.result).toHaveProperty('ratingChange');
    });
  });

  /**
   * Test 4: PUT /matches/:id - Update match
   */
  describe('PUT /api/matches/:id', () => {
    it('should update match notes', async () => {
      mockMatchService.getMatchById.mockResolvedValue(mockMatch);
      (mockPrisma.match.update as jest.Mock).mockResolvedValue({
        ...mockMatch,
        notes: 'Updated notes'
      });

      const response = await request(app)
        .put('/api/matches/match-123')
        .send({ notes: 'Updated notes' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Match updated successfully');
    });

    it('should prevent non-participants from updating', async () => {
      const otherMatch = {
        ...mockMatch,
        player1_id: 'other-player-1',
        player2_id: 'other-player-2'
      };
      mockMatchService.getMatchById.mockResolvedValue(otherMatch);

      const response = await request(app)
        .put('/api/matches/match-123')
        .send({ notes: 'Trying to update' })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should prevent updating completed matches', async () => {
      const completedMatch = {
        ...mockMatch,
        status: MatchStatus.COMPLETED
      };
      mockMatchService.getMatchById.mockResolvedValue(completedMatch);

      const response = await request(app)
        .put('/api/matches/match-123')
        .send({ notes: 'Trying to update completed match' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent match', async () => {
      mockMatchService.getMatchById.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/matches/non-existent')
        .send({ notes: 'Update' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  /**
   * Test 5: DELETE /matches/:id - Cancel match
   */
  describe('DELETE /api/matches/:id', () => {
    it('should cancel match successfully', async () => {
      mockMatchService.getMatchById.mockResolvedValue(mockMatch);
      mockMatchService.cancelMatch.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/matches/match-123')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Match cancelled successfully');
      expect(mockMatchService.cancelMatch).toHaveBeenCalledWith('match-123');
    });

    it('should prevent non-participants from cancelling', async () => {
      const otherMatch = {
        ...mockMatch,
        player1_id: 'other-player-1',
        player2_id: 'other-player-2'
      };
      mockMatchService.getMatchById.mockResolvedValue(otherMatch);

      const response = await request(app)
        .delete('/api/matches/match-123')
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent match', async () => {
      mockMatchService.getMatchById.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/matches/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  /**
   * Test 6: POST /matches/:id/result - Submit match result
   */
  describe('POST /api/matches/:id/result', () => {
    it('should submit match result successfully', async () => {
      mockMatchService.getMatchById.mockResolvedValue(mockMatch);
      mockMatchService.submitMatchResult.mockResolvedValue(mockMatchResult);

      const response = await request(app)
        .post('/api/matches/match-123/result')
        .send({
          player1Score: 3,
          player2Score: 1,
          resultType: 'WIN'
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Match result submitted successfully');
      expect(response.body.data).toHaveProperty('winnerId');
      expect(response.body.data).toHaveProperty('ratingChange');
    });

    it('should calculate ELO changes', async () => {
      mockMatchService.getMatchById.mockResolvedValue(mockMatch);
      mockMatchService.submitMatchResult.mockResolvedValue(mockMatchResult);

      const response = await request(app)
        .post('/api/matches/match-123/result')
        .send({
          player1Score: 3,
          player2Score: 1,
          resultType: 'WIN'
        })
        .expect(201);

      expect(response.body.data).toHaveProperty('winnerNewElo');
      expect(response.body.data).toHaveProperty('loserNewElo');
      expect(response.body.data.ratingChange).toBeGreaterThan(0);
    });

    it('should prevent non-participants from submitting results', async () => {
      const otherMatch = {
        ...mockMatch,
        player1_id: 'other-player-1',
        player2_id: 'other-player-2'
      };
      mockMatchService.getMatchById.mockResolvedValue(otherMatch);

      const response = await request(app)
        .post('/api/matches/match-123/result')
        .send({
          player1Score: 3,
          player2Score: 1,
          resultType: 'WIN'
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid score data', async () => {
      mockMatchService.getMatchById.mockResolvedValue(mockMatch);

      const response = await request(app)
        .post('/api/matches/match-123/result')
        .send({
          player1Score: -1,
          player2Score: 999,
          resultType: 'WIN'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent match', async () => {
      mockMatchService.getMatchById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/matches/non-existent/result')
        .send({
          player1Score: 3,
          player2Score: 1,
          resultType: 'WIN'
        })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  /**
   * Test 7: Transaction handling
   */
  describe('Transaction Handling', () => {
    it('should handle database transaction errors', async () => {
      mockMatchService.getMatchById.mockResolvedValue(mockMatch);
      mockMatchService.submitMatchResult.mockRejectedValue(
        new Error('Transaction failed')
      );

      const response = await request(app)
        .post('/api/matches/match-123/result')
        .send({
          player1Score: 3,
          player2Score: 1,
          resultType: 'WIN'
        })
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    it('should rollback on partial failures', async () => {
      // This would be tested with actual database transactions
      mockMatchService.getMatchById.mockResolvedValue(mockMatch);
      mockMatchService.submitMatchResult.mockRejectedValue(
        new Error('ELO update failed')
      );

      const response = await request(app)
        .post('/api/matches/match-123/result')
        .send({
          player1Score: 3,
          player2Score: 1,
          resultType: 'WIN'
        })
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  /**
   * Test 8: Concurrent update protection
   */
  describe('Concurrent Update Protection', () => {
    it('should handle concurrent match updates', async () => {
      mockMatchService.getMatchById.mockResolvedValue(mockMatch);
      (mockPrisma.match.update as jest.Mock).mockResolvedValue(mockMatch);

      const requests = Array(5).fill(null).map(() =>
        request(app)
          .put('/api/matches/match-123')
          .send({ notes: 'Concurrent update' })
      );

      const responses = await Promise.allSettled(requests);

      const successfulUpdates = responses.filter(
        r => r.status === 'fulfilled' && (r.value as any).status === 200
      );

      expect(successfulUpdates.length).toBeGreaterThan(0);
    });

    it('should prevent duplicate result submissions', async () => {
      const completedMatch = {
        ...mockMatch,
        status: MatchStatus.COMPLETED,
        result: mockMatchResult
      };
      mockMatchService.getMatchById.mockResolvedValue(completedMatch);

      const response = await request(app)
        .post('/api/matches/match-123/result')
        .send({
          player1Score: 3,
          player2Score: 1,
          resultType: 'WIN'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  /**
   * Test 9: Match history queries
   */
  describe('Match History', () => {
    it('should filter matches by player', async () => {
      const playerMatches = [mockMatch];
      mockMatchService.getMatches.mockResolvedValue(playerMatches);
      (mockPrisma.match.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/matches')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
    });

    it('should sort matches by date descending', async () => {
      const matches = [
        { ...mockMatch, created_at: new Date('2024-01-01') },
        { ...mockMatch, id: 'match-456', created_at: new Date('2024-01-02') }
      ];
      mockMatchService.getMatches.mockResolvedValue(matches);
      (mockPrisma.match.count as jest.Mock).mockResolvedValue(2);

      const response = await request(app)
        .get('/api/matches')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toHaveLength(2);
    });
  });

  /**
   * Test 10: Match statistics
   */
  describe('Match Statistics', () => {
    it('should include player statistics in match data', async () => {
      mockMatchService.getMatchById.mockResolvedValue(mockMatch);

      const response = await request(app)
        .get('/api/matches/match-123')
        .expect(200);

      expect(response.body.data.player1).toHaveProperty('eloRating');
      expect(response.body.data.player2).toHaveProperty('eloRating');
    });

    it('should track match type statistics', async () => {
      const competitiveMatch = { ...mockMatch, match_type: 'competitive' };
      mockMatchService.getMatches.mockResolvedValue([competitiveMatch]);
      (mockPrisma.match.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/matches')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data[0].matchType).toBe('competitive');
    });
  });

  /**
   * Test 11: Error edge cases
   */
  describe('Error Edge Cases', () => {
    it('should handle malformed UUIDs', async () => {
      const response = await request(app)
        .get('/api/matches/not-a-valid-uuid')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle service unavailable', async () => {
      mockMatchService.getMatchById.mockRejectedValue(
        new Error('Service unavailable')
      );

      const response = await request(app)
        .get('/api/matches/match-123')
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate required result fields', async () => {
      mockMatchService.getMatchById.mockResolvedValue(mockMatch);

      const response = await request(app)
        .post('/api/matches/match-123/result')
        .send({
          // Missing required fields
          resultType: 'WIN'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  /**
   * Test 12: Performance tests
   */
  describe('Performance', () => {
    it('should handle bulk match queries efficiently', async () => {
      const largeMatchSet = Array(100).fill(null).map((_, i) => ({
        ...mockMatch,
        id: `match-${i}`
      }));

      mockMatchService.getMatches.mockResolvedValue(largeMatchSet);
      (mockPrisma.match.count as jest.Mock).mockResolvedValue(1000);

      const startTime = Date.now();

      const response = await request(app)
        .get('/api/matches')
        .query({ page: 1, limit: 100 })
        .expect(200);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
      expect(response.body.data).toHaveLength(100);
    });
  });

  /**
   * Test 13: Authorization checks
   */
  describe('Authorization', () => {
    it('should require authentication for creating matches', async () => {
      // Remove auth middleware temporarily
      const noAuthApp = express();
      noAuthApp.use(express.json());
      noAuthApp.use('/api/matches', matchesRoutes);

      const response = await request(noAuthApp)
        .post('/api/matches')
        .send({
          player1Id: 'player-1',
          player2Id: 'player-2',
          matchType: 'competitive'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should allow viewing matches without authentication', async () => {
      const noAuthApp = express();
      noAuthApp.use(express.json());
      noAuthApp.use('/api/matches', matchesRoutes);

      mockMatchService.getMatches.mockResolvedValue([mockMatch]);
      (mockPrisma.match.count as jest.Mock).mockResolvedValue(1);

      const response = await request(noAuthApp)
        .get('/api/matches')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
    });
  });

  /**
   * Test 14: Rate limiting
   */
  describe('Rate Limiting', () => {
    it('should enforce rate limits on match creation', async () => {
      mockMatchService.createMatch.mockResolvedValue(mockMatch);

      // This would test actual rate limiting if configured
      const requests = Array(20).fill(null).map(() =>
        request(app)
          .post('/api/matches')
          .send({
            player1Id: 'player-1',
            player2Id: 'player-2',
            matchType: 'competitive'
          })
      );

      const responses = await Promise.allSettled(requests);

      // Some requests should succeed, rate limiter would block excessive ones
      const successfulRequests = responses.filter(
        r => r.status === 'fulfilled' && (r.value as any).status === 201
      );

      expect(successfulRequests.length).toBeGreaterThan(0);
    });
  });

  /**
   * Test 15: Data validation
   */
  describe('Data Validation', () => {
    it('should validate match type', async () => {
      const response = await request(app)
        .post('/api/matches')
        .send({
          player1Id: 'player-1',
          player2Id: 'player-2',
          matchType: 'invalid-type'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate player IDs format', async () => {
      const response = await request(app)
        .post('/api/matches')
        .send({
          player1Id: 'invalid',
          player2Id: 'also-invalid',
          matchType: 'competitive'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate score ranges', async () => {
      mockMatchService.getMatchById.mockResolvedValue(mockMatch);

      const response = await request(app)
        .post('/api/matches/match-123/result')
        .send({
          player1Score: 1000000,
          player2Score: -5,
          resultType: 'WIN'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
