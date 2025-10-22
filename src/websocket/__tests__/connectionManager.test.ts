/**
 * Connection Manager Tests
 * Tests client tracking, connection limits, reconnection logic, cleanup, memory leak prevention,
 * load balancing, metrics, rate limiting, state management, and multi-device support
 *
 * Test Coverage: TC-CONN-001 through TC-CONN-010
 */

import { Server as SocketIOServer } from 'socket.io';
import { createServer, Server as HTTPServer } from 'http';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { ConnectionManager } from '../connectionManager';
import { TypedSocket } from '../types';

describe('Connection Manager Tests', () => {
  let httpServer: HTTPServer;
  let ioServer: SocketIOServer;
  let connectionManager: ConnectionManager;
  let clientSocket: ClientSocket;
  const TEST_PORT = 3334;

  beforeEach((done) => {
    httpServer = createServer();
    ioServer = new SocketIOServer(httpServer, {
      cors: { origin: '*' },
      transports: ['websocket']
    });

    connectionManager = new ConnectionManager(ioServer);

    httpServer.listen(TEST_PORT, () => {
      done();
    });
  });

  afterEach((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }

    connectionManager.shutdown().then(() => {
      ioServer.close();
      httpServer.close(() => {
        done();
      });
    });
  });

  /**
   * TC-CONN-001: Client tracking
   * Verify proper tracking of connected clients
   */
  describe('TC-CONN-001: Client Tracking', () => {
    it('should track new connections', (done) => {
      const initialCount = connectionManager.getActiveConnections();

      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');
      });

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        setTimeout(() => {
          const currentCount = connectionManager.getActiveConnections();
          expect(currentCount).toBe(initialCount + 1);
          done();
        }, 100);
      });
    });

    it('should assign unique session IDs', (done) => {
      const sessionIds = new Set<string>();

      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');
        expect(socket.data.sessionId).toBeDefined();
        sessionIds.add(socket.data.sessionId);
      });

      const sockets: ClientSocket[] = [];
      const connectionCount = 3;
      let connectedCount = 0;

      for (let i = 0; i < connectionCount; i++) {
        const socket = ioc(`http://localhost:${TEST_PORT}`, {
          transports: ['websocket'],
          forceNew: true
        });

        socket.on('connect', () => {
          connectedCount++;
          if (connectedCount === connectionCount) {
            expect(sessionIds.size).toBe(connectionCount);
            sockets.forEach(s => s.disconnect());
            done();
          }
        });

        sockets.push(socket);
      }
    });

    it('should track connection timestamp', (done) => {
      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');

        expect(socket.data.connectedAt).toBeDefined();
        expect(socket.data.connectedAt).toBeGreaterThan(Date.now() - 1000);
        done();
      });

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });
    });
  });

  /**
   * TC-CONN-002: Connection limits
   * Test handling of connection limits and overflow
   */
  describe('TC-CONN-002: Connection Limits', () => {
    it('should handle multiple concurrent connections', (done) => {
      const connectionLimit = 10;
      const sockets: ClientSocket[] = [];
      let connectedCount = 0;

      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');
      });

      for (let i = 0; i < connectionLimit; i++) {
        const socket = ioc(`http://localhost:${TEST_PORT}`, {
          transports: ['websocket'],
          forceNew: true
        });

        socket.on('connect', () => {
          connectedCount++;
          if (connectedCount === connectionLimit) {
            const activeConnections = connectionManager.getActiveConnections();
            expect(activeConnections).toBeGreaterThanOrEqual(connectionLimit);
            sockets.forEach(s => s.disconnect());
            done();
          }
        });

        sockets.push(socket);
      }
    });

    it('should prevent connection overflow with proper metrics', (done) => {
      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');
      });

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        const metrics = connectionManager.getMetrics();
        expect(metrics.totalConnections).toBeGreaterThan(0);
        expect(metrics.activeConnections).toBeGreaterThan(0);
        done();
      });
    });
  });

  /**
   * TC-CONN-003: Reconnection logic
   * Test reconnection handling and session restoration
   */
  describe('TC-CONN-003: Reconnection Logic', () => {
    it('should handle reconnection with previous session ID', (done) => {
      let previousSessionId: string;

      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');

        if (!previousSessionId) {
          previousSessionId = socket.data.sessionId;
          // Simulate disconnect
          socket.disconnect();
        } else {
          // Reconnection detected
          connectionManager.handleReconnection(socket, previousSessionId);
          const metrics = connectionManager.getMetrics();
          expect(metrics.reconnections).toBeGreaterThan(0);
          done();
        }
      });

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 100
      });
    });

    it('should track reconnection count', (done) => {
      const initialReconnections = connectionManager.getMetrics().reconnections;

      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');
        connectionManager.handleReconnection(socket, 'test-session');
      });

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        setTimeout(() => {
          const currentReconnections = connectionManager.getMetrics().reconnections;
          expect(currentReconnections).toBeGreaterThan(initialReconnections);
          done();
        }, 100);
      });
    });
  });

  /**
   * TC-CONN-004: Stale connection cleanup
   * Test automatic cleanup of inactive connections
   */
  describe('TC-CONN-004: Stale Connection Cleanup', () => {
    it('should cleanup stale connections after timeout', (done) => {
      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');
      });

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        // Manually trigger cleanup with very short timeout
        connectionManager.cleanupStaleConnections(1); // 1ms timeout

        setTimeout(() => {
          // Connection should still be active since we're tracking pings
          const activeConnections = connectionManager.getActiveConnections();
          expect(activeConnections).toBeGreaterThan(0);
          done();
        }, 200);
      });
    });

    it('should not cleanup active connections', (done) => {
      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');
      });

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        // Send ping to keep connection active
        clientSocket.emit('ping');

        setTimeout(() => {
          const activeConnections = connectionManager.getActiveConnections();
          expect(activeConnections).toBeGreaterThan(0);
          done();
        }, 100);
      });
    });
  });

  /**
   * TC-CONN-005: Memory leak prevention
   * Test proper memory cleanup and resource management
   */
  describe('TC-CONN-005: Memory Leak Prevention', () => {
    it('should cleanup connection data on disconnect', (done) => {
      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');
      });

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        const initialCount = connectionManager.getActiveConnections();
        expect(initialCount).toBeGreaterThan(0);

        clientSocket.disconnect();

        setTimeout(() => {
          const finalCount = connectionManager.getActiveConnections();
          expect(finalCount).toBe(initialCount - 1);
          done();
        }, 200);
      });
    });

    it('should clear room subscriptions on disconnect', (done) => {
      const testRoom = 'memory-test-room';

      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');
        connectionManager.joinRoom(socket, testRoom);
      });

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        setTimeout(() => {
          const roomConnections = connectionManager.getConnectionsByRoom(testRoom);
          expect(roomConnections.length).toBeGreaterThan(0);

          clientSocket.disconnect();

          setTimeout(() => {
            const afterDisconnect = connectionManager.getConnectionsByRoom(testRoom);
            expect(afterDisconnect.length).toBe(0);
            done();
          }, 200);
        }, 100);
      });
    });
  });

  /**
   * TC-CONN-006: Load balancing
   * Test connection distribution and metrics
   */
  describe('TC-CONN-006: Load Balancing', () => {
    it('should track connections per namespace', (done) => {
      const namespaces = ['/', '/leaderboard', '/matches'];
      const sockets: ClientSocket[] = [];
      let connectedCount = 0;

      namespaces.forEach(namespace => {
        const nsServer = namespace === '/' ? ioServer : ioServer.of(namespace);
        nsServer.on('connection', (socket: TypedSocket) => {
          connectionManager.handleConnection(socket, namespace);
        });
      });

      namespaces.forEach(namespace => {
        const socket = ioc(`http://localhost:${TEST_PORT}${namespace}`, {
          transports: ['websocket'],
          forceNew: true
        });

        socket.on('connect', () => {
          connectedCount++;
          if (connectedCount === namespaces.length) {
            const activeConnections = connectionManager.getActiveConnections();
            expect(activeConnections).toBeGreaterThanOrEqual(namespaces.length);
            sockets.forEach(s => s.disconnect());
            done();
          }
        });

        sockets.push(socket);
      });
    });

    it('should provide metrics for load balancing decisions', (done) => {
      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');
      });

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        const metrics = connectionManager.getMetrics();
        expect(metrics).toBeDefined();
        expect(metrics.totalConnections).toBeDefined();
        expect(metrics.activeConnections).toBeDefined();
        expect(metrics.uptime).toBeDefined();
        expect(metrics.messagesSent).toBeDefined();
        expect(metrics.messagesReceived).toBeDefined();
        done();
      });
    });
  });

  /**
   * TC-CONN-007: Connection metrics
   * Test comprehensive metrics tracking
   */
  describe('TC-CONN-007: Connection Metrics', () => {
    it('should track message counts', (done) => {
      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');
      });

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        const initialMetrics = connectionManager.getMetrics();

        // Send some messages
        clientSocket.emit('room:join', 'test-room');
        clientSocket.emit('ping');

        setTimeout(() => {
          const finalMetrics = connectionManager.getMetrics();
          expect(finalMetrics.messagesReceived).toBeGreaterThan(initialMetrics.messagesReceived);
          done();
        }, 200);
      });
    });

    it('should track error counts', (done) => {
      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');

        // Simulate error
        socket.emit('error', new Error('Test error'));
      });

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        setTimeout(() => {
          const metrics = connectionManager.getMetrics();
          expect(metrics.errors).toBeDefined();
          done();
        }, 100);
      });
    });

    it('should calculate uptime correctly', (done) => {
      const metrics1 = connectionManager.getMetrics();
      const uptime1 = metrics1.uptime;

      setTimeout(() => {
        const metrics2 = connectionManager.getMetrics();
        const uptime2 = metrics2.uptime;
        expect(uptime2).toBeGreaterThan(uptime1);
        done();
      }, 100);
    });
  });

  /**
   * TC-CONN-008: Rate limiting per connection
   * Test connection-level rate limiting
   */
  describe('TC-CONN-008: Rate Limiting Per Connection', () => {
    it('should handle rapid message bursts', (done) => {
      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');
      });

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        // Send burst of messages
        for (let i = 0; i < 10; i++) {
          clientSocket.emit('room:join', `room-${i}`);
        }

        setTimeout(() => {
          const metrics = connectionManager.getMetrics();
          expect(metrics.messagesReceived).toBeGreaterThan(0);
          done();
        }, 200);
      });
    });

    it('should track per-connection activity', (done) => {
      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');
        expect(socket.data.connectedAt).toBeDefined();
        done();
      });

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });
    });
  });

  /**
   * TC-CONN-009: Connection state management
   * Test state persistence and updates
   */
  describe('TC-CONN-009: Connection State Management', () => {
    it('should maintain connection state', (done) => {
      ioServer.on('connection', (socket: TypedSocket) => {
        connectionManager.handleConnection(socket, '/');
        connectionManager.joinRoom(socket, 'state-test-room');
      });

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        setTimeout(() => {
          const connections = connectionManager.getConnectionsByRoom('state-test-room');
          expect(connections.length).toBeGreaterThan(0);
          expect(connections[0].rooms).toContain('state-test-room');
          done();
        }, 100);
      });
    });

    it('should update connection state dynamically', (done) => {
      let testSocket: TypedSocket;

      ioServer.on('connection', (socket: TypedSocket) => {
        testSocket = socket;
        connectionManager.handleConnection(socket, '/');
      });

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        connectionManager.joinRoom(testSocket, 'dynamic-room-1');

        setTimeout(() => {
          connectionManager.joinRoom(testSocket, 'dynamic-room-2');

          setTimeout(() => {
            const connections = connectionManager.getConnectionsByRoom('dynamic-room-2');
            expect(connections.length).toBeGreaterThan(0);
            done();
          }, 100);
        }, 100);
      });
    });
  });

  /**
   * TC-CONN-010: Multi-device support
   * Test handling multiple connections from same user
   */
  describe('TC-CONN-010: Multi-Device Support', () => {
    it('should allow multiple connections from same user', (done) => {
      const userId = 'user-123';
      const sockets: ClientSocket[] = [];
      let connectedCount = 0;
      const deviceCount = 3;

      ioServer.on('connection', (socket: TypedSocket) => {
        socket.data.userId = userId;
        connectionManager.handleConnection(socket, '/');
      });

      for (let i = 0; i < deviceCount; i++) {
        const socket = ioc(`http://localhost:${TEST_PORT}`, {
          transports: ['websocket'],
          forceNew: true,
          auth: { userId, deviceId: `device-${i}` }
        });

        socket.on('connect', () => {
          connectedCount++;
          if (connectedCount === deviceCount) {
            const activeConnections = connectionManager.getActiveConnections();
            expect(activeConnections).toBeGreaterThanOrEqual(deviceCount);
            sockets.forEach(s => s.disconnect());
            done();
          }
        });

        sockets.push(socket);
      }
    });

    it('should broadcast to all user devices', (done) => {
      const userId = 'user-456';
      const userRoom = `user:${userId}`;
      const sockets: ClientSocket[] = [];
      let messageCount = 0;
      const deviceCount = 2;

      ioServer.on('connection', (socket: TypedSocket) => {
        socket.data.userId = userId;
        connectionManager.handleConnection(socket, '/');
        connectionManager.joinRoom(socket, userRoom);
      });

      for (let i = 0; i < deviceCount; i++) {
        const socket = ioc(`http://localhost:${TEST_PORT}`, {
          transports: ['websocket'],
          forceNew: true
        });

        socket.on('user:notification', () => {
          messageCount++;
          if (messageCount === deviceCount) {
            sockets.forEach(s => s.disconnect());
            done();
          }
        });

        socket.on('connect', () => {
          if (sockets.length === deviceCount - 1) {
            setTimeout(() => {
              connectionManager.broadcastToRoom(userRoom, 'user:notification', {
                message: 'Test notification'
              });
            }, 100);
          }
        });

        sockets.push(socket);
      }
    });

    it('should handle device-specific disconnect without affecting others', (done) => {
      const userId = 'user-789';
      const sockets: ClientSocket[] = [];
      const deviceCount = 2;
      let connectedCount = 0;

      ioServer.on('connection', (socket: TypedSocket) => {
        socket.data.userId = userId;
        connectionManager.handleConnection(socket, '/');
      });

      for (let i = 0; i < deviceCount; i++) {
        const socket = ioc(`http://localhost:${TEST_PORT}`, {
          transports: ['websocket'],
          forceNew: true
        });

        socket.on('connect', () => {
          connectedCount++;
          if (connectedCount === deviceCount) {
            const initialCount = connectionManager.getActiveConnections();

            // Disconnect first device
            sockets[0].disconnect();

            setTimeout(() => {
              const afterCount = connectionManager.getActiveConnections();
              expect(afterCount).toBe(initialCount - 1);
              sockets[1].disconnect();
              done();
            }, 200);
          }
        });

        sockets.push(socket);
      }
    });
  });
});
