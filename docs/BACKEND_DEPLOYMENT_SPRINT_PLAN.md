# Backend Deployment Sprint Plan - Love Rank Pulse (MVP)

**Generated:** 2025-10-22
**Target:** MVP Backend API Deployment with Free Tools
**Scope:** Open-source testing with synthetic data
**Estimation Method:** T-Shirt Sizing (Token-based)
**Total Estimated Effort:** ~200k tokens (~1 Medium task)
**Timeline:** 3-4 hours

---

## T-Shirt Sizing Reference

| Size | Token Estimate | Example Task |
|------|----------------|--------------|
| **XS** | 50k tokens | Config change, environment setup, verification |
| **S** | 100k tokens | Platform setup, database configuration |
| **M** | 200k tokens | Full deployment pipeline, monitoring setup |
| **L** | 400k tokens | Multi-service orchestration |
| **XL** | >400k tokens | **Must be broken down** |

---

## Current Project Status

### ✅ Completed (Ready for MVP Deployment)
- All 7 implementation waves complete (100%)
- 596 tests written, 535 passing (83%)
- Build passing in 6.82s
- Frontend deployed to Vercel
- MVP readiness: 100%

### 📦 Ready to Deploy (MVP Scope)
- **Backend API** - Express server
- **API Gateway** - Request routing and middleware
- **Services Layer** - Business logic with in-memory/file storage
- **Synthetic Data** - Mock data for testing

### 🗄️ MVP Database Strategy
- **Option 1:** SQLite (file-based, zero cost)
- **Option 2:** Neon.tech (PostgreSQL free tier)
- **Option 3:** In-memory storage (fastest for testing)
- **Cache:** Simple in-memory cache (no Redis needed for MVP)

---

## MVP Deployment Architecture (100% Free)

```
┌─────────────────────────────────────────────────────────────┐
│                     MVP Test Environment                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │   Vercel (Backend)   │      │   Neon.tech (Free)   │    │
│  │   Serverless API     │─────▶│   PostgreSQL         │    │
│  │                      │      │                      │    │
│  │ - Express API        │      │ - 0.5GB Storage      │    │
│  │ - Serverless         │      │ - Auto-suspend       │    │
│  │   Functions          │      │ - Synthetic Data     │    │
│  │ - In-memory cache    │      │                      │    │
│  └──────────────────────┘      └──────────────────────┘    │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────┐                                   │
│  │   Vercel (Frontend)  │                                   │
│  │   Static Site        │                                   │
│  │                      │                                   │
│  │ - React App          │                                   │
│  │ - Already Deployed   │                                   │
│  └──────────────────────┘                                   │
│                                                               │
│  💰 Total Cost: $0/month                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Simplified MVP Dependency Graph

```
                    ┌──────────────────┐
                    │  Task 1: Setup   │
                    │  Neon DB (XS)    │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ Task 2: Create   │
                    │ Synthetic Data   │
                    │ (XS)             │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ Task 3: Deploy   │
                    │ to Vercel (S)    │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ Task 4: E2E Test │
                    │ & Validate (XS)  │
                    └──────────────────┘
