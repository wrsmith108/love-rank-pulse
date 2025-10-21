# Database Schema Documentation - Love Rank Pulse

## Overview
The Love Rank Pulse database schema implements an ELO-based competitive ranking system with comprehensive match tracking, player statistics, and real-time leaderboard functionality.

## Database Provider
- **Provider**: PostgreSQL
- **ORM**: Prisma
- **Schema Location**: `/prisma/schema.prisma`

## Architecture Decisions

### 1. ELO Rating System
- **Starting ELO**: 1200 (standard chess rating baseline)
- **K-Factor**: 32 (configurable per match for dynamic rating adjustments)
- **Rating Storage**: Integer type for precision and performance

### 2. Denormalized Leaderboard
- LeaderboardEntry table stores pre-calculated rankings
- Reduces query complexity for real-time leaderboard display
- Supports multiple leaderboard types (GLOBAL, SEASONAL, WEEKLY, MONTHLY, REGIONAL)

### 3. Comprehensive Indexing Strategy
- All foreign keys indexed
- Composite indexes for common query patterns
- Descending indexes on rating fields for leaderboard queries

## Data Models

### Player
Core user entity with ELO rating and match statistics.

**Key Fields:**
- `id`: CUID primary key
- `username`: Unique, max 50 characters
- `email`: Unique, max 255 characters
- `elo_rating`: Integer, default 1200
- `rank`: Overall leaderboard position
- `matches_played`, `wins`, `losses`, `draws`: Match statistics
- `is_active`, `is_verified`: Account status flags

**Relations:**
- One-to-many: matches_as_player1, matches_as_player2 (Match)
- One-to-many: match_wins, match_losses (MatchResult)
- One-to-many: leaderboard_entries (LeaderboardEntry)

**Indexes:**
- `idx_player_elo`: Descending on elo_rating for leaderboard queries
- `idx_player_username`: Unique constraint enforcement
- `idx_player_email`: Unique constraint enforcement
- `idx_player_rank`: Fast rank lookups
- `idx_active_players_elo`: Composite for active player leaderboards
- `idx_player_created`: Temporal queries

**Performance Characteristics:**
- O(log n) lookups by username/email
- O(1) leaderboard position queries with denormalized rank
- Efficient range queries on ELO rating

---

### Match
Represents a competitive match between two players.

**Key Fields:**
- `id`: CUID primary key
- `player1_id`, `player2_id`: Foreign keys to Player
- `status`: Enum (SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, FORFEIT, NO_SHOW)
- `match_type`: Enum (RANKED, UNRANKED, TOURNAMENT, FRIENDLY, PRACTICE)
- `scheduled_at`, `started_at`, `completed_at`: Timing information
- `best_of`: Integer for best-of-N match configuration
- `tournament_id`, `round_number`: Optional tournament metadata

**Relations:**
- Many-to-one: player1, player2 (Player)
- One-to-one: result (MatchResult)

**Indexes:**
- `idx_match_player1`, `idx_match_player2`: Player match history
- `idx_match_status`: Filter by match state
- `idx_match_scheduled`, `idx_match_completed`: Temporal queries
- `idx_match_type_status`: Composite for ranked match queries

**Cascade Behavior:**
- ON DELETE CASCADE: When player deleted, their matches are deleted
- Prevents orphaned match records

---

### MatchResult
Stores match outcomes and ELO rating changes.

**Key Fields:**
- `id`: CUID primary key
- `match_id`: Unique foreign key to Match
- `winner_id`, `loser_id`: Nullable for draws
- `result_type`: Enum (WIN, LOSS, DRAW, FORFEIT, NO_CONTEST)
- `player1_score`, `player2_score`: Match scores
- `rating_change`: Absolute ELO change (always positive)
- `winner_new_elo`, `loser_new_elo`: Updated ratings
- `k_factor`: K-factor used for this calculation (default 32)
- `verification_status`: Enum (PENDING, VERIFIED, DISPUTED, REJECTED)

**Relations:**
- One-to-one: match (Match)
- Many-to-one: winner, loser (Player)

**Indexes:**
- `idx_result_match`: Match result lookups
- `idx_result_winner`, `idx_result_loser`: Player win/loss history
- `idx_result_verification`: Admin verification workflows
- `idx_result_created`: Temporal queries

**ELO Calculation Logic:**
```
Expected Score (E) = 1 / (1 + 10^((opponent_rating - player_rating) / 400))
New Rating = Old Rating + K * (Actual Score - Expected Score)
```

