import {
  createTestServer,
  createTestClient,
  waitForEvent,
  createTestLeaderboardData,
  TestServerSetup,
  TestClient,
  disconnectAllClients,
  createMockRedisClient,
} from '../utils/websocketTestUtils';

describe('Leaderboard WebSocket Events', () => {
  let testServer: TestServerSetup;
  let clients: TestClient[] = [];
  let mockRedis: ReturnType<typeof createMockRedisClient>;

  beforeEach(async () => {
    testServer = await createTestServer();
    mockRedis = createMockRedisClient();

    // Setup leaderboard event handlers
    testServer.io.on('connection', (socket) => {
      socket.on('subscribe-leaderboard', (category: string, callback) => {
        const roomName = `leaderboard:${category}`;
        socket.join(roomName);
        callback({ success: true, room: roomName });
      });

      socket.on('unsubscribe-leaderboard', (category: string, callback) => {
        const roomName = `leaderboard:${category}`;
        socket.leave(roomName);
        callback({ success: true, room: roomName });
      });

      socket.on('request-leaderboard', (category: string, callback) => {
        const leaderboardData = createTestLeaderboardData(10);
        callback({ success: true, data: leaderboardData });
      });
    });
  });

  afterEach(async () => {
    disconnectAllClients(clients);
    clients = [];
    await testServer.cleanup();
  });

  describe('Subscription Management', () => {
    it('should allow client to subscribe to global leaderboard', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const response = await new Promise((resolve) => {
        client.socket.emit('subscribe-leaderboard', 'global', resolve);
      });

      expect(response).toEqual({
        success: true,
        room: 'leaderboard:global',
      });
    });

    it('should allow client to subscribe to division leaderboard', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const response = await new Promise((resolve) => {
        client.socket.emit('subscribe-leaderboard', 'diamond', resolve);
      });

      expect(response).toEqual({
        success: true,
        room: 'leaderboard:diamond',
      });
    });

    it('should allow client to subscribe to multiple leaderboards', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const response1 = await new Promise((resolve) => {
        client.socket.emit('subscribe-leaderboard', 'global', resolve);
      });

      const response2 = await new Promise((resolve) => {
        client.socket.emit('subscribe-leaderboard', 'diamond', resolve);
      });

      expect(response1).toEqual({
        success: true,
        room: 'leaderboard:global',
      });
      expect(response2).toEqual({
        success: true,
        room: 'leaderboard:diamond',
      });
    });

    it('should allow client to unsubscribe from leaderboard', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      await new Promise((resolve) => {
        client.socket.emit('subscribe-leaderboard', 'global', resolve);
      });

      const response = await new Promise((resolve) => {
        client.socket.emit('unsubscribe-leaderboard', 'global', resolve);
      });

      expect(response).toEqual({
        success: true,
        room: 'leaderboard:global',
      });
    });
  });

  describe('Real-time Leaderboard Updates', () => {
    it('should broadcast leaderboard update to subscribed clients', async () => {
      const client1 = createTestClient(testServer.port);
      const client2 = createTestClient(testServer.port);
      clients.push(client1, client2);

      await Promise.all([
        waitForEvent(client1.socket, 'connect'),
        waitForEvent(client2.socket, 'connect'),
      ]);

      // Subscribe both clients
      await Promise.all([
        new Promise((resolve) =>
          client1.socket.emit('subscribe-leaderboard', 'global', resolve)
        ),
        new Promise((resolve) =>
          client2.socket.emit('subscribe-leaderboard', 'global', resolve)
        ),
      ]);

      // Simulate leaderboard update
      const updateData = {
        type: 'full',
        leaderboard: createTestLeaderboardData(5),
      };

      testServer.io.to('leaderboard:global').emit('leaderboard-update', updateData);

      const [update1, update2] = await Promise.all([
        waitForEvent(client1.socket, 'leaderboard-update'),
        waitForEvent(client2.socket, 'leaderboard-update'),
      ]);

      expect(update1).toEqual(updateData);
      expect(update2).toEqual(updateData);
    });

    it('should only send updates to subscribed clients', async () => {
      const subscribedClient = createTestClient(testServer.port);
      const unsubscribedClient = createTestClient(testServer.port);
      clients.push(subscribedClient, unsubscribedClient);

      await Promise.all([
        waitForEvent(subscribedClient.socket, 'connect'),
        waitForEvent(unsubscribedClient.socket, 'connect'),
      ]);

      // Only subscribe first client
      await new Promise((resolve) => {
        subscribedClient.socket.emit('subscribe-leaderboard', 'global', resolve);
      });

      const updateData = {
        type: 'full',
        leaderboard: createTestLeaderboardData(5),
      };

      testServer.io.to('leaderboard:global').emit('leaderboard-update', updateData);

      // Subscribed client should receive
      const update = await waitForEvent(
        subscribedClient.socket,
        'leaderboard-update'
      );
      expect(update).toEqual(updateData);

      // Unsubscribed client should NOT receive
      let unsubscribedReceived = false;
      unsubscribedClient.socket.once('leaderboard-update', () => {
        unsubscribedReceived = true;
      });

      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(unsubscribedReceived).toBe(false);
    });
  });

  describe('Rank Change Events', () => {
    it('should broadcast rank change event', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      await new Promise((resolve) => {
        client.socket.emit('subscribe-leaderboard', 'global', resolve);
      });

      const rankChange = {
        playerId: 'player-123',
        username: 'TestPlayer',
        oldRank: 5,
        newRank: 3,
        ratingChange: +45,
        timestamp: new Date().toISOString(),
      };

      testServer.io.to('leaderboard:global').emit('rank-change', rankChange);

      const receivedEvent = await waitForEvent(client.socket, 'rank-change');
      expect(receivedEvent).toEqual(rankChange);
    });

    it('should handle multiple concurrent rank changes', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      await new Promise((resolve) => {
        client.socket.emit('subscribe-leaderboard', 'global', resolve);
      });

      const rankChanges = [
        {
          playerId: 'player-1',
          oldRank: 5,
          newRank: 3,
          ratingChange: +45,
        },
        {
          playerId: 'player-2',
          oldRank: 8,
          newRank: 10,
          ratingChange: -25,
        },
        {
          playerId: 'player-3',
          oldRank: 15,
          newRank: 12,
          ratingChange: +30,
        },
      ];

      const receivedEvents: any[] = [];
      const eventPromise = new Promise((resolve) => {
        client.socket.on('rank-change', (data) => {
          receivedEvents.push(data);
          if (receivedEvents.length === rankChanges.length) {
            resolve(receivedEvents);
          }
        });
      });

      // Emit all rank changes
      rankChanges.forEach((change) => {
        testServer.io.to('leaderboard:global').emit('rank-change', change);
      });

      await eventPromise;

      expect(receivedEvents).toHaveLength(3);
      expect(receivedEvents).toEqual(
        expect.arrayContaining(rankChanges)
      );
    });
  });

  describe('Efficient Diff Broadcasting', () => {
    it('should send only changed entries in diff update', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      await new Promise((resolve) => {
        client.socket.emit('subscribe-leaderboard', 'global', resolve);
      });

      const diffUpdate = {
        type: 'diff',
        changes: [
          {
            playerId: 'player-123',
            rank: 5,
            rating: 1550,
            change: 'rank_up',
          },
          {
            playerId: 'player-456',
            rank: 8,
            rating: 1490,
            change: 'rank_down',
          },
        ],
        timestamp: new Date().toISOString(),
      };

      testServer.io.to('leaderboard:global').emit('leaderboard-diff', diffUpdate);

      const receivedDiff = await waitForEvent(client.socket, 'leaderboard-diff');
      expect(receivedDiff).toEqual(diffUpdate);
      expect(receivedDiff.changes).toHaveLength(2);
    });

    it('should handle empty diff updates', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      await new Promise((resolve) => {
        client.socket.emit('subscribe-leaderboard', 'global', resolve);
      });

      const emptyDiff = {
        type: 'diff',
        changes: [],
        timestamp: new Date().toISOString(),
      };

      testServer.io.to('leaderboard:global').emit('leaderboard-diff', emptyDiff);

      const receivedDiff = await waitForEvent(client.socket, 'leaderboard-diff');
      expect(receivedDiff.changes).toEqual([]);
    });

    it('should send full update after threshold of diffs', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      await new Promise((resolve) => {
        client.socket.emit('subscribe-leaderboard', 'global', resolve);
      });

      // Simulate multiple diff updates
      const diffCount = 10;
      for (let i = 0; i < diffCount; i++) {
        const diff = {
          type: 'diff',
          changes: [{ playerId: `player-${i}`, rank: i + 1 }],
        };
        testServer.io.to('leaderboard:global').emit('leaderboard-diff', diff);
      }

      // After threshold, send full update
      const fullUpdate = {
        type: 'full',
        leaderboard: createTestLeaderboardData(10),
        reason: 'diff_threshold_exceeded',
      };

      testServer.io.to('leaderboard:global').emit('leaderboard-update', fullUpdate);

      const receivedUpdate = await waitForEvent(
        client.socket,
        'leaderboard-update'
      );
      expect(receivedUpdate.type).toBe('full');
      expect(receivedUpdate.reason).toBe('diff_threshold_exceeded');
    });
  });

  describe('Request Leaderboard Data', () => {
    it('should respond with current leaderboard on request', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const response = await new Promise((resolve) => {
        client.socket.emit('request-leaderboard', 'global', resolve);
      });

      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('data');
      expect((response as any).data).toHaveLength(10);
    });

    it('should handle pagination in leaderboard request', async () => {
      testServer.io.on('connection', (socket) => {
        socket.on(
          'request-leaderboard-page',
          (params: { category: string; page: number; limit: number }, callback) => {
            const fullData = createTestLeaderboardData(100);
            const start = (params.page - 1) * params.limit;
            const end = start + params.limit;
            const pageData = fullData.slice(start, end);

            callback({
              success: true,
              data: pageData,
              page: params.page,
              totalPages: Math.ceil(fullData.length / params.limit),
            });
          }
        );
      });

      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const response = await new Promise((resolve) => {
        client.socket.emit(
          'request-leaderboard-page',
          { category: 'global', page: 2, limit: 10 },
          resolve
        );
      });

      expect(response).toHaveProperty('success', true);
      expect((response as any).data).toHaveLength(10);
      expect((response as any).page).toBe(2);
      expect((response as any).totalPages).toBe(10);
    });
  });

  describe('Division-Specific Updates', () => {
    it('should broadcast updates only to specific division', async () => {
      const diamondClient = createTestClient(testServer.port);
      const platinumClient = createTestClient(testServer.port);
      clients.push(diamondClient, platinumClient);

      await Promise.all([
        waitForEvent(diamondClient.socket, 'connect'),
        waitForEvent(platinumClient.socket, 'connect'),
      ]);

      await new Promise((resolve) => {
        diamondClient.socket.emit('subscribe-leaderboard', 'diamond', resolve);
      });
      await new Promise((resolve) => {
        platinumClient.socket.emit('subscribe-leaderboard', 'platinum', resolve);
      });

      const diamondUpdate = {
        division: 'diamond',
        leaderboard: createTestLeaderboardData(5),
      };

      testServer.io
        .to('leaderboard:diamond')
        .emit('leaderboard-update', diamondUpdate);

      // Diamond client should receive
      const receivedUpdate = await waitForEvent(
        diamondClient.socket,
        'leaderboard-update'
      );
      expect(receivedUpdate).toEqual(diamondUpdate);

      // Platinum client should NOT receive
      let platinumReceived = false;
      platinumClient.socket.once('leaderboard-update', () => {
        platinumReceived = true;
      });

      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(platinumReceived).toBe(false);
    });
  });
});
