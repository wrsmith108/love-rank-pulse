# Love Rank Pulse - Production Deployment Guide

## Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [GitHub Secrets Configuration](#2-github-secrets-configuration)
3. [Railway Deployment (Backend)](#3-railway-deployment-backend)
4. [Supabase PostgreSQL Setup](#4-supabase-postgresql-setup)
5. [Upstash Redis Setup](#5-upstash-redis-setup)
6. [Monitoring & Error Tracking (Sentry)](#6-monitoring--error-tracking-sentry)
7. [Vercel Frontend (Already Deployed)](#7-vercel-frontend-already-deployed)
8. [Post-Deployment Verification](#8-post-deployment-verification)
9. [Production Readiness Checklist](#9-production-readiness-checklist)
10. [Troubleshooting Guide](#10-troubleshooting-guide)
11. [Rollback Procedure](#11-rollback-procedure)
12. [Cost Breakdown](#12-cost-breakdown)
13. [Maintenance Schedule](#13-maintenance-schedule)

---

## 1. Pre-Deployment Checklist

### Code Quality Checks

```bash
# Run all pre-deployment checks locally
npm ci                        # Clean install dependencies
npm run prisma:generate       # Generate Prisma client
npm run lint                  # ESLint checks
npm run typecheck             # TypeScript compilation
npm run test                  # Unit and integration tests
npm run test:coverage         # Coverage report (target: >80%)
npm run build                 # Production build
node scripts/verify-build.js  # Verify build output
```

### Pre-Flight Checklist

- [ ] All tests passing (unit, integration, E2E)
- [ ] TypeScript compilation successful with no errors
- [ ] Code coverage > 80% (current: 85%+)
- [ ] Build artifacts generated successfully
- [ ] Environment variables documented
- [ ] Database migrations prepared and tested
- [ ] Redis configuration ready
- [ ] Monitoring configured (Sentry, logs)
- [ ] CI/CD pipelines green
- [ ] Security audit passed (`npm audit`)
- [ ] Documentation updated

### Environment Validation

```bash
# Verify .env.example is complete
cat .env.example

# Should include:
# - DATABASE_URL
# - REDIS_URL
# - JWT_SECRET
# - NODE_ENV
# - PORT
# - VITE_API_BASE_URL
# - VITE_WS_URL
```

---

## 2. GitHub Secrets Configuration

### Required Secrets Overview

Navigate to: **Repository → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| `VERCEL_TOKEN` | Vercel API authentication | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | Vercel organization ID | `.vercel/project.json` or Vercel dashboard |
| `VERCEL_PROJECT_ID` | Vercel project ID | `.vercel/project.json` or project settings |
| `VITE_API_BASE_URL` | Backend API URL | Railway deployment URL |
| `VITE_WS_URL` | WebSocket server URL | Railway WebSocket URL |
| `CODECOV_TOKEN` | (Optional) Coverage reporting | https://codecov.io |

### Step-by-Step: Getting Vercel Credentials

#### 1. Get VERCEL_TOKEN

1. Visit https://vercel.com/account/tokens
2. Click **"Create Token"**
3. Configure token:
   - **Name:** `GitHub Actions CI/CD`
   - **Scope:** `Full Account` or specific team
   - **Expiration:** `No Expiration` (or per security policy)
4. Click **"Create"**
5. Copy token immediately (shown only once)
6. Add to GitHub secrets

```bash
# Alternative: Using Vercel CLI
vercel login
vercel token create
```

#### 2. Get VERCEL_ORG_ID and VERCEL_PROJECT_ID

**Method A: Using Vercel CLI**

```bash
# Install Vercel CLI
npm install -g vercel

# Link your project (run in project root)
vercel link

# Extract IDs from .vercel/project.json
cat .vercel/project.json
```

**Example output:**
```json
{
  "orgId": "team_xxxxxxxxxxxxxxxxxxxxx",
  "projectId": "prj_xxxxxxxxxxxxxxxxxxxxx"
}
```

**Method B: Using Vercel Dashboard**

1. Go to https://vercel.com/dashboard
2. Select your project **"love-rank-pulse"**
3. Navigate to **Settings → General**
4. Copy **Project ID** from the URL or settings page
5. Navigate to **Settings → Team** (or Account)
6. Copy **Team ID** (this is your Org ID)

#### 3. Configure VITE Environment Variables

These will be configured after Railway deployment:

```bash
# Format for VITE_API_BASE_URL
https://love-rank-pulse-production.up.railway.app/api

# Format for VITE_WS_URL
wss://love-rank-pulse-production.up.railway.app
```

### Adding Secrets to GitHub

1. Go to your repository on GitHub
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **"New repository secret"**
4. Enter secret name (e.g., `VERCEL_TOKEN`)
5. Paste the value
6. Click **"Add secret"**
7. Repeat for all required secrets

### Verifying Secrets

```yaml
# Secrets should be available in workflows as:
${{ secrets.VERCEL_TOKEN }}
${{ secrets.VERCEL_ORG_ID }}
${{ secrets.VERCEL_PROJECT_ID }}
${{ secrets.VITE_API_BASE_URL }}
${{ secrets.VITE_WS_URL }}
```

---

## 3. Railway Deployment (Backend)

Railway provides a modern platform for deploying Node.js applications with automatic scaling and built-in PostgreSQL.

### Account Setup

1. Visit https://railway.app
2. Sign up using GitHub account (recommended for seamless integration)
3. Verify email address
4. Complete onboarding

### Project Creation

#### Step 1: Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Authorize Railway to access your GitHub repositories
4. Select **"love-rank-pulse"** repository
5. Railway will automatically detect Node.js application

#### Step 2: Configure Build Settings

Railway auto-detects most settings, but verify:

1. **Root Directory:** `/` (project root)
2. **Build Command:** `npm run build`
3. **Start Command:** `node dist/server.js` (adjust based on your build output)
4. **Install Command:** `npm ci`

**Custom nixpacks.toml (if needed):**

```toml
[phases.setup]
nixPkgs = ['nodejs-18_x', 'npm-8_x']

[phases.install]
cmds = ['npm ci']

[phases.build]
cmds = ['npm run prisma:generate', 'npm run build']

[start]
cmd = 'node dist/server.js'
```

### Environment Variable Configuration

Navigate to: **Project → Variables**

#### Required Environment Variables

```bash
# Database (provided by Railway PostgreSQL plugin)
DATABASE_URL=postgresql://user:password@host:port/database

# Redis (from Upstash - add later)
REDIS_URL=redis://default:password@host:port

# Authentication
JWT_SECRET=your-super-secure-random-string-min-32-chars
JWT_EXPIRES_IN=7d

# Application
NODE_ENV=production
PORT=3000

# CORS (add your Vercel domain)
ALLOWED_ORIGINS=https://love-rank-pulse.vercel.app,https://www.your-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

#### Generating JWT_SECRET

```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or using OpenSSL
openssl rand -hex 32
```

### Railway PostgreSQL Plugin

#### Adding PostgreSQL

1. In your Railway project, click **"New"**
2. Select **"Database"**
3. Choose **"PostgreSQL"**
4. Railway automatically creates database and sets `DATABASE_URL`
5. Click on PostgreSQL service to view connection details

#### PostgreSQL Configuration

Railway provides:
- **Hostname:** `region.railway.internal` or public hostname
- **Port:** `5432`
- **Database:** Auto-generated name
- **Username:** `postgres`
- **Password:** Auto-generated
- **Connection String:** `DATABASE_URL` (automatically injected)

#### Connection Pooling (Recommended for Production)

Add `?connection_limit=10&pool_timeout=30` to DATABASE_URL:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=30
```

Or use Railway's built-in connection pooler:
- Enable in PostgreSQL service settings
- Use provided pooler URL

### Health Check Configuration

Create **railway.json** in project root:

```json
{
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "on_failure",
    "restartPolicyMaxRetries": 3
  }
}
```

Ensure your backend has a health endpoint:

```typescript
// src/routes/health.routes.ts
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});
```

### Auto-Deploy from GitHub

Railway automatically deploys on push to main branch:

1. Go to **Project Settings → Service → GitHub Repo**
2. Verify **"Deploy on Push"** is enabled
3. Set **Branch:** `main`
4. Optional: Configure **"Deploy on PR"** for preview environments

### Deploy Trigger

```bash
# Automatic deployment on push
git push origin main

# Or deploy manually via Railway dashboard
# Click "Deploy" → "Trigger Deploy"
```

### Post-Deployment

1. **Get Deployment URL:**
   - Found in Railway dashboard
   - Format: `https://love-rank-pulse-production.up.railway.app`

2. **Update GitHub Secrets:**
   - Set `VITE_API_BASE_URL` to `https://your-app.railway.app/api`
   - Set `VITE_WS_URL` to `wss://your-app.railway.app`

3. **Test Endpoints:**
   ```bash
   curl https://your-app.railway.app/health
   curl https://your-app.railway.app/api/v1/status
   ```

### Monitoring and Logging

Railway provides built-in monitoring:

1. **Logs:** Real-time logs in dashboard
2. **Metrics:** CPU, Memory, Network usage
3. **Deployments:** History of all deployments
4. **Alerts:** Configure in Project Settings

**Viewing Logs:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Stream logs
railway logs --follow
```

### Cost Estimation

**Railway Pricing:**
- **Free Tier:** $5 credit/month (limited resources)
- **Developer Plan:** $5/month + usage
  - 8GB RAM
  - 8 vCPU
  - 100GB bandwidth
  - $0.000463/GB-hour RAM
  - $0.000231/vCPU-hour

**Estimated Monthly Cost:**
- Small app: $5-10/month
- Medium traffic: $15-25/month
- High traffic: $30-50/month

**PostgreSQL:**
- Included with service
- 1GB storage free
- Additional storage: $0.25/GB/month

### Scaling Configuration

```json
// railway.json
{
  "deploy": {
    "numReplicas": 2,  // Horizontal scaling
    "sleepApplication": false
  }
}
```

Or via Dashboard: **Settings → Scaling**

---

## 4. Supabase PostgreSQL Setup

Supabase provides managed PostgreSQL with connection pooling, backups, and easy scaling.

### Account Creation

1. Visit https://supabase.com
2. Sign up with GitHub (recommended)
3. Verify email
4. Complete onboarding

### Project Setup

#### Create New Project

1. Click **"New Project"**
2. Configure project:
   - **Name:** `love-rank-pulse-production`
   - **Database Password:** Generate strong password (save securely!)
   - **Region:** Choose closest to your users (e.g., `us-east-1`)
   - **Pricing Plan:** Pro ($25/month recommended for production)

3. Click **"Create new project"**
4. Wait 2-3 minutes for provisioning

### Database Configuration

#### Get Connection String

1. Navigate to **Project Settings → Database**
2. Scroll to **Connection Info**
3. Select **Connection String → URI**

**Connection String Format:**
```bash
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
```

#### Connection Pooling (Critical for Production)

Supabase provides Supavisor connection pooler:

1. **Transaction Mode (Recommended for Prisma):**
   ```bash
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?pgbouncer=true
   ```

2. **Session Mode (if using raw queries):**
   ```bash
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```

**Update Prisma Schema:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")  // For migrations
}
```

**Environment Variables:**
```bash
# Connection pooler (for app queries)
DATABASE_URL="postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true"

# Direct connection (for migrations)
DIRECT_URL="postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"
```

### Migration Deployment

#### Prepare Migrations

```bash
# Generate Prisma client
npm run prisma:generate

# Create migration (if changes exist)
npm run prisma:migrate dev --name production_setup

# Review migration files
ls prisma/migrations/
```

#### Deploy to Production

```bash
# Set environment variables
export DATABASE_URL="your-supabase-direct-url"

# Deploy migrations
npm run prisma:deploy

# Verify schema
npm run prisma:studio
```

**Alternative: Deploy via CI/CD**

Add to `.github/workflows/cd.yml`:

```yaml
- name: Deploy Database Migrations
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: npm run prisma:migrate deploy
```

### Seed Production Database (Optional)

```bash
# For initial setup only
export DATABASE_URL="your-supabase-url"
npm run prisma:seed
```

**⚠️ Warning:** Only seed initial data, not on every deployment!

### Connection Pool Settings

Optimize for your traffic:

**Prisma Connection Pool:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL") // For preview envs
}

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "postgresqlExtensions"]
}
```

**Application Configuration:**
```typescript
// src/config/database.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
  errorFormat: 'pretty',
});

// Connection pool configuration
const connectionLimit = process.env.DATABASE_CONNECTION_LIMIT
  ? parseInt(process.env.DATABASE_CONNECTION_LIMIT)
  : 10;
```

### Backup Configuration

Supabase Pro includes automated backups:

1. **Navigate to:** Project Settings → Database → Backups
2. **Backup Schedule:**
   - Daily automatic backups (Pro plan)
   - 7-day retention (Pro plan)
   - 14-day retention (Team plan)
3. **Point-in-Time Recovery:** Available on Team plan ($599/month)

#### Manual Backup

```bash
# Using pg_dump (requires PostgreSQL tools)
pg_dump "postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres" > backup.sql

# Restore from backup
psql "postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres" < backup.sql
```

### Performance Tuning

#### Indexes (Already in schema.prisma)

```prisma
model Player {
  @@index([elo_rating(sort: Desc)], name: "idx_player_elo")
  @@index([username], name: "idx_player_username")
  @@index([is_active, elo_rating(sort: Desc)], name: "idx_active_players_elo")
}

model LeaderboardEntry {
  @@index([rank], name: "idx_leaderboard_rank")
  @@index([elo_rating(sort: Desc)], name: "idx_leaderboard_elo")
  @@index([leaderboard_type, is_active, elo_rating(sort: Desc)], name: "idx_active_leaderboard")
}
```

#### Query Optimization

1. **Enable Query Insights:**
   - Go to Supabase Dashboard → Database → Query Performance
   - Monitor slow queries
   - Optimize as needed

2. **Connection Pooling Stats:**
   ```sql
   SELECT * FROM pg_stat_database;
   SELECT * FROM pg_stat_activity;
   ```

### Monitoring

**Supabase Dashboard Metrics:**
- Database size
- Active connections
- Query performance
- API requests
- Error rates

**Custom Monitoring:**
```typescript
// Log slow queries
prisma.$on('query', (e) => {
  if (e.duration > 1000) { // > 1 second
    console.warn('Slow query:', e.query, `Duration: ${e.duration}ms`);
  }
});
```

### Cost Breakdown - Supabase Pro

| Feature | Limit |
|---------|-------|
| Database | 8GB included |
| Bandwidth | 250GB included |
| Backups | Daily, 7-day retention |
| Support | Email support |
| **Price** | **$25/month** |

**Additional Costs:**
- Extra storage: $0.125/GB/month
- Extra bandwidth: $0.09/GB
- Compute upgrade: $10-50/month

### Read Replicas (Optional - Team Plan)

For high-traffic applications:

1. Navigate to **Database → Read Replicas**
2. Click **"Add Read Replica"**
3. Choose region
4. Configure:
   ```bash
   # Write operations
   DATABASE_URL="primary-connection"

   # Read operations
   DATABASE_READ_URL="replica-connection"
   ```

---

## 5. Upstash Redis Setup

Upstash provides serverless Redis for caching and real-time features.

### Account Creation

1. Visit https://upstash.com
2. Sign up (GitHub or email)
3. Verify email
4. Complete onboarding

### Database Creation

#### Create Redis Database

1. Click **"Create Database"**
2. Configure:
   - **Name:** `love-rank-pulse-cache`
   - **Type:** `Regional` (lower latency) or `Global` (multi-region)
   - **Region:** Match Railway/Supabase region
   - **TLS:** Enabled (recommended)
   - **Eviction Policy:** `allkeys-lru` (least recently used)

3. Click **"Create"**

### Get Connection URL

1. Click on your database
2. Navigate to **"Details"** tab
3. Copy **REST URL** or **Redis URL**

**Redis URL Format:**
```bash
redis://default:[password]@[region]-[id].upstash.io:6379
```

**REST URL (for serverless environments):**
```bash
https://[region]-[id].upstash.io
```

### Configure Application

Add to Railway environment variables:

```bash
REDIS_URL=redis://default:xxxxxxxxxxxxx@us1-charming-firefly-12345.upstash.io:6379
REDIS_TLS=true
```

**Application Configuration:**

```typescript
// src/utils/redisClient.ts
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: process.env.REDIS_TLS === 'true',
    rejectUnauthorized: false, // For Upstash
  },
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis Client Connected'));

await redisClient.connect();

export default redisClient;
```

### Persistence Configuration

Upstash offers:
- **AOF (Append-Only File):** Write ahead log
- **RDB (Redis Database):** Snapshot backups

**Configure in Dashboard:**
1. Navigate to **Database → Settings**
2. Enable **"Persistence"**
3. Choose:
   - **Daily Backups:** Automatic snapshots
   - **AOF:** Real-time persistence

### Pub/Sub Channels Setup

For WebSocket coordination:

```typescript
// src/websocket/redis/channels.ts
export const REDIS_CHANNELS = {
  LEADERBOARD_UPDATE: 'leaderboard:update',
  MATCH_RESULT: 'match:result',
  PLAYER_STATUS: 'player:status',
  GLOBAL_ANNOUNCEMENT: 'global:announcement',
};

// Publisher
await redisClient.publish(
  REDIS_CHANNELS.LEADERBOARD_UPDATE,
  JSON.stringify({ type: 'GLOBAL', data: leaderboard })
);

// Subscriber (separate connection)
const subscriber = redisClient.duplicate();
await subscriber.connect();
await subscriber.subscribe(REDIS_CHANNELS.LEADERBOARD_UPDATE, (message) => {
  const update = JSON.parse(message);
  broadcastToWebSocketClients(update);
});
```

### Connection Retry Logic

```typescript
// Robust connection with retry
async function connectRedis(maxRetries = 5) {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await redisClient.connect();
      console.log('Redis connected successfully');
      return;
    } catch (error) {
      retries++;
      console.error(`Redis connection attempt ${retries} failed:`, error);

      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * retries));
      } else {
        throw new Error('Failed to connect to Redis after max retries');
      }
    }
  }
}
```

### Eviction Policies

Choose based on use case:

| Policy | Description | Use Case |
|--------|-------------|----------|
| `allkeys-lru` | Remove least recently used keys | General caching |
| `volatile-lru` | Remove LRU keys with TTL | Mixed workload |
| `allkeys-lfu` | Remove least frequently used | Hot data caching |
| `noeviction` | Never evict (error on full) | Critical data only |

**Set in Dashboard:** Database → Settings → Eviction Policy

### Monitoring

**Upstash Dashboard:**
- Commands per second
- Hit/miss ratio
- Memory usage
- Connection count
- Error rate

**Application Metrics:**
```typescript
// Track cache performance
let cacheHits = 0;
let cacheMisses = 0;

