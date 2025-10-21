# Love Rank Pulse Documentation

## Documentation Index

This directory contains comprehensive documentation for the Love Rank Pulse project's database and caching infrastructure.

---

## Quick Start

**New to the project?** Start here:
1. [Quick Start Guide](./quick-start-database.md) - Get up and running in 5 minutes
2. [Environment Variables](./environment-variables.md) - Configure your environment
3. [Database Setup](./database-setup.md) - Detailed setup instructions

---

## Core Documentation

### Setup & Configuration

- **[Quick Start Guide](./quick-start-database.md)**
  - 5-minute setup for local development
  - Common scenarios and workflows
  - Troubleshooting quick fixes

- **[Database Setup Guide](./database-setup.md)**
  - PostgreSQL installation and configuration
  - Redis installation and configuration
  - Connection pooling explained
  - Health checks and monitoring
  - Comprehensive troubleshooting

- **[Environment Variables Reference](./environment-variables.md)**
  - Complete variable listing
  - Configuration by environment
  - Security best practices
  - Example configurations

### Database Architecture

- **[Database Schema](./database-schema.md)**
  - Entity relationship diagrams
  - Table structures
  - Indexes and constraints
  - Performance optimizations

- **[Database Migrations](./database-migrations.md)**
  - Migration workflow
  - Best practices
  - Rollback procedures
  - Schema versioning

- **[Database Quick Reference](./database-quick-reference.md)**
  - Common queries
  - Prisma patterns
  - Performance tips

### Caching Layer

- **[Redis Cache Layer](./redis-cache-layer.md)**
  - Cache architecture
  - TTL strategies
  - Invalidation patterns
  - Performance optimization

- **[Cache Usage Example](./cache-usage-example.ts)**
  - Practical TypeScript examples
  - Integration patterns
  - Best practices

### DevOps

- **[Docker Setup](./docker-setup.md)**
  - Docker Compose configuration
  - Container orchestration
  - Development workflows
  - Production deployment

---

## File Structure

```
docs/
├── README.md                         # This file
├── quick-start-database.md           # Quick start guide
├── database-setup.md                 # Detailed database setup
├── environment-variables.md          # Environment variable reference
├── database-schema.md                # Schema documentation
├── database-migrations.md            # Migration guide
├── database-quick-reference.md       # Quick reference
├── redis-cache-layer.md             # Caching documentation
├── cache-usage-example.ts           # Cache examples
├── docker-setup.md                   # Docker configuration
└── schema-diagram.txt               # ASCII schema diagram
```

---

## Service Files

The main service implementations are located in `/src/services/`:

### Database Service (`database.ts`)
- Prisma client configuration
- Connection pooling
- Transaction management
- Health checks
- Retry logic

**Key Functions**:
```typescript
initializeDatabase()    // Initialize database connection
getPrismaClient()       // Get Prisma client instance
closeDatabase()         // Graceful shutdown
healthCheck()          // Database health check
withTransaction()      // Execute transaction with retry
```

### Cache Service (`cache.ts`)
- Redis client configuration
- Connection pooling
- Cache operations
- TTL management
- Invalidation patterns

**Key Functions**:
```typescript
initializeCache()       // Initialize Redis connection
getRedisClient()        // Get Redis client instance
closeCache()           // Graceful shutdown
cacheHealthCheck()     // Redis health check
setCache()             // Set cache value
getCache()             // Get cache value
cacheLeaderboard()     // Cache leaderboard data
getCachedLeaderboard() // Get cached leaderboard
invalidateEntityCache() // Invalidate cache pattern
```

### Health Check Service (`healthCheck.ts`)
- System-wide health monitoring
- Database health checks
- Cache health checks
- Express middleware

**Key Functions**:
```typescript
checkSystemHealth()         // Comprehensive health check
isSystemReady()            // Readiness probe
isSystemAlive()            // Liveness probe
createHealthCheckHandler() // Express middleware
```

---

## Quick Reference

### Environment Variables

**Development Minimum**:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/loverankpulse?schema=public
REDIS_URL=redis://localhost:6379/0
```

**Production Recommended**:
```env
DATABASE_URL=<production-database-url>
REDIS_URL=<production-redis-url>
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50
CACHE_TTL_LEADERBOARD=300
CACHE_TTL_PLAYER_STATS=600
NODE_ENV=production
```

### Common Commands

```bash
# Setup
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev

# Development
npm run dev
docker-compose up -d

