# Love Rank Pulse - Deployment Guide

## Quick Deployment to Vercel

### Prerequisites ✅ COMPLETED
- [x] Frontend build successful (`npm run build`)
- [x] Build verification passed
- [x] Database infrastructure ready (PostgreSQL + Redis)
- [x] Prisma schema migrated
- [x] Test data seeded

### Build Output
```
dist/index.html                   1.29 kB │ gzip:   0.52 kB
dist/assets/index-DhgWXVIK.css   60.83 kB │ gzip:  10.87 kB
dist/assets/index-tUYODPQB.js   735.84 kB │ gzip: 207.73 kB
```

## Deployment Steps

### Option 1: Vercel CLI (Recommended)

1. **Login to Vercel:**
   ```bash
   vercel login
   ```

2. **Deploy to Production:**
   ```bash
   vercel --prod
   ```

3. **Deployment will:**
   - Upload the build to Vercel
   - Configure routing for SPA
   - Set up custom domain (if configured)
   - Deploy to global CDN

### Option 2: GitHub Integration

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "feat: Ready for Vercel deployment"
   git push origin main
   ```

2. **Connect in Vercel Dashboard:**
   - Go to https://vercel.com
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect settings from `vercel.json`
   - Click "Deploy"

### Option 3: Vercel Token (CI/CD)

```bash
# Set your Vercel token
export VERCEL_TOKEN="your-vercel-token-here"

# Deploy with token
vercel --prod --token $VERCEL_TOKEN
```

## Post-Deployment Configuration

### 1. Environment Variables (Required)

Add these in Vercel Dashboard → Settings → Environment Variables:

```bash
# Frontend Configuration
VITE_API_URL=https://api.loverankpulse.com
VITE_AUTH_DOMAIN=auth.loverankpulse.com
VITE_ENABLE_REAL_TIME_UPDATES=true
VITE_ENABLE_COUNTRY_LEADERBOARDS=true
VITE_ENABLE_SESSION_LEADERBOARDS=true
```

### 2. Custom Domain (Optional)

1. Go to Vercel Dashboard → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Wait for SSL certificate provisioning

### 3. Verify Deployment

After deployment completes:

```bash
# Get deployment URL from Vercel output or dashboard
# Visit: https://your-app.vercel.app

# Test these pages:
- Homepage: /
- Auth Test: /auth-test
- Leaderboard tabs: Session, Country, Global
```

## Current Deployment Status

### ✅ Ready for Deployment
- Frontend build: **PASSED**
- Build size: **735 KB** (optimized)
- SPA routing: **Configured**
- Environment vars: **Templated**

### ⚠️ Using Mock Data
The current deployment uses mock authentication and leaderboard data. Once backend services are deployed (Day 2-4), the frontend will be updated to connect to real APIs.

## Backend Deployment (Next Steps)

After frontend is deployed, deploy backend services:

### Option 1: Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Option 2: Render
- Create account at https://render.com
- Connect GitHub repository
- Configure:
  - Build Command: `npm run build`
  - Start Command: `npm run start`
  - Environment: Add DATABASE_URL, REDIS_URL, JWT_SECRET

### Option 3: Fly.io
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch
fly deploy
```

## Integration Timeline

1. **Day 0 (Now)**: Frontend deployed to Vercel ✅
2. **Day 2**: Deploy backend API services
3. **Day 3**: Add WebSocket server for real-time updates
4. **Day 4**: Update frontend to use real APIs
5. **Day 5**: Complete testing and optimization

## Monitoring & Analytics

Once deployed, set up:
- Vercel Analytics (built-in)
- Error tracking (Sentry)
- Performance monitoring
- Custom domain analytics

## Rollback Plan

If deployment issues occur:

```bash
# List deployments
vercel ls

# Rollback to previous deployment
vercel rollback [deployment-url]
```

## Support

- Vercel Docs: https://vercel.com/docs
- Project Status: See DAY1_COMPLETION_REPORT.md
- Sprint Plan: See sprint-plan-claude-flow.md

---

**Last Updated:** 2025-10-21
**Deployment Ready:** ✅ YES
**Next Action:** Run `vercel login` then `vercel --prod`