async function getFromCache(key: string) {
  const value = await redisClient.get(key);
  if (value) {
    cacheHits++;
  } else {
    cacheMisses++;
  }
  return value;
}

// Expose metrics
app.get('/metrics/cache', (req, res) => {
  res.json({
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: (cacheHits / (cacheHits + cacheMisses) * 100).toFixed(2) + '%'
  });
});
```

### Cost Estimation

**Upstash Pricing:**
- **Free Tier:**
  - 10,000 commands/day
  - 256MB storage
  - Good for development

- **Pay-as-you-go:**
  - $0.2 per 100K commands
  - $0.25/GB storage/month
  - No fixed monthly fee

**Estimated Monthly Cost:**
- Low traffic (1M commands): $2-5/month
- Medium traffic (10M commands): $10-15/month
- High traffic (50M commands): $30-50/month

### Best Practices

1. **Set TTLs on all keys:**
   ```typescript
   await redisClient.setEx(key, 3600, value); // 1 hour TTL
   ```

2. **Use connection pooling:**
   ```typescript
   // Create pool for high-concurrency
   const redisPool = Array.from({ length: 5 }, () =>
     createClient({ url: process.env.REDIS_URL })
   );
   ```

3. **Implement circuit breaker:**
   ```typescript
   async function cachedOperation(key, fallback) {
     try {
       return await getFromCache(key);
     } catch (error) {
       console.warn('Redis error, using fallback:', error);
       return fallback();
     }
   }
   ```

4. **Monitor memory usage:**
   ```bash
   # Check Redis info
   redis-cli INFO memory
   ```

---

## 6. Monitoring & Error Tracking (Sentry)

Sentry provides real-time error tracking, performance monitoring, and alerting.

### Account Setup

1. Visit https://sentry.io
2. Sign up with GitHub or email
3. Verify email
4. Choose plan (Free tier available)

### Project Creation

1. Click **"Create Project"**
2. Select platform: **Node.js** and **React**
3. Project name: `love-rank-pulse`
4. Alert frequency: **Default**
5. Click **"Create Project"**

### Get DSN (Data Source Name)

After project creation:
1. Sentry shows onboarding with DSN
2. Or navigate to **Settings → Projects → love-rank-pulse → Client Keys (DSN)**
3. Copy **DSN URL**

**DSN Format:**
```
https://examplePublicKey@o0.ingest.sentry.io/0
```

### Backend Integration (Node.js/Express)

#### Install Sentry SDK

```bash
npm install @sentry/node @sentry/tracing
```

#### Configure Backend

```typescript
// src/server.ts (MUST be first import)
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";
import express from 'express';

