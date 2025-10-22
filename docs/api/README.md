# Love Rank Pulse API Documentation

## Overview

Love Rank Pulse is a real-time leaderboard system for multiplayer shooter games, providing player rankings across global, country, and session scopes.

## Documentation Structure

This API documentation follows the OpenAPI 3.0 specification and is organized into the following files:

### Main Files

- **`openapi.yaml`** - Main OpenAPI specification file with references to all components
- **`README.md`** - This file, providing an overview and getting started guide

### Path Definitions

- **`paths/auth.yaml`** - Authentication endpoints (register, login, logout, me)
- **`paths/players.yaml`** - Player management endpoints (get, update, delete, stats)
- **`paths/matches.yaml`** - Match management endpoints (create, list, update, submit results)
- **`paths/leaderboard.yaml`** - Leaderboard endpoints (global, country, top)
- **`paths/health.yaml`** - Health check endpoints

### Component Definitions

- **`components/schemas.yaml`** - Data models and schema definitions
- **`components/responses.yaml`** - Reusable response definitions
- **`components/parameters.yaml`** - Reusable parameter definitions
- **`components/examples.yaml`** - Request/response examples

## Quick Start

### Base URLs

- **Production**: `https://api.loverankpulse.com/api`
- **Staging**: `https://staging-api.loverankpulse.com/api`
- **Development**: `http://localhost:3001/api`

### Authentication

Most endpoints require JWT authentication. To authenticate:

1. **Register** a new account or **login** with existing credentials:
   ```bash
   # Register
   curl -X POST https://api.loverankpulse.com/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "username": "player123",
       "email": "player@example.com",
       "password": "SecurePass123",
       "displayName": "Pro Gamer",
       "countryCode": "US"
     }'

   # Login
   curl -X POST https://api.loverankpulse.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "player@example.com",
       "password": "SecurePass123"
     }'
   ```

2. **Extract the JWT token** from the response:
   ```json
   {
     "success": true,
     "message": "Login successful",
     "data": {
       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       "player": { ... }
     }
   }
   ```

3. **Include the token** in subsequent requests:
   ```bash
   curl -X GET https://api.loverankpulse.com/api/auth/me \
     -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   ```

## Common Use Cases

### 1. View Global Leaderboard

```bash
curl -X GET "https://api.loverankpulse.com/api/leaderboard/global?page=1&limit=20"
```

### 2. View Country Leaderboard

```bash
curl -X GET "https://api.loverankpulse.com/api/leaderboard/country/US?page=1&limit=20"
```

### 3. Create a Match

```bash
curl -X POST https://api.loverankpulse.com/api/matches \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "player1Id": "550e8400-e29b-41d4-a716-446655440000",
    "player2Id": "660e8400-e29b-41d4-a716-446655440001",
    "matchType": "RANKED"
  }'
```

### 4. Submit Match Result

```bash
curl -X POST https://api.loverankpulse.com/api/matches/770e8400-e29b-41d4-a716-446655440000/result \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "player1Score": 25,
    "player2Score": 18
  }'
```

### 5. Get Player Statistics

```bash
curl -X GET https://api.loverankpulse.com/api/players/550e8400-e29b-41d4-a716-446655440000/stats
```

## API Features

### ELO Rating System

The API implements a sophisticated ELO rating system:

- **K-Factor**: 32 (standard for competitive games)
- **Default Rating**: 1200
- **Range**: 100 - 3000
- **Calculation**: Automatic on match result submission
- **Factors**:
  - Rating difference between players
  - Number of matches played (experience factor)
  - Draw handling (0.5 score for both players)

### Leaderboard Ranking Algorithm

Rankings are determined by:

1. **Primary**: ELO rating (descending)
2. **Tiebreaker 1**: Total wins (descending)
3. **Tiebreaker 2**: Account age (ascending - older accounts rank higher)

### Caching Strategy

- **Global Leaderboard**: 5-minute TTL (high traffic, stable rankings)
- **Country Leaderboard**: 3-minute TTL (moderate traffic, regional changes)
- **Session Leaderboard**: 1-minute TTL (low traffic, tournament volatility)
- **Stats**: 5-minute TTL

### Rate Limiting

Different rate limits apply based on endpoint sensitivity:

- **Authentication endpoints** (`/auth/*`): 5 requests per minute (strict)
- **API endpoints** (general): 100 requests per minute
- **Adaptive rate limiting**: Adjusts based on user behavior and authentication status

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [
      {
        "field": "fieldName",
        "message": "Field-specific error"
      }
    ]
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15420,
    "totalPages": 771
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input parameters |
| `UNAUTHORIZED` | 401 | Authentication required |
| `INVALID_TOKEN` | 401 | Invalid or expired token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

## Viewing the Documentation

### Using Swagger UI

You can view the API documentation in a user-friendly interface using Swagger UI:

1. **Online Swagger Editor**:
   - Visit https://editor.swagger.io
   - Copy the contents of `openapi.yaml`
   - Paste into the editor

2. **Local Swagger UI**:
   ```bash
   # Install swagger-ui-express
   npm install swagger-ui-express yamljs

   # Serve the documentation
   npx swagger-ui-serve openapi.yaml
   ```

3. **ReDoc**:
   ```bash
   npx @redocly/cli preview-docs openapi.yaml
   ```

## WebSocket Support

In addition to REST endpoints, Love Rank Pulse provides WebSocket connections for real-time updates:

- **Endpoint**: `wss://api.loverankpulse.com/ws`
- **Events**: Leaderboard updates, match results, player status changes
- **Authentication**: JWT token required in connection handshake

See WebSocket documentation (separate) for detailed information.

## Support and Resources

- **GitHub Repository**: https://github.com/yourusername/love-rank-pulse
- **Issue Tracker**: https://github.com/yourusername/love-rank-pulse/issues
- **Support Email**: support@loverankpulse.com

## Version History

- **v1.0.0** (2024-01-20): Initial API release
  - Player authentication and management
  - Match creation and result submission
  - Multi-scope leaderboards
  - ELO rating system
  - Real-time WebSocket updates
