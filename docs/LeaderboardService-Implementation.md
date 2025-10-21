# LeaderboardService Implementation

**Status**: ✅ Complete
**Date**: 2025-10-21
**Author**: Backend Development Specialist Agent

## Overview

The LeaderboardService has been completely rewritten to use **Prisma** for database queries and **Redis** for high-performance caching. This implementation replaces all mock data with real database operations and includes comprehensive error handling and fallback mechanisms.

## Architecture

### Technology Stack

- **Database**: PostgreSQL via Prisma ORM
- **Caching**: Redis with 60-second TTL
- **Pattern**: Cache-aside with automatic invalidation

### Key Features

1. ✅ **Real-time rankings** using Prisma queries ordered by ELO rating
2. ✅ **Redis caching layer** for performance (60s TTL)
3. ✅ **Automatic cache invalidation** on rating updates
4. ✅ **Pagination support** (1-100 items per page)
5. ✅ **Rank range filtering** (get players by rank)
6. ✅ **Player rank lookup** with percentile calculation
7. ✅ **Graceful fallback** when Redis is unavailable
8. ✅ **Batch rank recalculation** for maintaining consistency

## API Reference

### Core Methods

#### `getLeaderboard(options)`

Get paginated leaderboard with caching.

```typescript
const result = await leaderboardService.getLeaderboard({
  page: 1,
  limit: 50,
  leaderboardType: LeaderboardType.GLOBAL,
  seasonId: null,
  activeOnly: true,
});

// Returns: LeaderboardResponse
{
  entries: LeaderboardEntry[],
  totalPlayers: number,
  page: number,
  limit: number,
  hasMore: boolean,
  lastUpdated: Date
}
```

**Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)
- `leaderboardType` (optional): GLOBAL, SEASONAL, WEEKLY, MONTHLY, REGIONAL
- `seasonId` (optional): Season identifier
- `activeOnly` (optional): Filter active players only (default: true)

**Caching**: 60 seconds TTL

---

#### `getLeaderboardByRankRange(minRank, maxRank, type?, seasonId?)`

Get players within a specific rank range.

```typescript
const topTen = await leaderboardService.getLeaderboardByRankRange(1, 10);
const midTier = await leaderboardService.getLeaderboardByRankRange(100, 200);
```

**Parameters**:
- `minRank`: Minimum rank (inclusive, must be >= 1)
- `maxRank`: Maximum rank (inclusive, must be >= minRank)
- `leaderboardType` (optional): Default GLOBAL
- `seasonId` (optional): Default null

**Caching**: 60 seconds TTL

---

#### `getPlayerRank(playerId, type?, seasonId?)`

Get a player's rank information with percentile.

```typescript
const rankInfo = await leaderboardService.getPlayerRank('player-123');

// Returns: PlayerRankInfo | null
{
  playerId: string,
  rank: number,
  totalPlayers: number,
  percentile: number  // 0-100
}
```

**Caching**: 300 seconds TTL (player stats)

---

#### `getTopPlayers(limit?, type?, seasonId?)`

Get top N players from leaderboard.

```typescript
const topPlayers = await leaderboardService.getTopPlayers(10);
```

**Parameters**:
- `limit`: Number of top players (1-100, default: 10)
- `leaderboardType` (optional): Default GLOBAL
- `seasonId` (optional): Default null

---

#### `invalidateCache(playerId?)`

Manually invalidate leaderboard caches.

```typescript
// Invalidate all leaderboard caches
await leaderboardService.invalidateCache();

// Invalidate specific player caches
await leaderboardService.invalidateCache('player-123');
```

**Use Cases**:
- After match completion
- After batch rating updates
- Manual cache refresh

---

#### `updateLeaderboardEntry(playerId, updates, type?, seasonId?)`

Update a player's leaderboard entry and invalidate caches.

```typescript
await leaderboardService.updateLeaderboardEntry(
  'player-123',
  {
    eloRating: 2100,
    wins: 36,
    losses: 15,
    currentStreak: 6,
  }
);
```

**Auto-calculated fields**:
- `matchesPlayed` (incremented)
- `winRate` (calculated from wins/losses/draws)
- `lastMatchAt` (current timestamp)
- `lastUpdated` (current timestamp)

