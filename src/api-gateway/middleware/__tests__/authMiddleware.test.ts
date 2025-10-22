/**
 * @file authMiddleware.test.ts
 * @description Test suite for API Gateway authentication middleware
 *
 * Test Cases:
 * - TC-AUTH-001: Valid JWT token authentication
 * - TC-AUTH-002: Expired token rejection
 * - TC-AUTH-003: Malformed token handling
 * - TC-AUTH-004: Missing token response
 * - TC-AUTH-005: Invalid header format
 * - TC-AUTH-006: User context extraction
 * - TC-AUTH-007: Role-based access control
 */

import {
  extractAuthToken,
  authenticateRequest,
  checkPermission,
  requireAuth,
  requirePermission
} from '../authMiddleware';
import { RequestContext } from '../../ApiGateway';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('API Gateway Auth Middleware', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('TC-AUTH-001: Valid JWT token authentication', () => {
    it('should authenticate user with valid Bearer token', () => {
      // Arrange
      const mockUser = { id: 'user-123', username: 'validuser', email: 'valid@example.com' };
      const mockToken = 'valid-jwt-token-12345';

      localStorageMock.setItem('love-rank-pulse-token', mockToken);
      localStorageMock.setItem('love-rank-pulse-user', JSON.stringify(mockUser));

      const headers = {
        'authorization': `Bearer ${mockToken}`
      };

      // Act
      const userId = extractAuthToken(headers);

      // Assert
      expect(userId).toBe('user-123');
    });

    it('should extract complete user context from valid token', () => {
      // Arrange
      const mockUser = { id: 'user-456', username: 'testuser', role: 'player' };
      const mockToken = 'test-jwt-token';

      localStorageMock.setItem('love-rank-pulse-token', mockToken);
      localStorageMock.setItem('love-rank-pulse-user', JSON.stringify(mockUser));

      const baseContext: RequestContext = {
        requestId: 'req-001',
        timestamp: new Date(),
        isAuthenticated: false,
        params: {}
      };

      const headers = {
        'authorization': `Bearer ${mockToken}`
      };

      // Act
      const authenticatedContext = authenticateRequest(baseContext, headers);

      // Assert
      expect(authenticatedContext.isAuthenticated).toBe(true);
      expect(authenticatedContext.userId).toBe('user-456');
      expect(authenticatedContext.token).toBe(mockToken);
    });
  });

  describe('TC-AUTH-002: Expired token rejection', () => {
    it('should reject authentication when stored token does not match', () => {
      // Arrange
      const mockUser = { id: 'user-123', username: 'testuser' };
      localStorageMock.setItem('love-rank-pulse-token', 'expired-token');
      localStorageMock.setItem('love-rank-pulse-user', JSON.stringify(mockUser));

      const headers = {
        'authorization': 'Bearer different-token'
      };

      // Act
      const userId = extractAuthToken(headers);

      // Assert
      expect(userId).toBeUndefined();
    });

    it('should return unauthenticated context for expired token', () => {
      // Arrange
      const baseContext: RequestContext = {
        requestId: 'req-002',
        timestamp: new Date(),
        isAuthenticated: false,
        params: {}
      };

      const headers = {
        'authorization': 'Bearer expired-token'
      };

      // Act
      const authenticatedContext = authenticateRequest(baseContext, headers);

      // Assert
      expect(authenticatedContext.isAuthenticated).toBe(false);
      expect(authenticatedContext.userId).toBeUndefined();
    });
  });

  describe('TC-AUTH-003: Malformed token handling', () => {
    it('should reject malformed Bearer token', () => {
      // Arrange
      const headers = {
        'authorization': 'BearerMalformed'
      };

      // Act
      const userId = extractAuthToken(headers);

      // Assert
      expect(userId).toBeUndefined();
    });

    it('should handle invalid JSON in stored user data', () => {
      // Arrange
      const mockToken = 'test-token';
      localStorageMock.setItem('love-rank-pulse-token', mockToken);
      localStorageMock.setItem('love-rank-pulse-user', 'invalid-json{');

      const headers = {
        'authorization': `Bearer ${mockToken}`
      };

      // Act
      const userId = extractAuthToken(headers);

      // Assert
      expect(userId).toBeUndefined();
    });
  });

  describe('TC-AUTH-004: Missing token response', () => {
    it('should return undefined when authorization header is missing', () => {
      // Arrange
      const headers: Record<string, string> = {};

      // Act
      const userId = extractAuthToken(headers);

      // Assert
      expect(userId).toBeUndefined();
    });

    it('should return unauthenticated context when no token provided', () => {
      // Arrange
      const baseContext: RequestContext = {
        requestId: 'req-003',
        timestamp: new Date(),
        isAuthenticated: false,
        params: {}
      };

      const headers: Record<string, string> = {};

      // Act
      const authenticatedContext = authenticateRequest(baseContext, headers);

      // Assert
      expect(authenticatedContext.isAuthenticated).toBe(false);
      expect(authenticatedContext.token).toBeUndefined();
    });
  });

  describe('TC-AUTH-005: Invalid header format', () => {
    it('should reject non-Bearer authorization schemes', () => {
      // Arrange
      const headers = {
        'authorization': 'Basic dXNlcjpwYXNz'
      };

      // Act
      const userId = extractAuthToken(headers);

      // Assert
      expect(userId).toBeUndefined();
    });

    it('should reject empty Bearer token', () => {
      // Arrange
      const headers = {
        'authorization': 'Bearer '
      };

      // Act
      const userId = extractAuthToken(headers);

      // Assert
      expect(userId).toBeUndefined();
    });

    it('should reject authorization header with only Bearer', () => {
      // Arrange
      const headers = {
        'authorization': 'Bearer'
      };

      // Act
      const userId = extractAuthToken(headers);

      // Assert
      expect(userId).toBeUndefined();
    });
  });

  describe('TC-AUTH-006: User context extraction', () => {
    it('should preserve original context properties during authentication', () => {
      // Arrange
      const originalTimestamp = new Date('2024-01-01');
      const baseContext: RequestContext = {
        requestId: 'req-preserve-001',
        timestamp: originalTimestamp,
        isAuthenticated: false,
        params: { test: 'value' },
        query: { page: '1' },
        body: { data: 'test' }
      };

      const headers: Record<string, string> = {};

      // Act
      const authenticatedContext = authenticateRequest(baseContext, headers);

      // Assert
      expect(authenticatedContext.requestId).toBe('req-preserve-001');
      expect(authenticatedContext.timestamp).toBe(originalTimestamp);
      expect(authenticatedContext.params).toEqual({ test: 'value' });
      expect(authenticatedContext.query).toEqual({ page: '1' });
      expect(authenticatedContext.body).toEqual({ data: 'test' });
    });

    it('should extract user ID from valid authentication', () => {
      // Arrange
      const mockUser = { id: 'extracted-user-789', username: 'extracted' };
      const mockToken = 'extraction-token';

      localStorageMock.setItem('love-rank-pulse-token', mockToken);
      localStorageMock.setItem('love-rank-pulse-user', JSON.stringify(mockUser));

      const headers = {
        'authorization': `Bearer ${mockToken}`
      };

      // Act
      const userId = extractAuthToken(headers);

      // Assert
      expect(userId).toBe('extracted-user-789');
    });
  });

  describe('TC-AUTH-007: Role-based access control', () => {
    const authenticatedContext: RequestContext = {
      requestId: 'req-rbac-001',
      timestamp: new Date(),
      isAuthenticated: true,
      userId: 'user-rbac-123',
      params: {}
    };

    const unauthenticatedContext: RequestContext = {
      requestId: 'req-rbac-002',
      timestamp: new Date(),
      isAuthenticated: false,
      params: {}
    };

    it('should allow access to own player resources', () => {
      // Act & Assert
      expect(checkPermission('user-rbac-123', '/players/user-rbac-123', 'read')).toBe(true);
      expect(checkPermission('user-rbac-123', '/players/user-rbac-123/stats', 'write')).toBe(true);
      expect(checkPermission('user-rbac-123', '/players/user-rbac-123/profile', 'delete')).toBe(true);
    });

    it('should allow read access to public leaderboards', () => {
      // Act & Assert
      expect(checkPermission('user-rbac-123', '/leaderboards/global', 'read')).toBe(true);
      expect(checkPermission('user-rbac-123', '/leaderboards/country/US', 'read')).toBe(true);
    });

    it('should allow read access to matches', () => {
      // Act & Assert
      expect(checkPermission('user-rbac-123', '/matches/match-456', 'read')).toBe(true);
      expect(checkPermission('user-rbac-123', '/matches', 'read')).toBe(true);
    });

    it('should allow read access to other players profiles', () => {
      // Act & Assert
      expect(checkPermission('user-rbac-123', '/players/other-user', 'read')).toBe(true);
    });

    it('should deny write access to other players resources', () => {
      // Act & Assert
      expect(checkPermission('user-rbac-123', '/players/other-user', 'write')).toBe(false);
      expect(checkPermission('user-rbac-123', '/players/other-user/stats', 'delete')).toBe(false);
    });

    it('should require authentication for protected routes', () => {
      // Arrange
      const middleware = requireAuth(true);

      // Act & Assert
      expect(() => middleware(unauthenticatedContext)).toThrow('Authentication required');
      expect(middleware(authenticatedContext)).toEqual(authenticatedContext);
    });

    it('should enforce permission requirements', () => {
      // Arrange
      const allowedMiddleware = requirePermission('/players/user-rbac-123', 'read');
      const deniedMiddleware = requirePermission('/players/other-user', 'delete');

      // Act & Assert
      expect(allowedMiddleware(authenticatedContext)).toEqual(authenticatedContext);
      expect(() => deniedMiddleware(authenticatedContext)).toThrow('Permission denied');
    });

    it('should allow optional authentication', () => {
      // Arrange
      const middleware = requireAuth(false);

      // Act & Assert
      expect(middleware(unauthenticatedContext)).toEqual(unauthenticatedContext);
      expect(middleware(authenticatedContext)).toEqual(authenticatedContext);
    });
  });
});