const app = express();

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    // Enable HTTP tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // Enable Express middleware tracing
    new Sentry.Integrations.Express({ app }),
    // Enable performance profiling
    new ProfilingIntegration(),
  ],

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Profiling
  profilesSampleRate: 1.0,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Release tracking
  release: process.env.COMMIT_SHA || 'unknown',

  // Before send hook (filter sensitive data)
  beforeSend(event, hint) {
    // Don't send 4xx errors to reduce noise
    if (event.request?.data && event.request.data.password) {
      delete event.request.data.password;
    }
    return event;
  },
});

// Sentry request handler (MUST be first)
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// ... your routes ...

// Sentry error handler (MUST be before other error handlers)
app.use(Sentry.Handlers.errorHandler());

// Optional: Additional error logging
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
```

### Frontend Integration (React/Vite)

#### Install Sentry SDK

```bash
npm install @sentry/react @sentry/tracing
```

#### Configure Frontend

```typescript
// src/main.tsx (MUST be early in initialization)
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import App from './App';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    new BrowserTracing({
      // Trace React Router
      routingInstrumentation: Sentry.reactRouterV6Instrumentation(
        React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes
      ),
    }),
  ],

  // Performance monitoring
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

  // Environment
  environment: import.meta.env.MODE,

  // Replay sessions on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Error boundary
const ErrorFallback = ({ error, resetError }) => (
  <div role="alert">
    <p>Something went wrong:</p>
    <pre>{error.message}</pre>
    <button onClick={resetError}>Try again</button>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={ErrorFallback} showDialog>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
```

### Environment Configuration

Add to Railway and Vercel:

```bash
# Backend (Railway)
SENTRY_DSN=https://xxxxx@o0.ingest.sentry.io/0

# Frontend (Vercel) - Add as environment variable
VITE_SENTRY_DSN=https://xxxxx@o0.ingest.sentry.io/0
```

### Performance Monitoring

**Track Critical Operations:**

```typescript
// Backend
import * as Sentry from '@sentry/node';

async function processMatchResult(matchId: string) {
  const transaction = Sentry.startTransaction({
    op: 'match.process',
    name: 'Process Match Result',
  });

  const span = transaction.startChild({
    op: 'db',
    description: 'Fetch match data',
  });

  try {
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    span.finish();

    // More processing...

    transaction.finish();
    return result;
  } catch (error) {
    Sentry.captureException(error);
    transaction.finish();
    throw error;
  }
}
```

**Frontend Performance:**

```typescript
// Track component rendering
import { withProfiler } from '@sentry/react';

const LeaderboardTable = withProfiler(({ data }) => {
  // Component code
}, { name: 'LeaderboardTable' });

// Manual performance tracking
const transaction = Sentry.startTransaction({
  name: 'Load Leaderboard Data',
  op: 'leaderboard.load',
});

try {
  const data = await fetchLeaderboard();
  transaction.finish();
} catch (error) {
  Sentry.captureException(error);
  transaction.finish();
}
```

### Alert Configuration

1. Navigate to **Alerts** in Sentry dashboard
2. Click **"Create Alert Rule"**
3. Configure alert:

**Example: High Error Rate Alert**
- **Metric:** Error count
- **Threshold:** > 50 errors in 1 hour
- **Action:** Send email + create GitHub issue

**Example: Performance Degradation**
- **Metric:** P95 response time
- **Threshold:** > 2 seconds
- **Action:** Send Slack notification

**Common Alert Types:**
- Error rate threshold
- New error first seen
- Performance degradation (P95, P99)
- Crash rate threshold
- User feedback received

### Notification Channels

Configure in **Settings → Integrations**:

- **Email:** Default, configure in user settings
- **Slack:** Connect workspace, choose channel
- **GitHub:** Create issues on errors
- **PagerDuty:** For on-call rotations
- **Discord:** Community notifications

### User Feedback

```typescript
// Backend: Capture user context
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.username,
});

// Frontend: User feedback widget
import * as Sentry from '@sentry/react';

<button onClick={() => {
  Sentry.showReportDialog({
    eventId: Sentry.lastEventId(),
    title: 'Report Issue',
    subtitle: 'Our team will investigate',
  });
}}>
  Report Feedback
</button>
```

### Release Tracking

**Configure in CI/CD:**

```yaml
# .github/workflows/cd.yml
- name: Create Sentry release
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: your-org
    SENTRY_PROJECT: love-rank-pulse
  run: |
    npm install -g @sentry/cli
    export SENTRY_RELEASE=$(git rev-parse HEAD)
    sentry-cli releases new $SENTRY_RELEASE
    sentry-cli releases set-commits $SENTRY_RELEASE --auto
    sentry-cli releases finalize $SENTRY_RELEASE
    sentry-cli releases deploys $SENTRY_RELEASE new -e production
```

### Dashboard Setup

Create custom dashboards for:

1. **Error Overview:**
   - Total errors (24h)
   - Error rate trend
   - Top 5 error types
   - Affected users

2. **Performance:**
   - P95/P99 response times
   - Throughput (requests/min)
   - Slowest endpoints
   - Database query performance

3. **User Experience:**
   - Crash-free sessions
   - User satisfaction (Apdex)
   - Page load times
   - JavaScript errors

### Cost Breakdown

| Plan | Features | Monthly Cost |
|------|----------|--------------|
| **Developer** | 5K errors, 10K transactions | $0 (Free) |
| **Team** | 50K errors, 100K transactions, alerts | $26/month |
| **Business** | 250K errors, 500K transactions, priority support | $80/month |

**Estimated Usage:**
- Small app: Developer (Free)
- Medium app: Team ($26/month)
- Large app: Business ($80/month)

### Best Practices

1. **Filter Noise:**
   ```typescript
   ignoreErrors: [
     'NetworkError',
     'AbortError',
     // Ignore browser extension errors
     /chrome-extension/,
   ],
   ```

2. **Rate Limiting:**
   ```typescript
   beforeSend(event) {
     // Sample events in high-traffic scenarios
     if (Math.random() > 0.1) return null;
     return event;
   },
   ```

3. **Breadcrumbs:**
   ```typescript
   Sentry.addBreadcrumb({
     category: 'auth',
     message: 'User logged in',
     level: 'info',
   });
   ```

4. **Context:**
   ```typescript
   Sentry.setContext('match', {
     matchId: '123',
     players: ['player1', 'player2'],
   });
   ```

---

## 7. Vercel Frontend (Already Deployed)

Your frontend is already deployed to Vercel. Verify and update configuration.

### Verify Deployment

1. Visit https://vercel.com/dashboard
2. Locate **"love-rank-pulse"** project
3. Check deployment status

**Current Deployment:**
- URL: `https://love-rank-pulse.vercel.app`
- Branch: `main`
- Auto-deploy: Enabled

### Update Environment Variables

