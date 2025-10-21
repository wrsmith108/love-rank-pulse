-- Love Rank Pulse - PostgreSQL Initialization Script
-- This script runs on first container startup

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create indexes for full-text search (if needed later)
-- This will be handled by Prisma migrations

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE loverank_db TO loverank;

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'Love Rank Pulse database initialized successfully';
END $$;
