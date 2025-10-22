import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, BadRequestError, UnauthorizedError, ConflictError } from '../middleware/errorHandler';
import { validate, registerSchema, loginSchema } from '../middleware/validation';
import { generateToken, requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { strictRateLimiter } from '../middleware/rateLimiter';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/auth/register
 * Register a new player
 */
router.post(
  '/register',
  strictRateLimiter,
  validate(registerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { username, email, password, displayName, countryCode } = req.body;

    // Check if user already exists
    const existingUser = await prisma.player.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictError('Email already registered');
      }
      if (existingUser.username === username) {
        throw new ConflictError('Username already taken');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create player
    const player = await prisma.player.create({
      data: {
        username,
        email,
        password_hash: hashedPassword,
        display_name: displayName,
        country_code: countryCode,
        elo_rating: 1200, // Default starting ELO
        is_active: true
      }
    });

    // Generate JWT token
    const token = generateToken({
      id: player.id,
      username: player.username,
      email: player.email,
      role: 'user'
    });

    res.status(201).json({
      success: true,
      message: 'Player registered successfully',
      data: {
        token,
        player: {
          id: player.id,
          username: player.username,
          email: player.email,
          displayName: player.display_name,
          countryCode: player.country_code,
          eloRating: player.elo_rating
        }
      }
    });
  })
);

/**
 * POST /api/auth/login
 * Login a player
 */
router.post(
  '/login',
  strictRateLimiter,
  validate(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // Find player
    const player = await prisma.player.findUnique({
      where: { email }
    });

    if (!player) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if account is active
    if (!player.is_active) {
      throw new UnauthorizedError('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, player.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Update last login
    await prisma.player.update({
      where: { id: player.id },
      data: { last_active_at: new Date() }
    });

    // Generate JWT token
    const token = generateToken({
      id: player.id,
      username: player.username,
      email: player.email,
      role: 'user'
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        player: {
          id: player.id,
          username: player.username,
          email: player.email,
          displayName: player.display_name,
          countryCode: player.country_code,
          eloRating: player.elo_rating,
          matchesPlayed: player.matches_played,
          wins: player.wins,
          losses: player.losses,
          draws: player.draws
        }
      }
    });
  })
);

/**
 * POST /api/auth/logout
 * Logout a player (token invalidation handled client-side)
 */
router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // In a JWT-based system, logout is typically handled client-side
    // by removing the token. For enhanced security, you could implement
    // a token blacklist using Redis.

    res.json({
      success: true,
      message: 'Logout successful'
    });
  })
);

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const player = await prisma.player.findUnique({
      where: { id: req.user!.id },
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
        created_at: true,
        last_active_at: true,
        is_active: true
      }
    });

    if (!player) {
      throw new UnauthorizedError('User not found');
    }

    res.json({
      success: true,
      data: {
        id: player.id,
        username: player.username,
        email: player.email,
        displayName: player.display_name,
        countryCode: player.country_code,
        avatarUrl: player.avatar_url,
        eloRating: player.elo_rating,
        matchesPlayed: player.matches_played,
        wins: player.wins,
        losses: player.losses,
        draws: player.draws,
        createdAt: player.created_at,
        lastActiveAt: player.last_active_at,
        isActive: player.is_active
      }
    });
  })
);

export default router;
