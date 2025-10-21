import { createClient, RedisClientType, RedisClientOptions } from 'redis';
import { LeaderboardEntry } from '../models';

/**
 * Redis Cache Configuration
 */
export interface RedisCacheConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  connectionPoolSize?: number;
  retryAttempts?: number;
  retryDelay?: number;
  connectTimeout?: number;
  commandTimeout?: number;
  enableOfflineQueue?: boolean;
}

/**
 * Cache Key Patterns
 */
export const CacheKeys = {
  LEADERBOARD: (scope: string, timePeriod: string, page: number, limit: number) =>
    `leaderboard:${scope}:${timePeriod}:${page}:${limit}`,
  LEADERBOARD_TOTAL: (scope: string, timePeriod: string) =>
    `leaderboard:total:${scope}:${timePeriod}`,
  PLAYER_RANK: (playerId: string, scope: string, timePeriod: string) =>
    `player:rank:${playerId}:${scope}:${timePeriod}`,
  PLAYER_STATS: (playerId: string) =>
    `player:stats:${playerId}`,
  SESSION_LEADERBOARD: (sessionId: string) =>
    `session:leaderboard:${sessionId}`,
  COUNTRY_LEADERBOARD: (countryCode: string, timePeriod: string) =>
    `country:leaderboard:${countryCode}:${timePeriod}`,
  GLOBAL_LEADERBOARD: (timePeriod: string) =>
    `global:leaderboard:${timePeriod}`,
  TOP_PLAYERS: (scope: string, limit: number) =>
    `top:players:${scope}:${limit}`,
} as const;

/**
 * Cache TTL Configurations (in seconds)
 */
export const CacheTTL = {
  LEADERBOARD_SHORT: 60,           // 1 minute for active leaderboards
  LEADERBOARD_MEDIUM: 300,         // 5 minutes for recent data
  LEADERBOARD_LONG: 3600,          // 1 hour for historical data
  PLAYER_RANK: 120,                // 2 minutes for player ranks
  PLAYER_STATS: 600,               // 10 minutes for player stats
  SESSION_LEADERBOARD: 30,         // 30 seconds for live session
  TOP_PLAYERS: 180,                // 3 minutes for top players
} as const;

/**
 * Redis Cache Client with Connection Pooling
 */
export class RedisCache {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;
  private config: RedisCacheConfig;

  constructor(config: RedisCacheConfig = {}) {
    this.config = {
      host: config.host || process.env.REDIS_HOST || 'localhost',
      port: config.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: config.password || process.env.REDIS_PASSWORD,
      db: config.db || parseInt(process.env.REDIS_DB || '0'),
      connectionPoolSize: config.connectionPoolSize || 10,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      connectTimeout: config.connectTimeout || 10000,
      commandTimeout: config.commandTimeout || 5000,
      enableOfflineQueue: config.enableOfflineQueue ?? false,
    };
  }

  /**
   * Initialize Redis connection with retry logic
   */
  async connect(): Promise<void> {
    // Return existing connection promise if already connecting
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Return immediately if already connected
    if (this.isConnected && this.client) {
      return Promise.resolve();
    }

    this.connectionPromise = this._connect();

    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  /**
   * Internal connection method with retry logic
   */
  private async _connect(): Promise<void> {
    const options: RedisClientOptions = {
      socket: {
        host: this.config.host,
        port: this.config.port,
        connectTimeout: this.config.connectTimeout,
      },
      password: this.config.password,
      database: this.config.db,
      disableOfflineQueue: !this.config.enableOfflineQueue,
    };

    this.client = createClient(options);

    // Set up error handler
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    // Set up reconnection handler
    this.client.on('reconnecting', () => {
      console.log('Redis Client reconnecting...');
    });

    // Set up ready handler
    this.client.on('ready', () => {
      console.log('Redis Client ready');
      this.isConnected = true;
    });

    // Connect with retry logic
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.config.retryAttempts!; attempt++) {
      try {
        await this.client.connect();
        this.isConnected = true;
        console.log(`Redis connected successfully (attempt ${attempt}/${this.config.retryAttempts})`);
        return;
      } catch (error) {
        lastError = error as Error;
        console.error(`Redis connection attempt ${attempt}/${this.config.retryAttempts} failed:`, error);

        if (attempt < this.config.retryAttempts!) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }

    // If all retries failed, log warning but don't throw - allow fallback to database
    console.warn('Redis connection failed after all retries. Falling back to database.');
    this.isConnected = false;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      this.client = null;
    }
  }

  /**
   * Check if Redis is connected
   */
  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Get cached leaderboard data
   */
  async getLeaderboard(
    scope: string,
    timePeriod: string,
    page: number = 1,
    limit: number = 50
  ): Promise<LeaderboardEntry[] | null> {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping cache read');
      return null;
    }

