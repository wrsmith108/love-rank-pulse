# Quick Start: Database & Cache Setup

Get your Love Rank Pulse development environment up and running in minutes.

---

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] PostgreSQL 14+ installed
- [ ] Redis 6+ installed
- [ ] Git repository cloned

---

## 5-Minute Setup

### Step 1: Install Dependencies (1 minute)

```bash
# Install project dependencies
npm install

# Install Prisma CLI globally (optional)
npm install -g prisma
```

### Step 2: Configure Environment (1 minute)

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your credentials
# Minimum required changes:
# - DATABASE_URL (if not using localhost)
# - REDIS_URL (if not using localhost)
```

**Default Development Settings** (works out-of-the-box):
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/loverankpulse?schema=public
REDIS_URL=redis://localhost:6379/0
```

### Step 3: Start Services (2 minutes)

#### Option A: Using Docker Compose (Recommended)

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Verify services are running
docker-compose ps
```

#### Option B: Using Local Services

```bash
# Start PostgreSQL (macOS)
brew services start postgresql@14

# Start Redis (macOS)
brew services start redis

# Verify services
psql -U postgres -c "SELECT version();"
redis-cli ping
```

### Step 4: Initialize Database (1 minute)

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Seed database (optional)
npx prisma db seed
```

### Step 5: Verify Setup

```bash
# Test database connection
npx prisma db execute --stdin <<< "SELECT 1;"

# Test Redis connection
redis-cli ping
```

**Expected Output**:
```
Database: Connected successfully
Redis: PONG
```

---

## Common Setup Scenarios

### Scenario 1: Local Development (Default)

```env
# .env
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/loverankpulse?schema=public
REDIS_URL=redis://localhost:6379/0
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=5
```

**Start Services**:
```bash
brew services start postgresql@14
brew services start redis
```

### Scenario 2: Docker Containers

```env
# .env
NODE_ENV=development
DATABASE_URL=postgresql://loverank:loverank_dev_password@localhost:5432/loverank_db?schema=public
REDIS_URL=redis://:redis_dev_password@localhost:6379/0
```

**Start Services**:
```bash
docker-compose up -d
```

### Scenario 3: Cloud Services

#### Using Vercel Postgres + Upstash Redis

```env
# .env.production
DATABASE_URL=postgresql://user:pass@db.region.postgres.vercel-storage.com/db
REDIS_URL=rediss://:password@endpoint.upstash.io:6379
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50
```

**No local services needed** - everything runs in the cloud.

---

## Usage Examples

### Basic Database Query

```typescript
import { initializeDatabase, getPrismaClient } from './services/database';

// Initialize on startup
await initializeDatabase();

// Use Prisma client
const prisma = getPrismaClient();
const players = await prisma.player.findMany();
```

### Basic Cache Usage

```typescript
import { initializeCache, setCache, getCache } from './services/cache';

// Initialize on startup
await initializeCache();

// Cache data
await setCache('leaderboard:global', leaderboardData, 300);

// Retrieve cached data
const cached = await getCache('leaderboard:global');
```

### Health Check

```typescript
import { checkSystemHealth } from './services/healthCheck';

const health = await checkSystemHealth();
console.log(health.status); // 'healthy', 'degraded', or 'unhealthy'
```

---

## Troubleshooting Quick Fixes

### Database Connection Failed

**Error**: `Connection refused on localhost:5432`

**Fix**:
```bash
# Check if PostgreSQL is running
brew services list

# Start PostgreSQL
brew services start postgresql@14

# Verify connection
psql -U postgres
```

### Redis Connection Failed

**Error**: `ECONNREFUSED redis://localhost:6379`

**Fix**:
```bash
# Check if Redis is running
brew services list

# Start Redis
brew services start redis

# Verify connection
redis-cli ping
```

### Database Doesn't Exist

**Error**: `database "loverankpulse" does not exist`

**Fix**:
```bash
# Create database
psql -U postgres -c "CREATE DATABASE loverankpulse;"

# Run migrations
npx prisma migrate dev
```

### Connection Pool Exhausted

**Error**: `Timed out fetching a new connection from the pool`

**Fix**: Edit `.env`:
```env
DATABASE_POOL_MAX=20  # Increase pool size
DATABASE_QUERY_TIMEOUT=30000  # Increase timeout
```