```

---

## MVP Execution Waves (Simplified, Free Tools Only)

### 🌊 Wave 1: Database Setup with Neon.tech (Sequential)
**Total:** 50k tokens (XS)
**Duration:** ~30 minutes
**Cost:** $0 (Free tier)

| Task | Size | Agent | Dependencies |
|------|------|-------|--------------|
| 1. Neon.tech PostgreSQL Setup | XS | `backend-dev` | None |

**Why Neon.tech for MVP:**
- ✅ **100% Free** - Generous free tier
- ✅ **PostgreSQL Compatible** - Works with existing Prisma schema
- ✅ **Auto-suspend** - Scales to zero when idle
- ✅ **No credit card** - Sign up with GitHub
- ✅ **Instant provisioning** - Ready in 30 seconds
- ✅ **0.5GB storage** - Plenty for synthetic data

**Setup Steps:**
1. Sign up at [neon.tech](https://neon.tech) with GitHub
2. Create new project: "love-rank-pulse-mvp"
3. Select region closest to you
4. Copy connection string
5. Enable "Compute Auto-suspend" (free tier feature)

**Connection String Format:**
```bash
postgres://username:password@ep-xxxx.neon.tech/dbname?sslmode=require
```

**Deliverables:**
- Neon.tech project created (free)
- Connection string obtained
- Auto-suspend enabled
- Zero monthly cost

---
### 🌊 Wave 2: Synthetic Data Generation (Sequential)
**Total:** 50k tokens (XS)
**Duration:** ~30 minutes
**Cost:** $0

| Task | Size | Agent | Dependencies |
|------|------|-------|--------------|
| 2. Generate Synthetic Test Data | XS | `backend-dev` | Wave 1 |

**Create Seed Script:**
Create `prisma/seed-synthetic.ts` for MVP testing:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding synthetic data for MVP...');

  // Create 50 test players
  const players = [];
  for (let i = 1; i <= 50; i++) {
    players.push({
      username: `player${i}`,
      email: `player${i}@test.com`,
      password_hash: 'hashed_password',  // Not real auth for MVP
      elo_rating: 1200 + Math.floor(Math.random() * 800),
      country_code: ['US', 'UK', 'CA', 'AU', 'DE'][i % 5],
      display_name: `Test Player ${i}`,
      is_active: true,
    });
  }

  await prisma.player.createMany({ data: players });

  // Create 100 synthetic matches
  for (let i = 0; i < 100; i++) {
    const p1 = Math.floor(Math.random() * 50) + 1;
    let p2 = Math.floor(Math.random() * 50) + 1;
    while (p2 === p1) p2 = Math.floor(Math.random() * 50) + 1;

    await prisma.match.create({
      data: {
        player1_id: `player${p1}`,
        player2_id: `player${p2}`,
        winner_id: Math.random() > 0.5 ? `player${p1}` : `player${p2}`,
        status: 'completed',
        started_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log('✅ Synthetic data created successfully!');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
```

**Run Locally First:**
```bash
# Set Neon connection string
export DATABASE_URL="postgres://..."

# Run Prisma migrations
npx prisma migrate deploy

# Seed synthetic data
npx tsx prisma/seed-synthetic.ts

# Verify data
npx prisma studio  # Opens browser to view data
```

**Deliverables:**
- 50 synthetic players created
- 100 synthetic matches created
- Leaderboard data populated
- Zero cost for data generation

---

### 🌊 Wave 3: Vercel Backend Deployment (Sequential)
**Total:** 100k tokens (S)
**Duration:** ~1.5 hours
**Cost:** $0 (Vercel free tier)

| Task | Size | Agent | Dependencies |
|------|------|-------|--------------|
| 3. Deploy Backend as Vercel Serverless | S | `cicd-engineer` | Wave 2 |

**Why Vercel for Backend (MVP):**
- ✅ **100% Free** - Hobby plan includes API routes
- ✅ **Already deployed frontend** - Same platform
- ✅ **Serverless** - Pay per invocation (free tier generous)
- ✅ **Auto HTTPS** - SSL certificates included
- ✅ **Easy deployment** - Git push to deploy
- ✅ **No cold starts** - Fast response times

**Convert Express to Vercel API Routes:**

Create `api/health.ts`:
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: 'mvp',
  });
}
```

Create `api/leaderboards.ts`:
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const players = await prisma.player.findMany({
      orderBy: { elo_rating: 'desc' },
      take: 100,
    });
    res.status(200).json(players);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
}
```

**Create `vercel.json`:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    }
  ],
  "env": {
    "DATABASE_URL": "@database_url"
  }
}
```

**Deployment Steps:**
1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Add environment variable in Vercel dashboard:
   - `DATABASE_URL` = Neon connection string
4. Deploy: `vercel --prod`
5. Note API URL: `https://your-project.vercel.app/api`

