# Redis Cache Layer Documentation

## Overview

The Redis cache layer provides high-performance caching for leaderboard data, player ranks, and statistics. It implements connection pooling, retry logic, and graceful fallback to database operations.

## Architecture

### Components

1. **RedisCache** (`src/services/redis.ts`)
   - Main cache client with connection pooling
   - Retry logic and error handling
   - Health monitoring and statistics

2. **CachedLeaderboardService** (`src/services/CachedLeaderboardService.ts`)
   - Wraps LeaderboardService with caching
   - Implements cache-aside pattern
   - Automatic cache invalidation

3. **Cache Types** (`src/types/cache.ts`)
   - Type definitions for cache operations
   - Cache result interfaces
   - Metrics and health status types

## Features

### Connection Pooling
- Configurable pool size (default: 10)
- Automatic connection retry (default: 3 attempts)
- Graceful degradation on connection failure

### Caching Strategies

#### Cache Keys
```typescript
// Leaderboard data
leaderboard:{scope}:{timePeriod}:{page}:{limit}

// Player ranks
player:rank:{playerId}:{scope}:{timePeriod}

// Player stats
player:stats:{playerId}

// Session leaderboard
session:leaderboard:{sessionId}

// Country leaderboard
country:leaderboard:{countryCode}:{timePeriod}

// Global leaderboard
global:leaderboard:{timePeriod}
```

#### TTL Configuration
```typescript
LEADERBOARD_SHORT: 60s     // Active leaderboards
LEADERBOARD_MEDIUM: 300s   // Recent data
LEADERBOARD_LONG: 3600s    // Historical data
PLAYER_RANK: 120s          // Player ranks
PLAYER_STATS: 600s         // Player stats
SESSION_LEADERBOARD: 30s   // Live sessions
TOP_PLAYERS: 180s          // Top player lists
```

### Cache Invalidation

#### On Match Completion
```typescript
await cachedLeaderboardService.handleMatchComplete(
  ['player1', 'player2'],
  LeaderboardScope.GLOBAL,
  TimePeriod.ALL_TIME
);
```

#### Manual Invalidation
```typescript
// Invalidate entire leaderboard
await redisCache.invalidateLeaderboard('global', 'all-time');

// Invalidate player cache
await redisCache.invalidatePlayerCache('player-123');
```

## Installation

### 1. Install Redis Package
```bash
npm install redis
```

### 2. Configure Environment Variables
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_dev_password
REDIS_DB=0
REDIS_CONNECTION_POOL_SIZE=10
REDIS_RETRY_ATTEMPTS=3
REDIS_RETRY_DELAY=1000
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
VITE_ENABLE_REDIS_CACHE=true
```

### 3. Start Redis Server
```bash
# Using Docker
docker run -d --name redis -p 6379:6379 redis:latest

# Or using Docker Compose (already configured)
docker-compose up -d redis
```

## Usage

### Initialize Cache at Application Startup

```typescript
import { initializeRedisCache, cleanupRedisCache } from '@/services';

// In main.tsx or App.tsx
async function initializeApp() {
  await initializeRedisCache();
  // ... rest of initialization
}

// On app shutdown
window.addEventListener('beforeunload', async () => {
  await cleanupRedisCache();
});
```

### Using Cached Leaderboard Service

```typescript
import { cachedLeaderboardService } from '@/services';

// Get cached leaderboard
const result = await cachedLeaderboardService.getCachedLeaderboard(
  LeaderboardScope.GLOBAL,
  TimePeriod.TODAY,
  1,  // page
  50  // limit
);

if (result.success) {
  console.log('Data:', result.data);
  console.log('From cache:', result.fromCache);
}

// Get player rank with caching
const rankResult = await cachedLeaderboardService.getCachedPlayerRank(
  'player-123',
  LeaderboardScope.GLOBAL,
  TimePeriod.ALL_TIME
);

// Handle match completion
await cachedLeaderboardService.handleMatchComplete(
  ['player1', 'player2', 'player3'],
  LeaderboardScope.GLOBAL,
  TimePeriod.TODAY
);
```

### Direct Redis Operations

```typescript
import { redisCache, CacheKeys, CacheTTL } from '@/services';

// Connect
await redisCache.connect();

// Set leaderboard
await redisCache.setLeaderboard(
  'global',
  'today',
  1,
  50,
  leaderboardData,
  CacheTTL.LEADERBOARD_SHORT
);