**Cascade Behavior:**
- ON DELETE CASCADE: Match deletion removes result
- ON DELETE SET NULL: Player deletion preserves result statistics

---

### LeaderboardEntry
Denormalized leaderboard data for high-performance queries.

**Key Fields:**
- `id`: CUID primary key
- `player_id`: Foreign key to Player
- `rank`, `previous_rank`, `rank_change`: Position tracking
- `elo_rating`, `previous_elo`, `peak_elo`, `lowest_elo`: Rating history
- `matches_played`, `wins`, `losses`, `draws`: Statistics
- `win_rate`: Pre-calculated (wins / total_matches)
- `current_streak`, `best_win_streak`: Streak tracking
- `season_id`: Optional season identifier
- `leaderboard_type`: Enum (GLOBAL, SEASONAL, WEEKLY, MONTHLY, REGIONAL)
- `is_active`: Activity flag for filtering inactive players
- `last_match_at`: Last match timestamp

**Relations:**
- Many-to-one: player (Player)

**Unique Constraint:**
- `unique_leaderboard_entry`: (player_id, season_id, leaderboard_type)
- Ensures one entry per player per season/type combination

**Indexes:**
- `idx_leaderboard_rank`: Fast rank-based queries
- `idx_leaderboard_elo`: Descending for top players
- `idx_leaderboard_player`: Player leaderboard lookup
- `idx_season_leaderboard`: Composite for seasonal leaderboards
- `idx_active_leaderboard`: Filter active players by rating
- `idx_leaderboard_updated`: Stale entry detection

**Update Strategy:**
- Triggered after each MatchResult creation
- Batch updates for seasonal rollover
- Real-time rank recalculation for top 100

---

## Enums

### MatchStatus
- `SCHEDULED`: Match scheduled but not started
- `IN_PROGRESS`: Match currently being played
- `COMPLETED`: Match finished with result
- `CANCELLED`: Match cancelled before start
- `FORFEIT`: One player forfeited
- `NO_SHOW`: One or both players didn't show

### MatchType
- `RANKED`: Affects ELO rating
- `UNRANKED`: Casual match, no rating change
- `TOURNAMENT`: Part of tournament bracket
- `FRIENDLY`: Private match between friends
- `PRACTICE`: Training match

### ResultType
- `WIN`: Normal victory
- `LOSS`: Normal defeat
- `DRAW`: Tied result
- `FORFEIT`: Victory by opponent forfeit
- `NO_CONTEST`: Match invalidated

### VerificationStatus
- `PENDING`: Awaiting verification
- `VERIFIED`: Result confirmed
- `DISPUTED`: Result contested
- `REJECTED`: Result invalidated

### LeaderboardType
- `GLOBAL`: All-time global leaderboard
- `SEASONAL`: Season-based rankings
- `WEEKLY`: Weekly top players
- `MONTHLY`: Monthly rankings
- `REGIONAL`: Region-specific leaderboard

---

## Indexing Strategy

### Primary Indexes
All tables use CUID for primary keys (26-character collision-resistant identifiers).

### Foreign Key Indexes
Every foreign key has a corresponding index for join performance:
- Player matches: `idx_match_player1`, `idx_match_player2`
- Match results: `idx_result_match`, `idx_result_winner`, `idx_result_loser`
- Leaderboard entries: `idx_leaderboard_player`

### Query Optimization Indexes

**Leaderboard Queries:**
```sql
-- Fast top 100 query
SELECT * FROM players ORDER BY elo_rating DESC LIMIT 100;
-- Uses idx_player_elo (descending)

-- Active players only
SELECT * FROM players WHERE is_active = true ORDER BY elo_rating DESC;
-- Uses idx_active_players_elo (composite)
```

**Match History:**
```sql
-- Player's recent matches
SELECT * FROM matches
WHERE player1_id = $1 OR player2_id = $1
ORDER BY completed_at DESC;
-- Uses idx_match_player1, idx_match_player2, idx_match_completed
```

**Seasonal Leaderboards:**
```sql
-- Season 2025-Q1 global leaderboard
SELECT * FROM leaderboard_entries
WHERE season_id = '2025-Q1'
  AND leaderboard_type = 'GLOBAL'
  AND is_active = true
ORDER BY rank ASC;
-- Uses idx_season_leaderboard, idx_active_leaderboard
```

---

## Performance Considerations

