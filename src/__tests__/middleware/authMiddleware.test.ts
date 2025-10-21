import {
  extractAuthToken,
  authenticateRequest,
  checkPermission,
  requireAuth,
  requirePermission
} from '../../api-gateway/middleware/authMiddleware';
import { RequestContext } from '../../api-gateway/ApiGateway';

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

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('authMiddleware', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('extractAuthToken', () => {
    it('should extract token from valid Bearer header', () => {
      const mockUser = { id: 'user-123', username: 'testuser' };
      const mockToken = 'test-token-12345';

      localStorageMock.setItem('love-rank-pulse-token', mockToken);
      localStorageMock.setItem('love-rank-pulse-user', JSON.stringify(mockUser));

      const headers = {
        'authorization': 'Bearer test-token-12345'
      };

      const userId = extractAuthToken(headers);

      expect(userId).toBe('user-123');
    });

    it('should return undefined when authorization header missing', () => {
      const headers: Record<string, string> = {};

      const userId = extractAuthToken(headers);

      expect(userId).toBeUndefined();
    });

    it('should return undefined when authorization header does not start with Bearer', () => {
      const headers = {
        'authorization': 'Basic some-token'
      };

      const userId = extractAuthToken(headers);

      expect(userId).toBeUndefined();
    });

    it('should return undefined when token does not match stored token', () => {
      const mockUser = { id: 'user-123', username: 'testuser' };

      localStorageMock.setItem('love-rank-pulse-token', 'different-token');
      localStorageMock.setItem('love-rank-pulse-user', JSON.stringify(mockUser));

      const headers = {
        'authorization': 'Bearer test-token-12345'
      };

      const userId = extractAuthToken(headers);

      expect(userId).toBeUndefined();
    });

    it('should return undefined when stored user is missing', () => {
      localStorageMock.setItem('love-rank-pulse-token', 'test-token-12345');

      const headers = {
        'authorization': 'Bearer test-token-12345'
      };

      const userId = extractAuthToken(headers);

      expect(userId).toBeUndefined();
    });

    it('should return undefined when stored user is invalid JSON', () => {
      localStorageMock.setItem('love-rank-pulse-token', 'test-token-12345');
      localStorageMock.setItem('love-rank-pulse-user', 'invalid-json');

      const headers = {
        'authorization': 'Bearer test-token-12345'
      };

      const userId = extractAuthToken(headers);

      expect(userId).toBeUndefined();
    });
  });

  describe('authenticateRequest', () => {
    const baseContext: RequestContext = {
      requestId: 'req-123',
      timestamp: new Date(),
      isAuthenticated: false,
      params: {}
    };

    it('should authenticate request with valid token', () => {
      const mockUser = { id: 'user-123', username: 'testuser' };
      const mockToken = 'test-token-12345';

      localStorageMock.setItem('love-rank-pulse-token', mockToken);
      localStorageMock.setItem('love-rank-pulse-user', JSON.stringify(mockUser));

      const headers = {
        'authorization': 'Bearer test-token-12345'
      };

      const authenticatedContext = authenticateRequest(baseContext, headers);

      expect(authenticatedContext.isAuthenticated).toBe(true);
      expect(authenticatedContext.userId).toBe('user-123');
      expect(authenticatedContext.token).toBe('test-token-12345');
    });

    it('should not authenticate request with invalid token', () => {
      const headers: Record<string, string> = {};

      const authenticatedContext = authenticateRequest(baseContext, headers);

      expect(authenticatedContext.isAuthenticated).toBe(false);
      expect(authenticatedContext.userId).toBeUndefined();
      expect(authenticatedContext.token).toBeUndefined();
    });

    it('should preserve original context properties', () => {
      const headers: Record<string, string> = {};

      const authenticatedContext = authenticateRequest(baseContext, headers);

      expect(authenticatedContext.requestId).toBe('req-123');
      expect(authenticatedContext.timestamp).toBe(baseContext.timestamp);
    });
  });

  describe('checkPermission', () => {
    it('should allow access to own resources', () => {
      const hasPermission = checkPermission('user-123', '/players/user-123', 'read');

      expect(hasPermission).toBe(true);
    });

    it('should allow read access to leaderboards', () => {
      const hasPermission = checkPermission('user-123', '/leaderboards/global', 'read');

      expect(hasPermission).toBe(true);
    });

    it('should allow read access to matches', () => {
      const hasPermission = checkPermission('user-123', '/matches/match-123', 'read');

      expect(hasPermission).toBe(true);
    });

    it('should allow read access to other players', () => {
      const hasPermission = checkPermission('user-123', '/players/user-456', 'read');

      expect(hasPermission).toBe(true);
    });

    it('should deny write access to other players', () => {
      const hasPermission = checkPermission('user-123', '/players/user-456', 'write');

      expect(hasPermission).toBe(false);
    });

    it('should deny delete access to other players', () => {
      const hasPermission = checkPermission('user-123', '/players/user-456', 'delete');

      expect(hasPermission).toBe(false);
    });

    it('should allow write access to own resources', () => {
      const hasPermission = checkPermission('user-123', '/players/user-123/stats', 'write');

      expect(hasPermission).toBe(true);
    });
  });

  describe('requireAuth', () => {
    const authenticatedContext: RequestContext = {
      requestId: 'req-123',
      timestamp: new Date(),
      isAuthenticated: true,
      userId: 'user-123',
      params: {}
    };

    const unauthenticatedContext: RequestContext = {
      requestId: 'req-124',
      timestamp: new Date(),
      isAuthenticated: false,
      params: {}
    };

    it('should pass authenticated request', () => {
      const middleware = requireAuth(true);

      const result = middleware(authenticatedContext);

      expect(result).toEqual(authenticatedContext);
    });

    it('should throw error for unauthenticated request when auth required', () => {
      const middleware = requireAuth(true);

      expect(() => middleware(unauthenticatedContext)).toThrow('Authentication required');
    });

    it('should pass unauthenticated request when auth not required', () => {
      const middleware = requireAuth(false);

      const result = middleware(unauthenticatedContext);

      expect(result).toEqual(unauthenticatedContext);
    });

    it('should require auth by default', () => {
      const middleware = requireAuth();

      expect(() => middleware(unauthenticatedContext)).toThrow('Authentication required');
    });
  });

  describe('requirePermission', () => {
    const authenticatedContext: RequestContext = {
      requestId: 'req-123',
      timestamp: new Date(),
      isAuthenticated: true,
      userId: 'user-123',
      params: {}
    };

    const unauthenticatedContext: RequestContext = {
      requestId: 'req-124',
      timestamp: new Date(),
      isAuthenticated: false,
      params: {}
    };

    it('should pass when user has permission', () => {
      const middleware = requirePermission('/players/user-123', 'read');

      const result = middleware(authenticatedContext);

      expect(result).toEqual(authenticatedContext);
    });

    it('should throw error when user lacks permission', () => {
      const middleware = requirePermission('/players/user-456', 'delete');

      expect(() => middleware(authenticatedContext)).toThrow('Permission denied');
    });

    it('should throw error when user not authenticated', () => {
      const middleware = requirePermission('/players/user-123', 'read');

      expect(() => middleware(unauthenticatedContext)).toThrow('Authentication required');
    });

    it('should allow access to public resources', () => {
      const middleware = requirePermission('/leaderboards/global', 'read');

      const result = middleware(authenticatedContext);

      expect(result).toEqual(authenticatedContext);
    });

    it('should allow user to read own profile', () => {
      const middleware = requirePermission('/players/user-123', 'read');

      const result = middleware(authenticatedContext);

      expect(result).toEqual(authenticatedContext);
    });

    it('should allow user to write own profile', () => {
      const middleware = requirePermission('/players/user-123/profile', 'write');

      const result = middleware(authenticatedContext);

      expect(result).toEqual(authenticatedContext);
    });
  });
});
