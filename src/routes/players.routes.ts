import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { validate, updateProfileSchema, uuidParamSchema } from '../middleware/validation';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { adaptiveRateLimiter } from '../middleware/rateLimiter';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/players/:id
 * Get player profile by ID
 */
router.get(
  '/:id',
  optionalAuth,
  adaptiveRateLimiter,
  validate(uuidParamSchema, 'params'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const player = await prisma.player.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        display_name: true,
        country_code: true,
        avatar_url: true,
        elo_rating: true,
        matches_played: true,
        wins: true,
        losses: true,
        draws: true,
        created_at: true,
        last_active_at: true,
        is_active: true
      }
    });

    if (!player) {
      throw new NotFoundError('Player');
    }

    if (!player.is_active) {
      throw new NotFoundError('Player');
    }

    res.json({
      success: true,
      data: {
        id: player.id,
        username: player.username,
        displayName: player.display_name,
        countryCode: player.country_code,
        avatarUrl: player.avatar_url,
        eloRating: player.elo_rating,
        matchesPlayed: player.matches_played,
        wins: player.wins,
        losses: player.losses,
        draws: player.draws,
        winRate: player.matches_played > 0 ? player.wins / player.matches_played : 0,
        createdAt: player.created_at,
        lastActiveAt: player.last_active_at
      }
    });
  })
);

/**
 * PUT /api/players/:id
 * Update player profile
 */
router.put(
  '/:id',
  requireAuth,
  adaptiveRateLimiter,
  validate(uuidParamSchema, 'params'),
  validate(updateProfileSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    // Check if user is updating their own profile
    if (req.user!.id !== id) {
      throw new ForbiddenError('You can only update your own profile');
    }

    const { displayName, countryCode, avatarUrl, settings } = req.body;

    const updatedPlayer = await prisma.player.update({
      where: { id },
      data: {
        ...(displayName && { display_name: displayName }),
        ...(countryCode && { country_code: countryCode }),
        ...(avatarUrl !== undefined && { avatar_url: avatarUrl })
      },
      select: {
        id: true,
        username: true,
        email: true,
        display_name: true,
        country_code: true,
        avatar_url: true,
        elo_rating: true,
        matches_played: true,
        wins: true,
        losses: true,
        draws: true,
        last_active_at: true
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedPlayer.id,
        username: updatedPlayer.username,
        email: updatedPlayer.email,
        displayName: updatedPlayer.display_name,
        countryCode: updatedPlayer.country_code,
        avatarUrl: updatedPlayer.avatar_url,
        eloRating: updatedPlayer.elo_rating,
        matchesPlayed: updatedPlayer.matches_played,
        wins: updatedPlayer.wins,
        losses: updatedPlayer.losses,
        draws: updatedPlayer.draws
      }
    });
  })
);

/**
 * DELETE /api/players/:id
 * Deactivate player account
 */
router.delete(
  '/:id',
  requireAuth,
  adaptiveRateLimiter,
  validate(uuidParamSchema, 'params'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    // Check if user is deleting their own account
    if (req.user!.id !== id) {
      throw new ForbiddenError('You can only delete your own account');
    }

    // Soft delete - deactivate account
    await prisma.player.update({
      where: { id },
      data: { is_active: false }
    });

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  })
);

/**
 * GET /api/players/:id/stats
 * Get detailed player statistics
 */
router.get(
  '/:id/stats',
  optionalAuth,
  adaptiveRateLimiter,
  validate(uuidParamSchema, 'params'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const player = await prisma.player.findUnique({
      where: { id },
      include: {
        matches_as_player1: {
          where: { status: 'COMPLETED' },
          include: { result: true }
        },
        matches_as_player2: {
          where: { status: 'COMPLETED' },
          include: { result: true }
        }
      }
    });

    if (!player || !player.is_active) {
      throw new NotFoundError('Player');
    }

    // Calculate detailed statistics
    const allMatches = [...player.matches_as_player1, ...player.matches_as_player2];
    const completedMatches = allMatches.filter(m => m.result);

    // Calculate streak
    let currentStreak = 0;
    const sortedMatches = completedMatches.sort((a, b) =>
      (b.completed_at?.getTime() || 0) - (a.completed_at?.getTime() || 0)
    );

    for (const match of sortedMatches) {
      if (!match.result) continue;

      if (match.result.winner_id === id) {
        currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
      } else if (match.result.loser_id === id) {
        currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
      } else {
        break;
      }
    }

    res.json({
      success: true,
      data: {
        playerId: player.id,
        username: player.username,
        displayName: player.display_name,
        eloRating: player.elo_rating,
        matchesPlayed: player.matches_played,
        wins: player.wins,
        losses: player.losses,
        draws: player.draws,
        winRate: player.matches_played > 0 ? player.wins / player.matches_played : 0,
        currentStreak,
        recentMatches: sortedMatches.slice(0, 10).map(m => ({
          id: m.id,
          opponent: m.player1_id === id ? m.player2_id : m.player1_id,
          result: m.result?.winner_id === id ? 'WIN' : m.result?.loser_id === id ? 'LOSS' : 'DRAW',
          eloChange: m.result?.rating_change || 0,
          completedAt: m.completed_at
        }))
      }
    });
  })
);

export default router;
