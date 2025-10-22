import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { playerService } from '../../services/PlayerService';
import {
  extractToken,
  verifySocketToken,
  attachUserToSocket,
  isSocketAuthenticated,
  getSocketUser,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  AuthenticatedUser
} from '../../websocket/auth';
import {
  socketAuthMiddleware,
  optionalAuthMiddleware,
  namespaceAuthMiddleware,
  requireVerifiedMiddleware
} from '../../websocket/middleware/authMiddleware';

// Mock PlayerService
jest.mock('../../services/PlayerService', () => ({
  playerService: {
    validateToken: jest.fn(),
    getPlayerById: jest.fn(),
    verifyJWT: jest.fn()
  }
}));

describe('WebSocket Authentication', () => {
  let io: Server;
  let serverPort: number;
  const TEST_USER = {
    userId: 'test-user-123',
    username: 'testuser',
    email: 'test@example.com',
    isVerified: true,
    roles: ['user', 'premium']
  };

  beforeEach(() => {
    serverPort = 3000 + Math.floor(Math.random() * 1000);
    io = new Server(serverPort);
  });

  afterEach((done) => {
    io.close(() => done());
  });

  describe('extractToken', () => {
    it('should extract token from query parameter', (done) => {
      io.on('connection', (socket) => {
        const token = extractToken(socket);
        expect(token).toBe('test-token-123');
        socket.disconnect();
        done();
      });

      const client = ioClient(`http://localhost:${serverPort}`, {
        query: { token: 'test-token-123' }
      });
    });

    it('should extract token from Authorization header', (done) => {
      io.on('connection', (socket) => {
        const token = extractToken(socket);
        expect(token).toBe('test-token-456');
        socket.disconnect();
        done();
      });

      const client = ioClient(`http://localhost:${serverPort}`, {
        extraHeaders: {
          Authorization: 'Bearer test-token-456'
        }
      });
    });

    it('should extract token from auth object', (done) => {
      io.on('connection', (socket) => {
        const token = extractToken(socket);
        expect(token).toBe('test-token-789');
        socket.disconnect();
        done();
      });

      const client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: 'test-token-789' }
      });
    });

    it('should return null if no token provided', (done) => {
      io.on('connection', (socket) => {
        const token = extractToken(socket);
        expect(token).toBeNull();
        socket.disconnect();
        done();
      });

      const client = ioClient(`http://localhost:${serverPort}`);
    });
  });

  describe('verifySocketToken', () => {
    it('should verify valid token and return user data', async () => {
      const mockValidation = {
        valid: true,
        userId: TEST_USER.userId,
        username: TEST_USER.username,
        email: TEST_USER.email
      };

      const mockPlayer = {
        id: TEST_USER.userId,
        username: TEST_USER.username,
        email: TEST_USER.email,
        isActive: true,
        isVerified: TEST_USER.isVerified
      };

      (playerService.validateToken as jest.Mock).mockResolvedValue(mockValidation);
      (playerService.getPlayerById as jest.Mock).mockResolvedValue(mockPlayer);

      io.on('connection', async (socket) => {
        try {
          const user = await verifySocketToken(socket);
          expect(user.userId).toBe(TEST_USER.userId);
          expect(user.username).toBe(TEST_USER.username);
          expect(user.email).toBe(TEST_USER.email);
          expect(user.isVerified).toBe(true);
          socket.disconnect();
        } catch (error) {
          socket.disconnect();
        }
      });

      const client = ioClient(`http://localhost:${serverPort}`, {
        query: { token: 'valid-token' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should reject invalid token', async () => {
      (playerService.validateToken as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'Invalid token'
      });

      io.on('connection', async (socket) => {
        await expect(verifySocketToken(socket)).rejects.toThrow('Invalid token');
        socket.disconnect();
      });

      const client = ioClient(`http://localhost:${serverPort}`, {
        query: { token: 'invalid-token' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should reject token for inactive user', async () => {
      const mockValidation = {
        valid: true,
        userId: 'inactive-user',
        username: 'inactive',
        email: 'inactive@example.com'
      };

      const mockPlayer = {
        id: 'inactive-user',
        isActive: false,
        isVerified: true
      };

      (playerService.validateToken as jest.Mock).mockResolvedValue(mockValidation);
      (playerService.getPlayerById as jest.Mock).mockResolvedValue(mockPlayer);

      io.on('connection', async (socket) => {
        await expect(verifySocketToken(socket)).rejects.toThrow('Account is deactivated');
        socket.disconnect();
      });

      const client = ioClient(`http://localhost:${serverPort}`, {
        query: { token: 'valid-token' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe('Role-based access control', () => {
    let mockSocket: any;

    beforeEach(() => {
      mockSocket = {
        data: {
          user: TEST_USER,
          authenticated: true
        }
      };
    });

    it('should check if user has specific role', () => {
      expect(hasRole(mockSocket, 'user')).toBe(true);
      expect(hasRole(mockSocket, 'premium')).toBe(true);
      expect(hasRole(mockSocket, 'admin')).toBe(false);
    });

    it('should check if user has any of the roles', () => {
      expect(hasAnyRole(mockSocket, ['admin', 'premium'])).toBe(true);
      expect(hasAnyRole(mockSocket, ['admin', 'moderator'])).toBe(false);
    });

    it('should check if user has all roles', () => {
      expect(hasAllRoles(mockSocket, ['user', 'premium'])).toBe(true);
      expect(hasAllRoles(mockSocket, ['user', 'admin'])).toBe(false);
    });
  });

  describe('Socket authentication state', () => {
    it('should identify authenticated socket', () => {
      const mockSocket: any = {
        data: {
          user: TEST_USER,
          authenticated: true
        }
      };

      expect(isSocketAuthenticated(mockSocket)).toBe(true);
    });

    it('should identify unauthenticated socket', () => {
      const mockSocket: any = {
        data: {
          authenticated: false
        }
      };

      expect(isSocketAuthenticated(mockSocket)).toBe(false);
    });

    it('should get user from authenticated socket', () => {
      const mockSocket: any = {
        data: {
          user: TEST_USER,
          authenticated: true
        }
      };

      const user = getSocketUser(mockSocket);
      expect(user).toEqual(TEST_USER);
    });

    it('should return null for unauthenticated socket', () => {
      const mockSocket: any = {
        data: {
          authenticated: false
        }
      };

      const user = getSocketUser(mockSocket);
      expect(user).toBeNull();
    });
  });
});

describe('WebSocket Middleware', () => {
  describe('socketAuthMiddleware', () => {
    it('should allow authenticated connections', async () => {
      const mockSocket: any = {
        handshake: {
          query: { token: 'valid-token' },
          headers: {},
          auth: {}
        },
        data: {}
      };

      const mockNext = jest.fn();

      const mockValidation = {
        valid: true,
        userId: 'test-user',
        username: 'testuser',
        email: 'test@example.com'
      };

      const mockPlayer = {
        id: 'test-user',
        isActive: true,
        isVerified: true
      };

      (playerService.validateToken as jest.Mock).mockResolvedValue(mockValidation);
      (playerService.getPlayerById as jest.Mock).mockResolvedValue(mockPlayer);

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockSocket.data.authenticated).toBe(true);
      expect(mockSocket.data.user).toBeDefined();
    });

    it('should reject unauthenticated connections', async () => {
      const mockSocket: any = {
        handshake: {
          query: {},
          headers: {},
          auth: {}
        },
        data: {}
      };

      const mockNext = jest.fn();

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('optionalAuthMiddleware', () => {
    it('should allow connections with valid token', async () => {
      const mockSocket: any = {
        handshake: {
          query: { token: 'valid-token' },
          headers: {},
          auth: {}
        },
        data: {}
      };

      const mockNext = jest.fn();

      const mockValidation = {
        valid: true,
        userId: 'test-user',
        username: 'testuser',
        email: 'test@example.com'
      };

      const mockPlayer = {
        id: 'test-user',
        isActive: true,
        isVerified: true
      };

      (playerService.validateToken as jest.Mock).mockResolvedValue(mockValidation);
      (playerService.getPlayerById as jest.Mock).mockResolvedValue(mockPlayer);

      await optionalAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockSocket.data.authenticated).toBe(true);
    });

    it('should allow connections without token', async () => {
      const mockSocket: any = {
        handshake: {
          query: {},
          headers: {},
          auth: {}
        },
        data: {}
      };

      const mockNext = jest.fn();

      await optionalAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockSocket.data.authenticated).toBe(false);
    });
  });
});
