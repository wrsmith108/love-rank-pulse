import { ApiResponse } from '@/api-gateway/types/api';
import { apiGateway } from '@/api-gateway/ApiGateway';
import { RequestContext } from '@/api-gateway/ApiGateway';

/**
 * Mock the API Gateway for testing
 */
export function mockApiGateway() {
  // Save original methods
  const originalHandleRequest = apiGateway.handleRequest;
  const originalRegisterRoute = apiGateway.registerRoute;
  const originalClearCache = apiGateway.clearCache;

  // Create mock implementations
  const mockHandleRequest = jest.fn().mockImplementation(async <T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    context: RequestContext
  ): Promise<ApiResponse<T>> => {
    return {
      success: true,
      data: {} as T,
      timestamp: new Date().toISOString()
    };
  });

  const mockRegisterRoute = jest.fn();
  const mockClearCache = jest.fn();

  // Apply mocks
  apiGateway.handleRequest = mockHandleRequest;
  apiGateway.registerRoute = mockRegisterRoute;
  apiGateway.clearCache = mockClearCache;

  // Return cleanup function
  return () => {
    apiGateway.handleRequest = originalHandleRequest;
    apiGateway.registerRoute = originalRegisterRoute;
    apiGateway.clearCache = originalClearCache;
  };
}

/**
 * Mock a successful API response
 * @param data The data to include in the response
 * @returns Mocked API response
 */
export function mockSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
}

/**
 * Mock an error API response
 * @param error The error message
 * @returns Mocked error API response
 */
export function mockErrorResponse<T>(error: string): ApiResponse<T> {
  return {
    success: false,
    error,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a mock request context for testing
 * @param isAuthenticated Whether the request is authenticated
 * @param userId Optional user ID for authenticated requests
 * @param params Optional request parameters
 * @param query Optional query parameters
 * @param body Optional request body
 * @returns Mock request context
 */
export function createMockRequestContext(
  isAuthenticated: boolean = false,
  userId?: string,
  params: Record<string, any> = {},
  query?: Record<string, any>,
  body?: any
): RequestContext {
  return {
    isAuthenticated,
    userId,
    requestId: 'test-request-id',
    timestamp: new Date(),
    params,
    query,
    body,
    token: isAuthenticated ? 'test-token' : undefined
  };
}