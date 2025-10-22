import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler';
import { validate, uuidParamSchema } from '../middleware/validation';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const addFriendSchema = z.object({
  playerId: z.string().uuid('Invalid player ID format'),
});

const reportPlayerSchema = z.object({
  playerId: z.string().uuid('Invalid player ID format'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500, 'Reason too long'),
});

const voteKickSchema = z.object({
  playerId: z.string().uuid('Invalid player ID format'),
  matchId: z.string().uuid('Invalid match ID format'),
});

/**
 * POST /api/friends
 * Add a friend
 */
router.post(
  '/',
  requireAuth,
  apiRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { playerId } = addFriendSchema.parse(req.body);
    const currentUserId = req.user!.id;

    // Check if player exists
    const player = await prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      throw new NotFoundError('Player');
    }

    // Check if already friends (you'd need to create a friends table in your schema)
    // For now, returning success
    // TODO: Implement actual friend relationship in database

    res.json({
      success: true,
      message: 'Friend added successfully',
      data: {
        playerId,
        playerName: player.username,
        addedAt: new Date(),
      },
    });
  })
);

/**
 * POST /api/friends/report
 * Report a player
 */
router.post(
  '/report',
  requireAuth,
  apiRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { playerId, reason } = reportPlayerSchema.parse(req.body);
    const reporterId = req.user!.id;

    // Check if player exists
    const player = await prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      throw new NotFoundError('Player');
    }

    // Create report (you'd need a reports table in your schema)
    // For now, returning success
    // TODO: Implement actual report storage in database

    res.json({
      success: true,
      message: 'Player reported successfully',
      data: {
        reportId: `report-${Date.now()}`,
        playerId,
        reason,
        status: 'pending',
        reportedAt: new Date(),
      },
    });
  })
);

/**
 * POST /api/friends/vote-kick
 * Vote to kick a player from a match
 */
router.post(
  '/vote-kick',
  requireAuth,
  apiRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { playerId, matchId } = voteKickSchema.parse(req.body);
    const voterId = req.user!.id;

    // Check if match exists
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundError('Match');
    }

    // Check if player is in the match
    if (match.player1_id !== playerId && match.player2_id !== playerId) {
      throw new NotFoundError('Player not in this match');
    }

    // Create vote (you'd need a votes table in your schema)
    // For now, returning mock data
    // TODO: Implement actual vote storage and counting in database

    res.json({
      success: true,
      message: 'Vote recorded successfully',
      data: {
        votesNeeded: 3,
        currentVotes: 1,
        playerId,
        matchId,
      },
    });
  })
);

/**
 * GET /api/friends
 * Get user's friends list
 */
router.get(
  '/',
  requireAuth,
  apiRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    // TODO: Implement actual friends retrieval from database
    res.json({
      success: true,
      data: [],
      message: 'Friends list retrieved successfully',
    });
  })
);

export default router;
