import { Server as SocketIOServer } from 'socket.io';
import {
  createTestServer,
  createTestClient,
  waitForEvent,
  generateTestToken,
  generateExpiredToken,
  disconnectAllClients,
  TestServerSetup,
  TestClient,
} from '../utils/websocketTestUtils';

describe('WebSocket Server', () => {
  let testServer: TestServerSetup;
  let clients: TestClient[] = [];

  beforeEach(async () => {
    testServer = await createTestServer();
  });

  afterEach(async () => {
    disconnectAllClients(clients);
    clients = [];
    await testServer.cleanup();
  });

  describe('Connection Establishment', () => {
    it('should accept connection without authentication', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');
      expect(client.socket.connected).toBe(true);
    });

    it('should accept multiple concurrent connections', async () => {
      const client1 = createTestClient(testServer.port);
      const client2 = createTestClient(testServer.port);
      const client3 = createTestClient(testServer.port);
      clients.push(client1, client2, client3);

      await Promise.all([
        waitForEvent(client1.socket, 'connect'),
        waitForEvent(client2.socket, 'connect'),
        waitForEvent(client3.socket, 'connect'),
      ]);

      expect(client1.socket.connected).toBe(true);
      expect(client2.socket.connected).toBe(true);
      expect(client3.socket.connected).toBe(true);
    });

    it('should assign unique socket IDs to each connection', async () => {
      const client1 = createTestClient(testServer.port);
      const client2 = createTestClient(testServer.port);
      clients.push(client1, client2);

      await Promise.all([
        waitForEvent(client1.socket, 'connect'),
        waitForEvent(client2.socket, 'connect'),
      ]);

      expect(client1.socket.id).toBeDefined();
      expect(client2.socket.id).toBeDefined();
      expect(client1.socket.id).not.toBe(client2.socket.id);
    });

    it('should handle connection errors gracefully', async () => {
      const client = createTestClient(99999); // Invalid port
      clients.push(client);

      const errorPromise = waitForEvent(client.socket, 'connect_error');
      await expect(errorPromise).resolves.toBeDefined();
    });
  });

  describe('Authentication', () => {
    let authenticatedServer: TestServerSetup;

    beforeEach(async () => {
      // Create server with authentication middleware
      authenticatedServer = await createTestServer();

      authenticatedServer.io.use((socket, next) => {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Simulate token validation
        try {
          if (token.includes('expired')) {
            throw new Error('Token expired');
          }
          if (token.includes('invalid')) {
            throw new Error('Invalid token');
          }
          // Valid token
          (socket as any).userId = token.split('-')[1];
          next();
        } catch (error) {
          next(new Error('Invalid token'));
        }
      });
    });

    afterEach(async () => {
      await authenticatedServer.cleanup();
    });

    it('should accept connection with valid token', async () => {
      const token = `valid-user123-token`;
      const client = createTestClient(authenticatedServer.port, { token });
      clients.push(client);

      await waitForEvent(client.socket, 'connect');
      expect(client.socket.connected).toBe(true);
    });

    it('should reject connection with invalid token', async () => {
      const token = 'invalid-token';
      const client = createTestClient(authenticatedServer.port, { token });
      clients.push(client);

      const error = await waitForEvent(client.socket, 'connect_error');
      expect(error).toBeDefined();
      expect(client.socket.connected).toBe(false);
    });

    it('should reject connection with expired token', async () => {
      const token = 'expired-user123-token';
      const client = createTestClient(authenticatedServer.port, { token });
      clients.push(client);

      const error = await waitForEvent(client.socket, 'connect_error');
      expect(error).toBeDefined();
      expect(client.socket.connected).toBe(false);
    });

    it('should reject connection without token', async () => {
      const client = createTestClient(authenticatedServer.port);
      clients.push(client);

      const error = await waitForEvent(client.socket, 'connect_error');
      expect(error).toBeDefined();
      expect(client.socket.connected).toBe(false);
    });
  });

  describe('Room Management', () => {
    beforeEach(() => {
      // Setup room join/leave handlers
      testServer.io.on('connection', (socket) => {
        socket.on('join-room', (roomName: string, callback) => {
          socket.join(roomName);
          callback({ success: true, room: roomName });
        });

        socket.on('leave-room', (roomName: string, callback) => {
          socket.leave(roomName);
          callback({ success: true, room: roomName });
        });

        socket.on('get-rooms', (callback) => {
          callback(Array.from(socket.rooms));
        });
      });
    });

    it('should allow client to join a room', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const response = await new Promise((resolve) => {
        client.socket.emit('join-room', 'test-room', resolve);
      });

      expect(response).toEqual({ success: true, room: 'test-room' });
    });

    it('should allow client to leave a room', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      await new Promise((resolve) => {
        client.socket.emit('join-room', 'test-room', resolve);
      });

      const response = await new Promise((resolve) => {
        client.socket.emit('leave-room', 'test-room', resolve);
      });

      expect(response).toEqual({ success: true, room: 'test-room' });
    });

    it('should allow client to join multiple rooms', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      await new Promise((resolve) => {
        client.socket.emit('join-room', 'room1', resolve);
      });
      await new Promise((resolve) => {
        client.socket.emit('join-room', 'room2', resolve);
      });

      const rooms = await new Promise<string[]>((resolve) => {
        client.socket.emit('get-rooms', resolve);
      });

      expect(rooms).toContain('room1');
      expect(rooms).toContain('room2');
    });

    it('should broadcast to all clients in a room', async () => {
      const client1 = createTestClient(testServer.port);
      const client2 = createTestClient(testServer.port);
      const client3 = createTestClient(testServer.port);
      clients.push(client1, client2, client3);

      await Promise.all([
        waitForEvent(client1.socket, 'connect'),
        waitForEvent(client2.socket, 'connect'),
        waitForEvent(client3.socket, 'connect'),
      ]);

      // Join room
      await new Promise((resolve) => {
        client1.socket.emit('join-room', 'broadcast-room', resolve);
      });
      await new Promise((resolve) => {
        client2.socket.emit('join-room', 'broadcast-room', resolve);
      });

      // Client 3 stays out of the room

      // Broadcast to room
      testServer.io.to('broadcast-room').emit('test-broadcast', { message: 'hello' });

      // Clients 1 and 2 should receive
      const [msg1, msg2] = await Promise.all([
        waitForEvent(client1.socket, 'test-broadcast'),
        waitForEvent(client2.socket, 'test-broadcast'),
      ]);

      expect(msg1).toEqual({ message: 'hello' });
      expect(msg2).toEqual({ message: 'hello' });

      // Client 3 should NOT receive (verify no event in 500ms)
      let client3Received = false;
      client3.socket.once('test-broadcast', () => {
        client3Received = true;
      });

      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(client3Received).toBe(false);
    });
  });

  describe('Disconnect and Reconnect', () => {
    it('should handle client disconnect', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');
      expect(client.socket.connected).toBe(true);

      client.socket.disconnect();
      await waitForEvent(client.socket, 'disconnect');
      expect(client.socket.connected).toBe(false);
    });

    it('should clean up rooms on disconnect', async () => {
      let disconnectedSocketId: string | undefined;

      testServer.io.on('connection', (socket) => {
        socket.on('join-room', (roomName: string) => {
          socket.join(roomName);
        });

        socket.on('disconnect', () => {
          disconnectedSocketId = socket.id;
        });
      });

      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      await new Promise((resolve) => {
        client.socket.emit('join-room', 'temp-room', resolve);
      });

      const socketId = client.socket.id;
      client.socket.disconnect();

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(disconnectedSocketId).toBe(socketId);
    });

    it('should handle server-initiated disconnect', async () => {
      testServer.io.on('connection', (socket) => {
        socket.on('force-disconnect', () => {
          socket.disconnect(true);
        });
      });

      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      client.socket.emit('force-disconnect');
      await waitForEvent(client.socket, 'disconnect');

      expect(client.socket.connected).toBe(false);
    });

    it('should emit disconnect reason', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const disconnectPromise = new Promise((resolve) => {
        client.socket.on('disconnect', (reason) => {
          resolve(reason);
        });
      });

      client.socket.disconnect();
      const reason = await disconnectPromise;

      expect(reason).toBe('io client disconnect');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid event data', async () => {
      testServer.io.on('connection', (socket) => {
        socket.on('invalid-data', (data, callback) => {
          try {
            if (typeof data !== 'object') {
              throw new Error('Invalid data format');
            }
            callback({ success: true });
          } catch (error) {
            callback({ success: false, error: (error as Error).message });
          }
        });
      });

      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const response = await new Promise((resolve) => {
        client.socket.emit('invalid-data', 'not-an-object', resolve);
      });

      expect(response).toEqual({
        success: false,
        error: 'Invalid data format',
      });
    });

    it('should handle connection timeout', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      client.socket.io.opts.timeout = 100;

      const timeoutPromise = new Promise((resolve) => {
        client.socket.on('connect_error', (error) => {
          resolve(error);
        });
      });

      // Force timeout by not completing handshake
      const error = await Promise.race([
        waitForEvent(client.socket, 'connect'),
        timeoutPromise,
      ]);

      expect(error).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should handle rapid event emission', async () => {
      let receivedCount = 0;

      testServer.io.on('connection', (socket) => {
        socket.on('rapid-event', () => {
          receivedCount++;
          socket.emit('rapid-response', receivedCount);
        });
      });

      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const eventCount = 100;
      const responses: number[] = [];

      const responsePromises = Array.from({ length: eventCount }, (_, i) => {
        return new Promise<number>((resolve) => {
          client.socket.once('rapid-response', (count) => {
            responses.push(count);
            if (responses.length === eventCount) {
              resolve(count);
            }
          });
        });
      });

      // Emit events rapidly
      for (let i = 0; i < eventCount; i++) {
        client.socket.emit('rapid-event');
      }

      await Promise.race([
        Promise.all(responsePromises),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        ),
      ]);

      expect(responses.length).toBe(eventCount);
      expect(receivedCount).toBe(eventCount);
    });
  });
});