# Database
npx prisma studio          # Database GUI
npx prisma migrate dev     # Create migration
npx prisma migrate deploy  # Apply migrations

# Testing
npm test
npm run test:e2e

# Production
npm run build
NODE_ENV=production npm start
```

### Health Check Endpoints

```bash
# System health
GET /health

# Readiness probe (K8s)
GET /ready

# Liveness probe (K8s)
GET /alive
```

---

## Architecture Overview

### Technology Stack

- **Database**: PostgreSQL 14+ (primary data store)
- **Cache**: Redis 6+ (in-memory cache)
- **ORM**: Prisma (database toolkit)
- **Client**: node-redis (Redis client)
- **Runtime**: Node.js 18+

### Connection Pooling

```
┌─────────────┐
│ Application │
└──────┬──────┘
       │
   ┌───▼───┐
   │ Pool  │  Min: 2-10 connections
   └───┬───┘  Max: 10-50 connections
       │
   ┌───▼───────┐
   │ Database  │
   │ (Postgres)│
   └───────────┘
```

### Cache Strategy

```
Request → Check Cache → Cache Hit? → Return Cached Data
                ↓ No
          Query Database → Cache Result → Return Data
```

---

## Performance Guidelines

### Database Connection Pool Sizing

**Formula**: `connections = (core_count × 2) + effective_spindle_count`

**Environments**:
- Development: 2-5 connections
- Staging: 5-20 connections
- Production: 10-50 connections

### Cache TTL Recommendations

**Real-time Data** (30s - 2min):
- Live leaderboards
- Active match data
- Session data

**Frequently Updated** (5-10min):
- Leaderboard rankings
- Player statistics
- Country rankings

**Stable Data** (15-60min):
- Historical data
- Profile information
- Configuration data

---

## Monitoring & Observability

### Metrics to Monitor

1. **Database**:
   - Connection pool utilization
   - Query response times
   - Failed connections
   - Active transactions

2. **Cache**:
   - Hit/miss ratio
   - Memory usage
   - Eviction rate
   - Connection errors

3. **Application**:
   - Response times
   - Error rates
   - Memory usage
   - CPU utilization

### Logging

**Development**:
```env
LOG_LEVEL=debug
LOG_FORMAT=text
```

**Production**:
```env
LOG_LEVEL=info
LOG_FORMAT=json
```

---

## Security Best Practices

1. **Use environment variables** for all secrets
2. **Rotate credentials** regularly
3. **Enable SSL/TLS** in production
4. **Implement rate limiting** on API endpoints
5. **Use prepared statements** to prevent SQL injection
6. **Restrict CORS origins** appropriately
7. **Enable security headers** (Helmet)
8. **Monitor access logs** for suspicious activity
9. **Backup databases** regularly
10. **Keep dependencies updated**

---

## Troubleshooting

### Common Issues

1. **Database connection failed**
   - Check if PostgreSQL is running
   - Verify DATABASE_URL is correct
   - Check network connectivity

2. **Redis connection failed**
   - Check if Redis is running
   - Verify REDIS_URL is correct
   - Check authentication credentials

3. **Connection pool exhausted**
   - Increase DATABASE_POOL_MAX
   - Optimize slow queries
   - Check for connection leaks

4. **Slow queries**
   - Add database indexes
   - Optimize query structure
   - Use caching for frequent queries

5. **High memory usage**
   - Check cache size limits
   - Review CACHE_TTL settings
   - Monitor for memory leaks

See [Database Setup Guide](./database-setup.md#troubleshooting) for detailed troubleshooting steps.

---

## Additional Resources

### External Documentation

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)
- [Redis Documentation](https://redis.io/documentation)
- [node-redis Documentation](https://github.com/redis/node-redis)

### Project Resources

- GitHub Repository: [Love Rank Pulse](https://github.com/your-org/love-rank-pulse)
- Issue Tracker: [GitHub Issues](https://github.com/your-org/love-rank-pulse/issues)
- Wiki: [Project Wiki](https://github.com/your-org/love-rank-pulse/wiki)

---

## Contributing

When updating documentation:

1. Keep examples up-to-date with code
2. Test all commands before documenting
3. Include troubleshooting tips
4. Add diagrams where helpful
5. Update this index when adding new docs

---

## Support

Need help? Try these resources:

1. Check the relevant documentation above
2. Search [GitHub Issues](https://github.com/your-org/love-rank-pulse/issues)
3. Ask in team chat
4. Contact the development team

---

**Last Updated**: 2025-10-21
