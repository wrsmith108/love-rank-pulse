# Production Deployment Quick Reference Checklist

**Purpose:** Quick checklist for deploying Love Rank Pulse to production. See [DEPLOYMENT_PRODUCTION_GUIDE.md](./DEPLOYMENT_PRODUCTION_GUIDE.md) for detailed instructions.

---

## Pre-Deployment (15 minutes)

### Local Verification
```bash
- [ ] npm ci
- [ ] npm run prisma:generate
- [ ] npm run lint
- [ ] npm run typecheck
- [ ] npm run test
- [ ] npm run build
- [ ] node scripts/verify-build.js
```

### Code Quality
- [ ] All tests passing (>80% coverage)
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Build artifacts generated

---

## GitHub Configuration (10 minutes)

### Required Secrets
Navigate to: **Repository → Settings → Secrets and variables → Actions**

```
- [ ] VERCEL_TOKEN          (from https://vercel.com/account/tokens)
- [ ] VERCEL_ORG_ID         (from .vercel/project.json)
- [ ] VERCEL_PROJECT_ID     (from .vercel/project.json)
- [ ] VITE_API_BASE_URL     (Railway URL - add after backend deployment)
- [ ] VITE_WS_URL           (Railway WebSocket URL - add after)
- [ ] CODECOV_TOKEN         (optional - from https://codecov.io)
```

### Get Vercel IDs
```bash
vercel link
cat .vercel/project.json
```

---

## Railway Backend (20 minutes)

### 1. Create Project
- [ ] Sign up/login at https://railway.app
- [ ] Click "New Project" → "Deploy from GitHub repo"
- [ ] Select "love-rank-pulse"

### 2. Environment Variables
```bash
- [ ] JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
- [ ] NODE_ENV=production
- [ ] PORT=3000
- [ ] ALLOWED_ORIGINS=https://love-rank-pulse.vercel.app
- [ ] RATE_LIMIT_WINDOW_MS=900000
- [ ] RATE_LIMIT_MAX_REQUESTS=100
- [ ] LOG_LEVEL=info
```

### 3. Get Deployment URL
- [ ] Copy Railway URL: `https://love-rank-pulse-production.up.railway.app`
- [ ] Test: `curl https://your-url/health`

---

## Supabase Database (15 minutes)

### 1. Create Project
- [ ] Sign up/login at https://supabase.com
- [ ] Click "New Project"
- [ ] Name: `love-rank-pulse-production`
- [ ] Region: `us-east-1` (or closest to users)
- [ ] Plan: **Pro ($25/month)**

### 2. Get Connection Strings
Navigate to: **Settings → Database → Connection Info**

```bash
# Transaction mode (for Prisma)
- [ ] Copy connection pooler URL (port 5432, ?pgbouncer=true)

# Direct connection (for migrations)
- [ ] Copy direct URL (port 5432)
```

### 3. Add to Railway
```bash
- [ ] DATABASE_URL=<pooler-url>
- [ ] DIRECT_URL=<direct-url>
```

### 4. Deploy Migrations
```bash
export DATABASE_URL="<direct-url>"
npm run prisma:migrate deploy
```

---

## Upstash Redis (10 minutes)

### 1. Create Database
- [ ] Sign up/login at https://upstash.com
- [ ] Click "Create Database"
- [ ] Name: `love-rank-pulse-cache`
- [ ] Type: `Regional`
- [ ] Region: Match Railway region
- [ ] TLS: Enabled
- [ ] Eviction: `allkeys-lru`

### 2. Get URL
- [ ] Copy Redis URL from dashboard

### 3. Add to Railway
```bash
- [ ] REDIS_URL=redis://default:password@host:6379
- [ ] REDIS_TLS=true
```

---

## Sentry Monitoring (10 minutes)

### 1. Create Project
- [ ] Sign up/login at https://sentry.io
- [ ] Click "Create Project"
- [ ] Platform: `Node.js` and `React`
- [ ] Name: `love-rank-pulse`

### 2. Get DSN
- [ ] Copy DSN from project settings

### 3. Configure
```bash
# Railway
- [ ] SENTRY_DSN=https://xxxxx@o0.ingest.sentry.io/0

# Vercel
- [ ] VITE_SENTRY_DSN=https://xxxxx@o0.ingest.sentry.io/0
```

---

## Vercel Frontend (5 minutes)

### Update Environment Variables
Navigate to: **Vercel Dashboard → love-rank-pulse → Settings → Environment Variables**

```bash
- [ ] VITE_API_BASE_URL=https://love-rank-pulse-production.up.railway.app/api
- [ ] VITE_WS_URL=wss://love-rank-pulse-production.up.railway.app
- [ ] VITE_SENTRY_DSN=<from-sentry>
- [ ] VITE_ENABLE_REALTIME=true
- [ ] VITE_ENABLE_WEBSOCKETS=true
```

### Redeploy
- [ ] Go to Deployments → Latest → Redeploy

---

## Post-Deployment Verification (10 minutes)

### Automated Checks
```bash
./scripts/verify-deployment.sh
```

### Manual Tests

**Backend:**
```bash
- [ ] curl https://your-backend.railway.app/health
- [ ] curl https://your-backend.railway.app/api/leaderboards/global
```

**Frontend:**
- [ ] Visit https://love-rank-pulse.vercel.app
- [ ] Test login/register
- [ ] View leaderboards (session, country, global)
- [ ] Test filters (24h, 7d, 30d, all)
- [ ] Verify WebSocket connection in console
- [ ] Check player stats modal

**Database:**
```bash
- [ ] psql "$DATABASE_URL"
- [ ] \dt  # List tables
- [ ] SELECT COUNT(*) FROM players;
```

**Redis:**
```bash
- [ ] redis-cli -u "$REDIS_URL" ping
# Should return: PONG
```

---

## Production Readiness (5 minutes)

### Final Checklist
- [ ] All services healthy and responding
- [ ] No console errors in frontend
- [ ] WebSocket connections stable
- [ ] Database queries < 300ms
- [ ] Error tracking working (Sentry)
- [ ] Monitoring dashboards visible
- [ ] GitHub Actions all green
- [ ] SSL certificates valid

---

## Cost Summary

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Vercel | Pro | $20 |
| Railway | Usage | $20-25 |
| Supabase | Pro | $25 |
| Upstash | Pay-as-go | $5-10 |
| Sentry | Team (optional) | $26 |
| **Total** | | **$70-106/month** |

---

## Emergency Contacts

**Rollback Commands:**
```bash
# Frontend
vercel promote [deployment-url]

# Backend
git reset --hard [commit-sha]
git push origin main --force

# Database
# Go to Supabase Dashboard → Backups → Restore
```

**Support:**
- Railway: support@railway.app
- Vercel: support@vercel.com
- Supabase: support@supabase.io
- Upstash: support@upstash.com
- Sentry: support@sentry.io

---

## Quick Links

- **Railway Dashboard:** https://railway.app/dashboard
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Upstash Dashboard:** https://console.upstash.com
- **Sentry Dashboard:** https://sentry.io
- **GitHub Actions:** https://github.com/[your-repo]/actions

---

**Total Deployment Time:** ~90 minutes

**Next Steps After Deployment:**
1. ✅ Monitor Sentry for errors (first 24 hours)
2. ✅ Check performance metrics
3. ✅ Verify backups are running
4. ✅ Set up monitoring alerts
5. ✅ Document any issues encountered

**Full Documentation:** See [DEPLOYMENT_PRODUCTION_GUIDE.md](./DEPLOYMENT_PRODUCTION_GUIDE.md) for detailed instructions.
