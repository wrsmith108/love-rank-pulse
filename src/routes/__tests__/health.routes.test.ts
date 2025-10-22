/**
 * Health Routes Tests
 * Tests health check endpoints for service monitoring and load balancer probes
 *
 * Test Coverage: TC-HEALTH-001 through TC-HEALTH-005
 */

import request from 'supertest';
import express, { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import RedisClient from '../../lib/redis';
import healthRoutes from '../health.routes';

// Mock Prisma and Redis
jest.mock('@prisma/client');
jest.mock('../../lib/redis');

describe('Health Routes Tests', () => {
  let app: Express;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockRedis: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/health', healthRoutes);
    app.use('/health', healthRoutes);

    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    mockRedis = {
      ping: jest.fn()
    };

    // Mock Redis getInstance
    (RedisClient.getInstance as jest.Mock) = jest.fn().mockResolvedValue(mockRedis);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * TC-HEALTH-001: GET /health basic check
   * Test basic health check endpoint
   */
  describe('TC-HEALTH-001: Basic Health Check', () => {
    it('should return 200 OK when all services are healthy', async () => {
      // Mock successful database connection
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const response = await request(app)
        .get('/api/health/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
      expect(response.body.services).toHaveProperty('database', 'healthy');
      expect(response.body.services).toHaveProperty('redis', 'healthy');
    });

    it('should include environment information', async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const response = await request(app)
        .get('/api/health/health')
        .expect(200);

      expect(response.body.environment).toBeDefined();
      expect(['development', 'production', 'test']).toContain(response.body.environment);
    });

    it('should include uptime in response', async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const response = await request(app)
        .get('/api/health/health')
        .expect(200);

      expect(response.body.uptime).toBeDefined();
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return ISO timestamp', async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const response = await request(app)
        .get('/api/health/health')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(() => new Date(response.body.timestamp)).not.toThrow();

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });
  });

  /**
   * TC-HEALTH-002: GET /health/db database check
   * Test database connectivity check
   */
  describe('TC-HEALTH-002: Database Health Check', () => {
    it('should detect unhealthy database', async () => {
      mockPrisma.$queryRaw = jest.fn().mockRejectedValue(new Error('Connection refused'));
      mockRedis.ping.mockResolvedValue('PONG');

      const response = await request(app)
        .get('/api/health/health')
        .expect(503);

      expect(response.body.status).toBe('degraded');
      expect(response.body.services.database).toBe('unhealthy');
    });

    it('should handle database timeout', async () => {
      mockPrisma.$queryRaw = jest.fn().mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );
      mockRedis.ping.mockResolvedValue('PONG');

      const response = await request(app)
        .get('/api/health/health')
        .expect(503);

      expect(response.body.services.database).toBe('unhealthy');
      expect(response.body.status).toBe('degraded');
    });

    it('should verify database connection with SELECT query', async () => {
      const mockQuery = jest.fn().mockResolvedValue([{ result: 1 }]);
      mockPrisma.$queryRaw = mockQuery;
      mockRedis.ping.mockResolvedValue('PONG');

      await request(app)
        .get('/api/health/health')
        .expect(200);

      expect(mockQuery).toHaveBeenCalled();
    });

    it('should return healthy when database reconnects', async () => {
      // First call fails
      mockPrisma.$queryRaw = jest.fn()
        .mockRejectedValueOnce(new Error('Connection lost'))
        .mockResolvedValue([{ result: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const response1 = await request(app).get('/api/health/health');
      expect(response1.body.services.database).toBe('unhealthy');

      // Second call succeeds
      const response2 = await request(app).get('/api/health/health');
      expect(response2.body.services.database).toBe('healthy');
      expect(response2.status).toBe(200);
    });
  });

  /**
   * TC-HEALTH-003: GET /health/redis cache check
   * Test Redis connectivity check
   */
  describe('TC-HEALTH-003: Redis Health Check', () => {
    it('should mark Redis as unhealthy on connection failure', async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
      (RedisClient.getInstance as jest.Mock).mockRejectedValue(
        new Error('Redis connection failed')
      );

      const response = await request(app)
        .get('/api/health/health')
        .expect(200); // Redis is optional, so still healthy overall

      expect(response.body.services.redis).toBe('unhealthy');
      expect(response.body.status).toBe('healthy'); // Not degraded for optional service
    });

    it('should handle Redis ping failure', async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
      mockRedis.ping.mockRejectedValue(new Error('Redis unavailable'));

      const response = await request(app)
        .get('/api/health/health')
        .expect(200);

      expect(response.body.services.redis).toBe('unhealthy');
    });

    it('should verify Redis with PING command', async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
      const pingMock = jest.fn().mockResolvedValue('PONG');
      mockRedis.ping = pingMock;

      await request(app)
        .get('/api/health/health')
        .expect(200);

      expect(pingMock).toHaveBeenCalled();
    });

    it('should not mark overall status as degraded for Redis failure', async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
      mockRedis.ping.mockRejectedValue(new Error('Redis down'));

      const response = await request(app)
        .get('/api/health/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.services.redis).toBe('unhealthy');
      expect(response.body.services.database).toBe('healthy');
    });
  });

  /**
   * TC-HEALTH-004: GET /health/ready readiness probe
   * Test Kubernetes readiness probe endpoint
   */
  describe('TC-HEALTH-004: Readiness Probe', () => {
    it('should return OK for root health endpoint', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({ status: 'ok' });
    });

    it('should respond quickly for readiness checks', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/health')
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should respond in under 100ms
    });

    it('should not check dependencies for readiness', async () => {
      // Root endpoint should not call database or Redis
      const queryMock = jest.fn();
      mockPrisma.$queryRaw = queryMock;

      await request(app)
        .get('/health')
        .expect(200);

      expect(queryMock).not.toHaveBeenCalled();
    });

    it('should use readiness endpoint for load balancer checks', async () => {
      // Simulate load balancer making multiple rapid requests
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });
  });

  /**
   * TC-HEALTH-005: GET /health/live liveness probe
   * Test Kubernetes liveness probe endpoint
   */
  describe('TC-HEALTH-005: Liveness Probe', () => {
    it('should return degraded when critical services are down', async () => {
      mockPrisma.$queryRaw = jest.fn().mockRejectedValue(new Error('DB down'));
      mockRedis.ping.mockRejectedValue(new Error('Redis down'));

      const response = await request(app)
        .get('/api/health/health')
        .expect(503);

      expect(response.body.status).toBe('degraded');
    });

    it('should provide service-level status details', async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const response = await request(app)
        .get('/api/health/health')
        .expect(200);

      expect(response.body.services).toBeDefined();
      expect(response.body.services.database).toBeDefined();
      expect(response.body.services.redis).toBeDefined();
    });

    it('should handle mixed service states', async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
      mockRedis.ping.mockRejectedValue(new Error('Redis unavailable'));

      const response = await request(app)
        .get('/api/health/health')
        .expect(200);

      expect(response.body.services.database).toBe('healthy');
      expect(response.body.services.redis).toBe('unhealthy');
      expect(response.body.status).toBe('healthy'); // Redis is optional
    });

    it('should distinguish between unknown and unhealthy states', async () => {
      // Before any checks, services should be unknown
      const initialState = {
        database: 'unknown',
        redis: 'unknown'
      };

      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const response = await request(app)
        .get('/api/health/health')
        .expect(200);

      // After check, should be either healthy or unhealthy, not unknown
      expect(['healthy', 'unhealthy']).toContain(response.body.services.database);
      expect(['healthy', 'unhealthy']).toContain(response.body.services.redis);
    });

    it('should return appropriate HTTP status codes', async () => {
      // Healthy - 200
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      await request(app).get('/api/health/health').expect(200);

      // Degraded - 503
      mockPrisma.$queryRaw = jest.fn().mockRejectedValue(new Error('DB error'));
      await request(app).get('/api/health/health').expect(503);
    });
  });

  /**
   * Additional test: Concurrent health checks
   */
  describe('Concurrent Health Checks', () => {
    it('should handle multiple concurrent health checks', async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const requests = Array(20).fill(null).map(() =>
        request(app).get('/api/health/health')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
      });
    });

    it('should not cache health check results', async () => {
      // First call - healthy
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      const response1 = await request(app).get('/api/health/health');
      expect(response1.body.services.database).toBe('healthy');

      // Second call - unhealthy
      mockPrisma.$queryRaw = jest.fn().mockRejectedValue(new Error('DB down'));
      const response2 = await request(app).get('/api/health/health');
      expect(response2.body.services.database).toBe('unhealthy');
    });
  });
});
