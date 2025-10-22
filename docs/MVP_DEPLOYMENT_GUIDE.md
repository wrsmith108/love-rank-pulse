# MVP Deployment Guide - Love Rank Pulse

**Target:** 100% Free MVP Deployment
**Timeline:** 30-60 minutes
**Cost:** $0/month

---

## Quick Start (30 Minutes)

### Step 1: Set Up Neon.tech Database (5 minutes)

1. **Sign up at [neon.tech](https://neon.tech)** with GitHub
2. **Create new project:**
   - Project name: `love-rank-pulse-mvp`
   - Region: Select closest to you
   - PostgreSQL version: 16 (default)
3. **Copy connection string** from dashboard
4. **Enable auto-suspend** (should be on by default)

**Connection String Format:**
```
postgres://username:password@ep-xxxx.neon.tech/dbname?sslmode=require
```

### Step 2: Configure Local Environment (2 minutes)

Create `.env.local` file in project root:

```bash
# Neon.tech PostgreSQL connection
DATABASE_URL="postgres://username:password@ep-xxxx.neon.tech/dbname?sslmode=require"

# Optional: Local development variables
VITE_API_URL="http://localhost:3000"
VITE_WS_URL="ws://localhost:3001"
```

### Step 3: Run Database Migrations (3 minutes)

```bash
# Generate Prisma client
npm run prisma:generate

# Deploy migrations to Neon
npx prisma migrate deploy

# Verify connection
npx prisma studio
```

**Expected Output:**
```
✅ Prisma Studio is now running on http://localhost:5555
✅ Connected to Neon.tech database
```

### Step 4: Seed Synthetic Data (5 minutes)

```bash
# Generate 50 players + 100 matches
npm run prisma:seed:synthetic
```

**Expected Output:**
```
🌱 Seeding synthetic data for MVP...
✅ Created 50 players
✅ Created 100 matches with results
✅ Created 50 leaderboard entries

📊 Synthetic Data Summary:
   Players: 50
   Matches: 100
   Match Results: 100
   Leaderboard Entries: 50
```

**Verify Data:**
```bash
# Open Prisma Studio to view data
npx prisma studio
```

Navigate to:
- `players` table - Should see 50 test players
- `matches` table - Should see 100 completed matches
- `leaderboard_entries` table - Should see 50 ranked players

### Step 5: Deploy to Vercel (10 minutes)

#### Option A: Vercel CLI (Recommended)

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (first time setup)
vercel

# Add DATABASE_URL secret
vercel env add DATABASE_URL
# Paste your Neon connection string
# Select: Production, Preview, Development

# Deploy to production
vercel --prod
```

#### Option B: Vercel Dashboard (Web UI)

1. **Go to [vercel.com/new](https://vercel.com/new)**
2. **Import Git Repository:**
   - Connect GitHub account
   - Select `love-rank-pulse` repository
3. **Configure Project:**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Add Environment Variables:**
   - Key: `DATABASE_URL`
   - Value: `postgres://...` (Neon connection string)
   - Environments: Production, Preview, Development
5. **Deploy!**

**Deployment Time:** ~2-3 minutes

### Step 6: Test API Endpoints (5 minutes)

Once deployed, note your Vercel URL: `https://your-project.vercel.app`

**Test Health Endpoint:**
```bash
curl https://your-project.vercel.app/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "environment": "mvp",
  "timestamp": "2025-10-22T...",
  "version": "1.0.0",
  "service": "love-rank-pulse-api"
}
```

**Test Leaderboard:**
```bash
curl https://your-project.vercel.app/api/leaderboards
```

**Expected Response:**
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "player": {
        "id": "...",
        "username": "player42",
        "country_code": "US"
      },
      "elo_rating": 1987,
      "wins": 23,
      "losses": 12,
      "win_rate": 0.66
    },
    ...
  ],
  "pagination": {
    "total": 50,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

**Test Player Stats:**
```bash
# Replace {id} with actual player ID from leaderboard
curl https://your-project.vercel.app/api/players/{id}/stats
```

### Step 7: Update Frontend Environment (Optional - 2 minutes)

If you want the frontend to use the deployed backend:

1. **Go to Vercel Dashboard**
2. **Select your project** → Settings → Environment Variables
3. **Update or add:**
   ```
   VITE_API_URL=https://your-project.vercel.app
   ```
4. **Redeploy** (triggers automatically on env change)

---

## API Endpoints Reference

### Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "environment": "mvp",
  "timestamp": "2025-10-22T22:30:00.000Z",
  "version": "1.0.0",
  "service": "love-rank-pulse-api"
}
```

### Leaderboards
```http
GET /api/leaderboards?type=global&limit=100&offset=0
```

**Query Parameters:**
- `type` (optional) - `global` (default) or `country`
- `country` (optional) - Country code (e.g., `US`, `UK`)
- `limit` (optional) - Results per page (default: 100)
- `offset` (optional) - Pagination offset (default: 0)

**Response:**
```json
{
  "leaderboard": [...],
  "pagination": {
    "total": 50,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

### Player Stats
```http
GET /api/players/{id}/stats
```

**Response:**
```json
{
  "player": {
    "id": "...",
    "username": "player1",
    "avatar_url": null,
    "country_code": "US",
    "bio": "Test player 1 - MVP synthetic data"
  },
  "rating": {
    "current": 1456,
    "peak": 1523,
    "lowest": 1389
  },
  "rank": 12,
  "stats": {
    "matches_played": 42,
    "wins": 24,
    "losses": 15,
    "draws": 3,
    "win_rate": 0.57,
    "current_streak": 3,
    "best_win_streak": 7
  },
  "recent_matches": [...]
}
```

---

## Troubleshooting

### Database Connection Issues

**Error:** `Can't reach database server`

**Solution:**
1. Check DATABASE_URL is correct in Vercel dashboard
2. Verify Neon database is not suspended (open Neon dashboard)
3. Check connection string has `?sslmode=require`

### Build Failures

**Error:** `Build failed with exit code 1`

**Solution:**
```bash
# Test build locally
npm run build

# If successful locally, check Vercel logs
vercel logs
```

### API Routes Not Found

**Error:** `404 Not Found` on `/api/health`

**Solution:**
1. Verify `vercel.json` has correct routes configuration
2. Check `api/` directory exists with `.ts` files
3. Redeploy: `vercel --prod`

### No Data Returned

**Error:** `{"leaderboard": [], "pagination": {"total": 0}}`

**Solution:**
```bash
# Re-run seed script
npm run prisma:seed:synthetic

# Verify in Prisma Studio
npx prisma studio
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     MVP Architecture                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Frontend (Vercel)                                           │
│  ├── React + Vite                                           │
│  ├── Static Site Generation                                  │
│  └── HTTPS Auto-configured                                   │
│                                                               │
│  Backend API (Vercel Serverless)                            │
│  ├── /api/health.ts                                         │
│  ├── /api/leaderboards.ts                                   │
│  ├── /api/players/[id]/stats.ts                            │
│  └── Serverless Functions (auto-scaling)                    │
│                                                               │
│  Database (Neon.tech)                                        │
│  ├── PostgreSQL 16                                          │
│  ├── 0.5GB Storage (free tier)                             │
│  ├── Auto-suspend after inactivity                          │
│  └── 50 players + 100 matches (synthetic)                   │
│                                                               │
│  💰 Total Cost: $0/month                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Performance Expectations

### Cold Start (First Request)
- **Time:** ~500ms - 1s
- **Reason:** Serverless function initialization + database wake-up
- **Acceptable for MVP**

### Warm Requests
- **Time:** ~100-200ms
- **Database queries:** ~50-100ms
- **Excellent for testing**

### Free Tier Limits

**Neon.tech:**
- 0.5GB storage
- 1 concurrent connection
- Auto-suspend after 5 minutes idle
- Unlimited compute hours (free tier)

**Vercel:**
- 100GB bandwidth/month
- 100GB-hours serverless execution
- 10k+ API requests/month
- Unlimited deployments

---

## Next Steps

### For Local Development
```bash
# Run frontend dev server
npm run dev

# Run Prisma Studio (view/edit data)
npx prisma studio

# Run tests
npm run test

# E2E tests
npm run test:e2e
```

### For Production Readiness
When ready to move beyond MVP:
1. Add real authentication (Auth0, Clerk, etc.)
2. Upgrade to Neon Pro for better performance
3. Add Redis cache layer (Upstash)
4. Enable WebSocket server
5. Add monitoring (Sentry, etc.)

---

## Success Checklist

- [ ] Neon.tech account created (free)
- [ ] Database connection verified
- [ ] Migrations deployed successfully
- [ ] Synthetic data seeded (50 players, 100 matches)
- [ ] Vercel account connected to GitHub
- [ ] DATABASE_URL environment variable added
- [ ] Backend deployed to Vercel
- [ ] `/api/health` endpoint returns 200
- [ ] `/api/leaderboards` returns player data
- [ ] Frontend loads and displays data
- [ ] Total cost: $0/month ✅

---

## Support

**Issues with deployment?**
- Check [Vercel Logs](https://vercel.com/docs/concepts/deployments/logs)
- Check [Neon Status](https://neon.tech/status)
- Review [Prisma Docs](https://www.prisma.io/docs)

**Questions?**
- Open an issue on GitHub
- Check `docs/BACKEND_DEPLOYMENT_SPRINT_PLAN.md` for detailed info

---

**Deployment Time:** ~30-60 minutes
**Cost:** $0/month
**Status:** ✅ Production-ready MVP
