# Environment Variables Reference

## Quick Reference

This document provides a comprehensive reference for all environment variables used in Love Rank Pulse.

---

## Frontend Variables (Client-Side)

All frontend variables must be prefixed with `VITE_` to be accessible in the browser.

### API Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `VITE_API_URL` | string | `https://api.loverankpulse.com` | Base URL for API requests |
| `VITE_API_TIMEOUT` | number | `30000` | API request timeout in milliseconds |

### Authentication

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `VITE_AUTH_DOMAIN` | string | Yes | Authentication service domain |
| `VITE_AUTH_CLIENT_ID` | string | Yes | OAuth client ID |
| `VITE_AUTH_AUDIENCE` | string | Yes | OAuth API audience |

### Feature Flags

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `VITE_ENABLE_REAL_TIME_UPDATES` | boolean | `true` | Enable real-time leaderboard updates |
| `VITE_ENABLE_COUNTRY_LEADERBOARDS` | boolean | `true` | Enable country-specific leaderboards |
| `VITE_ENABLE_SESSION_LEADERBOARDS` | boolean | `true` | Enable session-based leaderboards |

---

## Backend Variables (Server-Side)

### Database Configuration

#### Connection

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `DATABASE_URL` | string | Yes | PostgreSQL connection string |
| `TEST_DATABASE_URL` | string | No | Test database connection string |

**Format**: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public`

**Example**: `postgresql://postgres:password@localhost:5432/loverankpulse?schema=public`

#### Connection Pool

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DATABASE_POOL_MIN` | number | `2` | Minimum connections in pool |
| `DATABASE_POOL_MAX` | number | `10` | Maximum connections in pool |
| `DATABASE_CONNECTION_TIMEOUT` | number | `20000` | Connection timeout (ms) |
| `DATABASE_IDLE_TIMEOUT` | number | `30000` | Idle connection timeout (ms) |
| `DATABASE_MAX_LIFETIME` | number | `1800000` | Max connection lifetime (ms) |

#### Performance

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DATABASE_STATEMENT_TIMEOUT` | number | `30000` | SQL statement timeout (ms) |
| `DATABASE_QUERY_TIMEOUT` | number | `15000` | Query execution timeout (ms) |
| `DATABASE_POOL_ACQUIRE_TIMEOUT` | number | `10000` | Pool acquisition timeout (ms) |

**Recommended Settings by Environment**:

```bash
# Development
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=5

# Staging
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# Production
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50
```

### Redis Configuration

#### Connection

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `REDIS_URL` | string | Yes | Redis connection string |
| `REDIS_PASSWORD` | string | No | Redis password (if required) |
| `TEST_REDIS_URL` | string | No | Test Redis connection string |

**Format**: `redis://USER:PASSWORD@HOST:PORT/DATABASE`

**Examples**:
- Local: `redis://localhost:6379/0`
- Upstash: `rediss://:password@endpoint.upstash.io:6379`

#### Connection Pool

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `REDIS_POOL_MIN` | number | `2` | Minimum connections |
| `REDIS_POOL_MAX` | number | `10` | Maximum connections |
| `REDIS_CONNECTION_TIMEOUT` | number | `5000` | Connection timeout (ms) |
| `REDIS_COMMAND_TIMEOUT` | number | `3000` | Command execution timeout (ms) |
| `REDIS_KEEP_ALIVE` | number | `30000` | Keep-alive interval (ms) |

#### Retry Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `REDIS_MAX_RETRIES` | number | `3` | Maximum retry attempts |
| `REDIS_RETRY_DELAY` | number | `100` | Initial retry delay (ms) |
| `REDIS_RECONNECT_DELAY` | number | `1000` | Reconnection delay (ms) |

### Cache Configuration

#### TTL Settings (in seconds)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `CACHE_TTL_LEADERBOARD` | number | `300` | Leaderboard cache TTL (5 minutes) |
| `CACHE_TTL_PLAYER_STATS` | number | `600` | Player stats cache TTL (10 minutes) |
| `CACHE_TTL_MATCH_DATA` | number | `120` | Match data cache TTL (2 minutes) |
| `CACHE_TTL_COUNTRY_STATS` | number | `900` | Country stats cache TTL (15 minutes) |
| `CACHE_TTL_SESSION_DATA` | number | `180` | Session data cache TTL (3 minutes) |

#### Cache Strategy

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `CACHE_STRATEGY` | string | `stale-while-revalidate` | Caching strategy |
| `CACHE_MAX_SIZE` | number | `1000` | Maximum cache entries |
| `CACHE_EVICTION_POLICY` | string | `lru` | Cache eviction policy |

---

## API Gateway Configuration

### Rate Limiting

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `RATE_LIMIT_WINDOW` | number | `60000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | number | `100` | Max requests per window |
| `RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS` | boolean | `false` | Skip successful requests in counting |

### Request Timeouts

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `API_REQUEST_TIMEOUT` | number | `30000` | API request timeout (ms) |
| `API_CONNECT_TIMEOUT` | number | `5000` | Connection timeout (ms) |

### Circuit Breaker

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `CIRCUIT_BREAKER_THRESHOLD` | number | `5` | Failure threshold to open circuit |
| `CIRCUIT_BREAKER_TIMEOUT` | number | `60000` | Circuit open duration (ms) |
| `CIRCUIT_BREAKER_RESET_TIMEOUT` | number | `30000` | Time before attempting reset (ms) |

---

## Security Configuration

### JWT Configuration

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `JWT_SECRET` | string | Yes | JWT signing secret (change in production!) |
| `JWT_EXPIRATION` | number | `86400` | JWT expiration time (seconds) |
| `JWT_REFRESH_EXPIRATION` | number | `604800` | Refresh token expiration (seconds) |

### CORS Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `CORS_ORIGIN` | string | `http://localhost:5173` | Allowed CORS origins (comma-separated) |
| `CORS_CREDENTIALS` | boolean | `true` | Allow credentials in CORS requests |