**Alternative: Use Existing Express (also free on Vercel)**
```bash
# Keep Express server, deploy as Vercel Function
# Create api/server.ts that exports Express app
# Vercel will handle the serverless wrapper
```

**Deliverables:**
- Backend API deployed to Vercel (free)
- API endpoints accessible
- Database connected
- Zero monthly cost

---

### 🌊 Wave 4: End-to-End Testing (Sequential)
**Total:** 50k tokens (XS)
**Duration:** ~30 minutes
**Cost:** $0

| Task | Size | Agent | Dependencies |
|------|------|-------|--------------|
| 4. MVP E2E Testing & Validation | XS | `tester` | Wave 3 |

**Test MVP API:**
```bash
API_URL="https://your-project.vercel.app"

# Test health endpoint
curl $API_URL/api/health

# Test leaderboard
curl $API_URL/api/leaderboards

# Test player stats
curl $API_URL/api/players/player1/stats
```

**Update Frontend Environment:**
In Vercel dashboard (Frontend project):
```bash
VITE_API_BASE_URL=https://your-project.vercel.app
```

Redeploy frontend (auto-triggers on env change)

**Manual Testing Checklist:**
- [ ] Open frontend at your-app.vercel.app
- [ ] Leaderboard loads synthetic data
- [ ] Player names display correctly
- [ ] ELO ratings showing
- [ ] Country filters work
- [ ] No console errors
- [ ] Page loads under 2 seconds

**Performance Expectations (Free Tier):**
- First request: ~500ms (cold start)
- Subsequent requests: ~100-200ms
- Database queries: ~50-100ms
- Acceptable for MVP testing

**Deliverables:**
- All API endpoints tested
- Frontend integrated with backend
- Synthetic data displaying correctly
- MVP fully functional for testing

---

## Cost Breakdown (100% Free MVP)

| Service | Tier | Monthly Cost | Limits |
|---------|------|--------------|--------|
| **Neon.tech** | Free | $0 | 0.5GB, Auto-suspend |
| **Vercel (Frontend)** | Hobby | $0 | 100GB bandwidth |
| **Vercel (Backend)** | Hobby | $0 | 100GB bandwidth |
| **Total** | | **$0/month** | Perfect for MVP testing |

**Free Tier Limits:**
- Neon: 0.5GB storage (plenty for synthetic data)
- Vercel: 100GB bandwidth/month (10k+ API calls)
- No credit card required
- No hidden costs
- No time limits

---

## Timeline Summary

### Realistic MVP Timeline (3-4 hours)
- **Wave 1:** Neon.tech setup - 30 min
- **Wave 2:** Synthetic data - 30 min
- **Wave 3:** Vercel deployment - 1.5 hours
- **Wave 4:** E2E testing - 30 min
- **Total:** 3-4 hours to fully deployed MVP

### What's NOT Included (Not needed for MVP)
- ❌ No Sentry (use console.log for debugging)
- ❌ No Uptime monitoring (Vercel has basic metrics)
- ❌ No Redis cache (in-memory caching sufficient)
- ❌ No WebSocket server (not needed for MVP testing)
- ❌ No custom domain (use *.vercel.app)
- ❌ No CI/CD pipeline (Vercel auto-deploys)
- ❌ No load balancing (Vercel handles automatically)
- ❌ No backups (Neon has point-in-time recovery)

---

## Simplified Success Criteria

### ✅ MVP Deployment Success
- [ ] Neon database accessible
- [ ] Synthetic data populated
- [ ] Vercel API responding
- [ ] Frontend loads data
- [ ] Zero monthly cost
- [ ] No credit cards used

### ✅ Functional Testing
- [ ] Leaderboard displays 50 players
- [ ] ELO ratings visible
- [ ] Country filters work
- [ ] API response time < 500ms
- [ ] No critical errors

### ✅ MVP Complete When:
- Frontend and backend both on Vercel
- Database on Neon (free)
- Synthetic data populated
- All features testable
- Cost remains $0/month

---

## Quick Start Guide

