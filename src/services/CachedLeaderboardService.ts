import { LeaderboardService } from './LeaderboardService';
import { redisCache, CacheTTL } from './redis';
import {
  Leaderboard,
  LeaderboardEntry,
  LeaderboardScope,
  TimePeriod,
  SortCriteria,
  LeaderboardFilter
} from '../models';
import { CacheResult } from '../types/cache';

/**
 * Cached Leaderboard Service
 * Wraps LeaderboardService with Redis caching layer
 */
export class CachedLeaderboardService extends LeaderboardService {
  /**
   * Get leaderboard with caching
   */
  async getCachedLeaderboard(
    scope: LeaderboardScope,
    timePeriod: TimePeriod,
    page: number = 1,
    limit: number = 50
  ): Promise<CacheResult<LeaderboardEntry[]>> {
    const scopeKey = scope.toLowerCase();
    const periodKey = timePeriod.toLowerCase();

    try {
      // Try to get from cache first
      const cachedData = await redisCache.getLeaderboard(scopeKey, periodKey, page, limit);

      if (cachedData) {
        return {
          success: true,
          data: cachedData,
          fromCache: true,
        };
      }

      // Cache miss - get from database
      const leaderboard = this.getLeaderboardsByScope(scope)
        .find(lb => lb.timePeriod === timePeriod);

      if (!leaderboard) {
        return {
          success: false,
          fromCache: false,
          error: 'Leaderboard not found',
        };
      }

      // Calculate pagination
      const offset = (page - 1) * limit;
      const paginatedEntries = leaderboard.entries.slice(offset, offset + limit);

      // Cache the result
      const ttl = this.getTTLForTimePeriod(timePeriod);
      await redisCache.setLeaderboard(scopeKey, periodKey, page, limit, paginatedEntries, ttl);

      // Also cache total count
      await redisCache.setLeaderboardTotal(scopeKey, periodKey, leaderboard.entries.length, ttl);

      return {
        success: true,
        data: paginatedEntries,
        fromCache: false,
      };
    } catch (error) {
      console.error('Error in getCachedLeaderboard:', error);

      // Fallback to database on error
      const leaderboard = this.getLeaderboardsByScope(scope)
        .find(lb => lb.timePeriod === timePeriod);

      if (leaderboard) {
        const offset = (page - 1) * limit;
        const paginatedEntries = leaderboard.entries.slice(offset, offset + limit);

        return {
          success: true,
          data: paginatedEntries,
          fromCache: false,
          error: 'Cache error - fallback to database',
        };
      }

      return {
        success: false,
        fromCache: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get player rank with caching
   */
  async getCachedPlayerRank(
    playerId: string,
    scope: LeaderboardScope,
    timePeriod: TimePeriod
  ): Promise<CacheResult<number>> {
    const scopeKey = scope.toLowerCase();
    const periodKey = timePeriod.toLowerCase();

    try {
      // Try cache first
      const cachedRank = await redisCache.getPlayerRank(playerId, scopeKey, periodKey);

      if (cachedRank !== null) {
        return {
          success: true,
          data: cachedRank,
          fromCache: true,
        };
      }

      // Cache miss - get from database
      const leaderboard = this.getLeaderboardsByScope(scope)
        .find(lb => lb.timePeriod === timePeriod);

      if (!leaderboard) {
        return {
          success: false,
          fromCache: false,
          error: 'Leaderboard not found',
        };
      }

      const rank = this.getPlayerRank(leaderboard.id, playerId);

      if (rank === -1) {
        return {
          success: false,
          fromCache: false,
          error: 'Player not found in leaderboard',
        };
      }

      // Cache the rank
      const ttl = CacheTTL.PLAYER_RANK;
      await redisCache.setPlayerRank(playerId, scopeKey, periodKey, rank, ttl);

      return {
        success: true,
        data: rank,
        fromCache: false,
      };
    } catch (error) {
      console.error('Error in getCachedPlayerRank:', error);

      // Fallback to database
      const leaderboard = this.getLeaderboardsByScope(scope)
        .find(lb => lb.timePeriod === timePeriod);

      if (leaderboard) {
        const rank = this.getPlayerRank(leaderboard.id, playerId);

        return {
          success: rank !== -1,
          data: rank !== -1 ? rank : undefined,
          fromCache: false,
          error: 'Cache error - fallback to database',
        };
      }

      return {
        success: false,
        fromCache: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get filtered leaderboard with caching
   */
  async getCachedFilteredLeaderboard(
    leaderboardId: string,
    filter: LeaderboardFilter
  ): Promise<CacheResult<LeaderboardEntry[]>> {
    try {
      // For filtered queries, we'll use a more specific cache key
      const scope = filter.friendsOnly ? 'friends' : 'global';
      const timePeriod = 'custom';
      const page = Math.floor((filter.offset || 0) / (filter.limit || 50)) + 1;
      const limit = filter.limit || 50;

      // Try cache
      const cachedData = await redisCache.getLeaderboard(scope, timePeriod, page, limit);

      if (cachedData) {
        return {
          success: true,
          data: cachedData,
          fromCache: true,
        };
      }

      // Cache miss - get from database and filter
      const filteredEntries = this.filterLeaderboard(leaderboardId, filter);

      if (filteredEntries.length === 0) {
        return {
          success: true,
          data: [],
          fromCache: false,
        };
      }

      // Cache the filtered results
      await redisCache.setLeaderboard(
        scope,
        timePeriod,
        page,
        limit,
        filteredEntries,
        CacheTTL.LEADERBOARD_SHORT
      );

      return {
        success: true,
        data: filteredEntries,
        fromCache: false,
      };
    } catch (error) {
      console.error('Error in getCachedFilteredLeaderboard:', error);

      // Fallback to database
      const filteredEntries = this.filterLeaderboard(leaderboardId, filter);

      return {
        success: true,
        data: filteredEntries,
        fromCache: false,
        error: 'Cache error - fallback to database',
      };
    }
  }

  /**
   * Invalidate leaderboard cache on update
   */
  async invalidateLeaderboardCache(
    scope: LeaderboardScope,
    timePeriod: TimePeriod
  ): Promise<void> {
    const scopeKey = scope.toLowerCase();
    const periodKey = timePeriod.toLowerCase();

    await redisCache.invalidateLeaderboard(scopeKey, periodKey);
  }

  /**
   * Invalidate player cache on stats update
   */
  async invalidatePlayerCache(playerId: string): Promise<void> {
    await redisCache.invalidatePlayerCache(playerId);
  }

  /**
   * Handle match completion - invalidate all affected caches
   */
  async handleMatchComplete(
    playerIds: string[],
    scope: LeaderboardScope = LeaderboardScope.GLOBAL,
    timePeriod: TimePeriod = TimePeriod.ALL_TIME
  ): Promise<void> {
    const scopeKey = scope.toLowerCase();
    const periodKey = timePeriod.toLowerCase();

    await redisCache.invalidateOnMatchComplete(playerIds, scopeKey, periodKey);
  }

  /**
   * Get appropriate TTL based on time period
   */
  private getTTLForTimePeriod(timePeriod: TimePeriod): number {
    switch (timePeriod) {
      case TimePeriod.SESSION:
        return CacheTTL.SESSION_LEADERBOARD;
      case TimePeriod.TODAY:
      case TimePeriod.THIS_WEEK:
        return CacheTTL.LEADERBOARD_SHORT;
      case TimePeriod.THIS_MONTH:
        return CacheTTL.LEADERBOARD_MEDIUM;
      case TimePeriod.ALL_TIME:
      default:
        return CacheTTL.LEADERBOARD_LONG;
    }
  }

  /**
   * Warm up cache with top leaderboards
   */
  async warmupCache(): Promise<void> {
    console.log('Starting cache warmup...');

    const scopes = [LeaderboardScope.GLOBAL, LeaderboardScope.COUNTRY, LeaderboardScope.SESSION];
    const periods = [TimePeriod.TODAY, TimePeriod.THIS_WEEK, TimePeriod.THIS_MONTH];

    for (const scope of scopes) {
      for (const period of periods) {
        try {
          await this.getCachedLeaderboard(scope, period, 1, 50);
        } catch (error) {
          console.error(`Error warming cache for ${scope}/${period}:`, error);
        }
      }
    }

    console.log('Cache warmup completed');
  }

  /**
   * Get cache health status
   */
  async getCacheHealth(): Promise<{
    healthy: boolean;
    stats: any;
  }> {
    const healthy = await redisCache.healthCheck();
    const stats = await redisCache.getStats();

    return {
      healthy,
      stats,
    };
  }
}

// Create and export a singleton instance
export const cachedLeaderboardService = new CachedLeaderboardService();
