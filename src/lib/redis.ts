// Redis Client Configuration
// Singleton pattern for Redis connection

import { createClient } from 'redis';

type RedisClientType = ReturnType<typeof createClient>;

class RedisClient {
  private static instance: RedisClientType | null = null;
  private static connecting: Promise<RedisClientType> | null = null;

  private constructor() {}

  static async getInstance(): Promise<RedisClientType> {
    if (this.instance && this.instance.isOpen) {
      return this.instance;
    }

    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = this.connect();
    this.instance = await this.connecting;
    this.connecting = null;

    return this.instance;
  }

  private static async connect(): Promise<RedisClientType> {
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD,
    });

    client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    client.on('connect', () => {
      console.log('✅ Redis Client Connected');
    });

    client.on('reconnecting', () => {
      console.log('🔄 Redis Client Reconnecting...');
    });

    client.on('ready', () => {
      console.log('✅ Redis Client Ready');
    });

    await client.connect();
    return client;
  }

  static async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.quit();
      this.instance = null;
    }
  }
}

// Cache key generators
export const CacheKeys = {
  leaderboard: (scope: string, timePeriod: string) =>
    `leaderboard:${scope}:${timePeriod}`,

  playerStats: (playerId: string) =>
    `player:${playerId}:stats`,

  playerRank: (playerId: string, scope: string) =>
    `player:${playerId}:rank:${scope}`,

  matchResult: (matchId: string) =>
    `match:${matchId}:result`,

  activeSession: () =>
    'session:active',
};

// Cache TTLs in seconds
export const CacheTTL = {
  LEADERBOARD: parseInt(process.env.REDIS_LEADERBOARD_TTL || '60', 10),
  PLAYER_STATS: parseInt(process.env.REDIS_CACHE_TTL || '300', 10),
  MATCH_RESULT: 3600, // 1 hour
  ACTIVE_SESSION: 60, // 1 minute
};

export default RedisClient;