### Prisma Client Not Generated

**Error**: `Cannot find module '@prisma/client'`

**Fix**:
```bash
# Generate Prisma client
npx prisma generate

# If error persists, reinstall
rm -rf node_modules/@prisma
npm install @prisma/client
npx prisma generate
```

---

## Development Workflow

### Daily Workflow

```bash
# 1. Start services (if not already running)
docker-compose up -d
# OR
brew services start postgresql@14 redis

# 2. Run application
npm run dev

# 3. Check health
curl http://localhost:3000/health

# 4. Stop services when done
docker-compose down
# OR
brew services stop postgresql@14 redis
```

### Making Database Changes

```bash
# 1. Edit Prisma schema
vim prisma/schema.prisma

# 2. Create migration
npx prisma migrate dev --name add_new_field

# 3. Regenerate client
npx prisma generate

# 4. Restart application
npm run dev
```

### Clearing Cache

```bash
# Option 1: Via Redis CLI
redis-cli FLUSHDB

# Option 2: Programmatically
import { clearCachePattern } from './services/cache';
await clearCachePattern('*'); // Clear all caches
```

---

## Performance Tips

### Optimize Connection Pool

**Development**:
```env
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=5
REDIS_POOL_MAX=5
```

**Production**:
```env
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50
REDIS_POOL_MAX=20
```

### Optimize Cache TTL

**Frequently Accessed Data** (longer TTL):
```env
CACHE_TTL_PLAYER_STATS=600  # 10 minutes
CACHE_TTL_COUNTRY_STATS=900  # 15 minutes
```

**Real-Time Data** (shorter TTL):
```env
CACHE_TTL_LEADERBOARD=120  # 2 minutes
CACHE_TTL_MATCH_DATA=60     # 1 minute
```

### Monitor Performance

```typescript
import { getConnectionMetrics, getCacheMetrics } from './services';

// Log metrics every minute
setInterval(() => {
  console.log('DB Metrics:', getConnectionMetrics());
  console.log('Cache Metrics:', getCacheMetrics());
}, 60000);
```

---

## Testing Setup

### Test Database Setup

```bash
# Create test database
psql -U postgres -c "CREATE DATABASE loverankpulse_test;"

# Set test environment
export NODE_ENV=test
export DATABASE_URL=postgresql://postgres:password@localhost:5432/loverankpulse_test?schema=public
export REDIS_URL=redis://localhost:6379/1

# Run migrations on test database
npx prisma migrate deploy

# Run tests
npm test
```

### Integration Testing

```typescript
import { initializeDatabase, initializeCache } from './services';

beforeAll(async () => {
  await initializeDatabase();
  await initializeCache();
});

afterAll(async () => {
  await closeDatabase();
  await closeCache();
});
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Update `DATABASE_URL` with production credentials
- [ ] Update `REDIS_URL` with production credentials
- [ ] Change `JWT_SECRET` to secure random string
- [ ] Set `NODE_ENV=production`
- [ ] Configure appropriate pool sizes
- [ ] Enable SSL/TLS for database connections
- [ ] Set up database backups
- [ ] Configure monitoring and alerting
- [ ] Run security audit
- [ ] Test health check endpoints

### Deployment Commands

```bash
# Build application
npm run build

# Run migrations
npx prisma migrate deploy

# Start production server
NODE_ENV=production npm start
```

### Health Check Endpoints

```bash
# Overall health
curl https://api.loverankpulse.com/health

# Readiness probe
curl https://api.loverankpulse.com/ready

# Liveness probe
curl https://api.loverankpulse.com/alive
```

---

## Next Steps

1. **Read Full Documentation**:
   - [Database Setup Guide](./database-setup.md)
   - [Environment Variables Reference](./environment-variables.md)

2. **Configure Monitoring**:
   - Set up health check monitoring
   - Configure performance alerts
   - Enable database query logging

3. **Optimize Performance**:
   - Add database indexes
   - Tune cache TTL values
   - Configure connection pooling

4. **Set Up CI/CD**:
   - Automate database migrations
   - Add integration tests
   - Configure deployment pipelines

---

## Support Resources

- **Documentation**: See `/docs` folder
- **GitHub Issues**: Report bugs and feature requests
- **Team Chat**: Contact development team

---

**Ready to Start?** Run `npm run dev` and visit `http://localhost:5173`
