/**
 * Redis Cache Layer - Usage Examples
 *
 * This file demonstrates how to integrate the Redis cache layer
 * into the Love Rank Pulse application.
 */

import {
  initializeRedisCache,
  cleanupRedisCache,
  cachedLeaderboardService,
  redisCache,
  CacheKeys,
  CacheTTL,
} from '@/services';
import { LeaderboardScope, TimePeriod } from '@/models';

// ============================================================================
// Application Initialization
// ============================================================================

/**
 * Initialize cache at application startup (main.tsx or App.tsx)
 */
export async function initializeApp() {
  console.log('Initializing Love Rank Pulse application...');

  // Initialize Redis cache
  await initializeRedisCache();

  // Warm up cache with frequently accessed data
  await cachedLeaderboardService.warmupCache();

  // Check cache health
  const health = await cachedLeaderboardService.getCacheHealth();
  console.log('Cache health:', health);

  console.log('Application initialized successfully');
}

/**
 * Cleanup on application shutdown
 */
export async function shutdownApp() {
  console.log('Shutting down application...');

  await cleanupRedisCache();

  console.log('Application shutdown complete');
}

// Add to window beforeunload event
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', shutdownApp);
}

// ============================================================================
// Leaderboard Component Integration
// ============================================================================

/**
 * Example: Fetch leaderboard with caching for LeaderboardTable component
 */
export async function fetchLeaderboard(
  scope: LeaderboardScope = LeaderboardScope.GLOBAL,
  timePeriod: TimePeriod = TimePeriod.TODAY,
  page: number = 1,
  pageSize: number = 50
) {
  // Use cached leaderboard service
  const result = await cachedLeaderboardService.getCachedLeaderboard(
    scope,
    timePeriod,
    page,
    pageSize
  );

  if (!result.success) {
    console.error('Failed to fetch leaderboard:', result.error);
    return {
      data: [],
      fromCache: false,
      error: result.error,
    };
  }

  // Log cache performance
  console.log(`Leaderboard loaded (${result.fromCache ? 'CACHE HIT' : 'CACHE MISS'})`);

  return {
    data: result.data,
    fromCache: result.fromCache,
    error: result.error,
  };
}

/**
 * Example: Fetch player rank with caching
 */
export async function fetchPlayerRank(
  playerId: string,
  scope: LeaderboardScope = LeaderboardScope.GLOBAL,
  timePeriod: TimePeriod = TimePeriod.ALL_TIME
) {
  const result = await cachedLeaderboardService.getCachedPlayerRank(
    playerId,
    scope,
    timePeriod
  );

  if (!result.success) {
    console.error('Failed to fetch player rank:', result.error);
    return null;
  }

  console.log(`Player rank: ${result.data} (${result.fromCache ? 'cached' : 'database'})`);

  return result.data;
}

// ============================================================================
// Match Completion Handler
// ============================================================================

/**
 * Example: Handle match completion and invalidate caches
 */
export async function handleMatchCompletion(matchData: {
  matchId: string;
  playerIds: string[];
  scope: LeaderboardScope;
  timePeriod: TimePeriod;
}) {
  console.log(`Processing match completion: ${matchData.matchId}`);

  try {
    // Process match results (your existing logic)
    // await processMatchResults(matchData);

    // Invalidate all affected caches
    await cachedLeaderboardService.handleMatchComplete(
      matchData.playerIds,
      matchData.scope,
      matchData.timePeriod
    );

    console.log(`Cache invalidated for ${matchData.playerIds.length} players`);
  } catch (error) {
    console.error('Error handling match completion:', error);
  }
}

// ============================================================================
// Real-time Updates Integration
// ============================================================================

/**
 * Example: WebSocket handler for live leaderboard updates
 */
export async function handleLeaderboardUpdate(update: {
  scope: string;
  timePeriod: string;
  updatedPlayers: string[];
}) {
  console.log('Received leaderboard update:', update);

  // Invalidate affected leaderboard caches
  await redisCache.invalidateLeaderboard(update.scope, update.timePeriod);

  // Invalidate individual player caches
  for (const playerId of update.updatedPlayers) {
    await redisCache.invalidatePlayerCache(playerId);
  }

  console.log('Caches invalidated, clients should refresh');
}

// ============================================================================
// React Component Examples
// ============================================================================

/**
 * Example: React component using cached leaderboard
 */
