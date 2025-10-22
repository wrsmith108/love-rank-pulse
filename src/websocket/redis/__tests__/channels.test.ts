/**
 * Redis Channels Tests
 *
 * Tests for channel definitions and event validation
 */

import {
  REDIS_CHANNELS,
  LeaderboardUpdateEvent,
  MatchEvent,
  PlayerNotificationEvent,
  SystemEvent,
  isValidEventPayload,
  extractServerId,
  createServerId,
} from '../channels';

describe('Redis Channels', () => {
  describe('Channel Definitions', () => {
    it('should define all required channels', () => {
      expect(REDIS_CHANNELS.LEADERBOARD_UPDATES).toBe('leaderboard:updates');
      expect(REDIS_CHANNELS.MATCH_EVENTS).toBe('match:events');
      expect(REDIS_CHANNELS.PLAYER_NOTIFICATIONS).toBe('player:notifications');
      expect(REDIS_CHANNELS.SYSTEM_EVENTS).toBe('system:events');
    });

    it('should have unique channel names', () => {
      const channels = Object.values(REDIS_CHANNELS);
      const uniqueChannels = new Set(channels);
      expect(uniqueChannels.size).toBe(channels.length);
    });
  });

  describe('Event Validation', () => {
    it('should validate correct leaderboard event', () => {
      const event: LeaderboardUpdateEvent = {
        type: 'leaderboard_update',
        timestamp: Date.now(),
        serverId: 'server-1',
        data: {
          playerId: 'player-123',
          rankChanges: [
            {
              playerId: 'player-123',
              oldRank: 5,
              newRank: 3,
              ratingChange: 25,
            },
          ],
        },
      };

      expect(isValidEventPayload(event)).toBe(true);
    });

    it('should validate correct match event', () => {
      const event: MatchEvent = {
        type: 'match_completed',
        timestamp: Date.now(),
        serverId: 'server-1',
        data: {
          matchId: 'match-123',
          player1Id: 'player-1',
          player2Id: 'player-2',
          winnerId: 'player-1',
        },
      };

      expect(isValidEventPayload(event)).toBe(true);
    });

    it('should validate correct player notification', () => {
      const event: PlayerNotificationEvent = {
        type: 'rating_changed',
        timestamp: Date.now(),
        serverId: 'server-1',
        data: {
          playerId: 'player-123',
          message: 'Rating updated',
        },
      };

      expect(isValidEventPayload(event)).toBe(true);
    });

    it('should validate correct system event', () => {
      const event: SystemEvent = {
        type: 'server_started',
        timestamp: Date.now(),
        serverId: 'server-1',
        data: {
          serverId: 'server-1',
          status: 'online',
        },
      };

      expect(isValidEventPayload(event)).toBe(true);
    });

    it('should reject invalid event without type', () => {
      const event = {
        timestamp: Date.now(),
        serverId: 'server-1',
        data: {},
      };

      expect(isValidEventPayload(event)).toBe(false);
    });

    it('should reject invalid event without timestamp', () => {
      const event = {
        type: 'leaderboard_update',
        serverId: 'server-1',
        data: {},
      };

      expect(isValidEventPayload(event)).toBe(false);
    });

    it('should reject invalid event without serverId', () => {
      const event = {
        type: 'leaderboard_update',
        timestamp: Date.now(),
        data: {},
      };

      expect(isValidEventPayload(event)).toBe(false);
    });

    it('should reject invalid event without data', () => {
      const event = {
        type: 'leaderboard_update',
        timestamp: Date.now(),
        serverId: 'server-1',
      };

      expect(isValidEventPayload(event)).toBe(false);
    });

    it('should reject null or undefined', () => {
      // null check
      const nullResult = isValidEventPayload(null as any);
      expect(nullResult).toBe(false);

      // undefined check
      const undefinedResult = isValidEventPayload(undefined as any);
      expect(undefinedResult).toBe(false);
    });
  });

  describe('Server ID Management', () => {
    it('should create unique server IDs', async () => {
      const id1 = createServerId();
      // Wait 1ms to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
      const id2 = createServerId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('should include process ID in server ID', () => {
      const serverId = createServerId();
      expect(serverId).toContain('server_');
      expect(serverId).toContain(String(process.pid));
    });

    it('should extract server ID from event', () => {
      const event: LeaderboardUpdateEvent = {
        type: 'leaderboard_update',
        timestamp: Date.now(),
        serverId: 'test-server-123',
        data: { fullRefresh: true },
      };

      expect(extractServerId(event)).toBe('test-server-123');
    });
  });

  describe('Event Type Guards', () => {
    it('should handle all match event types', () => {
      const types: MatchEvent['type'][] = [
        'match_created',
        'match_started',
        'match_completed',
        'match_updated',
      ];

      types.forEach((type) => {
        const event: MatchEvent = {
          type,
          timestamp: Date.now(),
          serverId: 'server-1',
          data: {
            matchId: 'match-123',
            player1Id: 'player-1',
            player2Id: 'player-2',
          },
        };

        expect(isValidEventPayload(event)).toBe(true);
      });
    });

    it('should handle all player notification types', () => {
      const types: PlayerNotificationEvent['type'][] = [
        'rating_changed',
        'match_invite',
        'achievement_unlocked',
        'rank_changed',
      ];

      types.forEach((type) => {
        const event: PlayerNotificationEvent = {
          type,
          timestamp: Date.now(),
          serverId: 'server-1',
          data: {
            playerId: 'player-123',
            message: 'Test notification',
          },
        };

        expect(isValidEventPayload(event)).toBe(true);
      });
    });

    it('should handle all system event types', () => {
      const types: SystemEvent['type'][] = [
        'server_started',
        'server_stopped',
        'health_check',
      ];

      types.forEach((type) => {
        const event: SystemEvent = {
          type,
          timestamp: Date.now(),
          serverId: 'server-1',
          data: {
            serverId: 'server-1',
            status: 'online',
          },
        };

        expect(isValidEventPayload(event)).toBe(true);
      });
    });
  });
});