### Security Headers

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ENABLE_HELMET` | boolean | `true` | Enable Helmet security headers |
| `ENABLE_RATE_LIMITING` | boolean | `true` | Enable rate limiting |
| `ENABLE_COMPRESSION` | boolean | `true` | Enable response compression |

---

## Monitoring & Logging

### Logging

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LOG_LEVEL` | string | `info` | Logging level (`debug`, `info`, `warn`, `error`) |
| `LOG_FORMAT` | string | `json` | Log format (`json`, `text`) |
| `LOG_REQUESTS` | boolean | `true` | Log HTTP requests |
| `LOG_ERRORS` | boolean | `true` | Log errors |

### Metrics

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ENABLE_METRICS` | boolean | `true` | Enable metrics collection |
| `METRICS_PORT` | number | `9090` | Metrics server port |
| `METRICS_PATH` | string | `/metrics` | Metrics endpoint path |

### Health Checks

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `HEALTH_CHECK_ENABLED` | boolean | `true` | Enable health check endpoint |
| `HEALTH_CHECK_PATH` | string | `/health` | Health check endpoint path |
| `HEALTH_CHECK_INTERVAL` | number | `30000` | Health check interval (ms) |

---

## Deployment Configuration

### Environment Type

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NODE_ENV` | string | `development` | Node environment (`development`, `production`, `test`) |

### Server Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | number | `3000` | Server port |
| `HOST` | string | `0.0.0.0` | Server host |

### Vercel Configuration

These are automatically set by Vercel:

| Variable | Type | Description |
|----------|------|-------------|
| `VERCEL_ENV` | string | Deployment environment (`production`, `preview`, `development`) |
| `VERCEL_URL` | string | Deployment URL |
| `VERCEL_REGION` | string | Deployment region |

---

## Development & Testing

### Test Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `TEST_DATABASE_URL` | string | - | Test database connection string |
| `TEST_REDIS_URL` | string | - | Test Redis connection string |

### Mock Data

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ENABLE_MOCK_DATA` | boolean | `false` | Enable mock data in development |
| `MOCK_DELAY` | number | `100` | Simulated API delay (ms) |

### Debug Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DEBUG` | boolean | `false` | Enable debug mode |
| `VERBOSE_LOGGING` | boolean | `false` | Enable verbose logging |
| `ENABLE_PROFILING` | boolean | `false` | Enable performance profiling |

---

## Example Configurations

### Local Development (.env)

```env
# Frontend
VITE_API_URL=http://localhost:3000
VITE_ENABLE_REAL_TIME_UPDATES=true

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/loverankpulse?schema=public
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=5

# Redis
REDIS_URL=redis://localhost:6379/0

# Cache TTL (shorter for development)
CACHE_TTL_LEADERBOARD=60
CACHE_TTL_PLAYER_STATS=120

# Logging
LOG_LEVEL=debug
LOG_FORMAT=text

# Server
NODE_ENV=development
PORT=3000
```

### Production (.env.production)

```env
# Frontend
VITE_API_URL=https://api.loverankpulse.com
VITE_ENABLE_REAL_TIME_UPDATES=true

# Database (Vercel Postgres)
DATABASE_URL=postgresql://user:pass@db.region.postgres.vercel-storage.com/db
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50

# Redis (Upstash)
REDIS_URL=rediss://:password@endpoint.upstash.io:6379

# Cache TTL (optimized for production)
CACHE_TTL_LEADERBOARD=300
CACHE_TTL_PLAYER_STATS=600

# Security
JWT_SECRET=CHANGE_THIS_TO_A_SECURE_RANDOM_STRING
CORS_ORIGIN=https://loverankpulse.com

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Server
NODE_ENV=production
```

---

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use different secrets** for each environment
3. **Rotate JWT secrets** regularly in production
4. **Use strong passwords** for database connections
5. **Enable SSL/TLS** for production databases
6. **Restrict CORS origins** in production
7. **Use environment-specific** database credentials
8. **Enable rate limiting** to prevent abuse
9. **Set appropriate timeouts** to prevent resource exhaustion
10. **Monitor and rotate** API keys regularly

---

## Troubleshooting

### Common Issues

**Connection Pool Exhausted**:
```
Error: Timed out fetching a new connection from the pool
```
Solution: Increase `DATABASE_POOL_MAX` or optimize queries

**Redis Connection Failed**:
```
Error: Redis connection to localhost:6379 failed
```
Solution: Check `REDIS_URL` and ensure Redis is running

**JWT Verification Failed**:
```
Error: Invalid token
```
Solution: Ensure `JWT_SECRET` matches across all services

**CORS Error**:
```
Error: CORS policy blocked request
```
Solution: Add origin to `CORS_ORIGIN` environment variable

---

## Need Help?

- Review the [Database Setup Guide](./database-setup.md)
- Check the project's GitHub issues
- Contact the development team