export function LeaderboardComponentExample() {
  // This is TypeScript example code, not actual React code
  const [leaderboardData, setLeaderboardData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [fromCache, setFromCache] = React.useState(false);

  React.useEffect(() => {
    async function loadLeaderboard() {
      setLoading(true);

      const result = await fetchLeaderboard(
        LeaderboardScope.GLOBAL,
        TimePeriod.TODAY,
        1,
        50
      );

      setLeaderboardData(result.data);
      setFromCache(result.fromCache);
      setLoading(false);
    }

    loadLeaderboard();

    // Refresh every 60 seconds
    const interval = setInterval(loadLeaderboard, 60000);

    return () => clearInterval(interval);
  }, []);

  return {
    leaderboardData,
    loading,
    fromCache,
  };
}

/**
 * Example: Player stats with caching
 */
export async function fetchPlayerStats(playerId: string) {
  const cacheKey = CacheKeys.PLAYER_STATS(playerId);

  // Try to get from cache using direct Redis operations
  const cachedStats = await redisCache.getPlayerRank(
    playerId,
    'global',
    'all-time'
  );

  if (cachedStats !== null) {
    console.log('Player stats loaded from cache');
    return cachedStats;
  }

  // Fetch from database (your existing logic)
  // const stats = await fetchPlayerStatsFromDatabase(playerId);

  // Cache the result
  // await redisCache.setPlayerRank(
  //   playerId,
  //   'global',
  //   'all-time',
  //   stats.rank,
  //   CacheTTL.PLAYER_STATS
  // );

  return null;
}

// ============================================================================
// Performance Monitoring
// ============================================================================

/**
 * Example: Monitor cache performance
 */
export async function monitorCachePerformance() {
  const stats = await redisCache.getStats();

  if (stats) {
    console.log('=== Redis Cache Statistics ===');
    console.log(`Connected: ${stats.connected}`);
    console.log(`Database Size: ${stats.dbSize} keys`);
    console.log(`Memory Used: ${stats.memoryUsed}`);
    console.log(`Uptime: ${Math.floor(stats.uptime / 60)} minutes`);
    console.log('==============================');
  } else {
    console.warn('Cache statistics unavailable');
  }
}

/**
 * Example: Health check endpoint (for monitoring systems)
 */
export async function cacheHealthCheck() {
  const healthy = await redisCache.healthCheck();
  const stats = await redisCache.getStats();

  return {
    status: healthy ? 'healthy' : 'unhealthy',
    connected: redisCache.isReady(),
    stats,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Cache Warming Strategies
// ============================================================================

/**
 * Example: Warm cache with top leaderboards
 */
export async function warmCacheForNewSession() {
  console.log('Warming cache for new session...');

  const scopes = [LeaderboardScope.GLOBAL, LeaderboardScope.COUNTRY];
  const periods = [TimePeriod.TODAY, TimePeriod.THIS_WEEK];

  for (const scope of scopes) {
    for (const period of periods) {
      await cachedLeaderboardService.getCachedLeaderboard(scope, period, 1, 50);
      console.log(`Cached ${scope} / ${period}`);
    }
  }

  console.log('Cache warming complete');
}

// ============================================================================
// Error Handling Examples
// ============================================================================

/**
 * Example: Graceful error handling with fallback
 */
export async function robustLeaderboardFetch(
  scope: LeaderboardScope,
  timePeriod: TimePeriod
) {
  try {
    // Try cached service first
    const result = await cachedLeaderboardService.getCachedLeaderboard(
      scope,
      timePeriod
    );

    if (result.success) {
      if (result.error) {
        // Cache error but database fallback succeeded
        console.warn('Cache unavailable, using database:', result.error);
      }
      return result.data;
    }

    // Both cache and database failed
    throw new Error(result.error || 'Unknown error');

  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);

    // Return empty array as last resort
    return [];
  }
}

// ============================================================================
// Testing Utilities
// ============================================================================

/**
 * Example: Clear cache for testing
 */
export async function clearCacheForTesting() {
  if (process.env.NODE_ENV === 'test') {
    await redisCache.clearAll();
    console.log('Test cache cleared');
  }
}

/**
 * Example: Verify cache is working
 */
export async function verifyCacheWorking() {
  // First call should miss cache
  const result1 = await cachedLeaderboardService.getCachedLeaderboard(
    LeaderboardScope.GLOBAL,
    TimePeriod.TODAY
  );

  console.assert(result1.fromCache === false, 'First call should miss cache');

  // Second call should hit cache
  const result2 = await cachedLeaderboardService.getCachedLeaderboard(
    LeaderboardScope.GLOBAL,
    TimePeriod.TODAY
  );

  console.assert(result2.fromCache === true, 'Second call should hit cache');

  console.log('✅ Cache verification passed');
}

// Export all examples
export default {
  initializeApp,
  shutdownApp,
  fetchLeaderboard,
  fetchPlayerRank,
  handleMatchCompletion,
  handleLeaderboardUpdate,
  monitorCachePerformance,
  cacheHealthCheck,
  warmCacheForNewSession,
  robustLeaderboardFetch,
  clearCacheForTesting,
  verifyCacheWorking,
};
