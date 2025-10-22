// Export all services from a single entry point

// Export original service implementations (for backward compatibility)
export * from './PlayerService';
export * from './MatchService';
export * from './LeaderboardService';

// Export singleton instances for backward compatibility
import LeaderboardService from './LeaderboardService';
export { LeaderboardService };
export const leaderboardService = new LeaderboardService();

// Export API Gateway adapter
export * from './ApiGatewayAdapter';

// Export Redis cache layer
export * from './redis';
export * from './CachedLeaderboardService';

// Database and cache services
export {
  initializeDatabase,
  closeDatabase,
  getPrismaClient,
  healthCheck as databaseHealthCheck,
  withTransaction,
  executeRawQuery,
  getConnectionMetrics,
} from './database';

export {
  initializeCache,
  closeCache,
  getRedisClient,
  cacheHealthCheck,
  setCache,
  getCache,
  deleteCache,
  clearCachePattern,
  cacheLeaderboard,
  getCachedLeaderboard,
  cachePlayerStats,
  getCachedPlayerStats,
  cacheMatchData,
  getCachedMatchData,
  invalidateEntityCache,
  getCacheMetrics,
} from './cache';

// Health check service
export {
  checkSystemHealth,
  isSystemReady,
  isSystemAlive,
  formatHealthStatus,
  createHealthCheckHandler,
  createReadinessHandler,
  createLivenessHandler,
} from './healthCheck';

// Type exports
export type { PrismaClient } from './database';
export type { SystemHealthStatus } from './healthCheck';