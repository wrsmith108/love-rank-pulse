import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { validate, paginationSchema, countryParamSchema } from '../middleware/validation';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/leaderboard/global
 * Get global leaderboard
 */
router.get(
  '/global',
  optionalAuth,
  apiRateLimiter,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit } = req.query as any;
    const skip = (page - 1) * limit;

    const [players, total] = await Promise.all([
      prisma.player.findMany({
        where: { is_active: true },
        orderBy: { elo_rating: 'desc' },
        take: limit,
        skip,
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
          draws: true
        }
      }),
      prisma.player.count({ where: { is_active: true } })
    ]);

    res.json({
      success: true,
      data: players.map((player, index) => ({
        rank: skip + index + 1,
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
        winRate: player.matches_played > 0 ? player.wins / player.matches_played : 0
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
 * GET /api/leaderboard/country/:country
 * Get country-specific leaderboard
 */
router.get(
  '/country/:country',
  optionalAuth,
  apiRateLimiter,
  validate(countryParamSchema, 'params'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { country } = req.params;
    const { page, limit } = req.query as any;
    const skip = (page - 1) * limit;

    const [players, total] = await Promise.all([
      prisma.player.findMany({
        where: {
          is_active: true,
          country_code: country.toUpperCase()
        },
        orderBy: { elo_rating: 'desc' },
        take: limit,
        skip,
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
          draws: true
        }
      }),
      prisma.player.count({
        where: {
          is_active: true,
          country_code: country.toUpperCase()
        }
      })
    ]);

    res.json({
      success: true,
      data: players.map((player, index) => ({
        rank: skip + index + 1,
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
        winRate: player.matches_played > 0 ? player.wins / player.matches_played : 0
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      country: country.toUpperCase()
    });
  })
);

/**
 * GET /api/leaderboard/top
 * Get top 10 players (quick endpoint, no pagination)
 */
router.get(
  '/top',
  optionalAuth,
  apiRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const players = await prisma.player.findMany({
      where: { is_active: true },
      orderBy: { elo_rating: 'desc' },
      take: 10,
      select: {
        id: true,
        username: true,
        display_name: true,
        country_code: true,
        avatar_url: true,
        elo_rating: true,
        matches_played: true,
        wins: true
      }
    });

    res.json({
      success: true,
      data: players.map((player, index) => ({
        rank: index + 1,
        id: player.id,
        username: player.username,
        displayName: player.display_name,
        countryCode: player.country_code,
        avatarUrl: player.avatar_url,
        eloRating: player.elo_rating,
        matchesPlayed: player.matches_played,
        wins: player.wins
      }))
    });
  })
);

export default router;
