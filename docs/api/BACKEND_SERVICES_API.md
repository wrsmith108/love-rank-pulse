# Backend Services API Documentation

## Overview

This document provides comprehensive API documentation for all backend services in the Love Rank Pulse platform, including authentication, session management, player management, match management, and leaderboard services.

---

## Table of Contents

1. [Authentication & Session Management](#authentication--session-management)
2. [Player Service](#player-service)
3. [Match Service](#match-service)
4. [Leaderboard Service](#leaderboard-service)
5. [Validation Schemas](#validation-schemas)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)

---

## Authentication & Session Management

### Overview

The authentication system uses JWT tokens with Redis-backed session management, token blacklisting, and multi-session support.

### Features

- **JWT Authentication**: Secure token-based authentication
- **Session Management**: Redis-backed distributed sessions
- **Token Blacklisting**: Revocation and logout support
- **Multi-Session**: Up to 5 concurrent sessions per user
- **Auto-Expiration**: 7-day session TTL with activity tracking

### API Endpoints

#### 1. Register User

```typescript
POST /api/auth/register

// Request Body
{
  email: string;          // Valid email format
  username: string;       // 3-50 alphanumeric + underscores
  password: string;       // Min 8 chars, 1 letter, 1 number
  countryCode?: string;   // ISO 3166-1 alpha-2 (e.g., "US")
}

// Response
{
  success: true,
  token: string,          // JWT token
  expiresAt: Date,
  user: {
    id: string,
    username: string,
    email: string,
    displayName: string,
    countryCode: string,
    eloRating: number     // Default: 1200
  }
}
```

#### 2. Login User

```typescript
POST /api/auth/login

// Request Body
{
  email: string;
  password: string;
}

// Response
{
  success: true,
  token: string,
  expiresAt: Date,
  user: {
    id: string,
    username: string,
    email: string,
    displayName: string,
    countryCode: string,
    eloRating: number
  }
}
```

#### 3. Validate Token

```typescript
POST /api/auth/validate

// Request Body
{
  token: string;
}

// Response
{
  valid: boolean,
  userId?: string,
  username?: string,
  email?: string,
  sessionData?: SessionData,
  error?: string
}
```

#### 4. Logout User

```typescript
POST /api/auth/logout

// Headers
Authorization: Bearer <token>

// Response
{
  success: boolean,
  message: "Logged out successfully"
}
```

#### 5. Get Active Sessions

```typescript
GET /api/auth/sessions/:userId

// Headers
Authorization: Bearer <token>

// Response
{
  success: true,
  sessions: [
    {
      userId: string,
      username: string,
      email: string,
      createdAt: Date,
      lastActivity: Date,
      ipAddress?: string,
      userAgent?: string
    }
  ]
}
```

#### 6. Revoke All Sessions

```typescript
DELETE /api/auth/sessions/:userId

// Headers
Authorization: Bearer <token>

// Response
{
  success: true,
  message: "All sessions revoked"
}
```

---

## Player Service

### Overview

Manages player profiles, statistics, and account operations.

### API Endpoints

#### 1. Get Player by ID

```typescript
GET /api/players/:playerId

// Response
{
  success: true,
  data: {
    id: string,
    username: string,
    email: string,
    displayName: string,
    avatarUrl?: string,
    bio?: string,
    countryCode: string,
    eloRating: number,
    rank: number,
    createdAt: Date,
    lastLoginAt?: Date,
    isActive: boolean,
    isVerified: boolean
  }
}
```

#### 2. Get Player Statistics

```typescript
GET /api/players/:playerId/stats

// Response
{
  success: true,
  data: {
    playerId: string,
    matchesPlayed: number,
    wins: number,
    losses: number,
    draws: number,
    winRate: number,
    currentStreak: number,
    bestStreak: number,
    rank: number,
    eloRating: number,
    peakElo: number,
    lowestElo: number
  }
}
```

#### 3. Update Player Profile

```typescript
PATCH /api/players/:playerId

// Headers
Authorization: Bearer <token>

// Request Body
{
  username?: string,      // 3-50 alphanumeric + underscores
  bio?: string,          // Max 500 characters
  avatarUrl?: string,    // Valid URL
  countryCode?: string   // ISO 3166-1 alpha-2
}

// Response
{
  success: true,
  data: Player
}
```

#### 4. Search Players

```typescript
GET /api/players/search?query=<query>&limit=<limit>

// Query Parameters
query: string   // Min 1, max 100 characters
limit: number   // 1-100, default 20

// Response
{
  success: true,
  data: Player[],
  pagination: {
    limit: number,
    offset: number,
    total: number
  }
}
```

#### 5. Get Players by Country

```typescript
GET /api/players/country/:countryCode?limit=<limit>&offset=<offset>

// Response
{
  success: true,
  data: Player[],
  pagination: {
    limit: number,
    offset: number,
    total: number
  }
}
```

---

## Match Service

### Overview

Handles match creation, result submission, ELO calculations, and match statistics.

### Features

- **ELO Calculation**: Automatic rating adjustments using K-factor
- **Match Statistics**: Comprehensive stats including streaks and form
- **Match Verification**: Optional result verification system
- **Match Types**: RANKED, CASUAL, TOURNAMENT, PRACTICE

### API Endpoints

#### 1. Create Match

```typescript
POST /api/matches

// Headers
Authorization: Bearer <token>

// Request Body
{
  player1Id: string,           // UUID
  player2Id: string,           // UUID (different from player1Id)
  matchType?: "RANKED" | "CASUAL" | "TOURNAMENT" | "PRACTICE",  // Default: RANKED
  scheduledAt?: Date,
  bestOf?: number,             // 1-7, default 1
  timeLimit?: number,          // 60-7200 seconds
  tournamentId?: string,
  roundNumber?: number,        // Min 1
  notes?: string              // Max 1000 characters
}

// Response
{
  success: true,
  data: {
    id: string,
    player1: { id, username, elo_rating },
    player2: { id, username, elo_rating },
    matchType: string,
    status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
    createdAt: Date,
    scheduledAt?: Date,
    startedAt?: Date
  }
}
```

#### 2. Submit Match Result

```typescript
POST /api/matches/:matchId/result

// Headers
Authorization: Bearer <token>

// Request Body
{
  player1Score: number,        // Min 0
  player2Score: number,        // Min 0
  resultType?: "WIN" | "LOSS" | "DRAW" | "FORFEIT" | "NO_CONTEST",
  verifiedBy?: string          // UUID
}

// Response
{
  success: true,
  data: {
    matchId: string,
    winnerId?: string,
    loserId?: string,
    resultType: string,
    player1Score: number,
    player2Score: number,
    ratingChange: number,
    winnerNewElo?: number,
    loserNewElo?: number,
    verificationStatus: "PENDING" | "VERIFIED" | "DISPUTED"
  }
}
```

#### 3. Get Match by ID

```typescript
GET /api/matches/:matchId

// Response
{
  success: true,
  data: {
    id: string,
    player1: { id, username, elo_rating },
    player2: { id, username, elo_rating },
    matchType: string,
    status: string,
    result?: MatchResult,
    createdAt: Date,
    completedAt?: Date
  }
}
```

#### 4. Get Player Match History

```typescript
GET /api/matches/player/:playerId?limit=<limit>

// Query Parameters
limit: number  // 1-100, default 10

// Response
{
  success: true,
  data: Match[],
  pagination: {
    limit: number,
    total: number
  }
}
```

#### 5. Get Player Match Statistics

```typescript
GET /api/matches/player/:playerId/stats

// Response
{
  success: true,
  data: {
    totalMatches: number,
    wins: number,
    losses: number,
    draws: number,
    winRate: number,           // 0-1
    currentStreak: number,      // Positive = wins, negative = losses
    longestWinStreak: number,   // NEW
    longestLossStreak: number,  // NEW
    currentElo: number,
    peakElo: number,
    averageOpponentElo: number,
    recentForm: number,         // NEW: Last 10 matches win rate (0-100)
    lastMatchDate?: Date        // NEW
  }
}
```

---

## Leaderboard Service

### Overview

High-performance leaderboard system with Redis caching, multiple scopes, and real-time updates.

### Features

- **Multi-Scope**: Global, country, and session leaderboards
- **Redis Caching**: Sorted sets for O(log N) operations
- **Real-Time Updates**: Redis pub/sub broadcasting
- **Trending Players**: Fastest rising players
- **Historical Tracking**: Peak/lowest ELO, rank changes

### API Endpoints

#### 1. Get Global Leaderboard

```typescript
GET /api/leaderboard/global?limit=<limit>&offset=<offset>

// Query Parameters
limit: number   // 1-100, default 100
offset: number  // Min 0, default 0

// Response
{
  success: true,
  data: [
    {
      rank: number,
      player: {
        id: string,
        username: string,
        avatar_url?: string,
        country_code?: string
      },
      elo_rating: number,
      previous_elo?: number,
      wins: number,
      losses: number,
      draws: number,
      matches_played: number,
      win_rate: number,
      current_streak: number,
      rank_change: number,       // Positive = up, negative = down
      peak_elo: number,
      last_match_at?: Date
    }
  ],
  pagination: {
    limit: number,
    offset: number,
    total: number
  }
}
```

#### 2. Get Country Leaderboard

```typescript
GET /api/leaderboard/country/:countryCode?limit=<limit>&offset=<offset>

// Parameters
countryCode: string  // ISO 3166-1 alpha-2 (e.g., "US")

// Response
{
  success: true,
  data: LeaderboardEntry[],
  pagination: PaginationMeta
}
```

#### 3. Get Session/Tournament Leaderboard

```typescript
GET /api/leaderboard/session/:sessionId?limit=<limit>&offset=<offset>

// Parameters
sessionId: string  // UUID

// Response
{
  success: true,
  data: LeaderboardEntry[],
  pagination: PaginationMeta
}
```

#### 4. Get Player Rank

```typescript
GET /api/leaderboard/rank/:playerId?scope=<scope>&identifier=<identifier>

// Parameters
playerId: string  // UUID
scope: "global" | "country" | "session"  // Default: "global"
identifier?: string  // Country code or session ID (required for non-global)

// Response
{
  success: true,
  data: {
    player_id: string,
    rank: number,
    total_players: number,
    percentile: number,        // 0-100
    elo_rating: number,
    wins: number,
    losses: number,
    win_rate: number
  }
}
```

#### 5. Get Leaderboard Statistics

```typescript
GET /api/leaderboard/stats

// Response
{
  success: true,
  data: {
    total_players: number,
    active_players: number,
    average_elo: number,
    median_elo: number,
    highest_elo: number,
    total_matches: number,
    matches_today: number
  }
}
```

#### 6. Get Trending Players

```typescript
GET /api/leaderboard/trending?limit=<limit>

// Query Parameters
limit: number  // 1-100, default 10

// Response
{
  success: true,
  data: [
    {
      player_id: string,
      username: string,
      avatar_url?: string,
      elo_rating: number,
      elo_gain_24h: number,     // ELO change in last 24 hours
      rank: number,
      rank_change: number,
      wins_24h: number
    }
  ]
}
```

---

## Validation Schemas

All requests are validated using Zod schemas. Below are the common validation rules:

### Common Schemas

```typescript
// UUID
uuid: string // Valid UUID v4 format

// Email
email: string // Valid email format (RFC 5322)

// Username
username: string // 3-50 characters, alphanumeric + underscores only

// Password
password: string // Min 8 characters, at least 1 letter and 1 number

// Country Code
countryCode: string // Exactly 2 uppercase letters (ISO 3166-1 alpha-2)

// ELO Rating
eloRating: number // Integer, 100-3000

// Pagination
limit: number    // Integer, 1-100, default 20
offset: number   // Integer, min 0, default 0
```

### Validation Errors

When validation fails, the API returns a 422 status code with detailed error information:

```typescript
{
  success: false,
  error: "Validation failed",
  errorCode: "VALIDATION_ERROR",
  details: {
    fields: {
      "email": "Invalid email format",
      "password": "Password must be at least 8 characters",
      "username": "Username can only contain letters, numbers, and underscores"
    }
  },
  timestamp: "2025-10-22T12:00:00.000Z"
}
```

---

## Error Handling

### Standard Error Response

All errors follow a consistent format:

```typescript
{
  success: false,
  error: string,              // Human-readable error message
  errorCode?: string,         // Machine-readable error code
  details?: any,              // Additional error details
  requestId?: string,         // Request tracking ID
  timestamp: string           // ISO 8601 timestamp
}
```

### HTTP Status Codes

| Code | Error Type | Description |
|------|------------|-------------|
| 400 | BAD_REQUEST | Invalid request syntax or parameters |
| 401 | UNAUTHORIZED | Authentication required or invalid token |
| 403 | FORBIDDEN | Permission denied |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource conflict (e.g., duplicate username) |
| 422 | VALIDATION_ERROR | Request validation failed |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | Service temporarily unavailable |

---

## Rate Limiting

### Overview

API endpoints are rate-limited to prevent abuse. Limits are applied per IP address or authenticated user.

### Rate Limit Tiers

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 5 requests | 1 minute |
| Write Operations | 30 requests | 1 minute |
| Read Operations | 120 requests | 1 minute |
| Standard API | 60 requests | 1 minute |
| API (Authenticated) | 1000 requests | 1 hour |

### Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 2025-10-22T12:01:00.000Z
```

### Rate Limit Exceeded

When rate limit is exceeded, the API returns a 429 status code:

```typescript
{
  success: false,
  error: "Too many requests, please try again later",
  errorCode: "RATE_LIMITED",
  details: {
    retryAfter: 30  // Seconds to wait before retry
  },
  timestamp: "2025-10-22T12:00:00.000Z"
}
```

---

## Real-Time Updates

### WebSocket Subscriptions

The leaderboard service broadcasts real-time updates via Redis pub/sub. Clients can subscribe to receive instant notifications of ELO changes, rank updates, and match completions.

### Channels

```typescript
// Main leaderboard updates
"leaderboard:updates"

// Player-specific updates
"leaderboard:player:{playerId}"
```

### Update Event Format

```typescript
{
  type: "player_update",
  playerId: string,
  playerData: {
    id: string,
    username: string,
    avatar_url?: string,
    elo_rating: number,
    previous_elo: number,
    elo_change: number,
    rank: number,
    previous_rank: number,
    rank_change: number,
    wins: number,
    losses: number,
    win_rate: number
  },
  timestamp: string
}
```

---

## Best Practices

### 1. Authentication

- Always include the `Authorization: Bearer <token>` header for protected endpoints
- Implement token refresh logic before expiration
- Handle 401 errors by prompting re-authentication

### 2. Error Handling

- Check the `success` field before processing data
- Display `error` messages to users
- Log `requestId` for debugging and support

### 3. Pagination

- Always use pagination for list endpoints to avoid performance issues
- Implement cursor-based navigation for better UX
- Cache responses when appropriate

### 4. Rate Limiting

- Implement exponential backoff when encountering 429 errors
- Respect the `Retry-After` header
- Consider batching requests to reduce API calls

### 5. Validation

- Validate data on the client before sending to reduce errors
- Display field-specific validation errors clearly
- Use the validation schemas as a guide for form validation

---

## Support

For issues, questions, or feature requests related to the backend services API:

1. Check this documentation first
2. Review the error codes and messages
3. Check the server logs for detailed error information
4. Contact the development team with the `requestId` from error responses

**Last Updated**: October 22, 2025
**API Version**: 2.0.0
**Status**: Production Ready
