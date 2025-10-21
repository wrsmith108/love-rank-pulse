# Database Migrations Guide

## Overview
This guide explains how to manage database migrations and seeding for the Love Rank Pulse leaderboard system.

## Prerequisites
- PostgreSQL database installed and running
- Environment variable `DATABASE_URL` set in `.env` file
- Node.js and npm installed

## Database Setup

### 1. Environment Configuration
Create a `.env` file in the project root with your database connection:

```bash
DATABASE_URL="postgresql://username:password@localhost:5432/love_rank_pulse?schema=public"
```

### 2. Generate Prisma Client
Generate the Prisma Client to interact with your database:

```bash
npm run prisma:generate
```

### 3. Run Migrations
Apply the database schema to your PostgreSQL database:

```bash
npm run prisma:migrate
```

This will:
- Create all tables defined in `prisma/schema.prisma`
- Set up indexes for optimized queries
- Create foreign key relationships
- Apply constraints and defaults

### 4. Seed the Database
Populate the database with sample data:

```bash
npm run prisma:seed
```

The seed script will create:
- **20 sample players** with varied skill levels (beginner to expert)
- **30 completed matches** spread over time
- **Match results** with realistic stats (kills, deaths, accuracy, headshots)
- **Leaderboard entries** for multiple scopes and time periods
- **1 active game session** (Season 1 - Winter Tournament)

## Available NPM Scripts

### Migration Scripts
```bash
# Create and apply a new migration
npm run prisma:migrate

# Reset database (WARNING: deletes all data)
npm run prisma:reset

# Apply migrations in production
npm run prisma:deploy
```

### Prisma Studio
```bash
# Open Prisma Studio to view/edit data
npm run prisma:studio
```

### Database Seeding
```bash
# Run seed script
npm run prisma:seed
```

## Schema Overview

### Player Table
- Stores player authentication and profile information
- Unique username and email
- Country code for regional leaderboards
- Hashed passwords with bcrypt

### Match Table
- Represents individual game matches
- Links to game sessions
- Tracks match status (PENDING, IN_PROGRESS, COMPLETED, CANCELLED)

### MatchResult Table
- Player performance in specific matches
- Stats: kills, deaths, assists, headshots, accuracy, score
- KD ratio calculated and stored
- Win/loss tracking

### LeaderboardEntry Table
- Aggregated player rankings
- Multiple scopes: SESSION, COUNTRY, GLOBAL
- Time periods: SESSION, HOUR, DAY, WEEK, MONTH, ALL_TIME
- Pre-calculated stats for fast queries

### Session Table
- Game sessions for session-scoped leaderboards
- Active/inactive status
- Start and end times

## Sample Data

### Player Distribution
- **5 Beginners**: Lower KD ratios (0.5-1.5), learning the game
- **7 Intermediate**: Moderate KD ratios (1.5-3.0), improving skills
- **4 Advanced**: High KD ratios (3.0-5.0), experienced players
- **4 Experts**: Very high KD ratios (5.0+), top-tier players

### Match Results
- Each match includes 8-10 players
- Top 40% of players win each match
- Stats generated based on skill level
- Realistic score calculations

### Leaderboard Scopes
- **GLOBAL**: All players worldwide
- **SESSION**: Current game session
- **COUNTRY**: Regional rankings (future feature)

### Time Periods
- **ALL_TIME**: Complete player history
- **WEEK**: Last 7 days
- **DAY**: Last 24 hours

## Resetting the Database

To completely reset the database and start fresh:

```bash
# This will drop all tables, re-run migrations, and re-seed data
npm run prisma:reset
```

⚠️ **WARNING**: This command will delete ALL data in the database!

## Development Workflow

1. **Make schema changes** in `prisma/schema.prisma`
2. **Create migration**: `npm run prisma:migrate`
3. **Review migration** in `prisma/migrations/` folder
4. **Test with seed data**: `npm run prisma:seed`
5. **Verify in Prisma Studio**: `npm run prisma:studio`

## Production Deployment

For production environments:

1. Set `DATABASE_URL` environment variable
2. Run migrations: `npm run prisma:deploy`
3. **DO NOT** run seed script in production
4. Verify schema: `npm run prisma:validate`

## Troubleshooting

### Migration Failed
```bash
# Reset to a specific migration
npx prisma migrate resolve --applied "migration_name"
```

### Connection Issues
- Check `DATABASE_URL` format
- Verify PostgreSQL is running
- Check firewall/network settings
- Verify database exists

### Seed Errors
- Ensure migrations are up to date
- Check for unique constraint violations
- Verify Prisma Client is generated

## Performance Tips

### Indexes
The schema includes optimized indexes for:
- Username and email lookups
- Country-based filtering
- Leaderboard rank queries
- Match status filtering
- Time-based queries

### Query Optimization
- Use `include` sparingly (only fetch needed relations)
- Leverage leaderboard aggregations instead of calculating on-the-fly
- Use pagination for large result sets
- Cache frequently accessed leaderboards

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)
- [Prisma Migrate Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
