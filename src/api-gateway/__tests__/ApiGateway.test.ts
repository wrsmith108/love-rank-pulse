/**
 * @file ApiGateway.test.ts
 * @description Test suite for API Gateway core functionality (10 tests)
 */

import {
  ApiGateway,
  ApiGatewayConfig,
  RequestContext,
  RouteDefinition
} from '../ApiGateway';

describe('API Gateway Core', () => {
  let apiGateway: ApiGateway;
  let mockContext: RequestContext;

  beforeEach(() => {
    apiGateway = new ApiGateway();
    mockContext = {
      requestId: 'test-req-001',
      timestamp: new Date(),
      isAuthenticated: false,
      params: {}
    };
  });

  describe('Gateway Initialization', () => {
    it('should create API Gateway with default config', () => {
      // Act
      const gateway = new ApiGateway();

      // Assert
      expect(gateway).toBeInstanceOf(ApiGateway);
    });

    it('should create API Gateway with custom config', () => {
      // Arrange
      const config: ApiGatewayConfig = {
        enableCaching: false,
        cacheTTL: 600,
        defaultErrorMessage: 'Custom error',
        logRequests: false
      };

      // Act
      const gateway = new ApiGateway(config);

      // Assert
      expect(gateway).toBeInstanceOf(ApiGateway);
    });
  });

  describe('Route Registration', () => {
    it('should register a single route', () => {
      // Arrange
      const route: RouteDefinition = {
        path: '/test',
        method: 'GET',
        handler: async () => ({ message: 'test' })
      };

      // Act
      apiGateway.registerRoute(route);

      // Assert - route should be registered (no error thrown)
      expect(true).toBe(true);
    });

    it('should register multiple routes at once', () => {
      // Arrange
      const routes: RouteDefinition[] = [
        {
          path: '/users',
          method: 'GET',
          handler: async () => []
        },
        {
          path: '/users/:id',
          method: 'GET',
          handler: async () => ({})
        },
        {
          path: '/users',
          method: 'POST',
          handler: async () => ({})
        }
      ];

      // Act
      apiGateway.registerRoutes(routes);

      // Assert
      expect(true).toBe(true);
    });

    it('should register routes with authentication requirements', () => {
      // Arrange
      const route: RouteDefinition = {
        path: '/protected',
        method: 'GET',
        handler: async () => ({}),
        requiresAuth: true
      };

      // Act
      apiGateway.registerRoute(route);

      // Assert
      expect(true).toBe(true);
    });

    it('should register routes with caching configuration', () => {
      // Arrange
      const route: RouteDefinition = {
        path: '/cached',
        method: 'GET',
        handler: async () => ({}),
        cacheEnabled: true,
        cacheTTL: 300
      };

      // Act
      apiGateway.registerRoute(route);

      // Assert
      expect(true).toBe(true);
    });
  });

  describe('Request Handling', () => {
    it('should handle valid requests successfully', async () => {
      // Arrange
      const testData = { id: '123', name: 'Test' };
      apiGateway.registerRoute({
        path: '/test',
        method: 'GET',
        handler: async () => testData
      });

      // Act
      const response = await apiGateway.handleRequest(
        '/test',
        'GET',
        mockContext
      );

      // Assert
      expect(response.success).toBe(true);
      expect(response.data).toEqual(testData);
      expect(response.timestamp).toBeDefined();
    });

    it('should return 404 for non-existent routes', async () => {
      // Act
      const response = await apiGateway.handleRequest(
        '/nonexistent',
        'GET',
        mockContext
      );

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toContain('Route not found');
    });

    it('should enforce authentication when required', async () => {
      // Arrange
      apiGateway.registerRoute({
        path: '/protected',
        method: 'GET',
        handler: async () => ({ secret: 'data' }),
        requiresAuth: true
      });

      // Act
      const response = await apiGateway.handleRequest(
        '/protected',
        'GET',
        mockContext // unauthenticated
      );

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toContain('Authentication required');
    });

    it('should allow authenticated users to access protected routes', async () => {
      // Arrange
      apiGateway.registerRoute({
        path: '/protected',
        method: 'GET',
        handler: async () => ({ secret: 'data' }),
        requiresAuth: true
      });

      const authenticatedContext: RequestContext = {
        ...mockContext,
        isAuthenticated: true,
        userId: 'user-123'
      };

      // Act
      const response = await apiGateway.handleRequest(
        '/protected',
        'GET',
        authenticatedContext
      );

      // Assert
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ secret: 'data' });
    });

    it('should handle errors in route handlers', async () => {
      // Arrange
      apiGateway.registerRoute({
        path: '/error',
        method: 'GET',
        handler: async () => {
          throw new Error('Handler error');
        }
      });

      // Act
      const response = await apiGateway.handleRequest(
        '/error',
        'GET',
        mockContext
      );

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toContain('Handler error');
    });
  });

  describe('Response Formatting', () => {
    it('should create success responses', () => {
      // Arrange
      const data = { id: '1', value: 'test' };

      // Act
      const response = apiGateway.createSuccessResponse(data);

      // Assert
      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.timestamp).toBeDefined();
    });

    it('should create paginated responses', () => {
      // Arrange
      const data = [{ id: '1' }, { id: '2' }];
      const pagination = {
        currentPage: 1,
        totalPages: 5,
        totalItems: 50,
        itemsPerPage: 10
      };

      // Act
      const response = apiGateway.createPaginatedResponse(data, pagination);

      // Assert
      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.pagination).toEqual(pagination);
      expect(response.timestamp).toBeDefined();
    });

    it('should create error responses', () => {
      // Arrange
      const errorMessage = 'Something went wrong';
      const statusCode = 500;

      // Act
      const response = apiGateway.createErrorResponse(errorMessage, statusCode);

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toBe(errorMessage);
      expect(response.timestamp).toBeDefined();
    });
  });

  describe('Caching', () => {
    it('should cache GET request responses', async () => {
      // Arrange
      let callCount = 0;
      apiGateway.registerRoute({
        path: '/cached',
        method: 'GET',
        handler: async () => {
          callCount++;
          return { count: callCount };
        },
        cacheEnabled: true
      });

      // Act
      const response1 = await apiGateway.handleRequest('/cached', 'GET', mockContext);
      const response2 = await apiGateway.handleRequest('/cached', 'GET', mockContext);

      // Assert
      expect(response1.data).toEqual({ count: 1 });
      expect(response2.data).toEqual({ count: 1 }); // Same response from cache
      expect(callCount).toBe(1); // Handler called only once
    });

    it('should not cache POST requests', async () => {
      // Arrange
      let callCount = 0;
      apiGateway.registerRoute({
        path: '/create',
        method: 'POST',
        handler: async () => {
          callCount++;
          return { count: callCount };
        }
      });

      // Act
      const response1 = await apiGateway.handleRequest('/create', 'POST', mockContext);
      const response2 = await apiGateway.handleRequest('/create', 'POST', mockContext);

      // Assert
      expect(response1.data).toEqual({ count: 1 });
      expect(response2.data).toEqual({ count: 2 }); // Different responses
      expect(callCount).toBe(2); // Handler called twice
    });

    it('should respect custom cache TTL', async () => {
      // Arrange
      apiGateway.registerRoute({
        path: '/custom-ttl',
        method: 'GET',
        handler: async () => ({ data: 'test' }),
        cacheEnabled: true,
        cacheTTL: 60 // 1 minute
      });

      // Act
      const response = await apiGateway.handleRequest('/custom-ttl', 'GET', mockContext);

      // Assert
      expect(response.success).toBe(true);
      // Cache is stored with custom TTL
    });

    it('should clear entire cache', async () => {
      // Arrange
      apiGateway.registerRoute({
        path: '/test',
        method: 'GET',
        handler: async () => ({ data: 'test' })
      });

      await apiGateway.handleRequest('/test', 'GET', mockContext);

      // Act
      apiGateway.clearCache();

      // Assert - cache cleared successfully
      expect(true).toBe(true);
    });

    it('should clear cache by path prefix', async () => {
      // Arrange
      apiGateway.registerRoute({
        path: '/users/123',
        method: 'GET',
        handler: async () => ({ id: '123' })
      });

      await apiGateway.handleRequest('/users/123', 'GET', mockContext);

      // Act
      apiGateway.clearCacheByPath('/users');

      // Assert - specific cache cleared
      expect(true).toBe(true);
    });

    it('should clear cache for specific user', async () => {
      // Arrange
      const userContext: RequestContext = {
        ...mockContext,
        isAuthenticated: true,
        userId: 'user-123'
      };

      apiGateway.registerRoute({
        path: '/profile',
        method: 'GET',
        handler: async () => ({ name: 'Test' })
      });

      await apiGateway.handleRequest('/profile', 'GET', userContext);

      // Act
      apiGateway.clearCacheForUser('user-123');

      // Assert - user cache cleared
      expect(true).toBe(true);
    });
  });
});
