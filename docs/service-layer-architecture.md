# Service Layer Architecture - Love Rank Pulse

## Document Information
- **Version**: 1.0.0
- **Author**: System Architecture Specialist
- **Date**: 2025-10-21
- **Status**: Final Design

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Service Architecture Overview](#service-architecture-overview)
3. [Core Services](#core-services)
4. [API Gateway Enhancements](#api-gateway-enhancements)
5. [Database Query Patterns](#database-query-patterns)
6. [Caching Strategy](#caching-strategy)
7. [Security Implementation](#security-implementation)
8. [Error Handling Patterns](#error-handling-patterns)
9. [Architecture Decision Records](#architecture-decision-records)
10. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

This document defines the service layer architecture for Love Rank Pulse, an ELO-based competitive ranking system. The architecture implements a layered service approach with:

- **3 Core Services**: PlayerService, MatchService, LeaderboardService
- **Prisma ORM**: Type-safe database operations with PostgreSQL
- **Redis Caching**: 60-second TTL for leaderboard data
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Protect against abuse
- **Comprehensive Error Handling**: Structured error responses

---

## Service Architecture Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Client                         │
│                   (React + TypeScript)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│  - CORS, Security Headers, Rate Limiting                     │
│  - Request Validation & Logging                              │
│  - JWT Authentication Middleware                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
┌────────────┐  ┌────────────┐  ┌────────────────┐
│  Player    │  │   Match    │  │  Leaderboard   │
│  Service   │  │  Service   │  │   Service      │
│            │  │            │  │                │
│ - Auth     │  │ - ELO Calc │  │ - Rankings     │
│ - Profile  │  │ - Results  │  │ - Cache Layer  │
│ - CRUD     │  │ - Stats    │  │ - Real-time    │
└─────┬──────┘  └─────┬──────┘  └─────┬──────────┘
      │               │               │
      │               │               │
      ▼               ▼               ▼
┌─────────────────────────────────────────────┐
│          Prisma Client (ORM)                │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│         PostgreSQL Database                 │
│  - Players, Matches, Results, Leaderboard   │
└─────────────────────────────────────────────┘

                      │ Caching
                      ▼
┌─────────────────────────────────────────────┐
│            Redis Cache                      │
│  - Leaderboard Data (60s TTL)               │
│  - Player Stats (300s TTL)                  │
└─────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React + TypeScript | UI/UX |
| **API Gateway** | Express.js | Request routing, middleware |
| **ORM** | Prisma | Type-safe database queries |
| **Database** | PostgreSQL | Persistent data storage |
| **Cache** | Redis | Performance optimization |
| **Authentication** | JWT + bcrypt | Secure auth tokens, password hashing |
| **Security** | Helmet.js | HTTP security headers |
| **Rate Limiting** | express-rate-limit | API abuse protection |

---

## Core Services

### 1. PlayerService

**Responsibility**: User registration, authentication, profile management

#### Current Implementation Analysis
✅ **Already Implemented** (In-memory mock version):
- Player CRUD operations
- Friend management
- Registration/login with mock auth
- Profile search and filtering

#### Database-Backed Implementation Requirements

**Key Methods**:

```typescript
class PlayerService {
  private prisma: PrismaClient;

  // Authentication
  async register(data: RegistrationData): Promise<AuthResponse>
  async login(credentials: LoginCredentials): Promise<AuthResponse>
  async logout(userId: string): Promise<void>
  async refreshToken(refreshToken: string): Promise<AuthResponse>

  // Profile Management
  async getPlayerById(playerId: string): Promise<Player | null>
  async getPlayersByIds(playerIds: string[]): Promise<Player[]>
  async updatePlayer(playerId: string, updates: Partial<Player>): Promise<Player>
  async deletePlayer(playerId: string): Promise<void>

  // Search & Filter
  async searchPlayers(query: string): Promise<Player[]>
  async getPlayersByCountry(countryCode: string): Promise<Player[]>

  // Password Management
  async hashPassword(password: string): Promise<string>
  async verifyPassword(password: string, hash: string): Promise<boolean>
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>

  // JWT Token Management
  generateAccessToken(userId: string): string
  generateRefreshToken(userId: string): string
  verifyToken(token: string): { userId: string, exp: number } | null
}
```

**Database Schema Integration**:
- Uses Prisma `Player` model
- Stores hashed passwords (bcrypt with salt rounds: 12)
- Manages JWT tokens (access: 15min, refresh: 7 days)
- Validates email uniqueness and username constraints

**Security Features**:
- Password hashing: `bcrypt.hash(password, 12)`
- JWT signing: `jwt.sign({ userId }, SECRET, { expiresIn: '15m' })`
- Token refresh mechanism
- Password strength validation
- Email verification (future)

---

### 2. MatchService

**Responsibility**: Match creation, result processing, ELO rating calculations

#### Current Implementation Analysis
✅ **Already Implemented** (Database-backed with Prisma):
- Match creation with player validation
- ELO rating calculations
- Match result submission
- Player statistics tracking
- Transaction-safe updates

#### Architecture Strengths

**ELO Calculation Algorithm**:
```typescript
// Expected Score Formula: E_A = 1 / (1 + 10^((R_B - R_A) / 400))
private calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// New Rating Formula: R_new = R_old + K * (S - E)
private calculateNewRating(
  currentRating: number,
  expectedScore: number,
  actualScore: number,
  kFactor: number = 32
): number {
  const newRating = currentRating + kFactor * (actualScore - expectedScore);
  return Math.round(Math.max(100, Math.min(3000, newRating)));
}
```

**Key Configuration**:
- K-Factor: 32 (standard chess rating)
- Default ELO: 1200
- Min Rating: 100
- Max Rating: 3000

**Transaction Safety**:
```typescript
async submitMatchResult(input: SubmitMatchResultInput): Promise<MatchResult> {
  return await this.prisma.$transaction(async (tx) => {
    // 1. Validate match exists and not completed
    // 2. Calculate ELO changes
    // 3. Create match result
    // 4. Update both player ratings
    // 5. Update match status
    // All operations are atomic
  });
}
```

**Database Integration**:
- Uses Prisma `Match`, `MatchResult`, `Player` models
- Atomic transactions for rating updates
- Proper foreign key relationships
- Cascading deletes configured

---

### 3. LeaderboardService

**Responsibility**: Real-time rankings with Redis caching

#### Current Implementation Analysis
✅ **Already Implemented** (Database + Redis caching):
- Paginated leaderboard queries
- Redis caching with 60s TTL
- Cache invalidation on updates
- Rank range filtering
- Player rank lookup

#### Caching Strategy Architecture

**Cache Key Structure**:
```typescript
// Leaderboard pagination cache
"leaderboard:page:{page}:limit:{limit}:type:{type}:season:{seasonId}:active:{activeOnly}"

// Rank range cache
"leaderboard:range:{minRank}-{maxRank}:{type}:{seasonId}"

// Player rank cache
"player:{playerId}:rank:{type}:{seasonId}"
```

**Cache TTL Configuration**:
```typescript
const CacheTTL = {
  LEADERBOARD: 60,      // 60 seconds for leaderboard data
  PLAYER_STATS: 300,    // 5 minutes for player statistics
  MATCH_RESULTS: 180,   // 3 minutes for match results
};
```

**Cache-Aside Pattern**:
```typescript
async getLeaderboard(options): Promise<LeaderboardResponse> {
  // 1. Try cache first
  const cached = await this.getFromCache(cacheKey);
  if (cached) return cached;

  // 2. Cache miss - query database
  const data = await this.queryDatabase(options);

  // 3. Store in cache
  await this.setCache(cacheKey, data, TTL);

  return data;
}
```

**Cache Invalidation Strategy**:
```typescript
async invalidateCache(playerId?: string): Promise<void> {
  // 1. Invalidate all leaderboard caches
  const keys = await redis.keys('leaderboard:*');
  if (keys.length > 0) await redis.del(keys);

  // 2. Invalidate player-specific caches
  if (playerId) {
    const playerKeys = await redis.keys(`player:${playerId}:*`);
    if (playerKeys.length > 0) await redis.del(playerKeys);
  }
}
```

**Rank Recalculation**:
```typescript
async recalculateRanks(leaderboardType, seasonId): Promise<void> {
  // 1. Fetch all entries ordered by ELO
  const entries = await prisma.leaderboardEntry.findMany({
    orderBy: { elo_rating: 'desc' }
  });

  // 2. Batch update ranks with rank change tracking
  const updates = entries.map((entry, index) => {
    const newRank = index + 1;
    const rankChange = entry.rank - newRank;
    return prisma.leaderboardEntry.update({
      where: { id: entry.id },
      data: { rank: newRank, previous_rank: entry.rank, rank_change: rankChange }
    });
  });

  // 3. Execute in transaction
  await prisma.$transaction(updates);

  // 4. Invalidate all caches
  await this.invalidateCache();
}
```

---

## API Gateway Enhancements

### Current State
✅ **Existing Features**:
- Route registration and handling
- Response caching (in-memory)
- Success/error response formatting
- Request logging

### Required Enhancements

#### 1. Rate Limiting Strategy

```typescript
import rateLimit from 'express-rate-limit';

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth endpoint limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Leaderboard limiter (more lenient)
const leaderboardLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
});
```

**Rate Limit Tiers**:
| Endpoint Type | Window | Max Requests | Use Case |
|--------------|--------|--------------|----------|
| Global | 15 min | 100 | Default for all endpoints |
| Authentication | 15 min | 5 | Login, register (prevent brute force) |
| Leaderboard | 1 min | 30 | High-traffic read operations |
| Match Creation | 1 min | 10 | Prevent spam match creation |
| Profile Updates | 1 min | 5 | Prevent rapid profile changes |

#### 2. Request Logging Middleware

```typescript
import morgan from 'morgan';
import winston from 'winston';

// Winston logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
});

// Morgan HTTP request logger
const requestLogger = morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
});

// Custom request logging middleware
const logRequest = (req, res, next) => {
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    query: req.query,
    userId: req.user?.id || 'anonymous',
    ip: req.ip,
    userAgent: req.get('user-agent')
  };

  logger.info('Incoming request', logData);
  next();
};
```

**Log Levels**:
- `error`: Authentication failures, database errors, server errors
- `warn`: Rate limit violations, invalid requests
- `info`: Successful requests, cache hits/misses
- `debug`: Detailed query information (dev only)

#### 3. CORS Configuration

```typescript
import cors from 'cors';

const corsOptions = {
  origin: (origin, callback) => {
    // Allowed origins
    const allowedOrigins = [
      'https://love-rank-pulse.com',
      'https://www.love-rank-pulse.com',
      'http://localhost:3000', // Development
      'http://localhost:5173', // Vite dev server
    ];

    // Allow requests with no origin (mobile apps, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  maxAge: 600, // 10 minutes - how long to cache preflight requests
};

app.use(cors(corsOptions));
```

#### 4. Security Headers (Helmet.js)

```typescript
import helmet from 'helmet';

app.use(helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for UI
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"], // Allow external images
      connectSrc: ["'self'", "https://api.love-rank-pulse.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },

  // Strict Transport Security (HTTPS enforcement)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },

  // Prevent clickjacking
  frameguard: {
    action: 'deny',
  },

  // Hide X-Powered-By header
  hidePoweredBy: true,

  // Prevent MIME type sniffing
  noSniff: true,

  // XSS Protection
  xssFilter: true,

  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
}));
```

**Security Headers Added**:
- `Content-Security-Policy`: Prevent XSS attacks
- `Strict-Transport-Security`: Force HTTPS
- `X-Frame-Options`: Prevent clickjacking
- `X-Content-Type-Options`: Prevent MIME sniffing
- `X-XSS-Protection`: Enable browser XSS protection
- `Referrer-Policy`: Control referrer information

#### 5. Error Handling Middleware

```typescript
// Custom error class
class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Mongoose/Prisma validation errors
  if (err.name === 'ValidationError') {
    error = new ApiError(400, 'Validation Error', true);
  }

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    error = new ApiError(409, 'Resource already exists', true);
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    error = new ApiError(404, 'Resource not found', true);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError(401, 'Invalid token', true);
  }

  if (err.name === 'TokenExpiredError') {
    error = new ApiError(401, 'Token expired', true);
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Log error
  logger.error('Error occurred', {
    error: message,
    stack: err.stack,
    statusCode,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const error = new ApiError(404, `Route ${req.originalUrl} not found`);
  next(error);
};
```

---

## Database Query Patterns

### Optimized Prisma Queries

#### 1. Leaderboard Query with Pagination

```typescript
// Efficient pagination with total count
async function getLeaderboardPage(page: number, limit: number) {
  const [entries, total] = await prisma.$transaction([
    // Get paginated entries
    prisma.leaderboardEntry.findMany({
      where: { is_active: true },
      include: {
        player: {
          select: {
            id: true,
            username: true,
            avatar_url: true,
            country_code: true,
          },
        },
      },
      orderBy: { rank: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),

    // Get total count
    prisma.leaderboardEntry.count({
      where: { is_active: true },
    }),
  ]);

  return { entries, total, hasMore: page * limit < total };
}
```

**Performance**: Uses single transaction for atomicity, selective field projection to reduce data transfer.

#### 2. Player Match History with Results

```typescript
async function getPlayerMatchHistory(playerId: string, limit: number = 10) {
  return await prisma.match.findMany({
    where: {
      OR: [
        { player1_id: playerId },
        { player2_id: playerId },
      ],
      status: 'COMPLETED',
    },
    include: {
      player1: {
        select: { id: true, username: true, elo_rating: true },
      },
      player2: {
        select: { id: true, username: true, elo_rating: true },
      },
      result: true,
    },
    orderBy: { completed_at: 'desc' },
    take: limit,
  });
}
```

**Performance**: Uses compound OR condition with index on `player1_id` and `player2_id`.

#### 3. Bulk Player Statistics Update

```typescript
async function bulkUpdatePlayerStats(updates: Array<{ playerId: string; eloRating: number; wins: number; losses: number }>) {
  const transactions = updates.map(({ playerId, eloRating, wins, losses }) =>
    prisma.player.update({
      where: { id: playerId },
      data: {
        elo_rating: eloRating,
        wins,
        losses,
        last_active_at: new Date(),
      },
    })
  );

  // Execute all updates in single transaction
  return await prisma.$transaction(transactions);
}
```

**Performance**: Batch updates in single transaction reduce database round-trips.

#### 4. Complex Leaderboard Aggregation

```typescript
async function getLeaderboardWithStats(filters: {
  countryCode?: string;
  minElo?: number;
  limit?: number;
}) {
  return await prisma.leaderboardEntry.findMany({
    where: {
      is_active: true,
      ...(filters.countryCode && {
        player: { country_code: filters.countryCode },
      }),
      ...(filters.minElo && {
        elo_rating: { gte: filters.minElo },
      }),
    },
    include: {
      player: {
        select: {
          id: true,
          username: true,
          avatar_url: true,
          country_code: true,
        },
      },
    },
    orderBy: [
      { rank: 'asc' },
      { elo_rating: 'desc' },
    ],
    take: filters.limit || 50,
  });
}
```

**Performance**: Uses indexed columns (`is_active`, `elo_rating`, `rank`) for filtering and sorting.

### Database Indexes (Already Defined in Schema)

**Critical Indexes**:
```prisma
// Player indexes
@@index([elo_rating(sort: Desc)], name: "idx_player_elo")
@@index([is_active, elo_rating(sort: Desc)], name: "idx_active_players_elo")
@@index([rank], name: "idx_player_rank")

// Match indexes
@@index([player1_id], name: "idx_match_player1")
@@index([player2_id], name: "idx_match_player2")
@@index([status], name: "idx_match_status")
@@index([match_type, status], name: "idx_match_type_status")

// Leaderboard indexes
@@index([rank], name: "idx_leaderboard_rank")
@@index([elo_rating(sort: Desc)], name: "idx_leaderboard_elo")
@@index([leaderboard_type, is_active, elo_rating(sort: Desc)], name: "idx_active_leaderboard")
```

---

## Caching Strategy

### Redis Architecture

```
┌─────────────────────────────────────────────────────┐
│               Redis Cache Layers                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Layer 1: Leaderboard Cache (60s TTL)              │
│  ├─ Full leaderboard pages                         │
│  ├─ Rank range queries                             │
│  └─ Top N players                                  │
│                                                     │
│  Layer 2: Player Stats (300s TTL)                  │
│  ├─ Player rank info                               │
│  ├─ Match statistics                               │
│  └─ Win/loss records                               │
│                                                     │
│  Layer 3: Match Results (180s TTL)                 │
│  ├─ Recent matches                                 │
│  ├─ Match history                                  │
│  └─ Head-to-head records                           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Cache Invalidation Triggers

| Trigger Event | Invalidation Action | Affected Keys |
|--------------|---------------------|---------------|
| Match result submitted | Invalidate player stats & leaderboard | `leaderboard:*`, `player:{id}:*` |
| Player registers | Invalidate global leaderboard | `leaderboard:page:*:type:GLOBAL:*` |
| Rank recalculation | Invalidate all leaderboard caches | `leaderboard:*` |
| Profile update | Invalidate player-specific caches | `player:{id}:*` |

### Cache Warming Strategy

```typescript
// Warm cache on server startup
async function warmCache() {
  try {
    // Pre-cache first 3 pages of global leaderboard
    for (let page = 1; page <= 3; page++) {
      await leaderboardService.getLeaderboard({
        page,
        limit: 50,
        leaderboardType: LeaderboardType.GLOBAL,
      });
    }

    // Pre-cache top 10 players
    await leaderboardService.getTopPlayers(10);

    console.log('✅ Cache warmed successfully');
  } catch (error) {
    console.error('❌ Cache warming failed:', error);
  }
}
```

---

## Security Implementation

### 1. Password Hashing (bcrypt)

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

class PasswordService {
  async hash(password: string): Promise<string> {
    // Validate password strength
    if (!this.isStrongPassword(password)) {
      throw new Error('Password does not meet security requirements');
    }

    return await bcrypt.hash(password, SALT_ROUNDS);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  isStrongPassword(password: string): boolean {
    // Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special char
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongRegex.test(password);
  }
}
```

**Password Requirements**:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (`@$!%*?&`)

### 2. JWT Token Generation

```typescript
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET!;

class JWTService {
  generateAccessToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'access' },
      ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' } // 15 minutes
    );
  }

  generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'refresh' },
      REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' } // 7 days
    );
  }

  verifyAccessToken(token: string): { userId: string } | null {
    try {
      const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as any;
      if (decoded.type !== 'access') return null;
      return { userId: decoded.userId };
    } catch (error) {
      return null;
    }
  }

  verifyRefreshToken(token: string): { userId: string } | null {
    try {
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as any;
      if (decoded.type !== 'refresh') return null;
      return { userId: decoded.userId };
    } catch (error) {
      return null;
    }
  }
}
```

**Token Strategy**:
- **Access Token**: Short-lived (15 min), used for API requests
- **Refresh Token**: Long-lived (7 days), used to obtain new access tokens
- **Token Rotation**: Refresh tokens are rotated on each refresh

### 3. Authentication Middleware

```typescript
import { Request, Response, NextFunction } from 'express';

interface AuthRequest extends Request {
  user?: { userId: string };
}

const jwtService = new JWTService();

const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwtService.verifyAccessToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }

    // Verify user still exists
    const user = await prisma.player.findUnique({
      where: { id: decoded.userId },
      select: { id: true, is_active: true },
    });

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive',
      });
    }

    // Attach user to request
    req.user = { userId: decoded.userId };
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
    });
  }
};

// Optional authentication (allows both authenticated and anonymous access)
const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next(); // No token, continue as anonymous
  }

  // If token exists, verify it
  return authenticate(req, res, next);
};
```

---

## Error Handling Patterns

### Structured Error Responses

```typescript
// Error response interface
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
}

// Error code enum
enum ErrorCode {
  // Authentication errors (4xx)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Validation errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',

  // Business logic errors (4xx)
  MATCH_ALREADY_COMPLETED = 'MATCH_ALREADY_COMPLETED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
}

// Service-level error class
class ServiceError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// Error factory
class ErrorFactory {
  static unauthorized(message = 'Unauthorized'): ServiceError {
    return new ServiceError(ErrorCode.UNAUTHORIZED, 401, message);
  }

  static notFound(resource: string): ServiceError {
    return new ServiceError(
      ErrorCode.RESOURCE_NOT_FOUND,
      404,
      `${resource} not found`
    );
  }

  static validationError(details: any): ServiceError {
    return new ServiceError(
      ErrorCode.VALIDATION_ERROR,
      400,
      'Validation failed',
      details
    );
  }

  static duplicate(resource: string): ServiceError {
    return new ServiceError(
      ErrorCode.DUPLICATE_RESOURCE,
      409,
      `${resource} already exists`
    );
  }

  static rateLimit(): ServiceError {
    return new ServiceError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      429,
      'Too many requests, please try again later'
    );
  }
}
```

### Service Error Handling

```typescript
class PlayerService {
  async getPlayerById(playerId: string): Promise<Player> {
    try {
      const player = await prisma.player.findUnique({
        where: { id: playerId },
      });

      if (!player) {
        throw ErrorFactory.notFound('Player');
      }

      return player;
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error; // Re-throw service errors
      }

      // Log unexpected errors
      logger.error('Unexpected error in getPlayerById', {
        error: error.message,
        playerId,
      });

      throw new ServiceError(
        ErrorCode.DATABASE_ERROR,
        500,
        'Failed to retrieve player'
      );
    }
  }
}
```

---

## Architecture Decision Records

### ADR-003: JWT Authentication Mechanism

**Context**: The system requires secure user authentication with stateless token management.

**Decision**: Implement JWT-based authentication with separate access and refresh tokens.

**Status**: ✅ Approved

**Rationale**:
1. **Stateless**: No server-side session storage required
2. **Scalable**: Tokens can be verified without database lookups
3. **Secure**: Short-lived access tokens (15 min) minimize exposure
4. **Flexible**: Refresh token rotation prevents token theft

**Consequences**:
- ✅ Improved scalability (no session store)
- ✅ Better security (token expiration, rotation)
- ✅ Mobile-friendly (token storage in local storage)
- ⚠️ Token revocation requires additional logic (blacklist)
- ⚠️ Secret management is critical (use environment variables)

**Implementation**:
```typescript
// Access token: 15 minutes
// Refresh token: 7 days
// Algorithm: HS256 (HMAC with SHA-256)
```

---

### ADR-004: Redis Caching Strategy

**Context**: Leaderboard queries are read-heavy and performance-critical.

**Decision**: Implement Redis caching with 60-second TTL for leaderboard data.

**Status**: ✅ Approved

**Rationale**:
1. **Performance**: Reduce database load by 90%+
2. **Real-time**: 60s TTL balances freshness and performance
3. **Scalability**: Redis handles high read throughput
4. **Resilience**: Graceful degradation if Redis is unavailable

**Consequences**:
- ✅ 10-100x faster leaderboard queries
- ✅ Reduced database load
- ✅ Better user experience (instant leaderboard loads)
- ⚠️ Slightly stale data (max 60s delay)
- ⚠️ Additional infrastructure (Redis server)
- ⚠️ Cache invalidation complexity

**Cache Metrics** (Expected):
| Metric | Value |
|--------|-------|
| Cache Hit Rate | 85-95% |
| Avg Response Time (Cache Hit) | < 50ms |
| Avg Response Time (Cache Miss) | 200-500ms |
| TTL | 60 seconds |

---

### ADR-005: Rate Limiting Strategy

**Context**: API needs protection against abuse and DDoS attacks.

**Decision**: Implement tiered rate limiting with express-rate-limit.

**Status**: ✅ Approved

**Rationale**:
1. **Security**: Prevent brute force attacks on auth endpoints
2. **Fairness**: Ensure fair resource allocation
3. **Cost Control**: Reduce infrastructure costs from abuse
4. **User Experience**: Prevent one user from degrading service for others

**Rate Limit Tiers**:
| Tier | Use Case | Limit |
|------|----------|-------|
| Auth | Login, Register | 5/15min |
| Global | Default | 100/15min |
| Leaderboard | High-traffic reads | 30/min |

**Consequences**:
- ✅ Protection against brute force attacks
- ✅ Fair resource allocation
- ✅ Reduced abuse and costs
- ⚠️ Legitimate users may be rate-limited
- ⚠️ Requires monitoring and tuning

---

### ADR-006: Database Transaction Strategy

**Context**: Match result submission must atomically update multiple entities (match, result, player ratings).

**Decision**: Use Prisma transactions for all multi-entity updates.

**Status**: ✅ Approved (Already implemented in MatchService)

**Rationale**:
1. **Data Consistency**: Prevent partial updates
2. **Atomicity**: All-or-nothing updates
3. **Isolation**: Prevent race conditions
4. **Durability**: Changes persist after transaction

**Example**:
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Create match result
  // 2. Update player 1 rating
  // 3. Update player 2 rating
  // 4. Update match status
  // All succeed or all fail
});
```

**Consequences**:
- ✅ Guaranteed data consistency
- ✅ No partial updates
- ✅ Proper error handling
- ⚠️ Longer lock times (may affect concurrency)
- ⚠️ Requires careful error handling

---

### ADR-007: Password Hashing with bcrypt

**Context**: User passwords must be securely stored.

**Decision**: Use bcrypt with 12 salt rounds for password hashing.

**Status**: ✅ Approved

**Rationale**:
1. **Security**: bcrypt is designed to be slow (resistant to brute force)
2. **Salt**: Automatic salting prevents rainbow table attacks
3. **Adaptive**: Can increase cost factor as hardware improves
4. **Industry Standard**: Widely used and battle-tested

**Configuration**:
```typescript
const SALT_ROUNDS = 12; // ~250ms per hash on modern hardware
```

**Consequences**:
- ✅ Strong protection against brute force
- ✅ Rainbow table attack prevention
- ✅ Future-proof (can increase rounds)
- ⚠️ Slower than MD5/SHA (intentional security feature)
- ⚠️ Higher CPU usage during auth

---

## Implementation Roadmap

### Phase 1: Core Service Layer (Week 1-2)
- [x] PlayerService with Prisma integration
- [x] MatchService with ELO calculations
- [x] LeaderboardService with Redis caching
- [ ] JWT authentication implementation
- [ ] Password hashing with bcrypt

### Phase 2: API Gateway Enhancements (Week 2-3)
- [ ] Rate limiting middleware
- [ ] Request logging with Winston
- [ ] CORS configuration
- [ ] Security headers (Helmet.js)
- [ ] Error handling middleware

### Phase 3: Testing & Optimization (Week 3-4)
- [ ] Unit tests for all services
- [ ] Integration tests for API endpoints
- [ ] Load testing for leaderboard queries
- [ ] Cache performance monitoring
- [ ] Security audit

### Phase 4: Documentation & Deployment (Week 4)
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Deployment guide
- [ ] Monitoring setup (Prometheus/Grafana)
- [ ] Production environment configuration

---

## Appendix

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/love_rank_pulse"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT Secrets
JWT_ACCESS_SECRET="your-access-secret-here-min-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-here-min-32-chars"

# Server
NODE_ENV="production"
PORT="3000"

# Logging
LOG_LEVEL="info"

# Rate Limiting
RATE_LIMIT_WINDOW_MS="900000" # 15 minutes
RATE_LIMIT_MAX_REQUESTS="100"
```

### API Endpoint Summary

| Method | Endpoint | Auth Required | Rate Limit | Description |
|--------|----------|---------------|------------|-------------|
| POST | /api/auth/register | No | 5/15min | Register new user |
| POST | /api/auth/login | No | 5/15min | Login user |
| POST | /api/auth/refresh | No | 10/15min | Refresh access token |
| POST | /api/auth/logout | Yes | - | Logout user |
| GET | /api/players/:id | Optional | 100/15min | Get player profile |
| PUT | /api/players/:id | Yes | 5/min | Update player profile |
| GET | /api/leaderboard | No | 30/min | Get leaderboard |
| GET | /api/leaderboard/rank/:playerId | Optional | 30/min | Get player rank |
| POST | /api/matches | Yes | 10/min | Create match |
| POST | /api/matches/:id/result | Yes | 10/min | Submit match result |
| GET | /api/matches/:id | No | 100/15min | Get match details |

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-21
**Status**: Final Design - Ready for Implementation
