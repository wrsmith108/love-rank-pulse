import { ApiResponse, PaginatedApiResponse, PaginationMeta } from './types/api';

/**
 * API Gateway Configuration Interface
 */
export interface ApiGatewayConfig {
  enableCaching?: boolean;
  cacheTTL?: number; // Time to live in seconds
  defaultErrorMessage?: string;
  logRequests?: boolean;
}

/**
 * Route Handler Interface
 */
export interface RouteHandler<T = any, R = any> {
  (params: T): Promise<R> | R;
}

/**
 * Route Definition Interface
 */
export interface RouteDefinition<T = any, R = any> {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: RouteHandler<T, R>;
  requiresAuth?: boolean;
  cacheEnabled?: boolean;
  cacheTTL?: number; // Override default TTL
}

/**
 * Request Context Interface
 */
export interface RequestContext {
  userId?: string;
  isAuthenticated: boolean;
  token?: string;
  requestId: string;
  timestamp: Date;
  params: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
}

/**
 * API Gateway Class
 * 
 * Serves as a central entry point for all API requests,
 * handling routing, authentication, and error management.
 */
export class ApiGateway {
  private routes: Map<string, RouteDefinition> = new Map();
  private cache: Map<string, { data: ApiResponse<any>; expires: number }> = new Map();
  private config: ApiGatewayConfig;

  constructor(config: ApiGatewayConfig = {}) {
    this.config = {
      enableCaching: true,
      cacheTTL: 300, // 5 minutes default
      defaultErrorMessage: 'An unexpected error occurred',
      logRequests: true,
      ...config
    };
  }

  /**
   * Register a new route
   * @param route The route definition to register
   */
  registerRoute<T = any, R = any>(route: RouteDefinition<T, R>): void {
    const routeKey = `${route.method}:${route.path}`;
    this.routes.set(routeKey, route);
  }

  /**
   * Register multiple routes at once
   * @param routes Array of route definitions to register
   */
  registerRoutes(routes: RouteDefinition[]): void {
    routes.forEach(route => this.registerRoute(route));
  }

  /**
   * Handle an API request
   * @param path The request path
   * @param method The HTTP method
   * @param context The request context
   * @returns API response
   */
  async handleRequest<T = any>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    context: RequestContext
  ): Promise<ApiResponse<T>> {
    const routeKey = `${method}:${path}`;
    const route = this.routes.get(routeKey);

    if (!route) {
      return this.createErrorResponse('Route not found', 404);
    }

    // Check authentication if required
    if (route.requiresAuth && !context.isAuthenticated) {
      return this.createErrorResponse('Authentication required', 401);
    }

    // Check cache if enabled
    if (
      method === 'GET' &&
      this.config.enableCaching &&
      route.cacheEnabled !== false
    ) {
      const cacheKey = this.generateCacheKey(path, context);
      const cachedResponse = this.getFromCache<T>(cacheKey);
      
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    try {
      // Log request if enabled
      if (this.config.logRequests) {
        console.log(`[API Gateway] ${method} ${path}`, {
          requestId: context.requestId,
          userId: context.userId || 'anonymous',
          timestamp: context.timestamp
        });
      }

      // Execute route handler
      const result = await route.handler(context.params);
      
      // Create success response
      const response = this.createSuccessResponse<T>(result);
      
      // Cache response if applicable
      if (
        method === 'GET' &&
        this.config.enableCaching &&
        route.cacheEnabled !== false
      ) {
        const ttl = route.cacheTTL || this.config.cacheTTL;
        const cacheKey = this.generateCacheKey(path, context);
        this.addToCache(cacheKey, response, ttl);
      }
      
      return response;
    } catch (error) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : this.config.defaultErrorMessage;
      return this.createErrorResponse(errorMessage);
    }
  }

  /**
   * Create a success API response
   * @param data The response data
   * @returns Formatted API response
   */
  createSuccessResponse<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create a paginated API response
   * @param data The response data array
   * @param pagination The pagination metadata
   * @returns Formatted paginated API response
   */
  createPaginatedResponse<T>(
    data: T[],
    pagination: PaginationMeta
  ): PaginatedApiResponse<T> {
    return {
      success: true,
      data,
      pagination,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create an error API response
   * @param error The error message
   * @param statusCode Optional HTTP status code
   * @returns Formatted error API response
   */
  createErrorResponse<T = any>(
    error: string = this.config.defaultErrorMessage!,
    statusCode: number = 500
  ): ApiResponse<T> {
    return {
      success: false,
      error,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate a cache key for a request
   * @param path The request path
   * @param context The request context
   * @returns Cache key string
   */
  private generateCacheKey(path: string, context: RequestContext): string {
    // Include user ID in cache key if authenticated to ensure user-specific data is properly cached
    const userPart = context.isAuthenticated ? `user:${context.userId}` : 'anonymous';
    
    // Include query params in cache key
    const queryPart = context.query 
      ? Object.entries(context.query)
          .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
          .map(([key, value]) => `${key}=${value}`)
          .join('&')
      : '';
    
    return `${path}:${userPart}${queryPart ? `:${queryPart}` : ''}`;
  }

  /**
   * Add a response to the cache
   * @param key The cache key
   * @param data The data to cache
   * @param ttl Time to live in seconds
   */
  private addToCache<T>(key: string, data: ApiResponse<T>, ttl: number): void {
    const expires = Date.now() + ttl * 1000;
    this.cache.set(key, { data, expires });
  }

  /**
   * Get a response from the cache
   * @param key The cache key
   * @returns Cached response or undefined if not found or expired
   */
  private getFromCache<T>(key: string): ApiResponse<T> | undefined {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return undefined;
    }
    
    // Check if cache entry has expired
    if (cached.expires < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    
    return cached.data as ApiResponse<T>;
  }

  /**
   * Clear the entire cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear specific cache entries by path prefix
   * @param pathPrefix The path prefix to match
   */
  clearCacheByPath(pathPrefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pathPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear cache entries for a specific user
   * @param userId The user ID
   */
  clearCacheForUser(userId: string): void {
    const userPattern = `user:${userId}`;
    
    for (const key of this.cache.keys()) {
      if (key.includes(userPattern)) {
        this.cache.delete(key);
      }
    }
  }
}

// Create and export a singleton instance
export const apiGateway = new ApiGateway();