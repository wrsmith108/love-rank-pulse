/**
 * Centralized Health Check Service
 * Monitors database, cache, and application health
 */

import { healthCheck as dbHealthCheck } from './database';
import { cacheHealthCheck } from './cache';

/**
 * Overall system health status
 */
export interface SystemHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime: number;
      error?: string;
    };
    cache: {
      status: 'healthy' | 'unhealthy';
      responseTime: number;
      error?: string;
    };
    application: {
      status: 'healthy';
      uptime: number;
      memory: {
        used: number;
        total: number;
        percentage: number;
      };
    };
  };
}

/**
 * Perform comprehensive system health check
 */
export async function checkSystemHealth(): Promise<SystemHealthStatus> {
  const startTime = Date.now();

  // Run health checks in parallel
  const [dbHealth, cacheHealth] = await Promise.allSettled([
    dbHealthCheck(),
    cacheHealthCheck(),
  ]);

  // Extract database health
  const database = {
    status: (dbHealth.status === 'fulfilled' && dbHealth.value.status === 'healthy'
      ? 'healthy'
      : 'unhealthy') as 'healthy' | 'unhealthy',
    responseTime: dbHealth.status === 'fulfilled' ? dbHealth.value.responseTime : Date.now() - startTime,
    error: dbHealth.status === 'fulfilled' ? dbHealth.value.error : dbHealth.reason?.message,
  };

  // Extract cache health
  const cache = {
    status: (cacheHealth.status === 'fulfilled' && cacheHealth.value.status === 'healthy'
      ? 'healthy'
      : 'unhealthy') as 'healthy' | 'unhealthy',
    responseTime: cacheHealth.status === 'fulfilled' ? cacheHealth.value.responseTime : Date.now() - startTime,
    error: cacheHealth.status === 'fulfilled' ? cacheHealth.value.error : cacheHealth.reason?.message,
  };

  // Get application metrics
  const memoryUsage = process.memoryUsage();
  const application = {
    status: 'healthy' as const,
    uptime: process.uptime(),
    memory: {
      used: memoryUsage.heapUsed,
      total: memoryUsage.heapTotal,
      percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
    },
  };

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (database.status === 'healthy' && cache.status === 'healthy') {
    overallStatus = 'healthy';
  } else if (database.status === 'healthy' || cache.status === 'healthy') {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'unhealthy';
  }

  return {
    status: overallStatus,
    timestamp: new Date(),
    services: {
      database,
      cache,
      application,
    },
  };
}

/**
 * Simple readiness check (returns boolean)
 */
export async function isSystemReady(): Promise<boolean> {
  const health = await checkSystemHealth();
  return health.status === 'healthy' || health.status === 'degraded';
}

/**
 * Simple liveness check (returns boolean)
 */
export async function isSystemAlive(): Promise<boolean> {
  const health = await checkSystemHealth();
  return health.status !== 'unhealthy';
}

/**
 * Format health status for logging
 */
export function formatHealthStatus(health: SystemHealthStatus): string {
  const lines = [
    `System Health: ${health.status.toUpperCase()}`,
    `Timestamp: ${health.timestamp.toISOString()}`,
    '',
    'Services:',
    `  Database: ${health.services.database.status} (${health.services.database.responseTime}ms)`,
    health.services.database.error ? `    Error: ${health.services.database.error}` : '',
    `  Cache: ${health.services.cache.status} (${health.services.cache.responseTime}ms)`,
    health.services.cache.error ? `    Error: ${health.services.cache.error}` : '',
    `  Application: ${health.services.application.status}`,
    `    Uptime: ${Math.round(health.services.application.uptime)}s`,
    `    Memory: ${health.services.application.memory.percentage}% (${Math.round(health.services.application.memory.used / 1024 / 1024)}MB / ${Math.round(health.services.application.memory.total / 1024 / 1024)}MB)`,
  ];

  return lines.filter(line => line !== '').join('\n');
}

/**
 * Health check middleware for Express/HTTP servers
 */
export function createHealthCheckHandler() {
  return async (req: any, res: any) => {
    try {
      const health = await checkSystemHealth();

      const statusCode =
        health.status === 'healthy' ? 200 :
        health.status === 'degraded' ? 207 :
        503;

      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date(),
        error: (error as Error).message,
      });
    }
  };
}

/**
 * Readiness check middleware
 */
export function createReadinessHandler() {
  return async (req: any, res: any) => {
    try {
      const ready = await isSystemReady();
      res.status(ready ? 200 : 503).json({
        ready,
        timestamp: new Date(),
      });
    } catch (error) {
      res.status(503).json({
        ready: false,
        timestamp: new Date(),
        error: (error as Error).message,
      });
    }
  };
}

/**
 * Liveness check middleware
 */
export function createLivenessHandler() {
  return async (req: any, res: any) => {
    try {
      const alive = await isSystemAlive();
      res.status(alive ? 200 : 503).json({
        alive,
        timestamp: new Date(),
      });
    } catch (error) {
      res.status(503).json({
        alive: false,
        timestamp: new Date(),
        error: (error as Error).message,
      });
    }
  };
}
