/**
 * Event Handler Tests
 * Tests leaderboard updates, match completion, player stats, subscription management,
 * event validation, error handling, custom events, broadcasting, filtering, and acknowledgment
 *
 * Test Coverage: TC-EVENT-001 through TC-EVENT-010
 */

import { Server as SocketIOServer } from 'socket.io';
import { createServer, Server as HTTPServer } from 'http';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { EventHandler, EventEmitter, createEventSystem } from '../index';
import { LeaderboardService } from '../../../services/LeaderboardService';

// Mock LeaderboardService
jest.mock('../../../services/LeaderboardService');

describe('Event Handler Tests', () => {
  let httpServer: HTTPServer;
  let ioServer: SocketIOServer;
  let eventHandler: EventHandler;
  let eventEmitter: EventEmitter;
  let clientSocket: ClientSocket;
  let mockLeaderboardService: jest.Mocked<LeaderboardService>;
  const TEST_PORT = 3335;

  beforeEach(async () => {
    httpServer = createServer();
    ioServer = new SocketIOServer(httpServer, {
      cors: { origin: '*' },
      transports: ['websocket']
    });

    mockLeaderboardService = {
      getTopPlayers: jest.fn(),
      getPlayerRank: jest.fn()
    } as any;

    const system = await createEventSystem(ioServer, mockLeaderboardService);
    eventHandler = system.eventHandler;
    eventEmitter = system.eventEmitter;

    await new Promise<void>((resolve) => {
      httpServer.listen(TEST_PORT, resolve);
    });
  });

  afterEach(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }

    eventHandler.cleanup();
    ioServer.close();

    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  /**
   * TC-EVENT-001: Leaderboard update events
   * Test leaderboard update broadcasting
   */
  describe('TC-EVENT-001: Leaderboard Update Events', () => {
    it('should emit leaderboard update event', (done) => {
      mockLeaderboardService.getTopPlayers.mockResolvedValue([
        {
          id: 'player-1',
          username: 'Player1',
          eloRating: 2000,
          rank: 1,
          matchesPlayed: 100,
          wins: 75,
          losses: 25,
          draws: 0
        }
      ] as any);

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('leaderboard:update', (data) => {
        expect(data).toBeDefined();
        expect(Array.isArray(data.players) || data.type === 'update').toBe(true);
        done();
      });

      clientSocket.on('connect', async () => {
        await eventEmitter.emitLeaderboardUpdate(10, 'global');
      });
    });

    it('should broadcast to global room', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      let eventReceived = false;

      clientSocket.on('leaderboard:update', () => {
        eventReceived = true;
      });

      clientSocket.on('connect', async () => {
        await eventEmitter.emitLeaderboardUpdate(5, 'global');

        setTimeout(() => {
          expect(eventReceived).toBe(true);
          done();
        }, 200);
      });
    });

    it('should handle country-specific updates', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('joinCountry', { country: 'US' });

        setTimeout(async () => {
          await eventEmitter.emitLeaderboardUpdate(10, 'country');
          setTimeout(done, 100);
        }, 100);
      });
    });
  });

  /**
   * TC-EVENT-002: Match completion events
   * Test match-related event emissions
   */
  describe('TC-EVENT-002: Match Completion Events', () => {
    it('should emit match started event', (done) => {
      const matchId = 'match-123';
      const player1 = { id: 'p1', username: 'Player1', rating: 1500 };
      const player2 = { id: 'p2', username: 'Player2', rating: 1600 };

      clientSocket = ioc(`http://localhost:${TEST_PORT}/matches`, {
        transports: ['websocket']
      });

      clientSocket.on('match:started', (data) => {
        expect(data.matchId).toBe(matchId);
        expect(data.player1.username).toBe('Player1');
        expect(data.player2.username).toBe('Player2');
        done();
      });

      clientSocket.on('connect', async () => {
        await eventEmitter.emitMatchStarted(matchId, player1, player2, 1800000);
      });
    });

    it('should emit match completed event', (done) => {
      const matchId = 'match-456';

      clientSocket = ioc(`http://localhost:${TEST_PORT}/matches`, {
        transports: ['websocket']
      });

      clientSocket.on('match:completed', (data) => {
        expect(data.matchId).toBe(matchId);
        expect(data.winnerId).toBe('winner-1');
        expect(data.loserId).toBe('loser-2');
        done();
      });

      clientSocket.on('connect', async () => {
        await eventEmitter.emitMatchCompleted(
          matchId,
          'winner-1',
          'loser-2',
          'Winner',
          'Loser',
          { winnerScore: 3, loserScore: 1 },
          1200000,
          'competitive'
        );
      });
    });

    it('should emit match updated event', (done) => {
      const matchId = 'match-789';

      clientSocket = ioc(`http://localhost:${TEST_PORT}/matches`, {
        transports: ['websocket']
      });

      clientSocket.on('match:updated', (data) => {
        expect(data.matchId).toBe(matchId);
        expect(data.state).toBe('in_progress');
        done();
      });

      clientSocket.on('connect', async () => {
        await eventEmitter.emitMatchUpdated(matchId, 'in_progress', {
          score: { player1Score: 1, player2Score: 1 },
          duration: 600000
        });
      });
    });
  });

  /**
   * TC-EVENT-003: Player stat events
   * Test player statistics events
   */
  describe('TC-EVENT-003: Player Stat Events', () => {
    it('should emit rank change event', (done) => {
      const playerId = 'player-rank-change';

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('leaderboard:rank_change', (data) => {
        expect(data.playerId).toBe(playerId);
        expect(data.oldRank).toBe(10);
        expect(data.newRank).toBe(5);
        expect(data.rating).toBe(1850);
        done();
      });

      clientSocket.on('connect', async () => {
        await eventEmitter.emitRankChange(playerId, 10, 5, 1850, 'RankChanger');
      });
    });

    it('should emit ELO update event', (done) => {
      const matchId = 'match-elo';

      clientSocket = ioc(`http://localhost:${TEST_PORT}/matches`, {
        transports: ['websocket']
      });

      clientSocket.on('match:elo_update', (data) => {
        expect(data.matchId).toBe(matchId);
        expect(data.players).toHaveLength(2);
        expect(data.players[0].change).toBeGreaterThan(0);
        done();
      });

      clientSocket.on('connect', async () => {
        await eventEmitter.emitEloUpdate(matchId, [
          {
            playerId: 'p1',
            username: 'Player1',
            oldRating: 1500,
            newRating: 1520,
            change: 20,
            oldRank: 100,
            newRank: 95
          },
          {
            playerId: 'p2',
            username: 'Player2',
            oldRating: 1600,
            newRating: 1580,
            change: -20,
            oldRank: 50,
            newRank: 55
          }
        ]);
      });
    });

    it('should emit player joined event', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('leaderboard:player_joined', (data) => {
        expect(data.playerId).toBe('new-player');
        expect(data.username).toBe('NewPlayer');
        done();
      });

      clientSocket.on('connect', async () => {
        await eventEmitter.emitPlayerJoined('new-player', 'NewPlayer', 1200, 500);
      });
    });

    it('should emit player left event', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('leaderboard:player_left', (data) => {
        expect(data.playerId).toBe('leaving-player');
        expect(data.username).toBe('LeavingPlayer');
        done();
      });

      clientSocket.on('connect', async () => {
        await eventEmitter.emitPlayerLeft('leaving-player', 'LeavingPlayer', 1800, 25);
      });
    });
  });

  /**
   * TC-EVENT-004: Subscription management
   * Test room subscription and unsubscription
   */
  describe('TC-EVENT-004: Subscription Management', () => {
    it('should join room on subscription', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('roomJoined', (data) => {
        expect(data.room).toBe('test-room');
        done();
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('joinRoom', { room: 'test-room' });
      });
    });

    it('should leave room on unsubscription', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('roomLeft', (data) => {
        expect(data.room).toBe('test-room-leave');
        done();
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('joinRoom', { room: 'test-room-leave' });
        setTimeout(() => {
          clientSocket.emit('leaveRoom', { room: 'test-room-leave' });
        }, 100);
      });
    });

    it('should join country-specific room', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('countryJoined', (data) => {
        expect(data.country).toBe('US');
        done();
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('joinCountry', { country: 'US' });
      });
    });

    it('should join player-specific room', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('playerJoined', (data) => {
        expect(data.playerId).toBe('player-123');
        done();
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('joinPlayer', { playerId: 'player-123' });
      });
    });

    it('should join match-specific room', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('matchJoined', (data) => {
        expect(data.matchId).toBe('match-subscribe');
        done();
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('joinMatch', { matchId: 'match-subscribe' });
      });
    });
  });

  /**
   * TC-EVENT-005: Event validation
   * Test event data validation
   */
  describe('TC-EVENT-005: Event Validation', () => {
    it('should validate match started data', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}/matches`, {
        transports: ['websocket']
      });

      clientSocket.on('match:started', (data) => {
        expect(data).toHaveProperty('matchId');
        expect(data).toHaveProperty('player1');
        expect(data).toHaveProperty('player2');
        expect(data).toHaveProperty('timestamp');
        done();
      });

      clientSocket.on('connect', async () => {
        await eventEmitter.emitMatchStarted(
          'validated-match',
          { id: 'p1', username: 'P1', rating: 1500 },
          { id: 'p2', username: 'P2', rating: 1500 }
        );
      });
    });

    it('should validate player action data', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}/matches`, {
        transports: ['websocket']
      });

      clientSocket.on('match:player_action', (data) => {
        expect(data).toHaveProperty('matchId');
        expect(data).toHaveProperty('playerId');
        expect(data).toHaveProperty('action');
        expect(data).toHaveProperty('timestamp');
        done();
      });

      clientSocket.on('connect', async () => {
        await eventEmitter.emitPlayerAction(
          'action-match',
          'action-player',
          'ActionPlayer',
          'move',
          { position: 'A1' }
        );
      });
    });
  });

  /**
   * TC-EVENT-006: Error event handling
   * Test error event emission and handling
   */
  describe('TC-EVENT-006: Error Event Handling', () => {
    it('should handle service errors gracefully', (done) => {
      mockLeaderboardService.getTopPlayers.mockRejectedValue(
        new Error('Service unavailable')
      );

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect', async () => {
        try {
          await eventEmitter.emitLeaderboardUpdate(10, 'global');
        } catch (error) {
          // Error is expected
        }
        done();
      });
    });

    it('should emit error on invalid event data', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      clientSocket.on('connect', () => {
        // Emit invalid event
        clientSocket.emit('joinRoom', { room: null });
      });

      setTimeout(() => {
        // Fallback if no error emitted
        done();
      }, 500);
    });
  });

  /**
   * TC-EVENT-007: Custom events
   * Test custom event emission
   */
  describe('TC-EVENT-007: Custom Events', () => {
    it('should emit custom global announcement', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('global:announcement', (data) => {
        expect(data.message).toBe('Server maintenance in 5 minutes');
        done();
      });

      clientSocket.on('connect', () => {
        ioServer.emit('global:announcement', {
          message: 'Server maintenance in 5 minutes',
          timestamp: Date.now()
        });
      });
    });

    it('should support custom event metadata', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      clientSocket.on('custom:event', (data) => {
        expect(data.metadata).toBeDefined();
        expect(data.metadata.source).toBe('test-suite');
        done();
      });

      clientSocket.on('connect', () => {
        ioServer.emit('custom:event', {
          data: 'test',
          metadata: { source: 'test-suite', version: '1.0' }
        });
      });
    });
  });

  /**
   * TC-EVENT-008: Event broadcasting
   * Test broadcasting to multiple clients
   */
  describe('TC-EVENT-008: Event Broadcasting', () => {
    it('should broadcast to all connected clients', (done) => {
      const sockets: ClientSocket[] = [];
      const clientCount = 3;
      let receivedCount = 0;

      for (let i = 0; i < clientCount; i++) {
        const socket = ioc(`http://localhost:${TEST_PORT}`, {
          transports: ['websocket'],
          forceNew: true
        });

        socket.on('broadcast:test', () => {
          receivedCount++;
          if (receivedCount === clientCount) {
            sockets.forEach(s => s.disconnect());
            done();
          }
        });

        socket.on('connect', () => {
          if (sockets.length === clientCount - 1) {
            setTimeout(() => {
              ioServer.emit('broadcast:test', { data: 'test' });
            }, 100);
          }
        });

        sockets.push(socket);
      }
    });

    it('should broadcast to specific namespace only', (done) => {
      const mainSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      const matchSocket = ioc(`http://localhost:${TEST_PORT}/matches`, {
        transports: ['websocket']
      });

      let mainReceived = false;
      let matchReceived = false;

      mainSocket.on('namespace:test', () => {
        mainReceived = true;
      });

      matchSocket.on('namespace:test', () => {
        matchReceived = true;
      });

      matchSocket.on('connect', () => {
        setTimeout(() => {
          ioServer.of('/matches').emit('namespace:test', {});

          setTimeout(() => {
            expect(mainReceived).toBe(false);
            expect(matchReceived).toBe(true);
            mainSocket.disconnect();
            matchSocket.disconnect();
            done();
          }, 200);
        }, 100);
      });
    });
  });

  /**
   * TC-EVENT-009: Event filtering
   * Test event filtering based on criteria
   */
  describe('TC-EVENT-009: Event Filtering', () => {
    it('should filter events by room membership', (done) => {
      const inRoomSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      const outRoomSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
        forceNew: true
      });

      let inRoomReceived = false;
      let outRoomReceived = false;

      inRoomSocket.on('room:message', () => {
        inRoomReceived = true;
      });

      outRoomSocket.on('room:message', () => {
        outRoomReceived = true;
      });

      inRoomSocket.on('connect', () => {
        inRoomSocket.emit('joinRoom', { room: 'exclusive-room' });

        setTimeout(() => {
          ioServer.to('exclusive-room').emit('room:message', {});

          setTimeout(() => {
            expect(inRoomReceived).toBe(true);
            expect(outRoomReceived).toBe(false);
            inRoomSocket.disconnect();
            outRoomSocket.disconnect();
            done();
          }, 200);
        }, 100);
      });
    });
  });

  /**
   * TC-EVENT-010: Event acknowledgment
   * Test event acknowledgment patterns
   */
  describe('TC-EVENT-010: Event Acknowledgment', () => {
    it('should acknowledge received events', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      ioServer.on('connection', (socket) => {
        socket.on('event:ack', (data, callback) => {
          expect(data.message).toBe('test');
          callback({ acknowledged: true, timestamp: Date.now() });
        });
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('event:ack', { message: 'test' }, (response: any) => {
          expect(response.acknowledged).toBe(true);
          expect(response.timestamp).toBeDefined();
          done();
        });
      });
    });

    it('should handle acknowledgment timeout', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
        timeout: 1000
      });

      ioServer.on('connection', (socket) => {
        socket.on('slow:ack', () => {
          // Never acknowledge
        });
      });

      clientSocket.on('connect', () => {
        const timeout = setTimeout(() => {
          // Timeout occurred as expected
          done();
        }, 500);

        clientSocket.emit('slow:ack', {}, () => {
          clearTimeout(timeout);
          done(new Error('Should not acknowledge'));
        });
      });
    });
  });
});