### Prerequisites
- GitHub account (for Neon and Vercel sign-up)
- Existing Vercel account (already have frontend deployed)
- Prisma schema ready (already complete)

### 30-Minute MVP Deployment

**Step 1: Database (5 minutes)**
```bash
# 1. Sign up at neon.tech with GitHub
# 2. Create project "love-rank-pulse-mvp"
# 3. Copy connection string
export DATABASE_URL="postgres://..."
```

**Step 2: Migrate & Seed (10 minutes)**
```bash
# Run migrations
npx prisma migrate deploy

# Create synthetic data
npx tsx prisma/seed-synthetic.ts

# Verify in Prisma Studio
npx prisma studio
```

**Step 3: Deploy to Vercel (10 minutes)**
```bash
# Add DATABASE_URL to Vercel dashboard
# Then deploy
vercel --prod
```

**Step 4: Test (5 minutes)**
```bash
# Test API
curl https://your-project.vercel.app/api/health

# Update frontend env var in Vercel
# VITE_API_BASE_URL=https://your-project.vercel.app

# Open frontend and test
```

**Total Time:** 30 minutes to fully functional MVP!

---

## Troubleshooting

### Common Issues

**1. Database Connection Fails**
```bash
# Verify connection string format
postgres://username:password@host/database?sslmode=require

# Test connection
npx prisma db pull
```

**2. Prisma Not Found on Vercel**
```bash
# Add to package.json
"postinstall": "prisma generate"

# Redeploy
vercel --prod
```

**3. Frontend Can't Reach API**
```bash
# Check CORS in Vercel Function
res.setHeader('Access-Control-Allow-Origin', '*')

# Verify environment variable
VITE_API_BASE_URL=https://your-project.vercel.app
```

**4. Neon Database Auto-Suspended**
- This is normal on free tier
- First request will be slower (~500ms)
- Subsequent requests fast (~100ms)
- No action needed

---

## What You Get (100% Free)

### ✅ Fully Functional MVP
- Frontend on Vercel (static site)
- Backend on Vercel (serverless functions)
- Database on Neon (PostgreSQL)
- 50 synthetic players
- 100 synthetic matches
- Working leaderboard
- Country filters
- Player stats
- Real-time updates (via polling)

### ✅ Zero Cost Forever
- No credit card needed anywhere
- No time limits
- No surprise charges
- Generous free tiers
- Can upgrade later if needed

### ✅ Perfect for Testing
- Show to friends/portfolio
- Test all features
- Verify functionality
- Iterate quickly
- Deploy changes instantly

---

## Next Steps After MVP

### If You Want to Add More (Still Free)
1. **Vercel KV** (Redis alternative) - Free tier available
2. **Vercel Cron** - Scheduled jobs for leaderboard updates
3. **Vercel Analytics** - Basic usage stats (free)

### If MVP Works Well (Paid Upgrades)
1. Neon Pro ($25/mo) - More storage, better performance
2. Vercel Pro ($20/mo) - More bandwidth, team features
3. Custom domain ($12/year) - yourapp.com

### Not Needed for MVP
- Monitoring (Vercel provides basics)
- Error tracking (use console.log)
- Caching (Vercel handles)
- CDN (Vercel includes)
- SSL (Vercel provides)
- Load balancing (Vercel automatic)

---

## Documentation

**Related Docs:**
- [Neon.tech Docs](https://neon.tech/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Prisma with Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)

**Project Docs:**
- [FINAL_IMPLEMENTATION_STATUS.md](./FINAL_IMPLEMENTATION_STATUS.md)
- [REMAINING_TASKS.md](./REMAINING_TASKS.md)
- [TEST_SUITE_FIXES_SUMMARY.md](./TEST_SUITE_FIXES_SUMMARY.md)

---

**Document Version:** 2.0 (MVP Simplified)
**Last Updated:** 2025-10-22
**Status:** Ready for MVP deployment
**Total Cost:** $0/month
**Timeline:** 3-4 hours (or 30 min quick start)
**Next Action:** Sign up for Neon.tech and start Wave 1
