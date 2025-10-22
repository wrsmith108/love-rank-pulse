/**
 * Redis Client Configuration and Connection Management
 *
 * Provides a singleton Redis client with:
 * - Connection pooling
 * - Automatic reconnection
 * - Error handling
 * - Connection monitoring
 *
 * @module utils/redisClient
 */

import { createClient, RedisClientType } from 'redis';

/**
 * Redis client singleton instance
 */
let redisClient: RedisClientType | null = null;

/**
 * Redis connection status
 */
let isConnected = false;

/**
 * Redis configuration options
 */
interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  enableOfflineQueue?: boolean;
  connectTimeout?: number;
}

/**
 * Get default Redis configuration from environment
 */
function getRedisConfig(): RedisConfig {
  return {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    connectTimeout: 10000,
  };
}

/**
 * Initialize and connect to Redis
 *
 * @returns Promise<RedisClientType> - Connected Redis client
 * @throws Error if connection fails
 */
export async function connectRedis(): Promise<RedisClientType> {
  if (redisClient && isConnected) {
    return redisClient;
  }

  const config = getRedisConfig();

  try {
    // Create Redis client with configuration
    const connectionUrl = config.url || `redis://${config.host}:${config.port}/${config.db}`;

    redisClient = createClient({
      url: connectionUrl,
      password: config.password,
      socket: {
        connectTimeout: config.connectTimeout,
        reconnectStrategy: (retries) => {
          // Exponential backoff: 50ms, 100ms, 200ms, 400ms, 800ms, then cap at 1000ms
          if (retries > 10) {
            console.error('Redis: Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          const delay = Math.min(50 * Math.pow(2, retries), 1000);
          console.log(`Redis: Reconnecting in ${delay}ms (attempt ${retries + 1})`);
          return delay;
        },
      },
    });

    // Event handlers
    redisClient.on('connect', () => {
      console.log('Redis: Connection established');
    });

    redisClient.on('ready', () => {
      console.log('Redis: Client ready');
      isConnected = true;
    });

    redisClient.on('error', (error) => {
      console.error('Redis: Connection error', error);
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      console.log('Redis: Attempting to reconnect...');
      isConnected = false;
    });

    redisClient.on('end', () => {
      console.log('Redis: Connection closed');
      isConnected = false;
    });

    // Connect to Redis
    await redisClient.connect();

    console.log(`Redis: Successfully connected to ${config.host}:${config.port}`);

    return redisClient;
  } catch (error) {
    console.error('Redis: Failed to connect', error);
    throw new Error(`Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the Redis client instance
 *
 * @param autoConnect - Automatically connect if not connected (default: true)
 * @returns Promise<RedisClientType> - Redis client instance
 * @throws Error if client is not connected and autoConnect is false
 */
export async function getRedisClient(autoConnect = true): Promise<RedisClientType> {
  if (!redisClient || !isConnected) {
    if (!autoConnect) {
      throw new Error('Redis client not connected. Call connectRedis() first.');
    }
    return await connectRedis();
  }
  return redisClient;
}

/**
 * Disconnect from Redis
 *
 * @returns Promise<void>
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient && isConnected) {
    try {
      await redisClient.quit();
      console.log('Redis: Gracefully disconnected');
    } catch (error) {
      console.error('Redis: Error during disconnect', error);
      // Force disconnect if graceful shutdown fails
      await redisClient.disconnect();
    } finally {
      redisClient = null;
      isConnected = false;
    }
  }
}

/**
 * Check if Redis is connected
 *
 * @returns boolean - Connection status
 */
export function isRedisConnected(): boolean {
  return isConnected && redisClient !== null;
}

/**
 * Ping Redis to check connectivity
 *
 * @returns Promise<boolean> - True if ping successful
 */
export async function pingRedis(): Promise<boolean> {
  try {
    if (!redisClient || !isConnected) {
      return false;
    }
    const result = await redisClient.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis: Ping failed', error);
    return false;
  }
}

/**
 * Flush all Redis data (use with caution!)
 *
 * @returns Promise<void>
 */
export async function flushRedis(): Promise<void> {
  const client = await getRedisClient();
  await client.flushDb();
  console.log('Redis: Database flushed');
}

/**
 * Get Redis info and statistics
 *
 * @returns Promise<string> - Redis server info
 */
export async function getRedisInfo(): Promise<string> {
  const client = await getRedisClient();
  return await client.info();
}

// Graceful shutdown on process exit
process.on('SIGINT', async () => {
  await disconnectRedis();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectRedis();
  process.exit(0);
});

export default {
  connectRedis,
  getRedisClient,
  disconnectRedis,
  isRedisConnected,
  pingRedis,
  flushRedis,
  getRedisInfo,
};
