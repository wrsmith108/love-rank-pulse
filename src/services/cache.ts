/**
 * Cache Service - Redis Connection Configuration
 * Handles Redis connection pooling, retry logic, and caching utilities
 */

import { createClient, RedisClientType, RedisClientOptions } from 'redis';

// Environment variables with defaults
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/0';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const REDIS_POOL_MIN = parseInt(process.env.REDIS_POOL_MIN || '2', 10);
const REDIS_POOL_MAX = parseInt(process.env.REDIS_POOL_MAX || '10', 10);
const REDIS_CONNECTION_TIMEOUT = parseInt(process.env.REDIS_CONNECTION_TIMEOUT || '5000', 10);
const REDIS_COMMAND_TIMEOUT = parseInt(process.env.REDIS_COMMAND_TIMEOUT || '3000', 10);
const REDIS_MAX_RETRIES = parseInt(process.env.REDIS_MAX_RETRIES || '3', 10);
const REDIS_RETRY_DELAY = parseInt(process.env.REDIS_RETRY_DELAY || '100', 10);

// Cache TTL defaults (in seconds)
const CACHE_TTL_LEADERBOARD = parseInt(process.env.CACHE_TTL_LEADERBOARD || '300', 10);
const CACHE_TTL_PLAYER_STATS = parseInt(process.env.CACHE_TTL_PLAYER_STATS || '600', 10);
const CACHE_TTL_MATCH_DATA = parseInt(process.env.CACHE_TTL_MATCH_DATA || '120', 10);
const CACHE_TTL_COUNTRY_STATS = parseInt(process.env.CACHE_TTL_COUNTRY_STATS || '900', 10);
const CACHE_TTL_SESSION_DATA = parseInt(process.env.CACHE_TTL_SESSION_DATA || '180', 10);

/**
 * Redis client singleton instance
 */
let redisClient: RedisClientType | null = null;

/**
 * Cache configuration interface
 */
interface CacheConfig {
  url: string;
  password?: string;
  connectionTimeout: number;
  commandTimeout: number;
  maxRetries: number;
  retryDelay: number;
}

/**
 * Health check result interface
 */
interface CacheHealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  responseTime: number;
  error?: string;
  details?: {
    connected: boolean;
    ping?: string;
  };
}

/**
 * Cache entry metadata interface
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Get cache configuration from environment variables
 */
function getCacheConfig(): CacheConfig {
  return {
    url: REDIS_URL,
    password: REDIS_PASSWORD || undefined,
    connectionTimeout: REDIS_CONNECTION_TIMEOUT,
    commandTimeout: REDIS_COMMAND_TIMEOUT,
    maxRetries: REDIS_MAX_RETRIES,
    retryDelay: REDIS_RETRY_DELAY,
  };
}

/**
 * Create Redis client with connection pooling and retry logic
 */
function createRedisClient(): RedisClientType {
  const config = getCacheConfig();

  const options: RedisClientOptions = {
    url: config.url,
    password: config.password,
    socket: {
      connectTimeout: config.connectionTimeout,
      reconnectStrategy: (retries: number) => {
        if (retries > config.maxRetries) {
          console.error('[Cache] Max retries exceeded, giving up');
          return new Error('Max retries exceeded');
        }
        const delay = Math.min(config.retryDelay * Math.pow(2, retries), 5000);
        console.log(`[Cache] Retry attempt ${retries}, waiting ${delay}ms`);
        return delay;
      },
    },
    commandsQueueMaxLength: REDIS_POOL_MAX,
  };

  const client = createClient(options) as RedisClientType;

  // Set up event listeners
  client.on('error', (err) => {
    console.error('[Cache] Redis client error:', err);
  });

  client.on('connect', () => {
    console.log('[Cache] Redis client connected');
  });

  client.on('ready', () => {
    console.log('[Cache] Redis client ready');
  });

  client.on('reconnecting', () => {
    console.log('[Cache] Redis client reconnecting...');
  });

  return client;
}

/**
 * Initialize Redis connection with retry logic
 * @param maxRetries - Maximum number of connection attempts
 * @param retryDelay - Delay between retries in milliseconds
 */
export async function initializeCache(
  maxRetries: number = 5,
  retryDelay: number = 2000
): Promise<RedisClientType> {
  if (redisClient?.isOpen) {
    console.log('[Cache] Using existing connection');
    return redisClient;
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Cache] Connection attempt ${attempt}/${maxRetries}`);

      redisClient = createRedisClient();
      await redisClient.connect();

      // Test connection
      await redisClient.ping();

      console.log('[Cache] Successfully connected to Redis');
      console.log(`[Cache] Pool configuration: min=${REDIS_POOL_MIN}, max=${REDIS_POOL_MAX}`);

      return redisClient;
    } catch (error) {
      lastError = error as Error;
      console.error(`[Cache] Connection attempt ${attempt} failed:`, error);

      if (redisClient) {
        await redisClient.quit().catch(() => {});
        redisClient = null;
      }

      if (attempt < maxRetries) {
        console.log(`[Cache] Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw new Error(
    `Failed to connect to Redis after ${maxRetries} attempts: ${lastError?.message}`
  );
}

