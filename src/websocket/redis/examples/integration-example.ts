/**
 * Redis Pub/Sub Integration Examples
 *
 * Demonstrates how to integrate Redis pub/sub with services and WebSocket server
 */

import { getPubSubManager } from '../pubsub';
import { REDIS_CHANNELS, LeaderboardUpdateEvent, MatchEvent } from '../channels';

/**
 * Example 1: Service Integration
 * LeaderboardService publishes updates when rankings change
 */
export class LeaderboardServiceWithPubSub {
  private pubSubManager: any;

  async initialize() {
    this.pubSubManager = await getPubSubManager();
  }

  async updatePlayerRating(playerId: string, newRating: number) {
    // 1. Update database
    // await this.db.updateRating(playerId, newRating);

    // 2. Calculate rank changes
    const rankChanges = [
      {
        playerId,
        oldRank: 5,
        newRank: 3,
        ratingChange: 25,
      },
    ];

    // 3. Publish to Redis for multi-server coordination
    await this.pubSubManager.publish(REDIS_CHANNELS.LEADERBOARD_UPDATES, {
      type: 'leaderboard_update' as const,
      data: {
        playerId,
        affectedPlayers: [playerId],
        rankChanges,
      },
    });

    console.log(`Published leaderboard update for player ${playerId}`);
  }

  async refreshLeaderboard() {
    // Trigger full leaderboard refresh across all servers
    await this.pubSubManager.publish(REDIS_CHANNELS.LEADERBOARD_UPDATES, {
      type: 'leaderboard_update' as const,
      data: {
        fullRefresh: true,
      },
    });
  }
}

/**
 * Example 2: WebSocket Server Integration
 * Subscribe to Redis events and broadcast to connected clients
 */
export class WebSocketServerWithPubSub {
  private pubSubManager: any;
  private connectedClients: Map<string, any> = new Map();

  async initialize() {
    this.pubSubManager = await getPubSubManager();

    // Subscribe to leaderboard updates
    await this.pubSubManager.subscribe(
      REDIS_CHANNELS.LEADERBOARD_UPDATES,
      this.handleLeaderboardUpdate.bind(this)
    );

    // Subscribe to match events
    await this.pubSubManager.subscribe(
      REDIS_CHANNELS.MATCH_EVENTS,
      this.handleMatchEvent.bind(this)
    );

    console.log('WebSocket server subscribed to Redis channels');
  }

  private async handleLeaderboardUpdate(event: LeaderboardUpdateEvent) {
    console.log('Received leaderboard update:', event);

    // Broadcast to all connected WebSocket clients
    this.broadcastToAll({
      type: 'leaderboard_update',
      timestamp: event.timestamp,
      data: event.data,
    });
  }

  private async handleMatchEvent(event: MatchEvent) {
    console.log('Received match event:', event);

    if (event.type === 'match_completed') {
      // Send to specific players involved in the match
      this.sendToPlayer(event.data.player1Id, {
        type: 'match_result',
        data: {
          matchId: event.data.matchId,
          result: event.data.winnerId === event.data.player1Id ? 'win' : 'loss',
          ratingChange: event.data.player1RatingChange,
        },
      });

      this.sendToPlayer(event.data.player2Id, {
        type: 'match_result',
        data: {
          matchId: event.data.matchId,
          result: event.data.winnerId === event.data.player2Id ? 'win' : 'loss',
          ratingChange: event.data.player2RatingChange,
        },
      });
    }
  }

  private broadcastToAll(message: any) {
    this.connectedClients.forEach((client) => {
      client.send(JSON.stringify(message));
    });
  }

  private sendToPlayer(playerId: string, message: any) {
    const client = this.connectedClients.get(playerId);
    if (client) {
      client.send(JSON.stringify(message));
    }
  }

  async shutdown() {
    await this.pubSubManager.shutdown();
  }
}

/**
 * Example 3: Match Service Integration
 * Publish match events as they occur
 */
export class MatchServiceWithPubSub {
  private pubSubManager: any;

  async initialize() {
    this.pubSubManager = await getPubSubManager();
  }

  async createMatch(player1Id: string, player2Id: string) {
    const matchId = `match-${Date.now()}`;

    // 1. Save to database
    // await this.db.createMatch(matchId, player1Id, player2Id);

    // 2. Publish match created event
    await this.pubSubManager.publish(REDIS_CHANNELS.MATCH_EVENTS, {
      type: 'match_created' as const,
      data: {
        matchId,
        player1Id,
        player2Id,
      },
    });

    return matchId;
  }

  async completeMatch(matchId: string, winnerId: string) {
    // 1. Update database
    // await this.db.updateMatch(matchId, { status: 'completed', winnerId });

    // 2. Calculate rating changes (ELO)
    const player1RatingChange = 15;
    const player2RatingChange = -15;

    // 3. Publish match completed event
    await this.pubSubManager.publish(REDIS_CHANNELS.MATCH_EVENTS, {
      type: 'match_completed' as const,
      data: {
        matchId,
        player1Id: 'player-1',
        player2Id: 'player-2',
        winnerId,
        player1RatingChange,
        player2RatingChange,
        status: 'completed' as const,
      },
    });
  }
}

/**
 * Example 4: Complete Server Setup
 * Initialize all components with pub/sub
 */
export async function setupServerWithPubSub() {
  // 1. Initialize pub/sub manager
  const pubSubManager = await getPubSubManager();

  // 2. Initialize services
  const leaderboardService = new LeaderboardServiceWithPubSub();
  await leaderboardService.initialize();

  const matchService = new MatchServiceWithPubSub();
  await matchService.initialize();

  // 3. Initialize WebSocket server
  const wsServer = new WebSocketServerWithPubSub();
  await wsServer.initialize();

  // 4. Check health
  const health = pubSubManager.getHealthStatus();
  console.log('Pub/Sub Health:', health);

  // 5. Return cleanup function
  return async () => {
    await wsServer.shutdown();
    await pubSubManager.shutdown();
  };
}

/**
 * Example 5: Monitoring and Statistics
 */
export async function monitorPubSubStats() {
  const pubSubManager = await getPubSubManager();

  // Get publisher statistics
  const publisherStats = pubSubManager.getPublisherStats();
  console.log('Publisher Stats:', {
    totalPublished: publisherStats.totalPublished,
    successfulPublishes: publisherStats.successfulPublishes,
    failedPublishes: publisherStats.failedPublishes,
    successRate:
      (publisherStats.successfulPublishes / publisherStats.totalPublished) * 100,
  });

  // Get subscriber statistics
  const subscriberStats = pubSubManager.getSubscriberStats();
  console.log('Subscriber Stats:', {
    totalReceived: subscriberStats.totalReceived,
    processedEvents: subscriberStats.processedEvents,
    failedEvents: subscriberStats.failedEvents,
    processRate:
      (subscriberStats.processedEvents / subscriberStats.totalReceived) * 100,
  });

  // Channel-specific stats
  console.log('Channel Stats:');
  Object.entries(publisherStats.channelStats).forEach(([channel, count]) => {
    console.log(`  ${channel}: ${count} messages`);
  });
}
