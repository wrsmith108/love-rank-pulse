import { Router } from 'express';
import authRoutes from './auth.routes';
import playersRoutes from './players.routes';
import matchesRoutes from './matches.routes';
import leaderboardRoutes from './leaderboard.routes';
import healthRoutes from './health.routes';
import friendsRoutes from './friends.routes';

const router = Router();

/**
 * Mount all route modules
 */
router.use('/auth', authRoutes);
router.use('/players', playersRoutes);
router.use('/matches', matchesRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/health', healthRoutes);
router.use('/friends', friendsRoutes);

export default router;