    try {
      const key = CacheKeys.LEADERBOARD(scope, timePeriod, page, limit);
      const data = await this.client!.get(key);

      if (data) {
        return JSON.parse(data) as LeaderboardEntry[];
      }
      return null;
    } catch (error) {
      console.error('Error getting leaderboard from cache:', error);
      return null;
    }
  }

  /**
   * Cache leaderboard data with TTL
   */
  async setLeaderboard(
    scope: string,
    timePeriod: string,
    page: number,
    limit: number,
    data: LeaderboardEntry[],
    ttl: number = CacheTTL.LEADERBOARD_MEDIUM
  ): Promise<boolean> {
    if (!this.isReady()) {
      console.warn('Redis not ready, skipping cache write');
      return false;
    }

    try {
      const key = CacheKeys.LEADERBOARD(scope, timePeriod, page, limit);
      await this.client!.setEx(key, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error setting leaderboard in cache:', error);
      return false;
    }
  }

  /**
   * Get total player count for leaderboard
   */
  async getLeaderboardTotal(scope: string, timePeriod: string): Promise<number | null> {
    if (!this.isReady()) {
      return null;
    }

    try {
      const key = CacheKeys.LEADERBOARD_TOTAL(scope, timePeriod);
      const total = await this.client!.get(key);
      return total ? parseInt(total, 10) : null;
    } catch (error) {
      console.error('Error getting leaderboard total from cache:', error);
      return null;
    }
  }

  /**
   * Cache total player count
   */
  async setLeaderboardTotal(
    scope: string,
    timePeriod: string,
    total: number,
    ttl: number = CacheTTL.LEADERBOARD_MEDIUM
  ): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const key = CacheKeys.LEADERBOARD_TOTAL(scope, timePeriod);
      await this.client!.setEx(key, ttl, total.toString());
      return true;
    } catch (error) {
      console.error('Error setting leaderboard total in cache:', error);
      return false;
    }
  }

  /**
   * Get cached player rank
   */
  async getPlayerRank(playerId: string, scope: string, timePeriod: string): Promise<number | null> {
    if (!this.isReady()) {
      return null;
    }

    try {
      const key = CacheKeys.PLAYER_RANK(playerId, scope, timePeriod);
      const rank = await this.client!.get(key);
      return rank ? parseInt(rank, 10) : null;
    } catch (error) {
      console.error('Error getting player rank from cache:', error);
      return null;
    }
  }

  /**
   * Cache player rank with TTL
   */
  async setPlayerRank(
    playerId: string,
    scope: string,
    timePeriod: string,
    rank: number,
    ttl: number = CacheTTL.PLAYER_RANK
  ): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const key = CacheKeys.PLAYER_RANK(playerId, scope, timePeriod);
      await this.client!.setEx(key, ttl, rank.toString());
      return true;
    } catch (error) {
      console.error('Error setting player rank in cache:', error);
      return false;
    }
  }

  /**
   * Invalidate all leaderboard caches
   */
  async invalidateLeaderboard(scope?: string, timePeriod?: string): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      let pattern: string;

      if (scope && timePeriod) {
        // Invalidate specific leaderboard
        pattern = `leaderboard:${scope}:${timePeriod}:*`;
      } else if (scope) {
        // Invalidate all leaderboards for a scope
        pattern = `leaderboard:${scope}:*`;
      } else {
        // Invalidate all leaderboards
        pattern = 'leaderboard:*';
      }

      const keys = await this.client!.keys(pattern);

      if (keys.length > 0) {
        await this.client!.del(keys);
        console.log(`Invalidated ${keys.length} leaderboard cache keys`);
      }

      return true;
    } catch (error) {
      console.error('Error invalidating leaderboard cache:', error);
      return false;
    }
  }

  /**
   * Invalidate player-specific caches
   */
  async invalidatePlayerCache(playerId: string): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const patterns = [
        `player:rank:${playerId}:*`,
        `player:stats:${playerId}`,
      ];

      for (const pattern of patterns) {
        const keys = await this.client!.keys(pattern);
        if (keys.length > 0) {
          await this.client!.del(keys);
        }
      }

      return true;
    } catch (error) {
      console.error('Error invalidating player cache:', error);
      return false;
    }
  }

  /**
   * Batch invalidation on match completion
   */
  async invalidateOnMatchComplete(
    playerIds: string[],
    scope: string = 'global',
    timePeriod: string = 'all-time'
  ): Promise<void> {
    if (!this.isReady()) {
      return;
    }

    try {
      // Invalidate leaderboards affected by match
      await this.invalidateLeaderboard(scope, timePeriod);

      // Invalidate all affected players
      await Promise.all(
        playerIds.map(playerId => this.invalidatePlayerCache(playerId))
      );

      console.log(`Cache invalidated for ${playerIds.length} players in ${scope}/${timePeriod}`);
    } catch (error) {
      console.error('Error invalidating cache on match complete:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    dbSize: number;
    memoryUsed: string;
    uptime: number;
  } | null> {
    if (!this.isReady()) {
      return null;
    }

    try {
      const info = await this.client!.info('stats');
      const dbSize = await this.client!.dbSize();

      // Parse info string
      const lines = info.split('\r\n');
      const stats: Record<string, string> = {};
      lines.forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      });

      return {
        connected: this.isConnected,
        dbSize,
        memoryUsed: stats['used_memory_human'] || 'unknown',
        uptime: parseInt(stats['uptime_in_seconds'] || '0', 10),
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      await this.client!.flushDb();
      console.log('All cache cleared');
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const result = await this.client!.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}

/**
 * Default Redis cache instance
 */
export const redisCache = new RedisCache();

/**
 * Initialize Redis connection (call this at app startup)
 */
export async function initializeRedisCache(): Promise<void> {
  try {
    await redisCache.connect();
    console.log('Redis cache initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Redis cache:', error);
    // Don't throw - allow app to continue with database fallback
  }
}

/**
 * Cleanup Redis connection (call this at app shutdown)
 */
export async function cleanupRedisCache(): Promise<void> {
  try {
    await redisCache.disconnect();
    console.log('Redis cache disconnected successfully');
  } catch (error) {
    console.error('Error disconnecting Redis cache:', error);
  }
}
