# Database Setup Guide - Love Rank Pulse

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Configuration](#environment-configuration)
4. [PostgreSQL Setup](#postgresql-setup)
5. [Redis Setup](#redis-setup)
6. [Connection Pooling](#connection-pooling)
7. [Usage Examples](#usage-examples)
8. [Health Checks](#health-checks)
9. [Troubleshooting](#troubleshooting)

---

## Overview

Love Rank Pulse uses a dual-database architecture:
- **PostgreSQL** - Primary relational database for persistent data
- **Redis** - In-memory cache for high-performance data access

Both databases implement connection pooling for optimal performance and resource management.

---

## Prerequisites

### Required Software
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- npm or yarn package manager

### Required Node Packages
```bash
npm install @prisma/client redis
npm install -D prisma
```

---

## Environment Configuration

### 1. Copy Environment Template
```bash
cp .env.example .env
```

### 2. Configure Database Variables

#### PostgreSQL Configuration
```env
# Database URL format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
DATABASE_URL=postgresql://postgres:password@localhost:5432/loverankpulse?schema=public

# Connection Pool Settings
DATABASE_POOL_MIN=2          # Minimum connections in pool
DATABASE_POOL_MAX=10         # Maximum connections in pool
DATABASE_CONNECTION_TIMEOUT=20000  # Connection timeout (ms)
DATABASE_IDLE_TIMEOUT=30000  # Idle connection timeout (ms)
DATABASE_MAX_LIFETIME=1800000  # Max connection lifetime (ms)

# Query Performance
DATABASE_STATEMENT_TIMEOUT=30000  # Statement timeout (ms)
DATABASE_QUERY_TIMEOUT=15000      # Query timeout (ms)
```

#### Redis Configuration
```env
# Redis URL format: redis://USER:PASSWORD@HOST:PORT/DATABASE
REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=                   # Optional password

# Connection Pool Settings
REDIS_POOL_MIN=2                  # Minimum connections
REDIS_POOL_MAX=10                 # Maximum connections
REDIS_CONNECTION_TIMEOUT=5000     # Connection timeout (ms)
REDIS_COMMAND_TIMEOUT=3000        # Command timeout (ms)

# Retry Configuration
REDIS_MAX_RETRIES=3               # Maximum retry attempts
REDIS_RETRY_DELAY=100             # Initial retry delay (ms)
```

#### Cache TTL Configuration
```env
# Time To Live settings (in seconds)
CACHE_TTL_LEADERBOARD=300         # 5 minutes
CACHE_TTL_PLAYER_STATS=600        # 10 minutes
CACHE_TTL_MATCH_DATA=120          # 2 minutes
CACHE_TTL_COUNTRY_STATS=900       # 15 minutes
CACHE_TTL_SESSION_DATA=180        # 3 minutes
```

---

## PostgreSQL Setup

### Local Development Setup

#### 1. Install PostgreSQL
```bash
# macOS
brew install postgresql@14
brew services start postgresql@14

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install postgresql-14
sudo systemctl start postgresql

# Windows
# Download installer from https://www.postgresql.org/download/windows/
```

#### 2. Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE loverankpulse;
CREATE DATABASE loverankpulse_test;

# Create user (optional)
CREATE USER loverankpulse WITH ENCRYPTED PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE loverankpulse TO loverankpulse;

# Exit
\q
```

#### 3. Initialize Prisma Schema
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed database (if seed file exists)
npx prisma db seed
```

### Production Setup

#### Using Vercel Postgres
```bash
# Install Vercel CLI
npm i -g vercel

# Create Postgres database
vercel postgres create

# Get connection string
vercel postgres get <database-name>
```

Update `.env.production`:
```env
DATABASE_URL=<vercel-postgres-connection-string>
```

#### Using Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Create Postgres service
railway add

# Get connection string
railway variables
```

#### Using Supabase
1. Create project at https://supabase.com
2. Go to Settings → Database
3. Copy connection string
4. Update `DATABASE_URL` in `.env`

---

## Redis Setup

### Local Development Setup

#### 1. Install Redis
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis

# Windows
# Download from https://github.com/microsoftarchive/redis/releases
```

#### 2. Test Connection
```bash
# Connect to Redis
redis-cli

# Test ping
PING
# Should return: PONG

# Exit
exit
```

### Production Setup

#### Using Upstash Redis
1. Create account at https://upstash.com
2. Create Redis database
3. Copy connection string
4. Update `.env`:
```env
REDIS_URL=rediss://:<password>@<endpoint>:<port>
```

#### Using Redis Cloud
1. Create account at https://redis.com/cloud/
2. Create subscription
3. Copy connection details
4. Update `.env`

---

## Connection Pooling

### Why Connection Pooling?

Connection pooling improves performance by:
- **Reusing connections** instead of creating new ones
- **Limiting total connections** to prevent database overload
- **Managing idle connections** to free up resources
- **Handling connection failures** with automatic retry

### PostgreSQL Pool Configuration

```typescript
// Recommended settings by environment

// Development
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=5

// Staging
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

// Production
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50
```

### Redis Pool Configuration

```typescript
// Redis pools are managed differently (connection multiplexing)

// Development
REDIS_POOL_MIN=2
REDIS_POOL_MAX=5

// Production
REDIS_POOL_MIN=5
REDIS_POOL_MAX=20
```

### Pool Size Calculation

**Formula**: `connections = (core_count × 2) + effective_spindle_count`

Example for 4-core server with SSD:
```
(4 × 2) + 1 = 9 connections
Set DATABASE_POOL_MAX=10
```

### Connection Lifecycle

```
┌─────────────┐
│   Request   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Get Connection │◄──── From Pool
│   from Pool     │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Execute Query   │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│    Return       │────► Back to Pool
│  Connection     │
└─────────────────┘
```

---

## Usage Examples

### Database Service

#### Initialize Database
```typescript
import { initializeDatabase, getPrismaClient } from './services/database';

// Initialize on app startup
async function startApp() {
  try {
    await initializeDatabase();
    console.log('Database connected');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
}
```

#### Perform Queries
```typescript
import { getPrismaClient } from './services/database';

async function getLeaderboard() {
  const prisma = getPrismaClient();

  const players = await prisma.player.findMany({
    orderBy: { rank: 'asc' },
    take: 100,
  });

  return players;
}
```

#### Use Transactions
```typescript
import { withTransaction } from './services/database';

async function updatePlayerRank(playerId: string, newRank: number) {
  return withTransaction(async (tx) => {
    // Update player
    await tx.player.update({
      where: { id: playerId },
      data: { rank: newRank },
    });

    // Log rank change
    await tx.rankHistory.create({
      data: {
        playerId,
        newRank,
        timestamp: new Date(),
      },
    });

    return { success: true };
  });
}
```

### Cache Service

#### Initialize Cache
```typescript
import { initializeCache } from './services/cache';

async function startApp() {
  try {
    await initializeCache();
    console.log('Cache connected');
  } catch (error) {
    console.error('Failed to connect to cache:', error);
  }
}
```

#### Cache Data
```typescript
import { cacheLeaderboard, getCachedLeaderboard } from './services/cache';

async function getLeaderboard() {
  // Try cache first
  const cached = await getCachedLeaderboard('global');
  if (cached) {
    return cached;
  }

  // Fetch from database
  const data = await fetchLeaderboardFromDB();

  // Cache for 5 minutes
  await cacheLeaderboard('global', data);

  return data;
}
```

#### Invalidate Cache
```typescript
import { invalidateEntityCache } from './services/cache';

async function updateMatch(matchId: string, data: any) {
  // Update database
  await updateMatchInDB(matchId, data);

  // Invalidate related caches
  await invalidateEntityCache('match');
  await invalidateEntityCache('leaderboard');
}
```

---

## Health Checks

### Database Health Check
```typescript
import { healthCheck } from './services/database';

async function checkDatabaseHealth() {
  const health = await healthCheck();
  console.log('Database status:', health.status);
  console.log('Response time:', health.responseTime, 'ms');
}
```

### Cache Health Check
```typescript
import { cacheHealthCheck } from './services/cache';

async function checkCacheHealth() {
  const health = await cacheHealthCheck();
  console.log('Cache status:', health.status);
  console.log('Response time:', health.responseTime, 'ms');
}
```

### Combined Health Endpoint
```typescript
import { healthCheck } from './services/database';
import { cacheHealthCheck } from './services/cache';

export async function healthEndpoint(req, res) {
  const [dbHealth, cacheHealth] = await Promise.all([
    healthCheck(),
    cacheHealthCheck(),
  ]);

  const overall =
    dbHealth.status === 'healthy' && cacheHealth.status === 'healthy'
      ? 'healthy'
      : 'unhealthy';

  res.status(overall === 'healthy' ? 200 : 503).json({
    status: overall,
    timestamp: new Date(),
    services: {
      database: dbHealth,
      cache: cacheHealth,
    },
  });
}
```

---

## Troubleshooting

### Common Issues

#### 1. Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution**:
- Check if PostgreSQL is running: `brew services list` (macOS) or `systemctl status postgresql` (Linux)
- Verify connection string in `.env`
- Check firewall settings
- Ensure PostgreSQL is listening on correct port: `psql -U postgres -c "SHOW port;"`

#### 2. Too Many Connections
```
Error: remaining connection slots are reserved for non-replication superuser connections
```

**Solution**:
- Reduce `DATABASE_POOL_MAX`
- Increase PostgreSQL max_connections: Edit `postgresql.conf`
  ```
  max_connections = 100
  ```
- Restart PostgreSQL: `brew services restart postgresql`

#### 3. Connection Timeout
```
Error: Connection timeout
```

**Solution**:
- Increase `DATABASE_CONNECTION_TIMEOUT`
- Check network latency
- Verify database is accessible
- Review connection pool settings

#### 4. Redis Connection Failed
```
Error: Redis connection to localhost:6379 failed
```

**Solution**:
- Check if Redis is running: `redis-cli ping`
- Start Redis: `brew services start redis`
- Verify `REDIS_URL` in `.env`
- Check Redis logs: `tail -f /usr/local/var/log/redis.log`

#### 5. Slow Queries
```
Warning: Query took 5000ms to execute
```

**Solution**:
- Add database indexes
- Optimize query structure
- Use connection pooling
- Enable query caching with Redis
- Review `DATABASE_QUERY_TIMEOUT` setting

### Performance Monitoring

#### Enable Query Logging
```env
LOG_LEVEL=debug
```

#### Monitor Pool Metrics
```typescript
import { getConnectionMetrics } from './services/database';
import { getCacheMetrics } from './services/cache';

setInterval(() => {
  console.log('Database metrics:', getConnectionMetrics());
  console.log('Cache metrics:', getCacheMetrics());
}, 60000); // Every minute
```

#### Database Query Analysis
```sql
-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Best Practices

1. **Always use connection pooling** in production
2. **Close connections gracefully** on shutdown
3. **Implement health checks** for monitoring
4. **Use transactions** for multi-step operations
5. **Cache frequently accessed data** in Redis
6. **Monitor pool utilization** and adjust sizes
7. **Set appropriate timeouts** for your use case
8. **Use prepared statements** to prevent SQL injection
9. **Enable SSL/TLS** in production environments
10. **Backup database regularly**

---

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Connection Pooling](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [Redis Best Practices](https://redis.io/topics/optimization)
- [Node-Redis Documentation](https://github.com/redis/node-redis)

---

**Need Help?** Check the project's GitHub issues or contact the development team.