After backend deployment, update Vercel env vars:

1. Navigate to **Project Settings → Environment Variables**
2. Update or add:

```bash
# Production Environment
VITE_API_BASE_URL=https://love-rank-pulse-production.up.railway.app/api
VITE_WS_URL=wss://love-rank-pulse-production.up.railway.app
VITE_SENTRY_DSN=https://xxxxx@o0.ingest.sentry.io/0
VITE_ENABLE_REALTIME=true
VITE_ENABLE_WEBSOCKETS=true

# Preview Environment (same as production for now)
# Add separate preview backend URL if needed
```

3. Redeploy to apply changes:
   - Go to **Deployments**
   - Click on latest deployment
   - Click **"Redeploy"**

### Custom Domain Setup (Optional)

1. Navigate to **Settings → Domains**
2. Click **"Add Domain"**
3. Enter your domain (e.g., `loverankpulse.com`)
4. Follow DNS configuration instructions
5. Vercel automatically provisions SSL certificate

**DNS Records:**
```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### Analytics Setup

**Enable Vercel Analytics:**
1. Navigate to **Analytics** tab
2. Click **"Enable Analytics"**
3. Add to your app:

```bash
npm install @vercel/analytics
```

```typescript
// src/main.tsx
import { Analytics } from '@vercel/analytics/react';

function App() {
  return (
    <>
      <YourApp />
      <Analytics />
    </>
  );
}
```

### Performance Optimization

**Vercel Configuration (vercel.json):**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "regions": ["iad1"],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,PUT,DELETE,OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://love-rank-pulse-production.up.railway.app/api/:path*"
    }
  ]
}
```

### CDN Configuration

Vercel Edge Network automatically handles:
- Global CDN distribution
- Automatic compression (Brotli/gzip)
- HTTP/2 and HTTP/3
- Automatic SSL/TLS
- DDoS protection

**Cache Control:**
```typescript
// src/main.tsx
// Vercel automatically caches static assets
// Configure in vercel.json for API routes:
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### Monitoring Vercel Deployment

1. **Deployment Logs:** Real-time build logs
2. **Runtime Logs:** Application logs (Pro plan)
3. **Analytics:** Page views, performance metrics
4. **Web Vitals:** LCP, FID, CLS tracking

---

## 8. Post-Deployment Verification

### Automated Health Checks

Create a comprehensive verification script:

```bash
#!/bin/bash
# scripts/verify-deployment.sh

set -e

API_URL="${API_URL:-https://love-rank-pulse-production.up.railway.app}"
FRONTEND_URL="${FRONTEND_URL:-https://love-rank-pulse.vercel.app}"

echo "🔍 Verifying Production Deployment..."
echo "========================================"

# Backend Health Check
echo ""
echo "✅ Checking Backend Health..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
if [ "$HEALTH_STATUS" = "200" ]; then
  echo "✓ Backend health check passed"
else
  echo "✗ Backend health check failed (HTTP $HEALTH_STATUS)"
  exit 1
fi

# Database Connectivity
echo ""
echo "✅ Checking Database Connectivity..."
DB_STATUS=$(curl -s "$API_URL/health" | jq -r '.database.status')
if [ "$DB_STATUS" = "connected" ]; then
  echo "✓ Database connection successful"
else
  echo "✗ Database connection failed"
  exit 1
fi

# Redis Connectivity
echo ""
echo "✅ Checking Redis Connectivity..."
REDIS_STATUS=$(curl -s "$API_URL/health" | jq -r '.redis.status')
if [ "$REDIS_STATUS" = "connected" ]; then
  echo "✓ Redis connection successful"
else
  echo "✗ Redis connection failed"
  exit 1
fi

# WebSocket Server
echo ""
echo "✅ Checking WebSocket Server..."
WS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/socket.io/")
if [ "$WS_STATUS" = "200" ] || [ "$WS_STATUS" = "101" ]; then
  echo "✓ WebSocket server is running"
else
  echo "✗ WebSocket server check failed"
  exit 1
fi

# Frontend Availability
echo ""
echo "✅ Checking Frontend Availability..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
if [ "$FRONTEND_STATUS" = "200" ]; then
  echo "✓ Frontend is accessible"
else
  echo "✗ Frontend is not accessible (HTTP $FRONTEND_STATUS)"
  exit 1
fi

# API Endpoints
echo ""
echo "✅ Testing API Endpoints..."

# Get global leaderboard
LEADERBOARD=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/leaderboards/global")
if [ "$LEADERBOARD" = "200" ]; then
  echo "✓ Leaderboard API working"
else
  echo "✗ Leaderboard API failed"
fi

# Health endpoint details
echo ""
echo "✅ Deployment Details:"
curl -s "$API_URL/health" | jq '.'

echo ""
echo "========================================"
echo "✅ All checks passed! Deployment verified."
echo "========================================"
```

**Run verification:**
```bash
chmod +x scripts/verify-deployment.sh
./scripts/verify-deployment.sh
```

### Manual Verification Checklist

#### Backend Verification

- [ ] **Health check responds:**
  ```bash
  curl https://your-backend.railway.app/health
  ```

- [ ] **Database connectivity:**
  ```bash
  curl https://your-backend.railway.app/health | jq '.database'
  ```

- [ ] **Redis connectivity:**
  ```bash
  curl https://your-backend.railway.app/health | jq '.redis'
  ```

- [ ] **WebSocket connection:**
  ```bash
  # Use a WebSocket client or browser console
  const ws = new WebSocket('wss://your-backend.railway.app');
  ws.onopen = () => console.log('Connected');
  ```

- [ ] **Authentication endpoints:**
  ```bash
  # Register test user
  curl -X POST https://your-backend.railway.app/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"Test123!","username":"testuser"}'

  # Login
  curl -X POST https://your-backend.railway.app/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"Test123!"}'
  ```

- [ ] **Leaderboard API:**
  ```bash
  # Global leaderboard
  curl https://your-backend.railway.app/api/leaderboards/global

  # Country leaderboard
  curl https://your-backend.railway.app/api/leaderboards/country?country=US
  ```

#### Frontend Verification

- [ ] **Homepage loads:** Visit https://love-rank-pulse.vercel.app
- [ ] **Authentication works:** Try login/register
- [ ] **Leaderboards display:** Check all three views (session, country, global)
- [ ] **Filters work:** Test time period filters (24h, 7d, 30d, all)
- [ ] **Real-time updates:** Verify WebSocket connection in console
- [ ] **Player stats modal:** Click on a player to view stats
- [ ] **Responsive design:** Test on mobile/tablet
- [ ] **No console errors:** Check browser console for errors

#### Integration Testing

- [ ] **End-to-End User Flow:**
  1. Register new account
  2. View global leaderboard
  3. Filter by country
  4. Filter by time period
  5. View player stats
  6. Verify real-time updates (simulate match result)

- [ ] **WebSocket Real-Time:**
  1. Open app in two browser windows
  2. Simulate leaderboard update via API
  3. Verify both clients receive update

#### Performance Testing

```bash
# Load test with Apache Bench
ab -n 1000 -c 10 https://your-backend.railway.app/api/leaderboards/global

# Expected results:
# - All requests successful (no 5xx errors)
# - Average response time < 500ms
# - P95 < 1000ms
```

#### Security Verification

- [ ] **HTTPS enforced:** All connections use SSL/TLS
- [ ] **CORS configured:** Only allowed origins can access API
- [ ] **Rate limiting active:** Test by making rapid requests
- [ ] **Authentication required:** Protected endpoints require JWT
- [ ] **Sensitive data hidden:** No passwords/tokens in responses
- [ ] **Security headers present:**
  ```bash
  curl -I https://your-backend.railway.app | grep -E 'X-|Strict-Transport'
  ```

### Smoke Test Suite

Create automated smoke tests:

```typescript
// tests/smoke/production.test.ts
import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'https://your-backend.railway.app';
const APP_URL = process.env.APP_URL || 'https://love-rank-pulse.vercel.app';

