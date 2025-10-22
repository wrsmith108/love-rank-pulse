import { Router, Response } from 'express';
import { PrismaClient, MatchStatus } from '@prisma/client';
import { asyncHandler, NotFoundError, BadRequestError, ForbiddenError } from '../middleware/errorHandler';
import { validate, createMatchSchema, submitResultSchema, uuidParamSchema, paginationSchema } from '../middleware/validation';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { adaptiveRateLimiter } from '../middleware/rateLimiter';
import { MatchService } from '../services/MatchService';

const router = Router();
const prisma = new PrismaClient();
const matchService = new MatchService(prisma);

/**
 * GET /api/matches
 * Get all matches with pagination
 */
router.get(
  '/',
  optionalAuth,
  adaptiveRateLimiter,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit } = req.query as any;
    const skip = (page - 1) * limit;

    const [matches, total] = await Promise.all([
      matchService.getMatches({
        status: MatchStatus.COMPLETED,
        limit,
        offset: skip
      }),
      prisma.match.count({ where: { status: MatchStatus.COMPLETED } })
    ]);

    res.json({
      success: true,
      data: matches.map(m => ({
        id: m.id,
        player1: {
          id: m.player1.id,
          username: m.player1.username,
          eloRating: m.player1.elo_rating
        },
        player2: {
          id: m.player2.id,
          username: m.player2.username,
          eloRating: m.player2.elo_rating
        },
        status: m.status,
        matchType: m.match_type,
        result: m.result ? {
          winnerId: m.result.winner_id,
          loserId: m.result.loser_id,
          player1Score: m.result.player1_score,
          player2Score: m.result.player2_score,
          ratingChange: m.result.rating_change
        } : null,
        completedAt: m.completed_at,
        createdAt: m.created_at
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  })
);

/**
 * POST /api/matches
 * Create a new match
 */
router.post(
  '/',
  requireAuth,
  adaptiveRateLimiter,
  validate(createMatchSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { player1Id, player2Id, ...matchData } = req.body;

    // Verify user is creating a match for themselves
    if (player1Id !== req.user!.id && player2Id !== req.user!.id) {
      throw new ForbiddenError('You can only create matches you are participating in');
    }

    if (player1Id === player2Id) {
      throw new BadRequestError('A player cannot play against themselves');
    }

    const match = await matchService.createMatch({
      player1Id,
      player2Id,
      ...matchData
    });

    res.status(201).json({
      success: true,
      message: 'Match created successfully',
      data: {
        id: match.id,
        player1: match.player1,
        player2: match.player2,
        status: match.status,
        matchType: match.match_type,
        createdAt: match.created_at
      }
    });
  })
);

/**
 * GET /api/matches/:id
 * Get match details by ID
 */
router.get(
  '/:id',
  optionalAuth,
  adaptiveRateLimiter,
  validate(uuidParamSchema, 'params'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const match = await matchService.getMatchById(id);

    if (!match) {
      throw new NotFoundError('Match');
    }

    res.json({
      success: true,
      data: {
        id: match.id,
        player1: match.player1,
        player2: match.player2,
        status: match.status,
        matchType: match.match_type,
        result: match.result,
        scheduledAt: match.scheduled_at,
        startedAt: match.started_at,
        completedAt: match.completed_at,
        createdAt: match.created_at
      }
    });
  })
);

/**
 * PUT /api/matches/:id
 * Update match details
 */
router.put(
  '/:id',
  requireAuth,
  adaptiveRateLimiter,
  validate(uuidParamSchema, 'params'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const match = await matchService.getMatchById(id);

    if (!match) {
      throw new NotFoundError('Match');
    }

    // Only players in the match can update it
    if (match.player1_id !== req.user!.id && match.player2_id !== req.user!.id) {
      throw new ForbiddenError('You can only update matches you are participating in');
    }

    // Cannot update completed matches
    if (match.status === MatchStatus.COMPLETED) {
      throw new BadRequestError('Cannot update completed match');
    }

    const { notes } = req.body;

    const updated = await prisma.match.update({
      where: { id },
      data: { notes },
      include: {
        player1: {
          select: { id: true, username: true, elo_rating: true }
        },
        player2: {
          select: { id: true, username: true, elo_rating: true }
        }
      }
    });

    res.json({
      success: true,
      message: 'Match updated successfully',
      data: updated
    });
  })
);

/**
 * DELETE /api/matches/:id
 * Cancel a match
 */
router.delete(
  '/:id',
  requireAuth,
  adaptiveRateLimiter,
  validate(uuidParamSchema, 'params'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const match = await matchService.getMatchById(id);

    if (!match) {
      throw new NotFoundError('Match');
    }

    // Only players in the match can cancel it
    if (match.player1_id !== req.user!.id && match.player2_id !== req.user!.id) {
      throw new ForbiddenError('You can only cancel matches you are participating in');
    }

    await matchService.cancelMatch(id);

    res.json({
      success: true,
      message: 'Match cancelled successfully'
    });
  })
);

/**
 * POST /api/matches/:id/result
 * Submit match result
 */
router.post(
  '/:id/result',
  requireAuth,
  adaptiveRateLimiter,
  validate(uuidParamSchema, 'params'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { player1Score, player2Score, resultType } = req.body;

    const match = await matchService.getMatchById(id);

    if (!match) {
      throw new NotFoundError('Match');
    }

    // Only players in the match can submit results
    if (match.player1_id !== req.user!.id && match.player2_id !== req.user!.id) {
      throw new ForbiddenError('You can only submit results for matches you are participating in');
    }

    const result = await matchService.submitMatchResult({
      matchId: id,
      player1Score,
      player2Score,
      resultType,
      verifiedBy: req.user!.id
    });

    res.status(201).json({
      success: true,
      message: 'Match result submitted successfully',
      data: {
        matchId: result.match_id,
        winnerId: result.winner_id,
        loserId: result.loser_id,
        player1Score: result.player1_score,
        player2Score: result.player2_score,
        ratingChange: result.rating_change,
        winnerNewElo: result.winner_new_elo,
        loserNewElo: result.loser_new_elo,
        resultType: result.result_type,
        verificationStatus: result.verification_status
      }
    });
  })
);

export default router;
