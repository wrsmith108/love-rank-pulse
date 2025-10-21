# Database Quick Reference

## Quick Start Commands

```bash
# First time setup
npm run prisma:generate    # Generate Prisma Client
npm run prisma:migrate     # Run migrations
npm run prisma:seed        # Seed with sample data

# Development
npm run prisma:studio      # Open database browser

# Reset everything (WARNING: deletes all data)
npm run prisma:reset
```

## Sample Data Generated

### Players (20 total)
- **Skill Distribution**:
  - 5 Beginners (KD: 0.5-1.5)
  - 7 Intermediate (KD: 1.5-3.0)
  - 4 Advanced (KD: 3.0-5.0)
  - 4 Experts (KD: 5.0+)
- **Countries**: 10 different countries (US, GB, DE, FR, JP, KR, BR, CA, AU, SE)
- **Authentication**: All passwords hashed with bcrypt

### Matches (30 total)
- **Status**: All COMPLETED
- **Duration**: 20 minutes each
- **Players per match**: 8-10 random players
- **Time spread**: Distributed over last 7 days

### Match Results
- **Stats per player**:
  - Kills, Deaths, Assists
  - Headshots (skill-based)
  - Accuracy (25-85% based on skill)
  - Score (calculated from performance)
  - Win/Loss (top 40% win each match)
  - KD Ratio (auto-calculated)

### Leaderboard Entries
- **Scopes**: GLOBAL, SESSION
- **Time Periods**: ALL_TIME, WEEK, DAY
- **Rankings**: Based on KD ratio
- **Aggregated Stats**:
  - Total kills/deaths
  - Win rate
  - Average score
  - Total matches played

### Session
- **Name**: "Season 1 - Winter Tournament"
- **Status**: Active
- **Duration**: Started 7 days ago

## Schema Quick Reference

### Player Fields
```typescript
id: string (UUID)
username: string (unique)
email: string (unique)
password: string (bcrypt hashed)
countryCode: string (2 chars)
```

### Match Fields
```typescript
id: string (UUID)
sessionId: string
startTime: DateTime
endTime: DateTime?
status: PENDING | IN_PROGRESS | COMPLETED | CANCELLED
```

### MatchResult Fields
```typescript
id: string (UUID)
matchId: string
playerId: string
kills: number
deaths: number
assists: number
headshots: number
accuracy: number (0-1)
score: number
isWin: boolean
kdRatio: number (auto-calculated)
```

### LeaderboardEntry Fields
```typescript
id: string (UUID)
playerId: string
scope: SESSION | COUNTRY | GLOBAL
timePeriod: SESSION | HOUR | DAY | WEEK | MONTH | ALL_TIME
rank: number
totalKills: number
totalDeaths: number
kdRatio: number
wins: number
losses: number
winRate: number (0-1)
totalMatches: number
avgScore: number
lastMatchAt: DateTime?
```

## Common Queries

### Get Top 10 Players (Global, All-Time)
```typescript
const topPlayers = await prisma.leaderboardEntry.findMany({
  where: {
    scope: 'GLOBAL',
    timePeriod: 'ALL_TIME'
  },
  orderBy: { rank: 'asc' },
  take: 10,
  include: { player: true }
});
```

### Get Player Match History
```typescript
const matchHistory = await prisma.matchResult.findMany({
  where: { playerId: 'player-id' },
  include: { match: true },
  orderBy: { createdAt: 'desc' }
});
```

### Get Weekly Leaderboard
```typescript
const weeklyLeaderboard = await prisma.leaderboardEntry.findMany({
  where: {
    scope: 'GLOBAL',
    timePeriod: 'WEEK'
  },
  orderBy: { rank: 'asc' }
});
```

## Environment Variables

Required in `.env`:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/love_rank_pulse?schema=public"
```

## File Locations

- **Schema**: `/workspaces/love-rank-pulse/prisma/schema.prisma`
- **Seed Script**: `/workspaces/love-rank-pulse/prisma/seed.ts`
- **Migrations**: `/workspaces/love-rank-pulse/prisma/migrations/`
- **Documentation**: `/workspaces/love-rank-pulse/docs/database-migrations.md`

## Troubleshooting

### "Prisma Client not found"
```bash
npm run prisma:generate
```

### "Migration failed"
```bash
# Check DATABASE_URL is correct
# Ensure PostgreSQL is running
npm run prisma:validate
```

### "Unique constraint violation"
```bash
# Reset and re-seed
npm run prisma:reset
```

## Performance Notes

- All queries use optimized indexes
- Leaderboard stats are pre-aggregated
- Country filtering is indexed
- KD ratios are stored (not calculated on query)
- Use pagination for large result sets

## Next Steps

1. Set up production database on Vercel/Railway/Supabase
2. Add DATABASE_URL to production environment
3. Run migrations: `npm run prisma:deploy`
4. DO NOT run seed in production
