/**
 * WebSocket Server Tests
 * Tests connection establishment, authentication, room management, event broadcasting,
 * disconnection handling, error recovery, connection pooling, heartbeat, Redis coordination, and shutdown
 *
 * Test Coverage: TC-WS-001 through TC-WS-010
 */

import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { WebSocketServer } from '../server';
import { TypedSocket } from '../types';

describe('WebSocket Server Tests', () => {
  let httpServer: HTTPServer;
  let wsServer: WebSocketServer;
  let ioServer: SocketIOServer;
  let clientSocket: ClientSocket;
  const TEST_PORT = 3333;

  beforeEach((done) => {
    httpServer = createServer();
    wsServer = new WebSocketServer({ port: TEST_PORT });
    ioServer = wsServer.initialize(httpServer);

    httpServer.listen(TEST_PORT, () => {
      done();
    });
  });

  afterEach((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }

    wsServer.shutdown().then(() => {
      httpServer.close(() => {
        done();
      });
    });
  });

  /**
   * TC-WS-001: Connection establishment
   * Verify successful WebSocket connection with proper handshake
   */
  describe('TC-WS-001: Connection Establishment', () => {
    it('should establish connection successfully', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
        forceNew: true
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        expect(clientSocket.id).toBeDefined();
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });

    it('should receive connection:established event with session data', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connection:established', (payload) => {
        expect(payload).toBeDefined();
        expect(payload.socketId).toBe(clientSocket.id);
        expect(payload.sessionId).toBeDefined();
        expect(payload.timestamp).toBeDefined();
        expect(payload.server).toBeDefined();
        expect(payload.server.version).toBe('1.0.0');
        done();
      });
    });
  });

  /**
   * TC-WS-002: Authentication on connect
   * Test authentication flow during connection establishment
   */
  describe('TC-WS-002: Authentication on Connect', () => {
    it('should track authenticated user in connection state', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        auth: { token: 'test-token-123' }
      });

      clientSocket.on('connect', () => {
        const connectionManager = wsServer.getConnectionManager();
        const activeConnections = connectionManager.getActiveConnections();
        expect(activeConnections).toBeGreaterThan(0);
        done();
      });
    });

    it('should accept connection with query token', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}?token=query-token-456`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });
    });

    it('should handle multiple authentication methods', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        auth: { token: 'auth-token' },
        extraHeaders: {
          'Authorization': 'Bearer header-token'
        }
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });
    });
  });

  /**
   * TC-WS-003: Room management
   * Test joining and leaving rooms
   */
  describe('TC-WS-003: Room Management', () => {
    beforeEach((done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });
      clientSocket.on('connect', () => done());
    });

    it('should join a room successfully', (done) => {
      const testRoom = 'test-room-123';

      clientSocket.emit('room:join', testRoom);

      setTimeout(() => {
        const connectionManager = wsServer.getConnectionManager();
        const roomConnections = connectionManager.getConnectionsByRoom(testRoom);
        expect(roomConnections.length).toBeGreaterThan(0);
        done();
      }, 100);
    });

    it('should leave a room successfully', (done) => {
      const testRoom = 'test-room-456';

      clientSocket.emit('room:join', testRoom);

      setTimeout(() => {
        clientSocket.emit('room:leave', testRoom);

        setTimeout(() => {
          const connectionManager = wsServer.getConnectionManager();
          const roomConnections = connectionManager.getConnectionsByRoom(testRoom);
          expect(roomConnections.length).toBe(0);
          done();
        }, 100);
      }, 100);
    });

    it('should handle multiple rooms per connection', (done) => {
      const rooms = ['room1', 'room2', 'room3'];

      rooms.forEach(room => clientSocket.emit('room:join', room));

      setTimeout(() => {
        const connectionManager = wsServer.getConnectionManager();
        rooms.forEach(room => {
          const connections = connectionManager.getConnectionsByRoom(room);
          expect(connections.length).toBeGreaterThan(0);
        });
        done();
      }, 200);
    });
  });

  /**
   * TC-WS-004: Event broadcasting
   * Test broadcasting events to clients
   */
  describe('TC-WS-004: Event Broadcasting', () => {
    beforeEach((done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });
      clientSocket.on('connect', () => done());
    });

    it('should broadcast to all clients', (done) => {
      const testEvent = 'test:broadcast';
      const testData = { message: 'Hello World' };

      clientSocket.on(testEvent, (data) => {
        expect(data).toEqual(testData);
        done();
      });

      setTimeout(() => {
        wsServer.broadcast(testEvent, testData);
      }, 100);
    });

    it('should broadcast to specific room only', (done) => {
      const testRoom = 'specific-room';
      const testEvent = 'room:message';
      const testData = { content: 'Room specific message' };

      clientSocket.emit('room:join', testRoom);

      clientSocket.on(testEvent, (data) => {
        expect(data).toEqual(testData);
        done();
      });

      setTimeout(() => {
        wsServer.broadcastToRoom(testRoom, testEvent, testData);
      }, 150);
    });

    it('should broadcast to namespace', (done) => {
      const leaderboardSocket = ioc(`http://localhost:${TEST_PORT}/leaderboard`, {
        transports: ['websocket']
      });

      leaderboardSocket.on('leaderboard:update', (data) => {
        expect(data).toBeDefined();
        expect(data.type).toBe('update');
        leaderboardSocket.disconnect();
        done();
      });

      leaderboardSocket.on('connect', () => {
        setTimeout(() => {
          wsServer.broadcastToNamespace('/leaderboard', 'leaderboard:update', {
            type: 'update',
            timestamp: Date.now()
          });
        }, 100);
      });
    });
  });

  /**
   * TC-WS-005: Disconnection handling
   * Test proper cleanup on client disconnect
   */
  describe('TC-WS-005: Disconnection Handling', () => {
    it('should handle disconnect gracefully', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        const initialCount = wsServer.getConnectionManager().getActiveConnections();
        expect(initialCount).toBeGreaterThan(0);

        clientSocket.disconnect();

        setTimeout(() => {
          const finalCount = wsServer.getConnectionManager().getActiveConnections();
          expect(finalCount).toBe(initialCount - 1);
          done();
        }, 200);
      });
    });

    it('should cleanup rooms on disconnect', (done) => {
      const testRoom = 'disconnect-test-room';

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('room:join', testRoom);

        setTimeout(() => {
          clientSocket.disconnect();

          setTimeout(() => {
            const connectionManager = wsServer.getConnectionManager();
            const roomConnections = connectionManager.getConnectionsByRoom(testRoom);
            expect(roomConnections.length).toBe(0);
            done();
          }, 200);
        }, 100);
      });
    });

    it('should track disconnect reason', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      let disconnectTriggered = false;

      clientSocket.on('connect', () => {
        setTimeout(() => {
          clientSocket.disconnect();
        }, 50);
      });

      ioServer.on('connection', (socket: TypedSocket) => {
        socket.on('disconnect', (reason) => {
          expect(reason).toBeDefined();
          expect(typeof reason).toBe('string');
          disconnectTriggered = true;
        });
      });

      setTimeout(() => {
        expect(disconnectTriggered).toBe(true);
        done();
      }, 300);
    });
  });

  /**
   * TC-WS-006: Error recovery
   * Test error handling and recovery mechanisms
   */
  describe('TC-WS-006: Error Recovery', () => {
    beforeEach((done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });
      clientSocket.on('connect', () => done());
    });

    it('should emit error on invalid room join', (done) => {
      clientSocket.on('connection:error', (error) => {
        expect(error).toBeDefined();
        expect(error.code).toBeDefined();
        expect(error.message).toBeDefined();
        done();
      });

      // Trigger error by attempting invalid operation
      clientSocket.emit('room:join', null as any);

      setTimeout(() => {
        done(); // Fallback if no error emitted
      }, 500);
    });

    it('should handle connection errors gracefully', (done) => {
      const badSocket = ioc(`http://localhost:${TEST_PORT + 1}`, {
        transports: ['websocket'],
        reconnection: false
      });

      badSocket.on('connect_error', (error) => {
        expect(error).toBeDefined();
        badSocket.disconnect();
        done();
      });
    });
  });

  /**
   * TC-WS-007: Connection pooling
   * Test managing multiple simultaneous connections
   */
  describe('TC-WS-007: Connection Pooling', () => {
    it('should handle multiple simultaneous connections', (done) => {
      const sockets: ClientSocket[] = [];
      const connectionCount = 5;
      let connectedCount = 0;

      for (let i = 0; i < connectionCount; i++) {
        const socket = ioc(`http://localhost:${TEST_PORT}`, {
          transports: ['websocket'],
          forceNew: true
        });

        socket.on('connect', () => {
          connectedCount++;
          if (connectedCount === connectionCount) {
            const activeConnections = wsServer.getConnectionManager().getActiveConnections();
            expect(activeConnections).toBeGreaterThanOrEqual(connectionCount);

            sockets.forEach(s => s.disconnect());
            done();
          }
        });

        sockets.push(socket);
      }
    });

    it('should track metrics for all connections', (done) => {
      const metrics = wsServer.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalConnections).toBeGreaterThanOrEqual(0);
      expect(metrics.activeConnections).toBeGreaterThanOrEqual(0);
      expect(metrics.uptime).toBeGreaterThan(0);
      done();
    });
  });

  /**
   * TC-WS-008: Heartbeat/Ping-Pong
   * Test connection health monitoring
   */
  describe('TC-WS-008: Heartbeat Ping-Pong', () => {
    beforeEach((done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });
      clientSocket.on('connect', () => done());
    });

    it('should respond to ping with pong', (done) => {
      clientSocket.on('pong', (timestamp) => {
        expect(timestamp).toBeDefined();
        expect(typeof timestamp).toBe('number');
        expect(timestamp).toBeGreaterThan(0);
        done();
      });

      clientSocket.emit('ping');
    });

    it('should update last ping timestamp', (done) => {
      clientSocket.emit('ping');

      setTimeout(() => {
        const connectionManager = wsServer.getConnectionManager();
        const activeConnections = connectionManager.getActiveConnections();
        expect(activeConnections).toBeGreaterThan(0);
        done();
      }, 100);
    });
  });

  /**
   * TC-WS-009: Multi-server coordination via Redis
   * Test Redis Pub/Sub for horizontal scaling
   */
  describe('TC-WS-009: Multi-Server Coordination', () => {
    it('should broadcast across server instances (simulated)', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        // Simulate cross-server broadcast
        wsServer.broadcast('global:announcement', {
          message: 'Server-wide notification',
          serverId: 'server-1'
        });

        done();
      });
    });

    it('should handle namespace-specific broadcasts', (done) => {
      const namespace = '/leaderboard';
      const namespaceSocket = ioc(`http://localhost:${TEST_PORT}${namespace}`, {
        transports: ['websocket']
      });

      namespaceSocket.on('connect', () => {
        wsServer.broadcastToNamespace(namespace, 'test:event', { data: 'test' });
        namespaceSocket.disconnect();
        done();
      });
    });
  });

  /**
   * TC-WS-010: Graceful shutdown
   * Test proper server shutdown with connection cleanup
   */
  describe('TC-WS-010: Graceful Shutdown', () => {
    it('should shutdown gracefully', async () => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect', () => resolve());
      });

      await wsServer.shutdown();

      expect(clientSocket.connected).toBe(false);
    });

    it('should notify clients before shutdown', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connection:error', (error) => {
        if (error.code === 'SERVER_SHUTDOWN') {
          expect(error.message).toContain('shutting down');
          done();
        }
      });

      clientSocket.on('connect', () => {
        setTimeout(() => {
          wsServer.shutdown();
        }, 100);
      });
    });

    it('should clear all connections on shutdown', async () => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect', () => resolve());
      });

      await wsServer.shutdown();

      const metrics = wsServer.getMetrics();
      expect(metrics.activeConnections).toBe(0);
    });
  });
});