**Side effects**:
- Automatically invalidates all related caches

---

#### `recalculateRanks(type?, seasonId?)`

Recalculate all ranks based on current ELO ratings.

```typescript
await leaderboardService.recalculateRanks(LeaderboardType.GLOBAL);
```

**When to use**:
- After batch updates
- Periodically (e.g., daily cron job)
- After significant ranking changes

**Process**:
1. Fetch all entries ordered by ELO DESC
2. Assign sequential ranks
3. Calculate rank changes
4. Update in transaction
5. Invalidate all caches

## Database Schema

The implementation uses the following Prisma schema:

```prisma
model LeaderboardEntry {
  id              String          @id @default(cuid())
  player_id       String
  rank            Int
  previous_rank   Int?
  rank_change     Int             @default(0)
  elo_rating      Int
  previous_elo    Int?
  peak_elo        Int             @default(1200)
  lowest_elo      Int             @default(1200)
  matches_played  Int             @default(0)
  wins            Int             @default(0)
  losses          Int             @default(0)
  draws           Int             @default(0)
  win_rate        Float           @default(0.0)
  current_streak  Int             @default(0)
  best_win_streak Int             @default(0)
  season_id       String?
  leaderboard_type LeaderboardType @default(GLOBAL)
  is_active       Boolean         @default(true)
  last_match_at   DateTime?
  last_updated    DateTime        @default(now())
  created_at      DateTime        @default(now())

  player Player @relation(fields: [player_id], references: [id])

  @@unique([player_id, season_id, leaderboard_type])
  @@index([rank])
  @@index([elo_rating(sort: Desc)])
  @@index([player_id])
}
```

## Caching Strategy

### Cache-Aside Pattern

1. **Read Operation**:
   ```
   1. Check Redis cache
   2. If hit → return cached data
   3. If miss → query database
   4. Store result in cache with TTL
   5. Return data
   ```

2. **Write Operation**:
   ```
   1. Update database
   2. Invalidate related cache keys
   3. Next read will cache fresh data
   ```

### Cache Keys

The service uses the following cache key patterns:

```typescript
// Leaderboard page
leaderboard:page:{page}:limit:{limit}:type:{type}:season:{seasonId}:active:{active}

// Rank range
leaderboard:range:{minRank}-{maxRank}:{type}:{seasonId}

// Player rank
player:{playerId}:rank:{type}:{seasonId}
```

### Cache TTL (Time To Live)

- **Leaderboard data**: 60 seconds
- **Player stats**: 300 seconds (5 minutes)
- **Match results**: 3600 seconds (1 hour)

### Cache Invalidation Triggers

1. **After match completion**: Invalidate all leaderboard + affected player caches
2. **After rating update**: Invalidate all leaderboard + specific player caches
3. **After rank recalculation**: Invalidate all leaderboard caches
4. **Manual invalidation**: Via `invalidateCache()` method

## Error Handling

### Redis Unavailable

The service includes graceful fallback when Redis is unavailable:

```typescript
private async initializeRedis(): Promise<void> {
  try {
    this.redisClient = await RedisClient.getInstance();
    this.redisEnabled = true;
  } catch (error) {
    console.warn('⚠️  Redis unavailable, using direct DB queries');
    this.redisEnabled = false;
    this.redisClient = null;
  }
}
```

**Behavior**:
- All queries still work (direct database access)
- No caching performed
- No errors thrown to client
- Performance degrades gracefully

### Database Errors

All database operations include try-catch blocks:

```typescript
try {
  await prisma.leaderboardEntry.update(...);
  await this.invalidateCache(playerId);
} catch (error) {
  console.error('❌ Failed to update leaderboard entry:', error);
  throw error;  // Propagate to caller
}
```

## Performance Optimizations

### 1. Database Indexing

Prisma schema includes strategic indexes:

```prisma
@@index([rank])
@@index([elo_rating(sort: Desc)])
@@index([player_id])
@@index([season_id, leaderboard_type, rank])
```

### 2. Parallel Queries

Using `Promise.all()` for concurrent operations:

```typescript
const [entries, totalPlayers] = await Promise.all([
  this.queryLeaderboardEntries(...),
  this.countTotalPlayers(...),
]);
```

### 3. Selective Field Loading

Only loading required fields:

```typescript
include: {
  player: {
    select: {
      id: true,
      username: true,
      avatar_url: true,
      country_code: true,
      is_active: true,
    },
  },
}
```

### 4. Batch Updates

Rank recalculation uses transactions:

```typescript
const updates = entries.map((entry, index) =>
  prisma.leaderboardEntry.update(...)
);
await prisma.$transaction(updates);
```

## Testing

Comprehensive test coverage in `/src/__tests__/LeaderboardService.test.ts`:

- ✅ Pagination validation
- ✅ Cache hit/miss scenarios
- ✅ Rank range queries
- ✅ Player rank lookup
- ✅ Cache invalidation
- ✅ Entry updates
- ✅ Rank recalculation
- ✅ Redis fallback behavior

Run tests:
```bash
npm test LeaderboardService
```

## Usage Examples

### Example 1: Display Global Leaderboard

```typescript
import { leaderboardService } from '@/services/LeaderboardService';

async function displayLeaderboard() {
  const result = await leaderboardService.getLeaderboard({
    page: 1,
    limit: 50,
    leaderboardType: LeaderboardType.GLOBAL,
  });

  console.log(`Showing ${result.entries.length} of ${result.totalPlayers} players`);

  result.entries.forEach(entry => {
    console.log(
      `${entry.rank}. ${entry.username} - ${entry.eloRating} ELO ` +
      `(${entry.wins}W/${entry.losses}L)`
    );
  });
}
```

### Example 2: Update After Match

```typescript
async function afterMatchUpdate(playerId: string, matchResult: MatchResult) {
  const player = await prisma.player.findUnique({
    where: { id: playerId }
  });

  // Update player's leaderboard entry
  await leaderboardService.updateLeaderboardEntry(
    playerId,
    {
      eloRating: player.elo_rating,
      wins: player.wins,
      losses: player.losses,
      currentStreak: calculateStreak(matchResult),
    }
  );

  // Recalculate ranks if needed
  await leaderboardService.recalculateRanks();
}
```

### Example 3: Get Player's Position

```typescript
async function getPlayerPosition(playerId: string) {
  const rankInfo = await leaderboardService.getPlayerRank(playerId);

  if (rankInfo) {
    console.log(
      `You are ranked #${rankInfo.rank} out of ${rankInfo.totalPlayers} ` +
      `(Top ${rankInfo.percentile.toFixed(1)}%)`
    );
  }
}
```

## Environment Variables

Required environment variables:

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=your_password  # Optional

# Database Configuration (automatically used by Prisma)
DATABASE_URL=postgresql://user:pass@localhost:5432/loverank

# Cache TTL (optional, has defaults)
REDIS_LEADERBOARD_TTL=60
REDIS_CACHE_TTL=300
```

## Migration Path

The old mock-based implementation has been completely replaced. Key changes:

### Before (Mock Implementation)
```typescript
private leaderboards: Map<string, Leaderboard> = new Map();

getLeaderboardById(id: string) {
  return this.leaderboards.get(id);
}
```

### After (Prisma + Redis)
```typescript
async getLeaderboard(options) {
  const cached = await this.getFromCache(cacheKey);
  if (cached) return cached;

  const entries = await prisma.leaderboardEntry.findMany(...);
  await this.setCache(cacheKey, response);
  return response;
}
```

## Future Enhancements

Potential improvements for future iterations:

1. **WebSocket Updates**: Real-time leaderboard changes via Socket.IO
2. **Redis Pub/Sub**: Notify all instances of cache invalidation
3. **Materialized Views**: Pre-computed leaderboards in PostgreSQL
4. **Sharding**: Distribute leaderboard data across multiple Redis instances
5. **Advanced Metrics**: Track more statistics (accuracy, headshots, etc.)
6. **GraphQL API**: Add GraphQL resolver for flexible queries
7. **Rate Limiting**: Prevent abuse of leaderboard queries
8. **Analytics**: Track cache hit rates and query performance

## Support

For issues or questions, contact the backend development team or check:

- Prisma Docs: https://www.prisma.io/docs
- Redis Docs: https://redis.io/docs
- Project Architecture: `/docs/architecture-plan.md`

---

**Implementation Complete**: All mock data removed, Prisma queries operational, Redis caching active with graceful fallback.
