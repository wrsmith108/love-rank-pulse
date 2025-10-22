# Redis Pub/Sub Architecture for Multi-Server WebSocket Coordination

## Overview

This document describes the Redis pub/sub implementation for coordinating WebSocket events across multiple server instances in the Love Rank Pulse application.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Multi-Server Setup                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Server A   │         │   Server B   │                 │
│  ├──────────────┤         ├──────────────┤                 │
│  │ WebSocket 1  │         │ WebSocket 3  │                 │
│  │ WebSocket 2  │         │ WebSocket 4  │                 │
│  └──────┬───────┘         └──────┬───────┘                 │
│         │                        │                          │
│         │  Publish/Subscribe     │                          │
│         └────────┬───────────────┘                          │
│                  │                                           │
│         ┌────────▼────────┐                                 │
│         │  Redis Pub/Sub  │                                 │
│         │                 │                                 │
│         │  Channels:      │                                 │
│         │  - leaderboard  │                                 │
│         │  - matches      │                                 │
│         │  - players      │                                 │
│         │  - system       │                                 │
│         └─────────────────┘                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. RedisPubSubManager (`src/websocket/redis/pubsub.ts`)

Main orchestrator for pub/sub operations.

**Features:**
- Dual-client architecture (publisher + subscriber)
- Automatic retry logic with exponential backoff
- Message serialization/deserialization
- Statistics tracking
- Health monitoring
- Graceful shutdown

**Key Methods:**
```typescript
class RedisPubSubManager {
  // Initialize both clients
  async initialize(): Promise<void>

  // Publish event to channel
  async publish<T>(channel: T, event: Event): Promise<void>

  // Subscribe to channel with callback
  async subscribe<T>(channel: T, callback: Function): Promise<void>

  // Unsubscribe from channel
  async unsubscribe<T>(channel: T): Promise<void>

  // Get health and statistics
  getHealthStatus(): HealthStatus
  getPublisherStats(): PublisherStats
  getSubscriberStats(): SubscriberStats
}
```

### 2. Channel Definitions (`src/websocket/redis/channels.ts`)

Type-safe channel and event definitions.

**Channels:**
- `leaderboard:updates` - Ranking changes
- `match:events` - Match state updates
- `player:notifications` - Player-specific events
- `system:events` - Server coordination

**Event Types:**
```typescript
interface LeaderboardUpdateEvent {
  type: 'leaderboard_update';
  timestamp: number;
  serverId: string;
  data: {
    playerId?: string;
    affectedPlayers?: string[];
    rankChanges?: RankChange[];
    fullRefresh?: boolean;
  };
}

interface MatchEvent {
  type: 'match_created' | 'match_started' | 'match_completed' | 'match_updated';
  timestamp: number;
  serverId: string;
  data: {
    matchId: string;
    player1Id: string;
    player2Id: string;
    winnerId?: string;
    ratingChanges?: object;
  };
}
```

## Message Flow

### 1. Publishing Events

```typescript
// Service updates data
await leaderboardService.updateRanking(playerId);

// Publish to Redis
await pubSubManager.publish(REDIS_CHANNELS.LEADERBOARD_UPDATES, {
  type: 'leaderboard_update',
  data: {
    playerId: 'player-123',
    rankChanges: [{
      playerId: 'player-123',
      oldRank: 5,
      newRank: 3,
      ratingChange: 25
    }]
  }
});

// Redis broadcasts to ALL servers
```

### 2. Receiving Events

```typescript
// Each server subscribes on startup
await pubSubManager.subscribe(
  REDIS_CHANNELS.LEADERBOARD_UPDATES,
  async (event) => {
    // Skip if from same server (avoid duplicates)
    if (event.serverId === currentServerId) return;

    // Broadcast to local WebSocket clients
    websocketServer.broadcastToAll({
      type: 'leaderboard_update',
      data: event.data
    });
  }
);
```

## Multi-Server Coordination

### Duplicate Prevention

Each event includes `serverId` to identify origin:

```typescript
{
  type: 'leaderboard_update',
  serverId: 'server_12345_1698765432',  // Auto-generated
  timestamp: 1698765432000,
  data: { ... }
}
```

Subscribers skip events from same server:
```typescript
if (event.serverId === this.serverId) {
  return; // Don't process own events
}
```

### Retry Logic

Failed publishes retry with exponential backoff:

```typescript
// Retry configuration
maxRetries: 3
backoff: 100ms → 200ms → 400ms

// Example
Attempt 1: Fail → Wait 100ms
Attempt 2: Fail → Wait 200ms
Attempt 3: Success ✓
```

### Health Monitoring

```typescript
const health = pubSubManager.getHealthStatus();
// {
//   isHealthy: true,
//   publisherReady: true,
//   subscriberReady: true,
//   activeSubscriptions: 4,
//   reconnectAttempts: 0
// }
```

