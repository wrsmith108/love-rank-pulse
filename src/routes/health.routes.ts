import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import RedisClient from '../lib/redis';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'unknown',
      redis: 'unknown'
    }
  };

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'healthy';
  } catch (error) {
    health.services.database = 'unhealthy';
    health.status = 'degraded';
  }

  try {
    // Check Redis connection
    const redis = await RedisClient.getInstance();
    await redis.ping();
    health.services.redis = 'healthy';
  } catch (error) {
    health.services.redis = 'unhealthy';
    // Redis is optional, so don't mark as degraded
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * GET /health (root level health check for load balancers)
 */
router.get('/', async (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

export default router;
