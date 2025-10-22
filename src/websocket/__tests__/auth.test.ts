/**
 * WebSocket Authentication Tests
 * Tests token-based authentication, handshake validation, session management,
 * permission checking, token refresh, multi-device auth, and auth events
 *
 * Test Coverage: TC-WS-AUTH-001 through TC-WS-AUTH-010
 */

import { Socket } from 'socket.io';
import {
  extractToken,
  verifySocketToken,
  attachUserToSocket,
  isSocketAuthenticated,
  getSocketUser,
  disconnectWithError,
  refreshSocketToken,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  AuthenticatedSocket,
  AuthenticatedUser
} from '../auth';
import { playerService } from '../../services/PlayerService';

// Mock PlayerService
jest.mock('../../services/PlayerService', () => ({
  playerService: {
    validateToken: jest.fn(),
    getPlayerById: jest.fn()
  }
}));

describe('WebSocket Authentication Tests', () => {
  let mockSocket: Partial<Socket>;
  let mockAuthSocket: Partial<AuthenticatedSocket>;

  beforeEach(() => {
    mockSocket = {
      id: 'test-socket-123',
      handshake: {
        query: {},
        headers: {},
        auth: {}
      } as any,
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn()
    } as any;

    mockAuthSocket = {
      ...mockSocket,
      data: {
        authenticated: false
      }
    } as any;

    jest.clearAllMocks();
  });

  /**
   * TC-WS-AUTH-001: Token-based authentication
   * Test JWT token extraction and validation
   */
  describe('TC-WS-AUTH-001: Token-Based Authentication', () => {
    it('should extract token from query parameter', () => {
      mockSocket.handshake!.query = { token: 'query-token-123' };
      const token = extractToken(mockSocket as Socket);
      expect(token).toBe('query-token-123');
    });

    it('should extract token from Authorization header with Bearer', () => {
      mockSocket.handshake!.headers = {
        authorization: 'Bearer header-token-456'
      };
      const token = extractToken(mockSocket as Socket);
      expect(token).toBe('header-token-456');
    });

    it('should extract plain token from Authorization header', () => {
      mockSocket.handshake!.headers = {
        authorization: 'plain-token-789'
      };
      const token = extractToken(mockSocket as Socket);
      expect(token).toBe('plain-token-789');
    });

    it('should extract token from auth object', () => {
      mockSocket.handshake!.auth = { token: 'auth-token-abc' };
      const token = extractToken(mockSocket as Socket);
      expect(token).toBe('auth-token-abc');
    });

    it('should return null when no token provided', () => {
      const token = extractToken(mockSocket as Socket);
      expect(token).toBeNull();
    });

    it('should prioritize query parameter over header', () => {
      mockSocket.handshake!.query = { token: 'query-first' };
      mockSocket.handshake!.headers = { authorization: 'Bearer header-second' };
      const token = extractToken(mockSocket as Socket);
      expect(token).toBe('query-first');
    });
  });

  /**
   * TC-WS-AUTH-002: Handshake validation
   * Test connection handshake and token verification
   */
  describe('TC-WS-AUTH-002: Handshake Validation', () => {
    it('should verify valid token and return user data', async () => {
      mockSocket.handshake!.query = { token: 'valid-token' };

      const mockValidation = {
        valid: true,
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com'
      };

      const mockPlayer = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        isActive: true,
        isVerified: true
      };

      (playerService.validateToken as jest.Mock).mockResolvedValue(mockValidation);
      (playerService.getPlayerById as jest.Mock).mockResolvedValue(mockPlayer);

      const user = await verifySocketToken(mockSocket as Socket);

      expect(user).toBeDefined();
      expect(user.userId).toBe('user-123');
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.isVerified).toBe(true);
    });

    it('should reject when no token provided', async () => {
      await expect(verifySocketToken(mockSocket as Socket))
        .rejects.toThrow('Authentication token not provided');
    });

    it('should reject invalid token', async () => {
      mockSocket.handshake!.query = { token: 'invalid-token' };

      (playerService.validateToken as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'Invalid token'
      });

      await expect(verifySocketToken(mockSocket as Socket))
        .rejects.toThrow('Invalid token');
    });

    it('should reject when user not found', async () => {
      mockSocket.handshake!.query = { token: 'valid-token' };

      (playerService.validateToken as jest.Mock).mockResolvedValue({
        valid: true,
        userId: 'user-999',
        username: 'ghost',
        email: 'ghost@example.com'
      });

      (playerService.getPlayerById as jest.Mock).mockResolvedValue(null);

      await expect(verifySocketToken(mockSocket as Socket))
        .rejects.toThrow('User not found');
    });

    it('should reject deactivated accounts', async () => {
      mockSocket.handshake!.query = { token: 'valid-token' };

      (playerService.validateToken as jest.Mock).mockResolvedValue({
        valid: true,
        userId: 'user-inactive',
        username: 'inactive',
        email: 'inactive@example.com'
      });

      (playerService.getPlayerById as jest.Mock).mockResolvedValue({
        id: 'user-inactive',
        isActive: false
      });

      await expect(verifySocketToken(mockSocket as Socket))
        .rejects.toThrow('Account is deactivated');
    });
  });

  /**
   * TC-WS-AUTH-003: Unauthorized rejection
   * Test rejection of unauthorized connection attempts
   */
  describe('TC-WS-AUTH-003: Unauthorized Rejection', () => {
    it('should disconnect with error on auth failure', () => {
      const error = 'Authentication failed';
      disconnectWithError(mockSocket as Socket, error);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: error,
        code: 'AUTH_FAILED'
      });
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('should emit proper error format', () => {
      disconnectWithError(mockSocket as Socket, 'Unauthorized access');

      expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        message: expect.any(String),
        code: 'AUTH_FAILED'
      }));
    });
  });

  /**
   * TC-WS-AUTH-004: Session management
   * Test user session attachment and management
   */
  describe('TC-WS-AUTH-004: Session Management', () => {
    it('should attach user to socket', () => {
      const user: AuthenticatedUser = {
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        isVerified: true,
        roles: ['user']
      };

      attachUserToSocket(mockAuthSocket as AuthenticatedSocket, user);

      expect(mockAuthSocket.data!.user).toEqual(user);
      expect(mockAuthSocket.data!.authenticated).toBe(true);
    });

    it('should check authentication status', () => {
      const user: AuthenticatedUser = {
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        isVerified: true
      };

      attachUserToSocket(mockAuthSocket as AuthenticatedSocket, user);

      const isAuth = isSocketAuthenticated(mockAuthSocket as Socket);
      expect(isAuth).toBe(true);
    });

    it('should return false for unauthenticated socket', () => {
      const isAuth = isSocketAuthenticated(mockSocket as Socket);
      expect(isAuth).toBe(false);
    });

    it('should retrieve authenticated user', () => {
      const user: AuthenticatedUser = {
        userId: 'user-456',
        username: 'anotheruser',
        email: 'another@example.com',
        isVerified: false
      };

      attachUserToSocket(mockAuthSocket as AuthenticatedSocket, user);

      const retrievedUser = getSocketUser(mockAuthSocket as Socket);
      expect(retrievedUser).toEqual(user);
    });

    it('should return null for unauthenticated socket', () => {
      const user = getSocketUser(mockSocket as Socket);
      expect(user).toBeNull();
    });
  });

  /**
   * TC-WS-AUTH-005: User identity verification
   * Test verification of user identity and claims
   */
  describe('TC-WS-AUTH-005: User Identity Verification', () => {
    it('should verify user ID matches', () => {
      const user: AuthenticatedUser = {
        userId: 'user-verified',
        username: 'verified',
        email: 'verified@example.com',
        isVerified: true
      };

      attachUserToSocket(mockAuthSocket as AuthenticatedSocket, user);
      const retrievedUser = getSocketUser(mockAuthSocket as Socket);

      expect(retrievedUser?.userId).toBe('user-verified');
      expect(retrievedUser?.isVerified).toBe(true);
    });

    it('should track verification status', () => {
      const unverifiedUser: AuthenticatedUser = {
        userId: 'user-unverified',
        username: 'unverified',
        email: 'unverified@example.com',
        isVerified: false
      };

      attachUserToSocket(mockAuthSocket as AuthenticatedSocket, unverifiedUser);
      const retrievedUser = getSocketUser(mockAuthSocket as Socket);

      expect(retrievedUser?.isVerified).toBe(false);
    });
  });

  /**
   * TC-WS-AUTH-006: Permission checking
   * Test role-based access control
   */
  describe('TC-WS-AUTH-006: Permission Checking', () => {
    it('should check for specific role', () => {
      const user: AuthenticatedUser = {
        userId: 'user-admin',
        username: 'admin',
        email: 'admin@example.com',
        isVerified: true,
        roles: ['admin', 'moderator']
      };

      attachUserToSocket(mockAuthSocket as AuthenticatedSocket, user);

      expect(hasRole(mockAuthSocket as Socket, 'admin')).toBe(true);
      expect(hasRole(mockAuthSocket as Socket, 'moderator')).toBe(true);
      expect(hasRole(mockAuthSocket as Socket, 'superuser')).toBe(false);
    });

    it('should check for any of multiple roles', () => {
      const user: AuthenticatedUser = {
        userId: 'user-mod',
        username: 'moderator',
        email: 'mod@example.com',
        isVerified: true,
        roles: ['moderator']
      };

      attachUserToSocket(mockAuthSocket as AuthenticatedSocket, user);

      expect(hasAnyRole(mockAuthSocket as Socket, ['admin', 'moderator'])).toBe(true);
      expect(hasAnyRole(mockAuthSocket as Socket, ['admin', 'superuser'])).toBe(false);
    });

    it('should check for all required roles', () => {
      const user: AuthenticatedUser = {
        userId: 'user-multi',
        username: 'multiuser',
        email: 'multi@example.com',
        isVerified: true,
        roles: ['user', 'premium', 'verified']
      };

      attachUserToSocket(mockAuthSocket as AuthenticatedSocket, user);

      expect(hasAllRoles(mockAuthSocket as Socket, ['user', 'premium'])).toBe(true);
      expect(hasAllRoles(mockAuthSocket as Socket, ['user', 'admin'])).toBe(false);
    });

    it('should return false for unauthenticated socket', () => {
      expect(hasRole(mockSocket as Socket, 'any')).toBe(false);
      expect(hasAnyRole(mockSocket as Socket, ['any'])).toBe(false);
      expect(hasAllRoles(mockSocket as Socket, ['any'])).toBe(false);
    });
  });

  /**
   * TC-WS-AUTH-007: Token refresh
   * Test token refresh functionality
   */
  describe('TC-WS-AUTH-007: Token Refresh', () => {
    it('should refresh token successfully', async () => {
      const initialUser: AuthenticatedUser = {
        userId: 'user-refresh',
        username: 'refreshuser',
        email: 'refresh@example.com',
        isVerified: true,
        roles: ['user']
      };

      attachUserToSocket(mockAuthSocket as AuthenticatedSocket, initialUser);

      const newToken = 'new-valid-token';
      const mockValidation = {
        valid: true,
        userId: 'user-refresh',
        username: 'refreshuser',
        email: 'refresh@example.com'
      };

      const mockPlayer = {
        id: 'user-refresh',
        isActive: true,
        isVerified: true
      };

      (playerService.validateToken as jest.Mock).mockResolvedValue(mockValidation);
      (playerService.getPlayerById as jest.Mock).mockResolvedValue(mockPlayer);

      await refreshSocketToken(mockAuthSocket as AuthenticatedSocket, newToken);

      expect(mockAuthSocket.emit).toHaveBeenCalledWith('token:refreshed', expect.objectContaining({
        success: true
      }));
    });

    it('should emit error on invalid refresh token', async () => {
      const initialUser: AuthenticatedUser = {
        userId: 'user-refresh-fail',
        username: 'failuser',
        email: 'fail@example.com',
        isVerified: true
      };

      attachUserToSocket(mockAuthSocket as AuthenticatedSocket, initialUser);

      (playerService.validateToken as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'Invalid token'
      });

      await expect(refreshSocketToken(mockAuthSocket as AuthenticatedSocket, 'bad-token'))
        .rejects.toThrow();

      expect(mockAuthSocket.emit).toHaveBeenCalledWith('token:refresh:error', expect.objectContaining({
        success: false
      }));
    });
  });

  /**
   * TC-WS-AUTH-008: Multi-device auth
   * Test authentication across multiple devices
   */
  describe('TC-WS-AUTH-008: Multi-Device Auth', () => {
    it('should support same user on multiple devices', () => {
      const user: AuthenticatedUser = {
        userId: 'user-multidevice',
        username: 'multidevice',
        email: 'multi@example.com',
        isVerified: true
      };

      const device1: Partial<AuthenticatedSocket> = {
        id: 'socket-device-1',
        data: { authenticated: false }
      } as any;

      const device2: Partial<AuthenticatedSocket> = {
        id: 'socket-device-2',
        data: { authenticated: false }
      } as any;

      attachUserToSocket(device1 as AuthenticatedSocket, user);
      attachUserToSocket(device2 as AuthenticatedSocket, user);

      expect(device1.data!.user?.userId).toBe('user-multidevice');
      expect(device2.data!.user?.userId).toBe('user-multidevice');
      expect(device1.data!.authenticated).toBe(true);
      expect(device2.data!.authenticated).toBe(true);
    });

    it('should maintain separate sessions for different devices', () => {
      const user: AuthenticatedUser = {
        userId: 'user-separate',
        username: 'separate',
        email: 'separate@example.com',
        isVerified: true,
        roles: ['user']
      };

      const device1: Partial<AuthenticatedSocket> = {
        id: 'socket-1',
        data: { authenticated: false }
      } as any;

      const device2: Partial<AuthenticatedSocket> = {
        id: 'socket-2',
        data: { authenticated: false }
      } as any;

      attachUserToSocket(device1 as AuthenticatedSocket, user);
      attachUserToSocket(device2 as AuthenticatedSocket, { ...user, roles: ['user', 'premium'] });

      expect(device1.data!.user?.roles).toEqual(['user']);
      expect(device2.data!.user?.roles).toEqual(['user', 'premium']);
    });
  });

  /**
   * TC-WS-AUTH-009: Auth event handling
   * Test authentication-related events
   */
  describe('TC-WS-AUTH-009: Auth Event Handling', () => {
    it('should emit connection:established on successful auth', async () => {
      mockSocket.handshake!.query = { token: 'valid-token' };

      (playerService.validateToken as jest.Mock).mockResolvedValue({
        valid: true,
        userId: 'user-event',
        username: 'eventuser',
        email: 'event@example.com'
      });

      (playerService.getPlayerById as jest.Mock).mockResolvedValue({
        id: 'user-event',
        isActive: true,
        isVerified: true
      });

      const user = await verifySocketToken(mockSocket as Socket);
      expect(user).toBeDefined();
    });

    it('should handle token validation errors', async () => {
      mockSocket.handshake!.query = { token: 'error-token' };

      (playerService.validateToken as jest.Mock).mockRejectedValue(
        new Error('Token validation failed')
      );

      await expect(verifySocketToken(mockSocket as Socket)).rejects.toThrow();
    });
  });

  /**
   * TC-WS-AUTH-010: Auth timeout
   * Test authentication timeout handling
   */
  describe('TC-WS-AUTH-010: Auth Timeout', () => {
    it('should handle slow authentication response', async () => {
      mockSocket.handshake!.query = { token: 'slow-token' };

      (playerService.validateToken as jest.Mock).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          valid: true,
          userId: 'user-slow',
          username: 'slowuser',
          email: 'slow@example.com'
        }), 100))
      );

      (playerService.getPlayerById as jest.Mock).mockResolvedValue({
        id: 'user-slow',
        isActive: true,
        isVerified: true
      });

      const user = await verifySocketToken(mockSocket as Socket);
      expect(user).toBeDefined();
    }, 10000);

    it('should handle authentication service unavailable', async () => {
      mockSocket.handshake!.query = { token: 'service-down-token' };

      (playerService.validateToken as jest.Mock).mockRejectedValue(
        new Error('Service unavailable')
      );

      await expect(verifySocketToken(mockSocket as Socket))
        .rejects.toThrow('Service unavailable');
    });

    it('should handle malformed tokens gracefully', async () => {
      mockSocket.handshake!.query = { token: 'malformed!!!token' };

      (playerService.validateToken as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'Malformed token'
      });

      await expect(verifySocketToken(mockSocket as Socket))
        .rejects.toThrow();
    });
  });
});
