import { apiGateway, RequestContext } from './ApiGateway';
import { registerAllRoutes } from './routes';
import { createRequestContext, normalizeQueryParams, logRequest } from './middleware/requestMiddleware';
import { authenticateRequest } from './middleware/authMiddleware';
import { handleApiError } from './middleware/errorMiddleware';
import { ApiResponse, PaginatedApiResponse } from './types/api';
import { v4 as uuidv4 } from 'uuid';

// Security middleware exports
export {
  applySecurityMiddleware,
  applyMinimalSecurityMiddleware,
  applyProductionSecurityMiddleware,
  applyStrictSecurityMiddleware,
  getSecurityMiddlewareStack
} from './middleware/securityOrchestrator';

export {
  createRateLimiter,
  defaultRateLimiter,
  strictRateLimiter,
  lenientRateLimiter,
  uploadRateLimiter
} from './middleware/rateLimitMiddleware';

export {
  createSecurityMiddleware,
  getSecurityMiddleware
} from './middleware/securityMiddleware';

export {
  createCorsMiddleware,
  getCorsMiddleware
} from './middleware/corsMiddleware';

export {
  createLoggingMiddleware,
  getLoggingMiddleware,
  logError as logApiError,
  logAccess
} from './middleware/loggingMiddleware';

export {
  errorHandlerMiddleware,
  notFoundMiddleware,
  asyncHandler
} from './middleware/errorMiddleware';

/**
 * API Gateway Service
 *
 * Main entry point for all frontend API requests.
 * Handles routing, authentication, error handling, and security.
 *
 * Security Features:
 * - Rate limiting (100 requests per 15 minutes per IP)
 * - Security headers (Helmet)
 * - CORS configuration
 * - Request logging (Morgan)
 * - Global error handling
 * - Request ID tracking
 * - Response time monitoring
 */

// Initialize the API Gateway by registering all routes
registerAllRoutes();

/**
 * Process an API request through the gateway
 * @param path API endpoint path
 * @param method HTTP method
 * @param params Request parameters
 * @param headers Request headers
 * @param body Request body
 * @returns API response
 */
export async function processRequest<T = any>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  params: Record<string, any> = {},
  headers: Record<string, string> = {},
  body?: any,
  query?: Record<string, any>
): Promise<ApiResponse<T>> {
  try {
    // Create request context
    let context = createRequestContext(params, normalizeQueryParams(query), body);
    
    // Authenticate request
    context = authenticateRequest(context, headers);
    
    // Log request
    logRequest(context, path, method);
    
    // Process request through API Gateway
    return await apiGateway.handleRequest<T>(path, method, context);
  } catch (error) {
    // Handle any errors
    return handleApiError<T>(error);
  }
}

/**
 * Clear the API Gateway cache
 * @param path Optional path prefix to clear specific cache entries
 * @param userId Optional user ID to clear cache for a specific user
 */
export function clearCache(path?: string, userId?: string): void {
  if (path) {
    apiGateway.clearCacheByPath(path);
  } else if (userId) {
    apiGateway.clearCacheForUser(userId);
  } else {
    apiGateway.clearCache();
  }
}

// Export types and utilities
export type { ApiResponse, PaginatedApiResponse } from './types/api';
export { ApiErrors } from './middleware/errorMiddleware';

// Export the API Gateway instance for direct access if needed
export { apiGateway };