// Get leaderboard
const data = await redisCache.getLeaderboard('global', 'today', 1, 50);

// Health check
const healthy = await redisCache.healthCheck();

// Get stats
const stats = await redisCache.getStats();
```

## Performance Optimization

### Cache Warming
Preload frequently accessed data on application startup:

```typescript
await cachedLeaderboardService.warmupCache();
```

### Batch Operations
Use batch invalidation for multiple players:

```typescript
await redisCache.invalidateOnMatchComplete(
  ['player1', 'player2', 'player3'],
  'global',
  'today'
);
```

### TTL Selection
Choose appropriate TTL based on data freshness requirements:
- Live sessions: 30 seconds
- Active leaderboards: 1 minute
- Recent data: 5 minutes
- Historical data: 1 hour

## Error Handling

The cache layer implements graceful fallback:

1. **Connection Failure**: Falls back to database
2. **Cache Miss**: Fetches from database and caches result
3. **Cache Error**: Logs error and returns database result

```typescript
// Example error handling
const result = await cachedLeaderboardService.getCachedLeaderboard(
  LeaderboardScope.GLOBAL,
  TimePeriod.TODAY
);

if (result.success) {
  if (result.error) {
    console.warn('Cache warning:', result.error);
  }
  // Use result.data
} else {
  console.error('Failed to fetch leaderboard:', result.error);
}
```

## Monitoring

### Health Check
```typescript
const health = await cachedLeaderboardService.getCacheHealth();
console.log('Healthy:', health.healthy);
console.log('Stats:', health.stats);
```

### Cache Statistics
```typescript
const stats = await redisCache.getStats();
console.log('Connected:', stats.connected);
console.log('DB Size:', stats.dbSize);
console.log('Memory Used:', stats.memoryUsed);
console.log('Uptime:', stats.uptime);
```

## Best Practices

1. **Always Initialize**: Call `initializeRedisCache()` at app startup
2. **Use Cached Service**: Prefer `cachedLeaderboardService` over direct database calls
3. **Invalidate on Updates**: Always invalidate cache when data changes
4. **Monitor Health**: Regular health checks in production
5. **Set Appropriate TTL**: Balance freshness vs. cache hit rate
6. **Handle Errors Gracefully**: Always implement fallback to database
7. **Warm Critical Paths**: Preload frequently accessed data

## Debugging

Enable cache debugging:
```env
VITE_CACHE_DEBUG=true
```

This will log:
- Cache hits/misses
- Connection status
- Invalidation operations
- Error details

## Production Considerations

1. **Connection Pooling**: Set appropriate pool size based on traffic
2. **Redis Persistence**: Configure RDB/AOF for data durability
3. **High Availability**: Use Redis Sentinel or Cluster
4. **Monitoring**: Set up alerts for cache health
5. **Memory Management**: Monitor Redis memory usage
6. **Eviction Policy**: Configure maxmemory-policy (e.g., allkeys-lru)

## Testing

```typescript
// Example test
describe('CachedLeaderboardService', () => {
  beforeAll(async () => {
    await redisCache.connect();
  });

  afterAll(async () => {
    await redisCache.clearAll();
    await redisCache.disconnect();
  });

  it('should cache leaderboard data', async () => {
    const result1 = await cachedLeaderboardService.getCachedLeaderboard(
      LeaderboardScope.GLOBAL,
      TimePeriod.TODAY
    );
    expect(result1.fromCache).toBe(false);

    const result2 = await cachedLeaderboardService.getCachedLeaderboard(
      LeaderboardScope.GLOBAL,
      TimePeriod.TODAY
    );
    expect(result2.fromCache).toBe(true);
  });
});
```

## Troubleshooting

### Connection Issues
- Check Redis server is running
- Verify host and port configuration
- Check firewall rules
- Review connection timeout settings

### Performance Issues
- Monitor cache hit rate
- Adjust TTL values
- Check Redis memory usage
- Review connection pool size

### Data Inconsistency
- Verify cache invalidation is working
- Check TTL settings
- Review match completion handlers
- Test cache warming strategy

## References

- [Redis Node Client Documentation](https://github.com/redis/node-redis)
- [Cache-Aside Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/cache-aside)
- [Redis Best Practices](https://redis.io/topics/best-practices)