test.describe('Production Smoke Tests', () => {
  test('Backend health check', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.database.status).toBe('connected');
    expect(data.redis.status).toBe('connected');
  });

  test('Frontend loads successfully', async ({ page }) => {
    await page.goto(APP_URL);
    await expect(page).toHaveTitle(/Love Rank Pulse/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('Leaderboard API returns data', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/leaderboards/global`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('WebSocket connection establishes', async ({ page }) => {
    await page.goto(APP_URL);

    const wsConnected = await page.evaluate(() => {
      return new Promise((resolve) => {
        const ws = new WebSocket('wss://your-backend.railway.app');
        ws.onopen = () => resolve(true);
        ws.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 5000);
      });
    });

    expect(wsConnected).toBeTruthy();
  });
});
```

**Run smoke tests:**
```bash
npx playwright test tests/smoke/production.test.ts
```

---

## 9. Production Readiness Checklist

### Backend Services

#### Railway Backend

- [ ] Deployed to Railway successfully
- [ ] All environment variables configured:
  - [ ] `DATABASE_URL`
  - [ ] `REDIS_URL`
  - [ ] `JWT_SECRET`
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=3000`
  - [ ] `ALLOWED_ORIGINS`
  - [ ] `SENTRY_DSN`
- [ ] Health check endpoint responding
- [ ] Application logs accessible
- [ ] Auto-deploy from main branch enabled
- [ ] Service scaled appropriately (CPU/memory)
- [ ] SSL/TLS configured
- [ ] Custom domain configured (optional)

#### Database (Supabase PostgreSQL)

- [ ] Database created and configured
- [ ] Connection pooling enabled (Supavisor)
- [ ] All migrations deployed successfully:
  ```bash
  npm run prisma:migrate deploy
  ```
- [ ] Database seeded with initial data (if applicable)
- [ ] Indexes created and optimized
- [ ] Connection tested from backend
- [ ] Backups enabled (daily automatic)
- [ ] Monitoring configured
- [ ] Performance acceptable (query times < 100ms)

#### Cache (Upstash Redis)

- [ ] Redis database created
- [ ] Connection URL added to Railway
- [ ] TLS enabled
- [ ] Pub/Sub channels configured
- [ ] Persistence enabled (AOF/RDB)
- [ ] Eviction policy set (`allkeys-lru`)
- [ ] Connection tested from backend
- [ ] Cache hit rate monitored

### Frontend

#### Vercel Deployment

- [ ] Deployed to Vercel successfully
- [ ] Production URL accessible
- [ ] Environment variables configured:
  - [ ] `VITE_API_BASE_URL`
  - [ ] `VITE_WS_URL`
  - [ ] `VITE_SENTRY_DSN`
  - [ ] `VITE_ENABLE_REALTIME=true`
  - [ ] `VITE_ENABLE_WEBSOCKETS=true`
- [ ] Auto-deploy from main branch enabled
- [ ] Build successful with no errors
- [ ] All pages load correctly
- [ ] Assets served via CDN
- [ ] Custom domain configured (optional)
- [ ] Analytics enabled (optional)

### CI/CD Pipeline

#### GitHub Actions

- [ ] All workflows passing:
  - [ ] CI Pipeline (`ci.yml`)
  - [ ] CD Pipeline (`cd.yml`)
  - [ ] PR Checks (`pr-checks.yml`)
  - [ ] Scheduled Checks (`scheduled-checks.yml`)
- [ ] All required secrets configured:
  - [ ] `VERCEL_TOKEN`
  - [ ] `VERCEL_ORG_ID`
  - [ ] `VERCEL_PROJECT_ID`
  - [ ] `VITE_API_BASE_URL`
  - [ ] `VITE_WS_URL`
  - [ ] `CODECOV_TOKEN` (optional)
  - [ ] `SENTRY_AUTH_TOKEN` (optional)
- [ ] Branch protection enabled on `main`
- [ ] Required status checks configured
- [ ] Automatic deployments working

### Monitoring & Observability

#### Sentry

- [ ] Backend integration configured
- [ ] Frontend integration configured
- [ ] DSN added to environment variables
- [ ] Error tracking working
- [ ] Performance monitoring enabled
- [ ] Alerts configured:
  - [ ] High error rate
  - [ ] Performance degradation
  - [ ] New error types
- [ ] Notification channels set up (email, Slack)
- [ ] Release tracking enabled (optional)

#### Application Monitoring

- [ ] Railway logs accessible
- [ ] Vercel deployment logs available
- [ ] Database metrics visible (Supabase dashboard)
- [ ] Redis metrics visible (Upstash dashboard)
- [ ] Custom metrics endpoints working:
  ```bash
  curl https://your-backend.railway.app/metrics
  ```

### Security

#### Authentication

- [ ] JWT authentication working
- [ ] Password hashing enabled (bcrypt)
- [ ] Token expiration configured
- [ ] Refresh tokens implemented (if applicable)
- [ ] Login/register endpoints secured

#### API Security

- [ ] CORS configured with allowed origins
- [ ] Rate limiting enabled
- [ ] Helmet.js security headers set
- [ ] SQL injection protection (Prisma ORM)
- [ ] XSS protection enabled
- [ ] HTTPS enforced
- [ ] Input validation implemented

#### Data Protection

- [ ] Sensitive data encrypted at rest
- [ ] Passwords never logged or exposed
- [ ] JWT secrets stored securely
- [ ] Database credentials secure
- [ ] Redis credentials secure
- [ ] No hardcoded secrets in code

### Performance

#### Backend Performance

- [ ] Response times acceptable:
  - [ ] Health check: < 100ms
  - [ ] Leaderboard API: < 300ms
  - [ ] Player stats: < 200ms
- [ ] Database queries optimized
- [ ] Caching layer working
- [ ] Connection pooling configured
- [ ] No memory leaks
- [ ] Load tested (1000+ concurrent users)

#### Frontend Performance

- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Bundle size optimized
- [ ] Images optimized
- [ ] Code splitting implemented
- [ ] Lazy loading enabled

### Documentation

- [ ] README.md updated
- [ ] API documentation complete
- [ ] Deployment guide reviewed
- [ ] Environment variables documented
- [ ] Architecture documented
- [ ] Troubleshooting guide available

### Testing

- [ ] Unit tests passing (coverage > 80%)
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Performance tests passing
- [ ] Smoke tests executed post-deployment
- [ ] Load testing completed

### Final Verification

- [ ] Production URL accessible
- [ ] All features working
- [ ] No console errors
- [ ] WebSocket connections stable
- [ ] Real-time updates working
- [ ] Mobile responsive
- [ ] Cross-browser tested (Chrome, Firefox, Safari)
- [ ] User acceptance testing completed

---

## 10. Troubleshooting Guide

### Common Issues and Solutions

#### Connection Errors

**Issue: Database connection timeout**

```
Error: Can't reach database server at `db.xxxxx.supabase.co:5432`
```

**Solutions:**

1. **Check DATABASE_URL:**
   ```bash
   # Verify URL format
   echo $DATABASE_URL

   # Should be:
   postgresql://postgres:password@host:5432/postgres
   ```

2. **Test connection directly:**
   ```bash
   psql "$DATABASE_URL"
   ```

3. **Check Supabase IP whitelist:**
   - Go to Supabase → Project Settings → Database
   - Ensure "Allow connections from any IP" is enabled for Railway

4. **Verify connection pooling:**
   - Use pooler URL instead of direct URL
   - Format: `?pgbouncer=true`

5. **Check Railway service health:**
   - View Railway logs for connection errors
   - Restart service if needed

**Issue: Redis connection refused**

```
Error: connect ECONNREFUSED
```

**Solutions:**

1. **Verify REDIS_URL format:**
   ```bash
   # Should include protocol, credentials, host, port
   redis://default:password@host:6379
   ```

2. **Check TLS configuration:**
   ```typescript
   // For Upstash, TLS is required
   const client = createClient({
     url: process.env.REDIS_URL,
     socket: {
       tls: true,
       rejectUnauthorized: false,
     },
   });
   ```

3. **Test connection:**
   ```bash
   redis-cli -u "redis://default:password@host:6379" ping
   # Should return: PONG
   ```

4. **Check Upstash status:**
   - Visit Upstash dashboard
   - Verify database is running
   - Check connection limits

**Issue: WebSocket connection failed**

```
WebSocket connection to 'wss://...' failed: Error during WebSocket handshake
```

**Solutions:**

1. **Check CORS configuration:**
   ```typescript
   // Backend server.ts
   const io = new Server(server, {
     cors: {
       origin: process.env.ALLOWED_ORIGINS.split(','),
       methods: ['GET', 'POST'],
       credentials: true,
     },
   });
   ```

2. **Verify SSL certificate:**
   - Railway provides automatic SSL
   - Check if WebSocket URL uses `wss://` not `ws://`

3. **Check Railway WebSocket support:**
   - Ensure service port is exposed
   - Verify health check doesn't interfere

4. **Test WebSocket locally:**
   ```javascript
   const ws = new WebSocket('wss://your-backend.railway.app');
   ws.onopen = () => console.log('Connected');
   ws.onerror = (e) => console.error('Error:', e);
   ```

#### Migration Failures

**Issue: Schema conflicts during migration**

```
Error: The migration conflicts with existing schema
```

**Solutions:**

1. **Reset database (CAUTION: Data loss):**
   ```bash
   npm run prisma:reset
   npm run prisma:migrate deploy
   ```

2. **Create baseline migration:**
   ```bash
   # Mark existing schema as migrated
   npx prisma migrate resolve --applied "initial_migration"
   ```

3. **Manual schema sync:**
   ```bash
   # Generate migration from current schema
   npx prisma migrate dev --name sync_schema
   ```

4. **Check migration history:**
   ```sql
   SELECT * FROM "_prisma_migrations";
   ```

**Issue: Permission denied during migration**

```
Error: Permission denied for schema public
```

**Solutions:**

1. **Use direct URL for migrations:**
   ```bash
   # Set DIRECT_URL in .env
   DIRECT_URL="postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"

   # Run migration
   DATABASE_URL=$DIRECT_URL npm run prisma:migrate deploy
   ```

2. **Grant permissions:**
   ```sql
   GRANT ALL ON SCHEMA public TO postgres;
   GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
   ```

3. **Check user privileges:**
   ```sql
   \du postgres
   ```

**Issue: Migration timeout**

```
Error: Timeout during migration
```

**Solutions:**

1. **Increase connection timeout:**
   ```bash
   DATABASE_URL="postgresql://...?connect_timeout=30"
   ```

2. **Split large migrations:**
   - Break into smaller migrations
   - Deploy incrementally

3. **Run migrations during low-traffic:**
   - Schedule maintenance window
   - Temporarily disable app

#### Performance Issues

**Issue: Slow database queries**

**Solutions:**

1. **Check missing indexes:**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM leaderboard_entries
   WHERE leaderboard_type = 'GLOBAL'
   ORDER BY elo_rating DESC LIMIT 100;
   ```

2. **Add indexes if needed:**
   ```prisma
   @@index([leaderboard_type, elo_rating(sort: Desc)])
   ```

3. **Use connection pooling:**
   - Verify pooler is enabled
   - Check connection pool size

4. **Optimize queries:**
   - Use `select` to limit fields
   - Add `include` carefully
   - Implement pagination

5. **Monitor slow queries:**
   ```typescript
   prisma.$on('query', (e) => {
     if (e.duration > 1000) {
       console.warn('Slow query:', e.query);
     }
   });
   ```

**Issue: High memory usage**

**Solutions:**

1. **Check Railway metrics:**
   - View memory usage in dashboard
   - Identify memory leaks

2. **Implement connection limits:**
   ```typescript
   const prisma = new PrismaClient({
     datasources: {
       db: {
         url: `${process.env.DATABASE_URL}?connection_limit=10`,
       },
     },
   });
   ```

3. **Close connections:**
   ```typescript
   // In graceful shutdown
   await prisma.$disconnect();
   await redisClient.quit();
   ```

4. **Scale Railway service:**
   - Increase memory allocation
   - Add more replicas

**Issue: Rate limit errors**

```
Error: Too Many Requests (429)
```

**Solutions:**

1. **Adjust rate limit:**
   ```typescript
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100, // Increase limit
     standardHeaders: true,
     legacyHeaders: false,
   });
   ```

2. **Implement user-based limits:**
   ```typescript
   const limiter = rateLimit({
     keyGenerator: (req) => req.user?.id || req.ip,
   });
   ```

3. **Add Redis store:**
   ```typescript
   import RedisStore from 'rate-limit-redis';

   const limiter = rateLimit({
     store: new RedisStore({
       client: redisClient,
     }),
   });
   ```

#### Deployment Issues

**Issue: Vercel deployment fails with "Project not found"**

**Solutions:**

1. **Re-link project:**
   ```bash
   vercel link --yes
   ```

2. **Update GitHub secrets:**
   ```bash
   cat .vercel/project.json
   # Copy orgId and projectId to GitHub secrets
   ```

3. **Verify Vercel token:**
   - Create new token if expired
   - Update `VERCEL_TOKEN` secret

**Issue: Railway deployment fails**

```
Error: Build failed
```

**Solutions:**

1. **Check build logs:**
   - View detailed logs in Railway dashboard
   - Look for npm errors

2. **Verify build command:**
   ```bash
   # Test locally
   npm ci
   npm run build
   ```

3. **Check Node.js version:**
   ```json
   // package.json
   "engines": {
     "node": ">=18.0.0"
   }
   ```

4. **Clear build cache:**
   - In Railway dashboard: Settings → Clear Build Cache
   - Trigger new deployment

**Issue: Environment variables not loading**

**Solutions:**

1. **Verify variable names:**
   - Check for typos
   - Ensure `VITE_` prefix for frontend variables

2. **Restart services:**
   - Railway: Redeploy service
   - Vercel: Redeploy from dashboard

3. **Check variable scope:**
   - Ensure variables are in correct environment (production/preview)

4. **Test locally:**
   ```bash
   # Load .env file
   source .env
   echo $DATABASE_URL
   ```

### Emergency Procedures

#### Service Down

1. **Check status pages:**
   - Railway: https://status.railway.app
   - Vercel: https://vercel-status.com
   - Supabase: https://status.supabase.com
   - Upstash: https://status.upstash.com

2. **View service logs:**
   ```bash
   # Railway
   railway logs

   # Vercel
   vercel logs
   ```

3. **Restart services:**
   - Railway: Click "Restart" in dashboard
   - Vercel: Trigger redeploy

4. **Check health endpoints:**
   ```bash
   curl https://your-backend.railway.app/health
   ```

#### Data Loss

1. **Restore from backup:**
   ```bash
   # Supabase
   # Go to Dashboard → Database → Backups
   # Select backup and restore
   ```

2. **Point-in-Time Recovery (Team plan):**
   - Restore to specific timestamp
   - Minimize data loss

3. **Manual data recovery:**
   - Check application logs for recent changes
   - Manually recreate if needed

#### Security Incident

1. **Rotate all credentials:**
   - Generate new JWT_SECRET
   - Rotate database passwords
   - Update Redis credentials
   - Revoke compromised API tokens

2. **Review access logs:**
   ```bash
   # Check Railway logs for suspicious activity
   railway logs --filter="error"
   ```

3. **Update GitHub secrets:**
   - Rotate all secrets
   - Force re-deploy

4. **Notify users (if needed):**
   - Send security advisory
   - Force password resets

---

## 11. Rollback Procedure

### Frontend Rollback (Vercel)

#### Using Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select **love-rank-pulse** project
3. Navigate to **Deployments** tab
4. Find last known good deployment
5. Click **"︙" (three dots)**
6. Select **"Promote to Production"**
7. Confirm rollback

**Rollback complete in ~30 seconds**

#### Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# List recent deployments
vercel ls love-rank-pulse

# Promote specific deployment to production
vercel promote [deployment-url]

# Example:
vercel promote love-rank-pulse-abc123-user.vercel.app
```

### Backend Rollback (Railway)

#### Using Railway Dashboard

1. Go to https://railway.app/dashboard
2. Select your project
3. Click on the service
4. Navigate to **Deployments** tab
5. Find last stable deployment
6. Click **"︙"** → **"Redeploy"**
7. Confirm redeployment

**Rollback time: ~2-3 minutes**

#### Using Git Rollback

```bash
# Identify last good commit
git log --oneline

# Create rollback branch
git checkout -b rollback/emergency main

# Revert to last good commit
git revert --no-commit HEAD~1

# Or hard reset (use with caution)
git reset --hard <last-good-commit-sha>

# Push to main (if branch protection allows)
git push origin main --force

# Railway automatically deploys
```

#### Using Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# List deployments
railway deployments list

# Redeploy specific deployment
railway deploy --deployment <deployment-id>
```

### Database Rollback (Supabase)

#### Restore from Backup

1. Go to Supabase Dashboard
2. Navigate to **Project → Database → Backups**
3. Select backup timestamp
4. Click **"Restore"**
5. Confirm restoration

**⚠️ Warning: This overwrites current database!**

#### Manual Schema Rollback (Prisma)

```bash
# Revert specific migration
npm run prisma:migrate resolve --rolled-back "<migration-name>"

# Deploy previous migration state
npm run prisma:migrate deploy

# Regenerate client
npm run prisma:generate
```

### Redis Rollback (Upstash)

Redis is cache-only, so no rollback needed. Clear cache if needed:

```bash
# Using Redis CLI
redis-cli -u "$REDIS_URL" FLUSHDB

# Or programmatically
import redisClient from './utils/redisClient';
await redisClient.flushDb();
```

### Complete System Rollback

For major incidents requiring full rollback:

```bash
#!/bin/bash
# scripts/emergency-rollback.sh

set -e

echo "⚠️  EMERGENCY ROLLBACK INITIATED"
echo "================================"

# 1. Rollback frontend (Vercel)
echo "1. Rolling back frontend..."
vercel promote [last-stable-deployment-url]

# 2. Rollback backend (Railway)
echo "2. Rolling back backend..."
git reset --hard [last-stable-commit]
git push origin main --force

# 3. Rollback database migrations (if needed)
echo "3. Reverting database migrations..."
npm run prisma:migrate resolve --rolled-back "[migration]"

# 4. Clear Redis cache
echo "4. Clearing cache..."
redis-cli -u "$REDIS_URL" FLUSHDB

# 5. Verify services
echo "5. Verifying services..."
sleep 60 # Wait for deployments

curl https://love-rank-pulse.vercel.app/health
curl https://your-backend.railway.app/health

echo "================================"
echo "✅ Rollback complete. Verify functionality."
```

### Post-Rollback Steps

1. **Verify services are healthy:**
   ```bash
   ./scripts/verify-deployment.sh
   ```

2. **Monitor error rates in Sentry:**
   - Check if errors decreased
   - Verify no new issues

3. **Notify stakeholders:**
   - Send status update
   - Explain rollback reason

4. **Investigate root cause:**
   - Review logs
   - Identify issue
   - Create hotfix plan

5. **Document incident:**
   - What happened
   - Why rollback was needed
   - Lessons learned

### Emergency Contacts

**Escalation Path:**

1. **Development Lead:** [Name] - [Email] - [Phone]
2. **DevOps Engineer:** [Name] - [Email] - [Phone]
3. **CTO/Tech Lead:** [Name] - [Email] - [Phone]

**Service Providers:**

- **Railway Support:** support@railway.app
- **Vercel Support:** support@vercel.com
- **Supabase Support:** support@supabase.io
- **Upstash Support:** support@upstash.com
- **Sentry Support:** support@sentry.io

---

## 12. Cost Breakdown

### Monthly Cost Summary Table

| Service | Tier | Features | Monthly Cost | Notes |
|---------|------|----------|--------------|-------|
| **Vercel** | Pro | Unlimited bandwidth, analytics, preview envs | $20 | Required for production |
| **Railway** | Usage-based | 8GB RAM, auto-scaling, PostgreSQL included | $20-25 | Estimated for medium traffic |
| **Supabase** | Pro | 8GB database, daily backups, connection pooling | $25 | Recommended for production |
| **Upstash** | Pay-as-you-go | 10K commands/sec, 1GB storage, persistence | $5-10 | Based on usage |
| **Sentry** | Team (optional) | 50K errors, 100K transactions, alerts | $26 | Optional but recommended |
| **Domain** | Annual | Custom domain (optional) | ~$1/month | Optional |
| **Total (Base)** | | **Without Sentry** | **$70-80/month** | Minimum production setup |
| **Total (Full)** | | **With Sentry** | **$96-106/month** | Recommended for production |

### Detailed Cost Breakdown

#### Vercel - Frontend Hosting

**Pro Plan: $20/month**

**Included:**
- Unlimited bandwidth
- Unlimited builds
- Preview deployments for every PR
- Analytics (100K events/month)
- Edge Functions (100GB-hours)
- Image Optimization (1,000 source images)
- Commercial license

**Overage Costs:**
- Analytics: $10 per 100K additional events
- Edge Functions: $10 per 100 GB-hours
- Image Optimization: $5 per 1,000 images

**Estimated Usage (Medium App):**
- Bandwidth: 50-100GB/month ✓ Included
- Builds: 100-200/month ✓ Included
- Edge Functions: Minimal usage ✓ Included

**Cost: $20/month (fixed)**

#### Railway - Backend Hosting

**Usage-Based Pricing:**

**Compute:**
- $0.000231 per vCPU-hour
- $0.000463 per GB RAM-hour

**Database (PostgreSQL):**
- 1GB storage included
- $0.25 per GB-month for additional storage

**Bandwidth:**
- 100GB included
- $0.10 per GB overage

**Estimated Usage:**
```
Small App (Low Traffic):
- 0.5 vCPU × 24h × 30d × $0.000231 = $8.32
- 1GB RAM × 24h × 30d × $0.000463 = $16.64
- Database: 2GB × $0.25 = $0.50
Total: ~$25/month

Medium App (Moderate Traffic):
- 1 vCPU × 24h × 30d × $0.000231 = $16.64
- 2GB RAM × 24h × 30d × $0.000463 = $33.28
- Database: 3GB × $0.25 = $0.75
Total: ~$50/month

High Traffic:
- 2 vCPU × 24h × 30d × $0.000231 = $33.28
- 4GB RAM × 24h × 30d × $0.000463 = $66.55
- Database: 5GB × $0.25 = $1.25
Total: ~$100/month
```

**Estimated Cost: $20-25/month (medium traffic)**

**Cost Optimization Tips:**
1. Enable auto-scaling with limits
2. Optimize bundle size to reduce memory
3. Use connection pooling
4. Implement efficient caching

#### Supabase - PostgreSQL Database

**Pro Plan: $25/month**

**Included:**
- 8GB database storage
- 50GB bandwidth
- 10 million edge requests
- Daily backups (7-day retention)
- Connection pooling (Supavisor)
- 2 vCPU, 2GB RAM
- Email support

**Overage Costs:**
- Additional storage: $0.125/GB/month
- Additional bandwidth: $0.09/GB
- Compute upgrade: $10-50/month

**Estimated Usage (Medium App):**
- Storage: 2-4GB ✓ Included
- Bandwidth: 20-30GB ✓ Included
- Compute: Standard ✓ Included

**Cost: $25/month (fixed)**

**Upgrade Path:**
- **Team Plan ($599/month):** For scaling beyond 100K users
  - 100GB storage
  - Point-in-Time Recovery
  - Read replicas
  - Dedicated support

#### Upstash - Redis Cache

**Pay-As-You-Go Pricing:**

**Storage:**
- $0.25 per GB-month
- Prorated daily

**Commands:**
- $0.2 per 100K commands

**Bandwidth:**
- Free (no charges)

**Estimated Usage:**
```
Small App:
- Storage: 0.5GB × $0.25 = $0.125
- Commands: 1M/month = $2
Total: ~$2-5/month

Medium App:
- Storage: 1GB × $0.25 = $0.25
- Commands: 5M/month = $10
Total: ~$10-15/month

High Traffic:
- Storage: 2GB × $0.25 = $0.50
- Commands: 25M/month = $50
Total: ~$50-60/month
```

**Estimated Cost: $5-10/month (medium traffic)**

**Free Tier:**
- 10,000 commands/day (~300K/month)
- 256MB storage
- Good for development/testing

**Cost Optimization:**
1. Set aggressive TTLs
2. Use eviction policies
3. Monitor command usage
4. Cache only frequently accessed data

#### Sentry - Error Tracking & Monitoring

**Team Plan: $26/month (optional but recommended)**

**Included:**
- 50,000 errors/month
- 100,000 performance transactions/month
- Unlimited projects
- Unlimited team members
- Email + Slack alerts
- 90-day data retention
- Issue assignment & triage

**Overage Costs:**
- Additional errors: $0.000345 per error
- Additional transactions: $0.000138 per transaction

**Estimated Usage (Medium App):**
- Errors: 5,000-10,000/month ✓ Included
- Transactions: 50,000/month ✓ Included

**Cost: $26/month or $0 (free tier for small apps)**

**Free Tier (Developer):**
- 5,000 errors/month
- 10,000 transactions/month
- 30-day retention
- Good for MVPs

**Business Plan: $80/month**
- 250K errors, 500K transactions
- Priority support
- For production scale apps

#### Additional Services (Optional)

**Custom Domain (Optional):**
- Domain registration: $10-15/year (~$1/month)
- Already included free at Vercel (.vercel.app)
- Recommended for branding

**CDN/DDoS Protection:**
- Included with Vercel and Railway
- No additional cost

**SSL Certificates:**
- Included free (Let's Encrypt)
- No additional cost

**Backup Storage:**
- Supabase backups included
- Manual backups: Store on AWS S3 (~$0.023/GB/month)

### Cost Scenarios

#### Scenario 1: MVP / Low Traffic (0-1K users)
| Service | Plan | Cost |
|---------|------|------|
| Vercel | Pro | $20 |
| Railway | Minimal usage | $10-15 |
| Supabase | Pro | $25 |
| Upstash | Pay-as-go | $2-5 |
| Sentry | Free tier | $0 |
| **Total** | | **$57-65/month** |

#### Scenario 2: Production / Medium Traffic (1-10K users)
| Service | Plan | Cost |
|---------|------|------|
| Vercel | Pro | $20 |
| Railway | Medium usage | $20-25 |
| Supabase | Pro | $25 |
| Upstash | Pay-as-go | $5-10 |
| Sentry | Team | $26 |
| **Total** | | **$96-106/month** |

#### Scenario 3: High Traffic / Scale (10-50K users)
| Service | Plan | Cost |
|---------|------|------|
| Vercel | Pro | $20 |
| Railway | High usage | $40-60 |
| Supabase | Pro + compute | $35-50 |
| Upstash | Pay-as-go | $20-40 |
| Sentry | Business | $80 |
| **Total** | | **$195-250/month** |

### Cost Optimization Strategies

1. **Start with Free Tiers:**
   - Sentry Developer (free)
   - Railway $5 credit/month
   - Vercel Hobby (if solo project)

2. **Monitor Usage:**
   - Set up billing alerts
   - Review monthly usage reports
   - Optimize based on metrics

3. **Implement Efficient Caching:**
   - Reduce database queries
   - Cache API responses
   - Use CDN for static assets

4. **Optimize Database:**
   - Use indexes effectively
   - Implement connection pooling
   - Archive old data

5. **Scale Gradually:**
   - Start with smaller instances
   - Scale up based on actual traffic
   - Use auto-scaling with limits

6. **Annual Billing Discounts:**
   - Vercel Pro: Save ~15% with annual
   - Sentry Team: Save ~20% with annual

### Billing Management

**Set Up Billing Alerts:**

1. **Railway:**
   - Settings → Billing → Set spending limit
   - Email alerts at 50%, 80%, 100%

2. **Upstash:**
   - Account → Billing → Set budget
   - Alerts via email

3. **Supabase:**
   - Fixed price, no overages on Pro plan

4. **Vercel:**
   - Settings → Usage → Set alerts
   - Monitor bandwidth and builds

**Monthly Review Checklist:**
- [ ] Review all service usage reports
- [ ] Identify cost spikes and causes
- [ ] Optimize high-usage services
- [ ] Adjust scaling limits if needed
- [ ] Check for unused resources

---

## 13. Maintenance Schedule

### Daily Tasks (Automated)

**Automated Health Checks:**
- [x] Backend health endpoint monitoring
- [x] Database connectivity checks
- [x] Redis connectivity checks
- [x] WebSocket server status
- [x] Scheduled GitHub Actions (2 AM UTC)

**Automated Alerts:**
- Sentry error notifications
- Railway deployment failures
- Vercel build failures
- High error rates

**Manual Daily Review (5 minutes):**
- [ ] Check Sentry dashboard for new errors
- [ ] Review Railway logs for anomalies
- [ ] Monitor uptime (should be 99.9%+)
- [ ] Quick scan of GitHub Actions status

### Weekly Tasks (30 minutes)

**Monday: Health Check & Metrics**
- [ ] Review system metrics:
  - CPU usage (Railway dashboard)
  - Memory usage
  - Database size (Supabase)
  - Redis usage (Upstash)
- [ ] Check response times:
  - P95 < 1000ms
  - P99 < 2000ms
- [ ] Review error trends in Sentry
- [ ] Check bandwidth usage

**Wednesday: Dependencies & Security**
- [ ] Run security audit:
  ```bash
  npm audit
  ```
- [ ] Check for outdated packages:
  ```bash
  npm outdated
  ```
- [ ] Review GitHub security advisories
- [ ] Check Dependabot PRs
- [ ] Test auto-deployment workflow

**Friday: Performance & Optimization**
- [ ] Review slow database queries (Supabase query performance)
- [ ] Check cache hit rates (Redis)
- [ ] Analyze bundle size trends
- [ ] Review Lighthouse scores
- [ ] Check CDN cache effectiveness

**Weekly Reports:**
- [ ] Weekly uptime report
- [ ] Error summary (types, frequency, resolution)
- [ ] Performance metrics (response times, throughput)
- [ ] User engagement metrics (if analytics enabled)

### Bi-Weekly Tasks (1 hour)

**Every 2 Weeks:**

**Code Quality:**
- [ ] Review test coverage (should be >80%)
- [ ] Run full E2E test suite locally
- [ ] Review and merge Dependabot PRs
- [ ] Update lockfiles if needed
- [ ] Code review of recent changes

**Infrastructure:**
- [ ] Review Railway scaling settings
- [ ] Check database backup success (Supabase)
- [ ] Verify Redis persistence configuration
- [ ] Test disaster recovery procedures (dry run)
- [ ] Review and rotate API keys if needed

**Monitoring:**
- [ ] Review Sentry alert rules
- [ ] Update monitoring dashboards
- [ ] Check log rotation settings
- [ ] Verify webhook integrations

### Monthly Tasks (2-3 hours)

**First Week of Month:**

**Billing & Costs:**
- [ ] Review monthly bills:
  - Railway usage report
  - Supabase usage
  - Upstash commands & storage
  - Vercel bandwidth & builds
  - Sentry events
- [ ] Analyze cost trends
- [ ] Identify optimization opportunities
- [ ] Update cost projections

**Security Audit:**
- [ ] Review access logs
- [ ] Audit user permissions
- [ ] Check for suspicious activity
- [ ] Review rate limit effectiveness
- [ ] Scan for exposed secrets:
  ```bash
  git secrets --scan-history
  ```

**Second Week of Month:**

**Dependency Updates:**
- [ ] Update all dependencies:
  ```bash
  npm update
  npm audit fix
  ```
- [ ] Test all updates locally:
  ```bash
  npm test
  npm run build
  npm run test:e2e
  ```
- [ ] Deploy updates to production
- [ ] Monitor for issues post-deployment

**Performance Review:**
- [ ] Run comprehensive performance tests
- [ ] Analyze database query performance
- [ ] Review and optimize slow endpoints
- [ ] Check memory leaks (if any)
- [ ] Optimize bundle sizes

**Third Week of Month:**

**Backup & Recovery:**
- [ ] Verify database backups exist (Supabase)
- [ ] Test backup restoration process (staging)
- [ ] Document backup locations
- [ ] Review retention policies
- [ ] Update disaster recovery plan

**Documentation:**
- [ ] Update API documentation
- [ ] Review and update README
- [ ] Update deployment guide (this document)
- [ ] Document new features/changes
- [ ] Update troubleshooting guide

**Fourth Week of Month:**

**Capacity Planning:**
- [ ] Review traffic trends
- [ ] Analyze growth patterns
- [ ] Project future resource needs
- [ ] Plan scaling timeline
- [ ] Update infrastructure roadmap

**Team Sync:**
- [ ] Monthly maintenance meeting
- [ ] Review incidents/outages
- [ ] Discuss optimization opportunities
- [ ] Plan upcoming changes
- [ ] Share learnings

### Quarterly Tasks (4-6 hours)

**Every 3 Months:**

**Comprehensive Security Audit:**
- [ ] Penetration testing (if budget allows)
- [ ] Full dependency audit
- [ ] Review all access controls
- [ ] Update security policies
- [ ] Rotate all secrets and credentials:
  - JWT_SECRET
  - Database passwords
  - Redis credentials
  - API tokens
  - GitHub secrets
- [ ] Review CORS configuration
- [ ] Test rate limiting thoroughly
- [ ] Audit SSL/TLS certificates

**Infrastructure Review:**
- [ ] Review Railway service configurations
- [ ] Optimize database indexes
- [ ] Review and update scaling policies
- [ ] Audit DNS configurations
- [ ] Review CDN effectiveness
- [ ] Evaluate new services/providers

**Performance Optimization:**
- [ ] Full performance audit
- [ ] Load testing:
  ```bash
  ab -n 10000 -c 100 https://your-api.railway.app/api/leaderboards/global
  ```
- [ ] Database optimization:
  - Vacuum/analyze
  - Rebuild indexes
  - Archive old data
- [ ] Review and optimize caching strategy
- [ ] Bundle size optimization
- [ ] Image optimization review

**Disaster Recovery Testing:**
- [ ] Full backup restoration drill
- [ ] Test rollback procedures
- [ ] Verify emergency contacts
- [ ] Update runbooks
- [ ] Document lessons learned

**Compliance & Governance:**
- [ ] Review data retention policies
- [ ] Audit user data handling
- [ ] Update privacy policy (if needed)
- [ ] Review terms of service
- [ ] Ensure GDPR/CCPA compliance

**Technology Updates:**
- [ ] Evaluate new platform features
- [ ] Review Node.js version (LTS updates)
- [ ] Consider major dependency upgrades
- [ ] Evaluate new monitoring tools
- [ ] Research cost optimization opportunities

### Annual Tasks (1-2 days)

**Once Per Year:**

**Strategic Review:**
- [ ] Comprehensive system architecture review
- [ ] Evaluate alternative providers
- [ ] Cost-benefit analysis of current stack
- [ ] Plan major upgrades/migrations
- [ ] Review 12-month roadmap

**Security:**
- [ ] Annual security audit (third-party if budget allows)
- [ ] Review and update security policies
- [ ] Conduct security training
- [ ] Update incident response plan
- [ ] Review insurance coverage

**Infrastructure:**
- [ ] Major version upgrades:
  - Node.js LTS update
  - Database version upgrade
  - Framework updates
- [ ] Evaluate new technologies
- [ ] Plan infrastructure evolution

**Documentation:**
- [ ] Comprehensive documentation review
- [ ] Update all diagrams
- [ ] Review onboarding materials
- [ ] Update architecture decision records (ADRs)
- [ ] Create annual state-of-the-system report

**Team & Process:**
- [ ] Review maintenance processes
- [ ] Update runbooks
- [ ] Conduct retrospective
- [ ] Plan training/upskilling
- [ ] Update on-call procedures

### Maintenance Calendar Template

**Monthly Maintenance Window:**
- **Date:** First Saturday of each month
- **Time:** 2 AM - 4 AM UTC (low traffic period)
- **Duration:** 2 hours
- **Purpose:** Major updates, migrations, optimizations

**Notification:**
```
Subject: Scheduled Maintenance - Love Rank Pulse

Dear Users,

We'll be performing scheduled maintenance:
- Date: [First Saturday of Month]
- Time: 2 AM - 4 AM UTC
- Expected downtime: 15-30 minutes
- Impact: Service may be intermittently unavailable

We'll update the status page during maintenance.

Thank you for your patience.
```

### Automation Recommendations

**Automate These Tasks:**

1. **Daily health checks:**
   ```yaml
   # .github/workflows/health-check.yml
   on:
     schedule:
       - cron: '0 */6 * * *' # Every 6 hours
   ```

2. **Weekly dependency updates:**
   - Enable Dependabot (already configured)
   - Auto-merge minor/patch updates (optional)

3. **Monthly reports:**
   ```bash
   # Generate monthly reports
   npm run generate-report -- --month $(date +%m)
   ```

4. **Backup verification:**
   - Automate backup restoration tests
   - Alert on backup failures

5. **Performance monitoring:**
   - Automated Lighthouse CI
   - Synthetic user monitoring

### Emergency Maintenance

**When to Schedule Emergency Maintenance:**
- Critical security vulnerability
- Database corruption
- Severe performance degradation
- Data integrity issues

**Emergency Procedure:**
1. Assess severity (P0-P4)
2. Notify stakeholders
3. Enable maintenance mode (if available)
4. Execute fix
5. Verify fix
6. Post-mortem within 48 hours

---

## Support & Resources

### Documentation Links

- **Railway:** https://docs.railway.app
- **Vercel:** https://vercel.com/docs
- **Supabase:** https://supabase.com/docs
- **Upstash:** https://docs.upstash.com
- **Sentry:** https://docs.sentry.io
- **Prisma:** https://prisma.io/docs

### Community

- **Railway Discord:** https://discord.gg/railway
- **Vercel Discord:** https://vercel.com/discord
- **Supabase Discord:** https://discord.supabase.com

### Support Contacts

**Service Providers:**
- Railway: support@railway.app
- Vercel: support@vercel.com
- Supabase: support@supabase.io
- Upstash: support@upstash.com
- Sentry: support@sentry.io

---

**Congratulations!** You now have a comprehensive production deployment guide. Follow these steps carefully, and your Love Rank Pulse application will be running smoothly in production.

**Next Steps:**
1. Complete [GitHub Secrets Configuration](#2-github-secrets-configuration)
2. Deploy [Backend to Railway](#3-railway-deployment-backend)
3. Set up [Database on Supabase](#4-supabase-postgresql-setup)
4. Configure [Redis Cache with Upstash](#5-upstash-redis-setup)
5. Enable [Monitoring with Sentry](#6-monitoring--error-tracking-sentry)
6. Run [Post-Deployment Verification](#8-post-deployment-verification)

**Questions or Issues?** Refer to the [Troubleshooting Guide](#10-troubleshooting-guide) or contact support.
