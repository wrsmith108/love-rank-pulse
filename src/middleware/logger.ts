import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';

/**
 * Environment configuration
 */
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';
const isProduction = NODE_ENV === 'production';

/**
 * Create logs directory if it doesn't exist
 */
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Create log file streams
 */
const accessLogStream = fs.createWriteStream(
  path.join(logsDir, 'access.log'),
  { flags: 'a' }
);

const errorLogStream = fs.createWriteStream(
  path.join(logsDir, 'error.log'),
  { flags: 'a' }
);

/**
 * Custom token for response time in milliseconds
 */
morgan.token('response-time-ms', (req: Request, res: Response) => {
  const responseTime = res.getHeader('X-Response-Time');
  return responseTime ? `${responseTime}ms` : '-';
});

/**
 * Custom token for user ID
 */
morgan.token('user-id', (req: Request) => {
  const user = (req as any).user;
  return user?.id || 'anonymous';
});

/**
 * Custom token for request ID (if using request ID middleware)
 */
morgan.token('request-id', (req: Request) => {
  return (req as any).id || '-';
});

/**
 * Development format - Colorful and detailed
 */
const devFormat = ':method :url :status :response-time ms - :res[content-length]';

/**
 * Production format - JSON format for log aggregation
 */
const prodFormat = JSON.stringify({
  timestamp: ':date[iso]',
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time',
  contentLength: ':res[content-length]',
  userId: ':user-id',
  userAgent: ':user-agent',
  remoteAddr: ':remote-addr'
});

/**
 * Combined format for file logging
 */
const combinedFormat = ':remote-addr - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms';

/**
 * Development logger - colorful console output
 */
export const devLogger = morgan(devFormat, {
  skip: (req: Request, res: Response) => {
    // Skip logging for health checks in development
    return req.path === '/health' || req.path === '/api/health';
  }
});

/**
 * Production logger - JSON format to file and console
 */
export const prodLogger = morgan(prodFormat, {
  stream: accessLogStream,
  skip: (req: Request, res: Response) => {
    // Skip logging for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

/**
 * Error logger - logs only errors (4xx and 5xx)
 */
export const errorLogger = morgan(combinedFormat, {
  stream: errorLogStream,
  skip: (req: Request, res: Response) => {
    // Only log errors
    return res.statusCode < 400;
  }
});

/**
 * Request logger middleware
 * Adds request timing and logging
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Add request ID if not present
  if (!(req as any).id) {
    (req as any).id = generateRequestId();
  }

  // Log request start in development
  if (isDevelopment) {
    console.log(`[${new Date().toISOString()}] --> ${req.method} ${req.path}`);
  }

  // Capture response finish event
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    res.setHeader('X-Response-Time', duration);

    // Log request completion in development
    if (isDevelopment) {
      const statusColor = res.statusCode >= 500 ? '\x1b[31m' : // red
                         res.statusCode >= 400 ? '\x1b[33m' : // yellow
                         res.statusCode >= 300 ? '\x1b[36m' : // cyan
                         '\x1b[32m'; // green

      console.log(
        `[${new Date().toISOString()}] <-- ${req.method} ${req.path} ` +
        `${statusColor}${res.statusCode}\x1b[0m ${duration}ms`
      );
    }
  });

  next();
};

/**
 * Structured logger utility
 */
export const logger = {
  info: (message: string, meta?: any) => {
    log('INFO', message, meta);
  },

  warn: (message: string, meta?: any) => {
    log('WARN', message, meta);
  },

  error: (message: string, error?: Error | any, meta?: any) => {
    log('ERROR', message, { ...meta, error: serializeError(error) });
  },

  debug: (message: string, meta?: any) => {
    if (isDevelopment) {
      log('DEBUG', message, meta);
    }
  }
};

/**
 * Log function
 */
function log(level: string, message: string, meta?: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };

  if (isProduction) {
    // Write to file in production
    const logMessage = JSON.stringify(logEntry) + '\n';

    if (level === 'ERROR') {
      fs.appendFileSync(path.join(logsDir, 'error.log'), logMessage);
    } else {
      fs.appendFileSync(path.join(logsDir, 'app.log'), logMessage);
    }
  }

  // Console output
  const levelColors: { [key: string]: string } = {
    INFO: '\x1b[36m',    // cyan
    WARN: '\x1b[33m',    // yellow
    ERROR: '\x1b[31m',   // red
    DEBUG: '\x1b[35m'    // magenta
  };

  const color = levelColors[level] || '\x1b[0m';
  const reset = '\x1b[0m';

  console.log(
    `${color}[${level}]${reset} ${logEntry.timestamp} - ${message}`,
    meta ? JSON.stringify(meta, null, 2) : ''
  );
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Serialize error object for logging
 */
function serializeError(error: Error | any): any {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return error;
}

/**
 * Main logger middleware - chooses appropriate logger based on environment
 */
export const httpLogger = isDevelopment ? devLogger : prodLogger;
