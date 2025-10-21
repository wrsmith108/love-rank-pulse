# Docker Infrastructure Setup

This document describes the Docker infrastructure for Love Rank Pulse, including PostgreSQL database and Redis cache services.

## Services

### Core Services

#### 1. PostgreSQL Database
- **Image**: `postgres:15-alpine`
- **Container Name**: `love-rank-pulse-postgres`
- **Port**: 5432 (configurable via `POSTGRES_PORT`)
- **Default Credentials**:
  - User: `loverank`
  - Password: `loverank_dev_password`
  - Database: `loverank_db`
- **Features**:
  - Data persistence via named volume
  - Health checks (10s interval)
  - Automatic schema initialization from `/src/api-gateway/database/init`
  - JSON logging with rotation

#### 2. Redis Cache
- **Image**: `redis:7-alpine`
- **Container Name**: `love-rank-pulse-redis`
- **Port**: 6379 (configurable via `REDIS_PORT`)
- **Default Password**: `redis_dev_password`
- **Features**:
  - AOF (Append Only File) persistence enabled
  - Data persistence via named volume
  - Health checks (10s interval)
  - Password authentication
  - JSON logging with rotation

### Development Tools (Optional)

#### 3. PgAdmin (Database Management)
- **Image**: `dpage/pgadmin4:latest`
- **Container Name**: `love-rank-pulse-pgadmin`
- **Port**: 5050 (configurable via `PGADMIN_PORT`)
- **Profile**: `dev` (only runs with `--profile dev`)
- **Access**: http://localhost:5050
- **Default Credentials**:
  - Email: `admin@loverank.local`
  - Password: `admin`

#### 4. Redis Commander (Redis Management)
- **Image**: `rediscommander/redis-commander:latest`
- **Container Name**: `love-rank-pulse-redis-commander`
- **Port**: 8081 (configurable via `REDIS_COMMANDER_PORT`)
- **Profile**: `dev` (only runs with `--profile dev`)
- **Access**: http://localhost:8081

## Quick Start

### 1. Start Core Services
```bash
# Start PostgreSQL and Redis
docker-compose up -d

# View logs
docker-compose logs -f
```

### 2. Start with Development Tools
```bash
# Start all services including PgAdmin and Redis Commander
docker-compose --profile dev up -d

# View logs
docker-compose --profile dev logs -f
```

### 3. Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v
```

## Environment Configuration

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

### Required Variables
```env
# PostgreSQL
POSTGRES_USER=loverank
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=loverank_db
POSTGRES_PORT=5432

# Redis
REDIS_PASSWORD=your_redis_password
REDIS_PORT=6379
```

### Optional Variables (Dev Tools)
```env
# PgAdmin
PGADMIN_EMAIL=admin@loverank.local
PGADMIN_PASSWORD=admin
PGADMIN_PORT=5050

# Redis Commander
REDIS_COMMANDER_PORT=8081
```

## Health Checks

All services include health checks for monitoring:

### PostgreSQL
```bash
docker-compose exec postgres pg_isready -U loverank -d loverank_db
```

### Redis
```bash
docker-compose exec redis redis-cli --raw incr ping
```

## Data Persistence

### Named Volumes
- `love-rank-postgres-data`: PostgreSQL data
- `love-rank-redis-data`: Redis data
- `love-rank-pgadmin-data`: PgAdmin settings

### Backup PostgreSQL
```bash
docker-compose exec postgres pg_dump -U loverank loverank_db > backup.sql
```

### Restore PostgreSQL
```bash
cat backup.sql | docker-compose exec -T postgres psql -U loverank -d loverank_db
```

### Backup Redis
```bash
docker-compose exec redis redis-cli --rdb /data/backup.rdb
docker cp love-rank-pulse-redis:/data/backup.rdb ./redis-backup.rdb
```

## Network Configuration

Services communicate via `love-rank-network`:
- **Driver**: Bridge
- **Subnet**: 172.28.0.0/16
- **DNS**: Automatic service discovery by container name

### Connection Strings

#### From Host Machine
- PostgreSQL: `postgresql://loverank:loverank_dev_password@localhost:5432/loverank_db`
- Redis: `redis://:redis_dev_password@localhost:6379`

#### From Docker Containers
- PostgreSQL: `postgresql://loverank:loverank_dev_password@postgres:5432/loverank_db`
- Redis: `redis://:redis_dev_password@redis:6379`

## Logging

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis

# Last 100 lines
docker-compose logs --tail=100 postgres
```

### Log Rotation
- Core services: Max 10MB per file, 3 files
- Dev tools: Max 5MB per file, 2 files

## Troubleshooting

### PostgreSQL Connection Issues
```bash
# Check if service is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart service
docker-compose restart postgres

# Test connection
docker-compose exec postgres psql -U loverank -d loverank_db -c "SELECT 1;"
```

### Redis Connection Issues
```bash
# Check if service is running
docker-compose ps redis

# Check logs
docker-compose logs redis

# Restart service
docker-compose restart redis

# Test connection
docker-compose exec redis redis-cli -a redis_dev_password ping
```

### Port Conflicts
If ports are already in use, modify in `.env`:
```env
POSTGRES_PORT=5433
REDIS_PORT=6380
PGADMIN_PORT=5051
REDIS_COMMANDER_PORT=8082
```

## Production Considerations

### Security
1. **Change default passwords** in `.env`
2. **Disable dev tools** (don't use `--profile dev` in production)
3. **Use secrets management** (Docker secrets, AWS Secrets Manager, etc.)
4. **Restrict network access** via firewall rules

### Performance
1. **Tune PostgreSQL** settings in `postgresql.conf`
2. **Configure Redis** memory limits and eviction policies
3. **Monitor resource usage** with docker stats
4. **Set resource limits** in docker-compose.yml

### Monitoring
```bash
# Resource usage
docker stats love-rank-pulse-postgres love-rank-pulse-redis

# Health status
docker inspect --format='{{json .State.Health}}' love-rank-pulse-postgres | jq
docker inspect --format='{{json .State.Health}}' love-rank-pulse-redis | jq
```

## Integration with Application

### Backend API Connection
Update your backend configuration to use:
```javascript
// PostgreSQL
const dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'loverank_db',
  user: process.env.POSTGRES_USER || 'loverank',
  password: process.env.POSTGRES_PASSWORD,
};

// Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
};
```

### Docker Compose Override
For local development, create `docker-compose.override.yml`:
```yaml
version: '3.8'
services:
  postgres:
    ports:
      - "5432:5432"
  redis:
    ports:
      - "6379:6379"
```

## Next Steps

1. Initialize database schema (see Backend API documentation)
2. Configure application connection strings
3. Set up database migrations
4. Implement connection pooling in backend
5. Configure Redis caching strategies
