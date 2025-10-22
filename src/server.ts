import express, { Application } from 'express';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';

// Middleware imports
import { applySecurity } from './middleware/security';
import { httpLogger, requestLogger } from './middleware/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Routes import
import routes from './routes';

// WebSocket import
import { initializeWebSocketServer } from './websocket/server';

/**
 * Environment configuration with validation
 */
const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0 && NODE_ENV === 'production') {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

/**
 * Initialize Express application
 */
const app: Application = express();

/**
 * Initialize Prisma Client
 */
const prisma = new PrismaClient({
  log: NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

/**
 * Middleware chain - ORDER MATTERS!
 */

// 1. Security headers (must be first)
app.use(applySecurity);

// 2. Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Request logging
app.use(httpLogger);
app.use(requestLogger);

// 4. API Routes
app.use('/api', routes);

// 5. Root health check
app.get('/', (req, res) => {
  res.json({
    service: 'Love Rank Pulse API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 6. 404 handler (after all routes)
app.use(notFoundHandler);

// 7. Global error handler (must be last)
app.use(errorHandler);

/**
 * Start server
 */
const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✓ Database connected successfully');

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize WebSocket server
    const io = initializeWebSocketServer(httpServer);
    console.log('✓ WebSocket server initialized');

    // Start listening
    httpServer.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`🚀 Love Rank Pulse API Server`);
      console.log('='.repeat(50));
      console.log(`Environment: ${NODE_ENV}`);
      console.log(`HTTP Server: http://localhost:${PORT}`);
      console.log(`WebSocket Server: ws://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log(`API Base URL: http://localhost:${PORT}/api`);
      console.log('='.repeat(50));
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);

      // Close HTTP server
      httpServer.close(async () => {
        console.log('HTTP server closed');

        // Close WebSocket connections
        const { getWebSocketServer } = await import('./websocket/server');
        await getWebSocketServer().shutdown();
        console.log('WebSocket server closed');

        // Disconnect Prisma
        await prisma.$disconnect();
        console.log('Database disconnected');

        console.log('Shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
if (require.main === module) {
  startServer();
}

export { app, prisma };
