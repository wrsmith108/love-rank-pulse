import {
  createTestServer,
  createTestClient,
  waitForEvent,
  createMockRedisClient,
  TestServerSetup,
  TestClient,
  disconnectAllClients,
} from '../utils/websocketTestUtils';

describe('Redis Pub/Sub Integration', () => {
  let testServer: TestServerSetup;
  let clients: TestClient[] = [];
  let mockRedis: ReturnType<typeof createMockRedisClient>;
  let mockSubscriber: ReturnType<typeof createMockRedisClient>;
  let mockPublisher: ReturnType<typeof createMockRedisClient>;

  beforeEach(async () => {
    testServer = await createTestServer();
    mockRedis = createMockRedisClient();
    mockSubscriber = createMockRedisClient();
    mockPublisher = createMockRedisClient();

    // Setup pub/sub handlers
    testServer.io.on('connection', (socket) => {
      socket.on('subscribe-channel', (channel: string, callback) => {
        mockSubscriber.subscribe(channel);
        socket.join(`pubsub:${channel}`);
        callback({ success: true, channel });
      });

      socket.on('publish-message', async (data: { channel: string; message: any }, callback) => {
        const serialized = JSON.stringify(data.message);
        await mockPublisher.publish(data.channel, serialized);

        // Simulate broadcasting to all subscribers
        testServer.io.to(`pubsub:${data.channel}`).emit('channel-message', {
          channel: data.channel,
          message: data.message,
          timestamp: new Date().toISOString(),
        });

        callback({ success: true });
      });
    });
  });

  afterEach(async () => {
    disconnectAllClients(clients);
    clients = [];
    await mockRedis.quit();
    await mockSubscriber.quit();
    await mockPublisher.quit();
    await testServer.cleanup();
  });

  describe('Redis Pub/Sub Integration', () => {
    it('should subscribe to Redis channel', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const response = await new Promise((resolve) => {
        client.socket.emit('subscribe-channel', 'test-channel', resolve);
      });

      expect(response).toEqual({ success: true, channel: 'test-channel' });
      expect(mockSubscriber.subscribe).toHaveBeenCalledWith('test-channel');
    });

    it('should publish message to Redis channel', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const message = { type: 'test', data: 'hello' };
      const response = await new Promise((resolve) => {
        client.socket.emit(
          'publish-message',
          { channel: 'test-channel', message },
          resolve
        );
      });

      expect(response).toEqual({ success: true });
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'test-channel',
        JSON.stringify(message)
      );
    });

    it('should receive published messages on subscribed channel', async () => {
      const client1 = createTestClient(testServer.port);
      const client2 = createTestClient(testServer.port);
      clients.push(client1, client2);

      await Promise.all([
        waitForEvent(client1.socket, 'connect'),
        waitForEvent(client2.socket, 'connect'),
      ]);

      // Both clients subscribe
      await Promise.all([
        new Promise((resolve) =>
          client1.socket.emit('subscribe-channel', 'broadcast-channel', resolve)
        ),
        new Promise((resolve) =>
          client2.socket.emit('subscribe-channel', 'broadcast-channel', resolve)
        ),
      ]);

      const message = { type: 'notification', text: 'Hello everyone!' };

      // Client 1 publishes
      client1.socket.emit('publish-message', {
        channel: 'broadcast-channel',
        message,
      });

      // Both clients should receive
      const [msg1, msg2] = await Promise.all([
        waitForEvent(client1.socket, 'channel-message'),
        waitForEvent(client2.socket, 'channel-message'),
      ]);

      expect(msg1.message).toEqual(message);
      expect(msg2.message).toEqual(message);
    });

    it('should handle multiple channel subscriptions', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const channels = ['channel-1', 'channel-2', 'channel-3'];

      await Promise.all(
        channels.map((channel) =>
          new Promise((resolve) =>
            client.socket.emit('subscribe-channel', channel, resolve)
          )
        )
      );

      expect(mockSubscriber.subscribe).toHaveBeenCalledTimes(3);
      expect(mockSubscriber.subscribe).toHaveBeenCalledWith('channel-1');
      expect(mockSubscriber.subscribe).toHaveBeenCalledWith('channel-2');
      expect(mockSubscriber.subscribe).toHaveBeenCalledWith('channel-3');
    });

    it('should unsubscribe from Redis channel', async () => {
      testServer.io.on('connection', (socket) => {
        socket.on('unsubscribe-channel', (channel: string, callback) => {
          mockSubscriber.unsubscribe(channel);
          socket.leave(`pubsub:${channel}`);
          callback({ success: true, channel });
        });
      });

      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      await new Promise((resolve) => {
        client.socket.emit('subscribe-channel', 'temp-channel', resolve);
      });

      const response = await new Promise((resolve) => {
        client.socket.emit('unsubscribe-channel', 'temp-channel', resolve);
      });

      expect(response).toEqual({ success: true, channel: 'temp-channel' });
      expect(mockSubscriber.unsubscribe).toHaveBeenCalledWith('temp-channel');
    });
  });

  describe('Multi-Server Message Routing', () => {
    let server2: TestServerSetup;
    let mockRedis2: ReturnType<typeof createMockRedisClient>;

    beforeEach(async () => {
      server2 = await createTestServer();
      mockRedis2 = createMockRedisClient();

      // Setup second server to simulate multi-server scenario
      server2.io.on('connection', (socket) => {
        socket.on('subscribe-channel', (channel: string, callback) => {
          socket.join(`pubsub:${channel}`);
          callback({ success: true, channel });
        });
      });
    });

    afterEach(async () => {
      await mockRedis2.quit();
      await server2.cleanup();
    });

    it('should route messages across multiple server instances', async () => {
      const client1 = createTestClient(testServer.port);
      const client2 = createTestClient(server2.port);
      clients.push(client1, client2);

      await Promise.all([
        waitForEvent(client1.socket, 'connect'),
        waitForEvent(client2.socket, 'connect'),
      ]);

      await Promise.all([
        new Promise((resolve) =>
          client1.socket.emit('subscribe-channel', 'cross-server', resolve)
        ),
        new Promise((resolve) =>
          client2.socket.emit('subscribe-channel', 'cross-server', resolve)
        ),
      ]);

      const message = { type: 'cross-server', data: 'multi-server message' };

      // Simulate Redis pub/sub broadcasting to both servers
      const simulateRedisPublish = (channel: string, msg: any) => {
        testServer.io.to(`pubsub:${channel}`).emit('channel-message', {
          channel,
          message: msg,
          timestamp: new Date().toISOString(),
        });

        server2.io.to(`pubsub:${channel}`).emit('channel-message', {
          channel,
          message: msg,
          timestamp: new Date().toISOString(),
        });
      };

      simulateRedisPublish('cross-server', message);

      const [msg1, msg2] = await Promise.all([
        waitForEvent(client1.socket, 'channel-message'),
        waitForEvent(client2.socket, 'channel-message'),
      ]);

      expect(msg1.message).toEqual(message);
      expect(msg2.message).toEqual(message);
    });

    it('should handle high-frequency messages across servers', async () => {
      const client1 = createTestClient(testServer.port);
      const client2 = createTestClient(server2.port);
      clients.push(client1, client2);

      await Promise.all([
        waitForEvent(client1.socket, 'connect'),
        waitForEvent(client2.socket, 'connect'),
      ]);

      await Promise.all([
        new Promise((resolve) =>
          client1.socket.emit('subscribe-channel', 'high-freq', resolve)
        ),
        new Promise((resolve) =>
          client2.socket.emit('subscribe-channel', 'high-freq', resolve)
        ),
      ]);

      const messageCount = 50;
      const receivedMessages1: any[] = [];
      const receivedMessages2: any[] = [];

      const promise1 = new Promise((resolve) => {
        client1.socket.on('channel-message', (msg) => {
          receivedMessages1.push(msg);
          if (receivedMessages1.length === messageCount) {
            resolve(receivedMessages1);
          }
        });
      });

      const promise2 = new Promise((resolve) => {
        client2.socket.on('channel-message', (msg) => {
          receivedMessages2.push(msg);
          if (receivedMessages2.length === messageCount) {
            resolve(receivedMessages2);
          }
        });
      });

      // Simulate rapid message publishing
      for (let i = 0; i < messageCount; i++) {
        const msg = { id: i, data: `message-${i}` };
        testServer.io.to('pubsub:high-freq').emit('channel-message', {
          channel: 'high-freq',
          message: msg,
        });
        server2.io.to('pubsub:high-freq').emit('channel-message', {
          channel: 'high-freq',
          message: msg,
        });
      }

      await Promise.all([promise1, promise2]);

      expect(receivedMessages1).toHaveLength(messageCount);
      expect(receivedMessages2).toHaveLength(messageCount);
    });
  });

  describe('Message Serialization', () => {
    it('should serialize and deserialize JSON messages', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      await new Promise((resolve) => {
        client.socket.emit('subscribe-channel', 'json-channel', resolve);
      });

      const complexMessage = {
        id: 123,
        type: 'complex',
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' },
        },
        timestamp: new Date().toISOString(),
      };

      client.socket.emit('publish-message', {
        channel: 'json-channel',
        message: complexMessage,
      });

      const received = await waitForEvent(client.socket, 'channel-message');

      expect(received.message).toEqual(complexMessage);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'json-channel',
        JSON.stringify(complexMessage)
      );
    });

    it('should handle special characters in messages', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      await new Promise((resolve) => {
        client.socket.emit('subscribe-channel', 'special-chars', resolve);
      });

      const message = {
        text: 'Special chars: "quotes", \\backslash, \nnewline, \ttab',
        emoji: '🚀🎉💯',
        unicode: 'Ω≈ç√∫˜µ≤≥÷',
      };

      client.socket.emit('publish-message', {
        channel: 'special-chars',
        message,
      });

      const received = await waitForEvent(client.socket, 'channel-message');

      expect(received.message).toEqual(message);
    });

    it('should handle large message payloads', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      await new Promise((resolve) => {
        client.socket.emit('subscribe-channel', 'large-payload', resolve);
      });

      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: `item-${i}`,
        metadata: { index: i, type: 'test' },
      }));

      const message = { type: 'bulk-data', items: largeArray };

      client.socket.emit('publish-message', {
        channel: 'large-payload',
        message,
      });

      const received = await waitForEvent(client.socket, 'channel-message');

      expect(received.message.items).toHaveLength(1000);
      expect(received.message.items[999]).toEqual({
        id: 999,
        data: 'item-999',
        metadata: { index: 999, type: 'test' },
      });
    });

    it('should validate message format before serialization', async () => {
      testServer.io.on('connection', (socket) => {
        socket.on('publish-validated', (data, callback) => {
          // Validate message structure
          if (!data.message || typeof data.message !== 'object') {
            callback({ success: false, error: 'Invalid message format' });
            return;
          }

          if (!data.channel || typeof data.channel !== 'string') {
            callback({ success: false, error: 'Invalid channel' });
            return;
          }

          try {
            const serialized = JSON.stringify(data.message);
            mockPublisher.publish(data.channel, serialized);
            callback({ success: true });
          } catch (error) {
            callback({ success: false, error: 'Serialization failed' });
          }
        });
      });

      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      // Valid message
      const validResponse = await new Promise((resolve) => {
        client.socket.emit(
          'publish-validated',
          {
            channel: 'valid-channel',
            message: { type: 'test', data: 'valid' },
          },
          resolve
        );
      });

      expect(validResponse).toEqual({ success: true });

      // Invalid message (not an object)
      const invalidResponse = await new Promise((resolve) => {
        client.socket.emit(
          'publish-validated',
          {
            channel: 'invalid-channel',
            message: 'not-an-object',
          },
          resolve
        );
      });

      expect(invalidResponse).toEqual({
        success: false,
        error: 'Invalid message format',
      });
    });

    it('should handle circular reference errors gracefully', async () => {
      testServer.io.on('connection', (socket) => {
        socket.on('publish-circular', (data, callback) => {
          try {
            JSON.stringify(data.message);
            callback({ success: true });
          } catch (error) {
            callback({
              success: false,
              error: 'Cannot serialize circular structure',
            });
          }
        });
      });

      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      // Create circular reference
      const circular: any = { type: 'circular' };
      circular.self = circular;

      const response = await new Promise((resolve) => {
        client.socket.emit(
          'publish-circular',
          { channel: 'test', message: circular },
          resolve
        );
      });

      expect(response).toEqual({
        success: false,
        error: 'Cannot serialize circular structure',
      });
    });
  });

  describe('Channel Patterns and Namespaces', () => {
    it('should support pattern-based subscriptions', async () => {
      testServer.io.on('connection', (socket) => {
        socket.on('subscribe-pattern', (pattern: string, callback) => {
          // Simulate pattern subscription (e.g., "leaderboard:*")
          socket.join(`pattern:${pattern}`);
          callback({ success: true, pattern });
        });
      });

      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const response = await new Promise((resolve) => {
        client.socket.emit('subscribe-pattern', 'leaderboard:*', resolve);
      });

      expect(response).toEqual({ success: true, pattern: 'leaderboard:*' });
    });

    it('should route messages to pattern subscribers', async () => {
      testServer.io.on('connection', (socket) => {
        socket.on('subscribe-pattern', (pattern: string) => {
          socket.join(`pattern:${pattern}`);
        });

        socket.on('publish-to-pattern', (data) => {
          testServer.io.to(`pattern:${data.pattern}`).emit('pattern-message', {
            pattern: data.pattern,
            channel: data.channel,
            message: data.message,
          });
        });
      });

      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      client.socket.emit('subscribe-pattern', 'match:*');

      await new Promise((resolve) => setTimeout(resolve, 100));

      client.socket.emit('publish-to-pattern', {
        pattern: 'match:*',
        channel: 'match:123',
        message: { type: 'score', value: 5 },
      });

      const received = await waitForEvent(client.socket, 'pattern-message');

      expect(received.channel).toBe('match:123');
      expect(received.message.type).toBe('score');
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle Redis connection errors', async () => {
      const failingRedis = createMockRedisClient();
      failingRedis.publish = jest.fn(() => Promise.reject(new Error('Redis connection lost')));

      testServer.io.on('connection', (socket) => {
        socket.on('publish-with-error', async (data, callback) => {
          try {
            await failingRedis.publish(data.channel, JSON.stringify(data.message));
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
        client.socket.emit(
          'publish-with-error',
          { channel: 'test', message: { data: 'test' } },
          resolve
        );
      });

      expect(response).toEqual({
        success: false,
        error: 'Redis connection lost',
      });

      await failingRedis.quit();
    });

    it('should retry failed publishes', async () => {
      let attemptCount = 0;
      const retryRedis = createMockRedisClient();

      retryRedis.publish = jest.fn(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve(1);
      });

      testServer.io.on('connection', (socket) => {
        socket.on('publish-with-retry', async (data, callback) => {
          const maxRetries = 3;
          let retries = 0;

          while (retries < maxRetries) {
            try {
              await retryRedis.publish(data.channel, JSON.stringify(data.message));
              callback({ success: true, attempts: retries + 1 });
              return;
            } catch (error) {
              retries++;
              if (retries >= maxRetries) {
                callback({
                  success: false,
                  error: (error as Error).message,
                  attempts: retries,
                });
              }
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }
        });
      });

      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const response = await new Promise((resolve) => {
        client.socket.emit(
          'publish-with-retry',
          { channel: 'test', message: { data: 'test' } },
          resolve
        );
      });

      expect(response).toEqual({ success: true, attempts: 3 });
      expect(attemptCount).toBe(3);

      await retryRedis.quit();
    });
  });
});
