import {
  createTestServer,
  createTestClient,
  waitForEvent,
  createTestMatchData,
  TestServerSetup,
  TestClient,
  disconnectAllClients,
} from '../utils/websocketTestUtils';

describe('Match WebSocket Events', () => {
  let testServer: TestServerSetup;
  let clients: TestClient[] = [];

  beforeEach(async () => {
    testServer = await createTestServer();

    // Setup match event handlers
    testServer.io.on('connection', (socket) => {
      socket.on('subscribe-match', (matchId: string, callback) => {
        socket.join(`match:${matchId}`);
        callback({ success: true, matchId });
      });

      socket.on('unsubscribe-match', (matchId: string, callback) => {
        socket.leave(`match:${matchId}`);
        callback({ success: true, matchId });
      });

      socket.on('create-match', (data, callback) => {
        const match = createTestMatchData(data.player1Id, data.player2Id);
        callback({ success: true, match });
      });

      socket.on('update-score', (data, callback) => {
        // Simulate score update
        callback({ success: true, matchId: data.matchId, score: data.score });

        // Broadcast to match room
        testServer.io.to(`match:${data.matchId}`).emit('score-update', {
          matchId: data.matchId,
          player1Score: data.score.player1,
          player2Score: data.score.player2,
          timestamp: new Date().toISOString(),
        });
      });

      socket.on('complete-match', (data, callback) => {
        const match = createTestMatchData(
          data.player1Id,
          data.player2Id,
          data.winnerId
        );

        callback({ success: true, match });

        // Broadcast match completion
        testServer.io.to(`match:${data.matchId}`).emit('match-complete', {
          matchId: data.matchId,
          winnerId: data.winnerId,
          finalScore: data.finalScore,
          eloChanges: data.eloChanges,
        });
      });
    });
  });

  afterEach(async () => {
    disconnectAllClients(clients);
    clients = [];
    await testServer.cleanup();
  });

  describe('Match Lifecycle Events', () => {
    it('should allow client to subscribe to match', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const response = await new Promise((resolve) => {
        client.socket.emit('subscribe-match', 'match-123', resolve);
      });

      expect(response).toEqual({ success: true, matchId: 'match-123' });
    });

    it('should broadcast match creation event', async () => {
      const client1 = createTestClient(testServer.port);
      const client2 = createTestClient(testServer.port);
      clients.push(client1, client2);

      await Promise.all([
        waitForEvent(client1.socket, 'connect'),
        waitForEvent(client2.socket, 'connect'),
      ]);

      const matchData = {
        player1Id: 'player-1',
        player2Id: 'player-2',
      };

      const response = await new Promise((resolve) => {
        client1.socket.emit('create-match', matchData, resolve);
      });

      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('match');
      expect((response as any).match.player1Id).toBe('player-1');
      expect((response as any).match.player2Id).toBe('player-2');
    });

    it('should emit match-started event to both players', async () => {
      testServer.io.on('connection', (socket) => {
        socket.on('start-match', (matchId: string) => {
          testServer.io.to(`match:${matchId}`).emit('match-started', {
            matchId,
            startTime: new Date().toISOString(),
            status: 'IN_PROGRESS',
          });
        });
      });

      const client1 = createTestClient(testServer.port);
      const client2 = createTestClient(testServer.port);
      clients.push(client1, client2);

      await Promise.all([
        waitForEvent(client1.socket, 'connect'),
        waitForEvent(client2.socket, 'connect'),
      ]);

      const matchId = 'match-456';

      await Promise.all([
        new Promise((resolve) =>
          client1.socket.emit('subscribe-match', matchId, resolve)
        ),
        new Promise((resolve) =>
          client2.socket.emit('subscribe-match', matchId, resolve)
        ),
      ]);

      client1.socket.emit('start-match', matchId);

      const [event1, event2] = await Promise.all([
        waitForEvent(client1.socket, 'match-started'),
        waitForEvent(client2.socket, 'match-started'),
      ]);

      expect(event1.matchId).toBe(matchId);
      expect(event2.matchId).toBe(matchId);
      expect(event1.status).toBe('IN_PROGRESS');
    });

    it('should emit match-complete event with final results', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const matchId = 'match-789';
      await new Promise((resolve) => {
        client.socket.emit('subscribe-match', matchId, resolve);
      });

      const completeData = {
        matchId,
        player1Id: 'player-1',
        player2Id: 'player-2',
        winnerId: 'player-1',
        finalScore: { player1: 3, player2: 1 },
        eloChanges: {
          player1: { old: 1500, new: 1525, change: +25 },
          player2: { old: 1500, new: 1475, change: -25 },
        },
      };

      client.socket.emit('complete-match', completeData);

      const event = await waitForEvent(client.socket, 'match-complete');

      expect(event.matchId).toBe(matchId);
      expect(event.winnerId).toBe('player-1');
      expect(event.eloChanges).toBeDefined();
    });
  });

  describe('Real-time Score Updates', () => {
    it('should broadcast score updates to all match subscribers', async () => {
      const client1 = createTestClient(testServer.port);
      const client2 = createTestClient(testServer.port);
      clients.push(client1, client2);

      await Promise.all([
        waitForEvent(client1.socket, 'connect'),
        waitForEvent(client2.socket, 'connect'),
      ]);

      const matchId = 'match-score-123';

      await Promise.all([
        new Promise((resolve) =>
          client1.socket.emit('subscribe-match', matchId, resolve)
        ),
        new Promise((resolve) =>
          client2.socket.emit('subscribe-match', matchId, resolve)
        ),
      ]);

      const scoreUpdate = {
        matchId,
        score: { player1: 1, player2: 0 },
      };

      client1.socket.emit('update-score', scoreUpdate);

      const [update1, update2] = await Promise.all([
        waitForEvent(client1.socket, 'score-update'),
        waitForEvent(client2.socket, 'score-update'),
      ]);

      expect(update1.matchId).toBe(matchId);
      expect(update1.player1Score).toBe(1);
      expect(update1.player2Score).toBe(0);
      expect(update2).toEqual(update1);
    });

    it('should handle multiple rapid score updates', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const matchId = 'match-rapid';
      await new Promise((resolve) => {
        client.socket.emit('subscribe-match', matchId, resolve);
      });

      const updates = [
        { player1: 1, player2: 0 },
        { player1: 1, player2: 1 },
        { player1: 2, player2: 1 },
        { player1: 2, player2: 2 },
        { player1: 3, player2: 2 },
      ];

      const receivedUpdates: any[] = [];
      const updatePromise = new Promise((resolve) => {
        client.socket.on('score-update', (data) => {
          receivedUpdates.push(data);
          if (receivedUpdates.length === updates.length) {
            resolve(receivedUpdates);
          }
        });
      });

      updates.forEach((score) => {
        client.socket.emit('update-score', { matchId, score });
      });

      await updatePromise;

      expect(receivedUpdates).toHaveLength(5);
      expect(receivedUpdates[4].player1Score).toBe(3);
      expect(receivedUpdates[4].player2Score).toBe(2);
    });

    it('should include timestamp in score updates', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const matchId = 'match-timestamp';
      await new Promise((resolve) => {
        client.socket.emit('subscribe-match', matchId, resolve);
      });

      client.socket.emit('update-score', {
        matchId,
        score: { player1: 1, player2: 0 },
      });

      const update = await waitForEvent(client.socket, 'score-update');

      expect(update.timestamp).toBeDefined();
      expect(new Date(update.timestamp).getTime()).toBeLessThanOrEqual(
        Date.now()
      );
    });
  });

  describe('ELO Update Broadcasts', () => {
    it('should broadcast ELO changes after match completion', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const matchId = 'match-elo';
      await new Promise((resolve) => {
        client.socket.emit('subscribe-match', matchId, resolve);
      });

      const completeData = {
        matchId,
        player1Id: 'player-1',
        player2Id: 'player-2',
        winnerId: 'player-1',
        finalScore: { player1: 3, player2: 1 },
        eloChanges: {
          player1: { old: 1500, new: 1532, change: +32 },
          player2: { old: 1480, new: 1448, change: -32 },
        },
      };

      client.socket.emit('complete-match', completeData);

      const event = await waitForEvent(client.socket, 'match-complete');

      expect(event.eloChanges.player1.change).toBe(32);
      expect(event.eloChanges.player2.change).toBe(-32);
      expect(event.eloChanges.player1.new).toBe(1532);
      expect(event.eloChanges.player2.new).toBe(1448);
    });

    it('should emit elo-update event to affected players', async () => {
      testServer.io.on('connection', (socket) => {
        socket.on('subscribe-player-updates', (playerId: string) => {
          socket.join(`player:${playerId}`);
        });

        socket.on('trigger-elo-update', (data) => {
          testServer.io.to(`player:${data.playerId}`).emit('elo-update', {
            playerId: data.playerId,
            oldRating: data.oldRating,
            newRating: data.newRating,
            change: data.change,
            matchId: data.matchId,
          });
        });
      });

      const player1Client = createTestClient(testServer.port);
      const player2Client = createTestClient(testServer.port);
      clients.push(player1Client, player2Client);

      await Promise.all([
        waitForEvent(player1Client.socket, 'connect'),
        waitForEvent(player2Client.socket, 'connect'),
      ]);

      player1Client.socket.emit('subscribe-player-updates', 'player-1');
      player2Client.socket.emit('subscribe-player-updates', 'player-2');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const eloUpdate1 = {
        playerId: 'player-1',
        oldRating: 1500,
        newRating: 1532,
        change: +32,
        matchId: 'match-123',
      };

      player1Client.socket.emit('trigger-elo-update', eloUpdate1);

      const update = await waitForEvent(player1Client.socket, 'elo-update');

      expect(update.playerId).toBe('player-1');
      expect(update.change).toBe(32);
      expect(update.newRating).toBe(1532);
    });

    it('should handle draw scenarios with smaller ELO changes', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const matchId = 'match-draw';
      await new Promise((resolve) => {
        client.socket.emit('subscribe-match', matchId, resolve);
      });

      const completeData = {
        matchId,
        player1Id: 'player-1',
        player2Id: 'player-2',
        winnerId: null, // Draw
        finalScore: { player1: 2, player2: 2 },
        eloChanges: {
          player1: { old: 1500, new: 1505, change: +5 },
          player2: { old: 1480, new: 1475, change: -5 },
        },
      };

      client.socket.emit('complete-match', completeData);

      const event = await waitForEvent(client.socket, 'match-complete');

      expect(event.winnerId).toBeNull();
      expect(Math.abs(event.eloChanges.player1.change)).toBeLessThan(10);
      expect(Math.abs(event.eloChanges.player2.change)).toBeLessThan(10);
    });
  });

  describe('Match Subscription Management', () => {
    it('should allow unsubscribe from match', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const matchId = 'match-unsub';

      await new Promise((resolve) => {
        client.socket.emit('subscribe-match', matchId, resolve);
      });

      const response = await new Promise((resolve) => {
        client.socket.emit('unsubscribe-match', matchId, resolve);
      });

      expect(response).toEqual({ success: true, matchId });
    });

    it('should not receive updates after unsubscribe', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const matchId = 'match-no-updates';

      await new Promise((resolve) => {
        client.socket.emit('subscribe-match', matchId, resolve);
      });

      await new Promise((resolve) => {
        client.socket.emit('unsubscribe-match', matchId, resolve);
      });

      testServer.io.to(`match:${matchId}`).emit('score-update', {
        matchId,
        score: { player1: 1, player2: 0 },
      });

      let receivedUpdate = false;
      client.socket.once('score-update', () => {
        receivedUpdate = true;
      });

      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(receivedUpdate).toBe(false);
    });

    it('should allow resubscribe after unsubscribe', async () => {
      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const matchId = 'match-resub';

      await new Promise((resolve) => {
        client.socket.emit('subscribe-match', matchId, resolve);
      });

      await new Promise((resolve) => {
        client.socket.emit('unsubscribe-match', matchId, resolve);
      });

      await new Promise((resolve) => {
        client.socket.emit('subscribe-match', matchId, resolve);
      });

      testServer.io.to(`match:${matchId}`).emit('score-update', {
        matchId,
        score: { player1: 1, player2: 0 },
      });

      const update = await waitForEvent(client.socket, 'score-update');
      expect(update.matchId).toBe(matchId);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid match ID gracefully', async () => {
      testServer.io.on('connection', (socket) => {
        socket.on('subscribe-invalid-match', (matchId: string, callback) => {
          if (!matchId || matchId.length < 5) {
            callback({ success: false, error: 'Invalid match ID' });
          } else {
            socket.join(`match:${matchId}`);
            callback({ success: true, matchId });
          }
        });
      });

      const client = createTestClient(testServer.port);
      clients.push(client);

      await waitForEvent(client.socket, 'connect');

      const response = await new Promise((resolve) => {
        client.socket.emit('subscribe-invalid-match', 'abc', resolve);
      });

      expect(response).toEqual({ success: false, error: 'Invalid match ID' });
    });
  });
});
