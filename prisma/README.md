# Prisma Database Configuration

This directory contains the Prisma schema, migrations, and seed data for the Love Rank Pulse leaderboard system.

## 📁 Directory Structure

```
prisma/
├── schema.prisma          # Database schema definition
├── seed.ts               # Seed data generator
├── migrations/           # Migration history (auto-generated)
└── README.md            # This file
```

## 🚀 Quick Start

### 1. Environment Setup
Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/love_rank_pulse?schema=public"
```

### 2. Generate Prisma Client
```bash
npm run prisma:generate
```

### 3. Run Migrations
```bash
npm run prisma:migrate
```

This creates all database tables, indexes, and constraints.

### 4. Seed Database
```bash
npm run prisma:seed
```

This populates the database with realistic test data:
- 20 players (varied skill levels)
- 30 completed matches
- Match results with stats
- Leaderboard entries (multiple scopes/periods)
- 1 active game session

## 📊 Database Schema

### Tables
- **players**: User profiles and authentication
- **matches**: Game match sessions
- **match_results**: Player performance per match
- **leaderboard_entries**: Aggregated player rankings
- **sessions**: Game session management

### Enums
- **MatchStatus**: PENDING, IN_PROGRESS, COMPLETED, CANCELLED
- **LeaderboardScope**: SESSION, COUNTRY, GLOBAL
- **TimePeriod**: SESSION, HOUR, DAY, WEEK, MONTH, ALL_TIME

## 🛠️ Available Commands

| Command | Description |
|---------|-------------|
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Create and apply migrations |
| `npm run prisma:deploy` | Apply migrations (production) |
| `npm run prisma:seed` | Seed database with test data |
| `npm run prisma:reset` | Reset DB and re-seed (⚠️ DELETES ALL DATA) |
| `npm run prisma:studio` | Open Prisma Studio (DB browser) |
| `npm run prisma:validate` | Validate schema syntax |

## 🎲 Seed Data Details

### Player Distribution
- **5 Beginners**: Learning, KD 0.5-1.5
- **7 Intermediate**: Improving, KD 1.5-3.0
- **4 Advanced**: Experienced, KD 3.0-5.0
- **4 Experts**: Top-tier, KD 5.0+

### Match Configuration
- **30 matches** spread over 7 days
- **8-10 players** per match
- **20 minute** match duration
- **Top 40%** of players win each match

### Stats Generated
- **Kills**: Skill-based (5-50 per match)
- **Deaths**: Inversely skill-based (3-20 per match)
- **Accuracy**: 25-85% based on skill
- **Headshots**: 1-35 based on skill
- **Score**: Calculated from performance

### Leaderboard Scopes
- **GLOBAL**: All players
- **SESSION**: Current season

### Time Periods
- **ALL_TIME**: Complete history
- **WEEK**: Last 7 days
- **DAY**: Last 24 hours

## 🔄 Creating New Migrations

When you modify `schema.prisma`:

```bash
npm run prisma:migrate
# Follow prompts to name your migration
```

Prisma will:
1. Detect schema changes
2. Generate SQL migration file
3. Apply migration to database
4. Update Prisma Client

## 📝 Example Queries

### Get Top 10 Global Players
```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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

### Get Player Stats
```typescript
const playerStats = await prisma.leaderboardEntry.findFirst({
  where: {
    playerId: 'player-id',
    scope: 'GLOBAL',
    timePeriod: 'ALL_TIME'
  }
});
```

### Recent Matches
```typescript
const recentMatches = await prisma.match.findMany({
  where: { status: 'COMPLETED' },
  orderBy: { endTime: 'desc' },
  take: 20,
  include: { matchResults: { include: { player: true } } }
});
```

## 🔍 Prisma Studio

Open visual database browser:
```bash
npm run prisma:studio
```

Access at: http://localhost:5555

## ⚠️ Important Notes

### Development
- Always run migrations before seeding
- Use `prisma:studio` to inspect data
- Seed data is for testing only

### Production
- **NEVER** run `prisma:seed` in production
- Use `prisma:deploy` for production migrations
- Set `DATABASE_URL` in environment variables
- Use connection pooling for serverless (PgBouncer)

### Performance
- All tables have optimized indexes
- Leaderboard stats are pre-aggregated
- Use pagination for large queries
- Consider caching frequently accessed data

## 🐛 Troubleshooting

### Prisma Client not generated
```bash
npm run prisma:generate
```

### Migration conflicts
```bash
# Reset development database
npm run prisma:reset

# Or resolve manually
npx prisma migrate resolve --applied "migration_name"
```

### Connection errors
- Verify `DATABASE_URL` format
- Check PostgreSQL is running
- Test connection: `npx prisma db pull`

## 📚 Additional Resources

- [Full Database Documentation](/workspaces/love-rank-pulse/docs/database-migrations.md)
- [Quick Reference Guide](/workspaces/love-rank-pulse/docs/database-quick-reference.md)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)

## 🔐 Security

- Passwords are hashed with bcrypt (cost factor 10)
- Use environment variables for credentials
- Never commit `.env` file
- Use SSL in production (`?sslmode=require`)

## 📈 Monitoring

Track database performance:
- Monitor query execution time
- Set up connection pool limits
- Use Prisma query logging in development
- Consider APM tools for production

---

**Need help?** Check the documentation in `/docs` or review the seed script for examples.