### 1. Connection Pooling
Configure PostgreSQL connection pooling via environment variables:
```env
DATABASE_URL="postgresql://user:password@host:5432/dbname?connection_limit=20"
```

### 2. Query Patterns

**Efficient:**
- Single-table queries with indexed columns
- Leaderboard queries using pre-calculated ranks
- Match history with player_id filters

**Avoid:**
- Full table scans on Player table
- JOIN-heavy queries for leaderboards (use denormalized LeaderboardEntry)
- Unindexed WHERE clauses

### 3. Write Operations

**Match Completion Workflow:**
1. Update Match.status to COMPLETED
2. Create MatchResult with ELO changes
3. Update Player.elo_rating, wins/losses
4. Update LeaderboardEntry for affected players
5. Recalculate ranks for nearby players (±50 ELO)

**Batch Operations:**
- Seasonal rollover: Batch create new LeaderboardEntry records
- Rank recalculation: Process in batches of 100 players
- Inactive player cleanup: Scheduled batch updates

---

## Migration Strategy

### Initial Setup
```bash
# Generate Prisma client
npx prisma generate

# Create initial migration
npx prisma migrate dev --name init

# Apply to production
npx prisma migrate deploy
```

### Adding New Features
```bash
# Add field to schema
npx prisma migrate dev --name add_player_avatar

# Review SQL in prisma/migrations
# Test in development
# Deploy to production
npx prisma migrate deploy
```

### Data Seeding
```bash
# Create seed script: prisma/seed.ts
npx prisma db seed
```

---

## Security Considerations

### 1. Cascading Deletes
- Player deletion cascades to matches, match results, and leaderboard entries
- Consider soft deletes for player accounts to preserve historical data

### 2. Data Integrity
- Unique constraints on username and email prevent duplicates
- Foreign key constraints maintain referential integrity
- Enum types enforce valid status values

### 3. Input Validation
- Username: Max 50 characters, alphanumeric + underscore
- Email: Max 255 characters, valid email format
- ELO rating: Min 0, Max 4000 (prevent overflow)

---

## Monitoring & Maintenance

### Key Metrics
- Average query time for leaderboard queries (<50ms target)
- Match result write latency (<100ms target)
- Index usage statistics (pg_stat_user_indexes)
- Connection pool saturation

### Regular Tasks
- **Daily**: Prune old verification pending results (>7 days)
- **Weekly**: Reindex frequently updated tables
- **Monthly**: VACUUM ANALYZE for query planner statistics
- **Seasonal**: Archive old season data to cold storage

---

## API Integration Points

### Player Service
- `GET /players/:id` - Player profile (uses idx_player_id)
- `GET /players?username=X` - Username search (uses idx_player_username)
- `PATCH /players/:id` - Update profile (updates updated_at)

### Match Service
- `POST /matches` - Create match (inserts Match record)
- `PATCH /matches/:id/complete` - Complete match (triggers result workflow)
- `GET /matches?player_id=X` - Player match history (uses idx_match_player1/2)

### Leaderboard Service
- `GET /leaderboard` - Global leaderboard (uses idx_leaderboard_elo)
- `GET /leaderboard/seasonal/:season` - Seasonal leaderboard (uses idx_season_leaderboard)
- `GET /players/:id/rank` - Player rank (uses idx_leaderboard_player)

---

## Future Enhancements

### Planned Features
1. **Match Replays**: Add replay_url field to Match
2. **Player Teams**: New Team model with many-to-many Player relation
3. **Achievement System**: New Achievement model tracking player milestones
4. **Chat/Messaging**: Add Message model for player communication
5. **Tournament Brackets**: Enhanced tournament_id with Tournament model

### Scalability Improvements
1. **Read Replicas**: Separate read/write connection pools
2. **Partitioning**: Partition Match table by created_at (monthly)
3. **Caching**: Redis layer for top 100 leaderboard
4. **Archiving**: Move old matches to cold storage after 1 year

---

## Conclusion

This schema provides a solid foundation for a competitive ELO-based ranking system with:
- **Performance**: Comprehensive indexing for sub-50ms queries
- **Scalability**: Denormalized leaderboards for high-traffic scenarios
- **Flexibility**: Support for multiple match types and leaderboard configurations
- **Data Integrity**: Strong typing with enums and foreign key constraints

**Schema File**: `/workspaces/love-rank-pulse/prisma/schema.prisma`
**Last Updated**: 2025-10-21
**Schema Version**: 1.0.0