## Usage Examples

### Example 1: Leaderboard Update

```typescript
// Server A - Match completes, ratings update
await matchService.completeMatch(matchId, winnerId);

// Automatically publish via service integration
await pubSubManager.publish(REDIS_CHANNELS.LEADERBOARD_UPDATES, {
  type: 'leaderboard_update',
  data: {
    affectedPlayers: ['player-1', 'player-2'],
    rankChanges: [...]
  }
});

// Server B - Receives update, broadcasts to WebSockets
// (Handled automatically by subscription)
```

### Example 2: Real-time Match Updates

```typescript
// Subscribe to match events
await pubSubManager.subscribe(
  REDIS_CHANNELS.MATCH_EVENTS,
  async (event) => {
    if (event.type === 'match_completed') {
      // Notify specific players
      websocketServer.sendToPlayer(event.data.player1Id, {
        type: 'match_result',
        data: event.data
      });

      websocketServer.sendToPlayer(event.data.player2Id, {
        type: 'match_result',
        data: event.data
      });
    }
  }
);
```

### Example 3: Player Notifications

```typescript
// Publish player-specific notification
await pubSubManager.publish(REDIS_CHANNELS.PLAYER_NOTIFICATIONS, {
  type: 'achievement_unlocked',
  data: {
    playerId: 'player-123',
    message: 'Congratulations! 10-win streak!',
    metadata: {
      achievementId: 'streak-10',
      rewards: ['badge', 'points']
    }
  }
});
```

## Statistics Tracking

### Publisher Statistics
```typescript
const stats = pubSubManager.getPublisherStats();
// {
//   totalPublished: 1234,
//   successfulPublishes: 1200,
//   failedPublishes: 34,
//   lastPublishTime: 1698765432000,
//   channelStats: {
//     'leaderboard:updates': 450,
//     'match:events': 600,
//     'player:notifications': 150,
//     'system:events': 34
//   }
// }
```

### Subscriber Statistics
```typescript
const stats = pubSubManager.getSubscriberStats();
// {
//   totalReceived: 5678,
//   processedEvents: 5650,
//   failedEvents: 28,
//   lastReceiveTime: 1698765432000,
//   channelStats: { ... }
// }
```

## Error Handling

### Connection Failures
- Automatic reconnection with exponential backoff
- Max retry attempts: 10
- Graceful degradation

### Message Failures
- Invalid JSON: Logged and skipped
- Callback errors: Caught and tracked in statistics
- Validation errors: Rejected before processing

### Publisher Failures
- 3 retry attempts with exponential backoff
- Failed publishes tracked in statistics
- Errors thrown after max retries

## Performance Considerations

### Connection Pooling
- Single publisher client (reused)
- Dedicated subscriber client (required by Redis)
- Persistent connections

### Message Size
- JSON serialization
- Recommend: < 1KB per message
- Large payloads: Use references, not full data

### Scalability
- Horizontal scaling: Add more servers
- Each server maintains own connections
- Redis handles fan-out to all subscribers

## Integration Points

### With WebSocket Server
```typescript
// On server startup
await pubSubManager.initialize();

// Subscribe to all channels
await pubSubManager.subscribeAll(async (event) => {
  websocketServer.broadcast(event);
});
```

### With Services
```typescript
// In LeaderboardService
async updateRankings() {
  // Update database
  await this.db.updateRankings();

  // Publish to Redis
  await pubSubManager.publish(
    REDIS_CHANNELS.LEADERBOARD_UPDATES,
    { type: 'leaderboard_update', data: {...} }
  );
}
```

## Testing

Comprehensive tests included:
- `src/websocket/redis/__tests__/pubsub.test.ts`
- `src/websocket/redis/__tests__/channels.test.ts`

Coverage includes:
- Publishing and subscribing
- Message handling
- Error scenarios
- Statistics tracking
- Health monitoring
- Multi-server coordination

## Deployment Checklist

- [ ] Redis server configured and accessible
- [ ] Environment variables set (`REDIS_URL`, `REDIS_HOST`, etc.)
- [ ] Pub/sub manager initialized on server startup
- [ ] Subscriptions registered before accepting connections
- [ ] Graceful shutdown handlers in place
- [ ] Health checks monitoring pub/sub status
- [ ] Metrics collection for observability

## Future Enhancements

1. **Message Persistence**: Store events for replay
2. **Pattern Subscriptions**: Subscribe to channel patterns
3. **Filtering**: Server-side event filtering
4. **Compression**: Compress large payloads
5. **Encryption**: End-to-end message encryption
6. **Rate Limiting**: Throttle publish rates per channel

## References

- [Redis Pub/Sub Documentation](https://redis.io/topics/pubsub)
- [WebSocket Integration Guide](./WEBSOCKET_INTEGRATION.md)
- [Real-time Events Guide](./REALTIME_EVENTS.md)
