/**
 * Redis Pub/Sub Tests
 *
 * Tests for multi-server WebSocket coordination via Redis pub/sub
 */

import { RedisPubSubManager } from '../pubsub';
import {
  REDIS_CHANNELS,
  LeaderboardUpdateEvent,
  MatchEvent,
  PlayerNotificationEvent,
} from '../channels';
import { getRedisClient } from '../../../utils/redisClient';

jest.mock('../../../utils/redisClient');

describe('RedisPubSubManager', () => {
  let pubSubManager: RedisPubSubManager;
  let mockPublisherClient: any;
  let mockSubscriberClient: any;

  beforeEach(() => {
    // Mock Redis clients
    mockPublisherClient = {
      publish: jest.fn().mockResolvedValue(1),
    };

    mockSubscriberClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockImplementation((channel, callback) => {
        callback();
        return Promise.resolve();
      }),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };

    (getRedisClient as jest.Mock).mockResolvedValue(mockPublisherClient);

    // Create instance
    pubSubManager = new RedisPubSubManager('test-server-1');
  });

  afterEach(async () => {
    await pubSubManager.shutdown();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize publisher and subscriber clients', async () => {
      // Mock createSubscriberClient
      jest.spyOn(pubSubManager as any, 'createSubscriberClient').mockResolvedValue(mockSubscriberClient);

      await pubSubManager.initialize();

      expect(getRedisClient).toHaveBeenCalled();
      expect(mockSubscriberClient.connect).toHaveBeenCalled();
    });

    it('should assign unique server ID', () => {
      expect(pubSubManager.getServerId()).toBe('test-server-1');
    });

    it('should handle initialization errors', async () => {
      (getRedisClient as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      await expect(pubSubManager.initialize()).rejects.toThrow('Redis Pub/Sub initialization failed');
    });
  });

  describe('Publishing Events', () => {
    beforeEach(async () => {
      jest.spyOn(pubSubManager as any, 'createSubscriberClient').mockResolvedValue(mockSubscriberClient);
      await pubSubManager.initialize();
    });

    it('should publish leaderboard update event', async () => {
      const event: Omit<LeaderboardUpdateEvent, 'serverId' | 'timestamp'> = {
        type: 'leaderboard_update',
        data: {
          playerId: 'player-123',
          affectedPlayers: ['player-123', 'player-456'],
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

      await pubSubManager.publish(REDIS_CHANNELS.LEADERBOARD_UPDATES, event);

      expect(mockPublisherClient.publish).toHaveBeenCalledWith(
        REDIS_CHANNELS.LEADERBOARD_UPDATES,
        expect.stringContaining('leaderboard_update')
      );

      const stats = pubSubManager.getPublisherStats();
      expect(stats.totalPublished).toBe(1);
      expect(stats.successfulPublishes).toBe(1);
    });

    it('should publish match event', async () => {
      const event: Omit<MatchEvent, 'serverId' | 'timestamp'> = {
        type: 'match_completed',
        data: {
          matchId: 'match-123',
          player1Id: 'player-1',
          player2Id: 'player-2',
          winnerId: 'player-1',
          player1RatingChange: 15,
          player2RatingChange: -15,
        },
      };

      await pubSubManager.publish(REDIS_CHANNELS.MATCH_EVENTS, event);

      expect(mockPublisherClient.publish).toHaveBeenCalledWith(
        REDIS_CHANNELS.MATCH_EVENTS,
        expect.stringContaining('match_completed')
      );
    });

    it('should publish player notification', async () => {
      const event: Omit<PlayerNotificationEvent, 'serverId' | 'timestamp'> = {
        type: 'rating_changed',
        data: {
          playerId: 'player-123',
          message: 'Your rating increased by 25 points!',
          metadata: { oldRating: 1500, newRating: 1525 },
        },
      };

      await pubSubManager.publish(REDIS_CHANNELS.PLAYER_NOTIFICATIONS, event);

      expect(mockPublisherClient.publish).toHaveBeenCalled();
    });

    it('should retry failed publishes', async () => {
      mockPublisherClient.publish
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(1);

      const event: Omit<LeaderboardUpdateEvent, 'serverId' | 'timestamp'> = {
        type: 'leaderboard_update',
        data: { fullRefresh: true },
      };

      await pubSubManager.publish(REDIS_CHANNELS.LEADERBOARD_UPDATES, event);

      expect(mockPublisherClient.publish).toHaveBeenCalledTimes(3);
      expect(pubSubManager.getPublisherStats().successfulPublishes).toBe(1);
    });

    it('should fail after max retry attempts', async () => {
      mockPublisherClient.publish.mockRejectedValue(new Error('Persistent error'));

      const event: Omit<LeaderboardUpdateEvent, 'serverId' | 'timestamp'> = {
        type: 'leaderboard_update',
        data: { fullRefresh: true },
      };

      await expect(
        pubSubManager.publish(REDIS_CHANNELS.LEADERBOARD_UPDATES, event)
      ).rejects.toThrow('Failed to publish after 3 attempts');

      expect(pubSubManager.getPublisherStats().failedPublishes).toBe(1);
    });

    it('should throw error if not initialized', async () => {
      const uninitializedManager = new RedisPubSubManager('test-server-2');

      const event: Omit<LeaderboardUpdateEvent, 'serverId' | 'timestamp'> = {
        type: 'leaderboard_update',
        data: { fullRefresh: true },
      };

      await expect(
        uninitializedManager.publish(REDIS_CHANNELS.LEADERBOARD_UPDATES, event)
      ).rejects.toThrow('Publisher client not initialized');
    });
  });

  describe('Subscribing to Events', () => {
    beforeEach(async () => {
      jest.spyOn(pubSubManager as any, 'createSubscriberClient').mockResolvedValue(mockSubscriberClient);
      await pubSubManager.initialize();
    });

    it('should subscribe to channel', async () => {
      const callback = jest.fn();

      await pubSubManager.subscribe(REDIS_CHANNELS.LEADERBOARD_UPDATES, callback);

      expect(mockSubscriberClient.subscribe).toHaveBeenCalledWith(
        REDIS_CHANNELS.LEADERBOARD_UPDATES,
        expect.any(Function)
      );
    });

    it('should handle multiple subscriptions to same channel', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      await pubSubManager.subscribe(REDIS_CHANNELS.LEADERBOARD_UPDATES, callback1);
      await pubSubManager.subscribe(REDIS_CHANNELS.LEADERBOARD_UPDATES, callback2);

      // Should only subscribe to Redis once
      expect(mockSubscriberClient.subscribe).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe from channel', async () => {
      const callback = jest.fn();

      await pubSubManager.subscribe(REDIS_CHANNELS.LEADERBOARD_UPDATES, callback);
      await pubSubManager.unsubscribe(REDIS_CHANNELS.LEADERBOARD_UPDATES, callback);

      expect(mockSubscriberClient.unsubscribe).toHaveBeenCalledWith(REDIS_CHANNELS.LEADERBOARD_UPDATES);
    });

    it('should unsubscribe all callbacks from channel', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      await pubSubManager.subscribe(REDIS_CHANNELS.LEADERBOARD_UPDATES, callback1);
      await pubSubManager.subscribe(REDIS_CHANNELS.LEADERBOARD_UPDATES, callback2);
      await pubSubManager.unsubscribe(REDIS_CHANNELS.LEADERBOARD_UPDATES);

      expect(mockSubscriberClient.unsubscribe).toHaveBeenCalled();
    });

    it('should subscribe to all channels', async () => {
      const callback = jest.fn();

      await pubSubManager.subscribeAll(callback);

      expect(mockSubscriberClient.subscribe).toHaveBeenCalledTimes(
        Object.keys(REDIS_CHANNELS).length
      );
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      jest.spyOn(pubSubManager as any, 'createSubscriberClient').mockResolvedValue(mockSubscriberClient);
      await pubSubManager.initialize();
    });

    it('should handle incoming messages and invoke callbacks', async () => {
      const callback = jest.fn();
      await pubSubManager.subscribe(REDIS_CHANNELS.LEADERBOARD_UPDATES, callback);

      const event: LeaderboardUpdateEvent = {
        type: 'leaderboard_update',
        timestamp: Date.now(),
        serverId: 'other-server',
        data: { fullRefresh: true },
      };

      // Simulate receiving message
      await (pubSubManager as any).handleIncomingMessage(
        REDIS_CHANNELS.LEADERBOARD_UPDATES,
        JSON.stringify(event)
      );

      expect(callback).toHaveBeenCalledWith(event, REDIS_CHANNELS.LEADERBOARD_UPDATES);
      expect(pubSubManager.getSubscriberStats().processedEvents).toBe(1);
    });

    it('should skip messages from same server', async () => {
      const callback = jest.fn();
      await pubSubManager.subscribe(REDIS_CHANNELS.LEADERBOARD_UPDATES, callback);

      const event: LeaderboardUpdateEvent = {
        type: 'leaderboard_update',
        timestamp: Date.now(),
        serverId: 'test-server-1', // Same as current server
        data: { fullRefresh: true },
      };

      await (pubSubManager as any).handleIncomingMessage(
        REDIS_CHANNELS.LEADERBOARD_UPDATES,
        JSON.stringify(event)
      );

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON messages', async () => {
      const callback = jest.fn();
      await pubSubManager.subscribe(REDIS_CHANNELS.LEADERBOARD_UPDATES, callback);

      await (pubSubManager as any).handleIncomingMessage(
        REDIS_CHANNELS.LEADERBOARD_UPDATES,
        'invalid json'
      );

      expect(callback).not.toHaveBeenCalled();
      expect(pubSubManager.getSubscriberStats().failedEvents).toBeGreaterThan(0);
    });

    it('should handle callback errors gracefully', async () => {
      const callback = jest.fn().mockRejectedValue(new Error('Callback error'));
      await pubSubManager.subscribe(REDIS_CHANNELS.LEADERBOARD_UPDATES, callback);

      const event: LeaderboardUpdateEvent = {
        type: 'leaderboard_update',
        timestamp: Date.now(),
        serverId: 'other-server',
        data: { fullRefresh: true },
      };

      await (pubSubManager as any).handleIncomingMessage(
        REDIS_CHANNELS.LEADERBOARD_UPDATES,
        JSON.stringify(event)
      );

      expect(pubSubManager.getSubscriberStats().failedEvents).toBeGreaterThan(0);
    });
  });

  describe('Statistics and Health', () => {
    beforeEach(async () => {
      jest.spyOn(pubSubManager as any, 'createSubscriberClient').mockResolvedValue(mockSubscriberClient);
      await pubSubManager.initialize();
    });

    it('should track publisher statistics', async () => {
      const event: Omit<LeaderboardUpdateEvent, 'serverId' | 'timestamp'> = {
        type: 'leaderboard_update',
        data: { fullRefresh: true },
      };

      await pubSubManager.publish(REDIS_CHANNELS.LEADERBOARD_UPDATES, event);

      const stats = pubSubManager.getPublisherStats();
      expect(stats.totalPublished).toBe(1);
      expect(stats.successfulPublishes).toBe(1);
      expect(stats.channelStats[REDIS_CHANNELS.LEADERBOARD_UPDATES]).toBe(1);
      expect(stats.lastPublishTime).toBeTruthy();
    });

    it('should track subscriber statistics', async () => {
      const callback = jest.fn();
      await pubSubManager.subscribe(REDIS_CHANNELS.LEADERBOARD_UPDATES, callback);

      const event: LeaderboardUpdateEvent = {
        type: 'leaderboard_update',
        timestamp: Date.now(),
        serverId: 'other-server',
        data: { fullRefresh: true },
      };

      await (pubSubManager as any).handleIncomingMessage(
        REDIS_CHANNELS.LEADERBOARD_UPDATES,
        JSON.stringify(event)
      );

      const stats = pubSubManager.getSubscriberStats();
      expect(stats.totalReceived).toBe(1);
      expect(stats.processedEvents).toBe(1);
    });

    it('should reset statistics', async () => {
      const event: Omit<LeaderboardUpdateEvent, 'serverId' | 'timestamp'> = {
        type: 'leaderboard_update',
        data: { fullRefresh: true },
      };

      await pubSubManager.publish(REDIS_CHANNELS.LEADERBOARD_UPDATES, event);

      pubSubManager.resetStats();

      const stats = pubSubManager.getPublisherStats();
      expect(stats.totalPublished).toBe(0);
      expect(stats.successfulPublishes).toBe(0);
    });

    it('should report health status', async () => {
      const callback = jest.fn();
      await pubSubManager.subscribe(REDIS_CHANNELS.LEADERBOARD_UPDATES, callback);

      const health = pubSubManager.getHealthStatus();

      expect(health.serverId).toBe('test-server-1');
      expect(health.publisherReady).toBe(true);
      expect(health.activeSubscriptions).toBeGreaterThan(0);
    });
  });

  describe('Shutdown', () => {
    beforeEach(async () => {
      jest.spyOn(pubSubManager as any, 'createSubscriberClient').mockResolvedValue(mockSubscriberClient);
      await pubSubManager.initialize();
    });

    it('should gracefully shutdown', async () => {
      const callback = jest.fn();
      await pubSubManager.subscribe(REDIS_CHANNELS.LEADERBOARD_UPDATES, callback);

      await pubSubManager.shutdown();

      expect(mockSubscriberClient.unsubscribe).toHaveBeenCalled();
      expect(mockSubscriberClient.quit).toHaveBeenCalled();
    });

    it('should handle shutdown errors', async () => {
      mockSubscriberClient.quit.mockRejectedValue(new Error('Shutdown error'));

      await expect(pubSubManager.shutdown()).resolves.not.toThrow();
    });
  });
});
