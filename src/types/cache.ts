/**
 * Type definitions for Redis cache operations
 */

/**
 * Cache operation result
 */
export interface CacheResult<T> {
  success: boolean;
  data?: T;
  fromCache: boolean;
  error?: string;
}

/**
 * Cache invalidation options
 */
export interface CacheInvalidationOptions {
  scope?: string;
  timePeriod?: string;
  playerId?: string;
  immediate?: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  connected: boolean;
  dbSize: number;
  memoryUsed: string;
  uptime: number;
  hitRate?: number;
  missRate?: number;
}

/**
 * Cache health status
 */
export interface CacheHealthStatus {
  healthy: boolean;
  connected: boolean;
  latency?: number;
  lastCheck: Date;
  error?: string;
}

/**
 * Cache key metadata
 */
export interface CacheKeyMetadata {
  key: string;
  ttl: number;
  type: 'leaderboard' | 'player' | 'stats' | 'session';
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
  ttl?: number;
  namespace?: string;
  compression?: boolean;
  serialization?: 'json' | 'msgpack';
}

/**
 * Batch cache operation
 */
export interface BatchCacheOperation<T> {
  key: string;
  value?: T;
  ttl?: number;
  operation: 'get' | 'set' | 'delete';
}

/**
 * Cache eviction policy
 */
export type CacheEvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'ttl';

/**
 * Cache warming strategy
 */
export interface CacheWarmingStrategy {
  enabled: boolean;
  targets: Array<{
    key: string;
    loader: () => Promise<any>;
    ttl: number;
  }>;
  schedule?: string; // Cron expression
}

/**
 * Cache metrics
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  avgLatency: number;
  totalOperations: number;
}