/**
 * Get or create Redis client instance
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient || !redisClient.isOpen) {
    throw new Error('Cache not initialized. Call initializeCache() first.');
  }
  return redisClient;
}

/**
 * Gracefully close Redis connection
 */
export async function closeCache(): Promise<void> {
  if (!redisClient) {
    console.log('[Cache] No active connection to close');
    return;
  }

  try {
    console.log('[Cache] Closing connection...');
    await redisClient.quit();
    redisClient = null;
    console.log('[Cache] Connection closed successfully');
  } catch (error) {
    console.error('[Cache] Error closing connection:', error);
    throw error;
  }
}

/**
 * Perform cache health check
 */
export async function cacheHealthCheck(): Promise<CacheHealthCheckResult> {
  const startTime = Date.now();

  if (!redisClient || !redisClient.isOpen) {
    return {
      status: 'unhealthy',
      timestamp: new Date(),
      responseTime: Date.now() - startTime,
      error: 'Cache not initialized',
      details: {
        connected: false,
      },
    };
  }

  try {
    const pong = await redisClient.ping();
    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      timestamp: new Date(),
      responseTime,
      details: {
        connected: true,
        ping: pong,
      },
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      status: 'unhealthy',
      timestamp: new Date(),
      responseTime,
      error: (error as Error).message,
      details: {
        connected: false,
      },
    };
  }
}

/**
 * Set cache value with TTL
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttl: number = 300
): Promise<void> {
  const client = getRedisClient();
  const entry: CacheEntry<T> = {
    data: value,
    timestamp: Date.now(),
    ttl,
  };

  await client.setEx(key, ttl, JSON.stringify(entry));
}

/**
 * Get cache value
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  const value = await client.get(key);

  if (!value) {
    return null;
  }

  try {
    const entry: CacheEntry<T> = JSON.parse(value);
    return entry.data;
  } catch (error) {
    console.error('[Cache] Error parsing cache value:', error);
    return null;
  }
}

/**
 * Delete cache value
 */
export async function deleteCache(key: string): Promise<void> {
  const client = getRedisClient();
  await client.del(key);
}

/**
 * Clear all cache values matching pattern
 */
export async function clearCachePattern(pattern: string): Promise<void> {
  const client = getRedisClient();
  const keys = await client.keys(pattern);

  if (keys.length > 0) {
    await client.del(keys);
  }
}

/**
 * Cache leaderboard data
 */
export async function cacheLeaderboard<T>(
  leaderboardType: string,
  data: T,
  customTTL?: number
): Promise<void> {
  const key = `leaderboard:${leaderboardType}`;
  await setCache(key, data, customTTL || CACHE_TTL_LEADERBOARD);
}

/**
 * Get cached leaderboard data
 */
export async function getCachedLeaderboard<T>(
  leaderboardType: string
): Promise<T | null> {
  const key = `leaderboard:${leaderboardType}`;
  return getCache<T>(key);
}

/**
 * Cache player statistics
 */
export async function cachePlayerStats<T>(
  playerId: string,
  data: T,
  customTTL?: number
): Promise<void> {
  const key = `player:${playerId}:stats`;
  await setCache(key, data, customTTL || CACHE_TTL_PLAYER_STATS);
}

/**
 * Get cached player statistics
 */
export async function getCachedPlayerStats<T>(
  playerId: string
): Promise<T | null> {
  const key = `player:${playerId}:stats`;
  return getCache<T>(key);
}

/**
 * Cache match data
 */
export async function cacheMatchData<T>(
  matchId: string,
  data: T,
  customTTL?: number
): Promise<void> {
  const key = `match:${matchId}`;
  await setCache(key, data, customTTL || CACHE_TTL_MATCH_DATA);
}

/**
 * Get cached match data
 */
export async function getCachedMatchData<T>(
  matchId: string
): Promise<T | null> {
  const key = `match:${matchId}`;
  return getCache<T>(key);
}

/**
 * Invalidate all caches for a specific entity type
 */
export async function invalidateEntityCache(entityType: 'leaderboard' | 'player' | 'match'): Promise<void> {
  await clearCachePattern(`${entityType}:*`);
  console.log(`[Cache] Invalidated all ${entityType} caches`);
}

/**
 * Get cache connection metrics
 */
export function getCacheMetrics() {
  return {
    poolMin: REDIS_POOL_MIN,
    poolMax: REDIS_POOL_MAX,
    connectionTimeout: REDIS_CONNECTION_TIMEOUT,
    commandTimeout: REDIS_COMMAND_TIMEOUT,
    maxRetries: REDIS_MAX_RETRIES,
    isInitialized: redisClient !== null && redisClient.isOpen,
    ttls: {
      leaderboard: CACHE_TTL_LEADERBOARD,
      playerStats: CACHE_TTL_PLAYER_STATS,
      matchData: CACHE_TTL_MATCH_DATA,
      countryStats: CACHE_TTL_COUNTRY_STATS,
      sessionData: CACHE_TTL_SESSION_DATA,
    },
  };
}

// Graceful shutdown handler
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    console.log('[Cache] Received SIGINT, closing connection...');
    await closeCache();
  });

  process.on('SIGTERM', async () => {
    console.log('[Cache] Received SIGTERM, closing connection...');
    await closeCache();
  });
}
