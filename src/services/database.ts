/**
 * Database Service - Prisma Client Configuration
 * Handles PostgreSQL connection pooling, retry logic, and health checks
 */

import { PrismaClient } from '@prisma/client';

// Environment variables with defaults
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/loverankpulse?schema=public';
const DATABASE_POOL_MIN = parseInt(process.env.DATABASE_POOL_MIN || '2', 10);
const DATABASE_POOL_MAX = parseInt(process.env.DATABASE_POOL_MAX || '10', 10);
const DATABASE_CONNECTION_TIMEOUT = parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '20000', 10);
const DATABASE_QUERY_TIMEOUT = parseInt(process.env.DATABASE_QUERY_TIMEOUT || '15000', 10);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Prisma Client singleton instance
 * Prevents multiple instances in development with hot reloading
 */
let prisma: PrismaClient | null = null;

/**
 * Database configuration interface
 */
interface DatabaseConfig {
  url: string;
  poolMin: number;
  poolMax: number;
  connectionTimeout: number;
  queryTimeout: number;
  logLevel: 'info' | 'warn' | 'error';
}

/**
 * Health check result interface
 */
interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  responseTime: number;
  error?: string;
  details?: {
    connected: boolean;
    poolSize?: number;
    activeConnections?: number;
  };
}

/**
 * Get database configuration from environment variables
 */
function getDatabaseConfig(): DatabaseConfig {
  return {
    url: DATABASE_URL,
    poolMin: DATABASE_POOL_MIN,
    poolMax: DATABASE_POOL_MAX,
    connectionTimeout: DATABASE_CONNECTION_TIMEOUT,
    queryTimeout: DATABASE_QUERY_TIMEOUT,
    logLevel: (LOG_LEVEL === 'debug' ? 'info' : LOG_LEVEL) as 'info' | 'warn' | 'error',
  };
}

/**
 * Create Prisma Client with connection pooling and logging configuration
 */
function createPrismaClient(): PrismaClient {
  const config = getDatabaseConfig();

  return new PrismaClient({
    datasources: {
      db: {
        url: config.url,
      },
    },
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'warn',
      },
      {
        emit: 'stdout',
        level: 'info',
      },
    ],
    errorFormat: NODE_ENV === 'production' ? 'minimal' : 'pretty',
  });
}

/**
 * Initialize database connection with retry logic
 * @param maxRetries - Maximum number of connection attempts
 * @param retryDelay - Delay between retries in milliseconds
 */
export async function initializeDatabase(
  maxRetries: number = 5,
  retryDelay: number = 2000
): Promise<PrismaClient> {
  if (prisma) {
    console.log('[Database] Using existing connection');
    return prisma;
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Database] Connection attempt ${attempt}/${maxRetries}`);

      prisma = createPrismaClient();

      // Set up event listeners
      setupEventListeners(prisma);

      // Test connection
      await prisma.$connect();

      console.log('[Database] Successfully connected to PostgreSQL');
      console.log(`[Database] Pool configuration: min=${DATABASE_POOL_MIN}, max=${DATABASE_POOL_MAX}`);

      return prisma;
    } catch (error) {
      lastError = error as Error;
      console.error(`[Database] Connection attempt ${attempt} failed:`, error);

      if (prisma) {
        await prisma.$disconnect().catch(() => {});
        prisma = null;
      }

      if (attempt < maxRetries) {
        console.log(`[Database] Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw new Error(
    `Failed to connect to database after ${maxRetries} attempts: ${lastError?.message}`
  );
}

/**
 * Set up Prisma event listeners for monitoring
 */
function setupEventListeners(client: PrismaClient): void {
  // Query logging in development
  if (NODE_ENV === 'development') {
    client.$on('query' as never, (e: any) => {
      console.log(`[Database Query] ${e.query}`);
      console.log(`[Database Params] ${e.params}`);
      console.log(`[Database Duration] ${e.duration}ms`);
    });
  }

  // Error logging
  client.$on('error' as never, (e: any) => {
    console.error('[Database Error]', e);
  });

  // Warning logging
  client.$on('warn' as never, (e: any) => {
    console.warn('[Database Warning]', e);
  });
}

/**
 * Get or create Prisma client instance
 * Uses singleton pattern to prevent multiple connections
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return prisma;
}

/**
 * Gracefully close database connection
 * Should be called during application shutdown
 */
export async function closeDatabase(): Promise<void> {
  if (!prisma) {
    console.log('[Database] No active connection to close');
    return;
  }

  try {
    console.log('[Database] Closing connection...');
    await prisma.$disconnect();
    prisma = null;
    console.log('[Database] Connection closed successfully');
  } catch (error) {
    console.error('[Database] Error closing connection:', error);
    throw error;
  }
}

/**
 * Perform database health check
 * Tests connection and query execution
 */
export async function healthCheck(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  if (!prisma) {
    return {
      status: 'unhealthy',
      timestamp: new Date(),
      responseTime: Date.now() - startTime,
      error: 'Database not initialized',
      details: {
        connected: false,
      },
    };
  }

  try {
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`;

    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      timestamp: new Date(),
      responseTime,
      details: {
        connected: true,
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
 * Execute database transaction with retry logic
 * @param callback - Transaction callback function
 * @param maxRetries - Maximum number of retry attempts
 */
export async function withTransaction<T>(
  callback: (tx: PrismaClient) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  const client = getPrismaClient();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.$transaction(async (tx) => {
        return await callback(tx as PrismaClient);
      }, {
        timeout: DATABASE_QUERY_TIMEOUT,
      });
    } catch (error) {
      lastError = error as Error;
      console.error(`[Database] Transaction attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[Database] Retrying transaction in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Transaction failed after ${maxRetries} attempts: ${lastError?.message}`
  );
}

/**
 * Execute raw query with timeout
 * @param query - SQL query string
 * @param params - Query parameters
 */
export async function executeRawQuery<T = any>(
  query: string,
  ...params: any[]
): Promise<T> {
  const client = getPrismaClient();

  try {
    const result = await client.$queryRawUnsafe<T>(query, ...params);
    return result;
  } catch (error) {
    console.error('[Database] Raw query failed:', error);
    throw error;
  }
}

/**
 * Get database connection metrics
 */
export function getConnectionMetrics() {
  return {
    poolMin: DATABASE_POOL_MIN,
    poolMax: DATABASE_POOL_MAX,
    connectionTimeout: DATABASE_CONNECTION_TIMEOUT,
    queryTimeout: DATABASE_QUERY_TIMEOUT,
    isInitialized: prisma !== null,
  };
}

// Export Prisma client type for use in other modules
export type { PrismaClient };

// Export singleton instance getter
export { prisma };

// Graceful shutdown handler
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    console.log('[Database] Received SIGINT, closing connection...');
    await closeDatabase();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('[Database] Received SIGTERM, closing connection...');
    await closeDatabase();
    process.exit(0);
  });
}
