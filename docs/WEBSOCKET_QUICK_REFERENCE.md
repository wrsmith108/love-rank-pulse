# WebSocket Quick Reference Card

## 🚀 Quick Start

### Server-Side Broadcasting

```typescript
import { getWebSocketServer } from './websocket/server';

const wsServer = getWebSocketServer();

// Broadcast to room
wsServer.broadcastToRoom('leaderboard:overall', 'leaderboard:update', data);

// Broadcast to namespace
wsServer.broadcastToNamespace(NamespaceType.MATCHES, 'match:created', data);

// Broadcast to all
wsServer.broadcast('global:announcement', data);
```

### Client-Side Connection

```typescript
import io from 'socket.io-client';

// Connect to namespace
const socket = io('http://localhost:3000/leaderboard');

// Subscribe to updates
socket.emit('leaderboard:subscribe', 'overall');

// Listen for updates
socket.on('leaderboard:update', (data) => {
  console.log('Update received:', data);
});

// Cleanup
socket.emit('leaderboard:unsubscribe', 'overall');
socket.close();
```

## 📡 Namespaces

| Namespace | Purpose | Events |
|-----------|---------|--------|
| `/` | General | `ping`, `pong`, `room:join`, `room:leave` |
| `/leaderboard` | Leaderboard updates | `subscribe`, `unsubscribe`, `update`, `rankChange` |
| `/matches` | Match events | `subscribe`, `unsubscribe`, `created`, `updated`, `completed` |
| `/players` | Player updates | `subscribe`, `unsubscribe`, `updated`, `eloChange` |

## 🎯 Event Patterns

### Leaderboard

```typescript
// Subscribe
socket.emit('leaderboard:subscribe', 'overall');

// Receive update
socket.on('leaderboard:update', (data: LeaderboardUpdatePayload) => {
  // data.category, data.players, data.timestamp
});

// Receive rank change
socket.on('leaderboard:rankChange', (data: RankChangePayload) => {
  // data.playerId, data.oldRank, data.newRank
});
```

### Matches

```typescript
// Subscribe to match
socket.emit('match:subscribe', 'match-123');

// Receive updates
socket.on('match:created', (data: MatchPayload) => {});
socket.on('match:updated', (data: MatchPayload) => {});
socket.on('match:completed', (data: MatchPayload) => {});
```

### Players

```typescript
// Subscribe to player
socket.emit('player:subscribe', 'player-456');

// Receive updates
socket.on('player:updated', (data: PlayerPayload) => {});
socket.on('player:eloChange', (data: EloChangePayload) => {
  // data.oldElo, data.newElo, data.change
});
```

## 🔧 Common Tasks

### Service Integration

```typescript
// In LeaderboardService
import { getWebSocketServer } from '../websocket/server';

async updateRankings(category: string) {
  const players = await this.getTopPlayers(category);

  getWebSocketServer().broadcastToRoom(
    `leaderboard:${category}`,
    'leaderboard:update',
    { category, players, timestamp: Date.now() }
  );
}
```

### React Hook

```typescript
function useLeaderboard(category: string) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const socket = io('http://localhost:3000/leaderboard');

    socket.on('connection:established', () => {
      socket.emit('leaderboard:subscribe', category);
    });

    socket.on('leaderboard:update', setData);

    return () => {
      socket.emit('leaderboard:unsubscribe', category);
      socket.close();
    };
  }, [category]);

  return data;
}
```

## 📊 Room Naming Convention

```
leaderboard:all             # All leaderboard updates
leaderboard:{category}      # Category-specific (e.g., leaderboard:overall)
match:{matchId}             # Match-specific (e.g., match:abc123)
player:{playerId}           # Player-specific (e.g., player:xyz789)
```

## 🔍 Monitoring

```typescript
// Get metrics
const metrics = getWebSocketServer().getMetrics();
console.log('Active connections:', metrics.activeConnections);

// Health check
socket.emit('ping');
socket.on('pong', (timestamp) => {
  console.log('Latency:', Date.now() - timestamp, 'ms');
});
```

## ⚙️ Configuration

```env
PORT=3000
PORT_WS=3001  # Optional
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

## 🎨 TypeScript Types

```typescript
import {
  LeaderboardUpdatePayload,
  RankChangePayload,
  MatchPayload,
  PlayerPayload,
  EloChangePayload,
  NamespaceType,
  RoomType
} from './websocket/types';
```

## 🐛 Debugging

```typescript
// Client-side debug mode
localStorage.debug = 'socket.io-client:*';

// Check connection status
socket.on('connect', () => console.log('Connected'));
socket.on('disconnect', (reason) => console.log('Disconnected:', reason));
socket.on('connection:error', (error) => console.error('Error:', error));
```

## 📦 Payload Examples

### LeaderboardUpdatePayload
```typescript
{
  category: "overall",
  players: [{
    id: "p1",
    name: "Player One",
    rank: 1,
    elo: 1500,
    wins: 10,
    losses: 2,
    winRate: 0.833
  }],
  timestamp: 1234567890
}
```

### EloChangePayload
```typescript
{
  playerId: "p1",
  playerName: "Player One",
  oldElo: 1450,
  newElo: 1500,
  change: 50,
  matchId: "m123",
  timestamp: 1234567890
}
```

## 🚦 Connection States

```typescript
socket.connected     // true/false
socket.disconnected  // true/false
socket.id           // unique socket ID
```

## 🔒 Best Practices

1. **Always unsubscribe on cleanup**
2. **Handle reconnection events**
3. **Validate payload types**
4. **Use TypeScript for type safety**
5. **Monitor connection health**
6. **Implement error handling**

## 📚 Documentation

- [Full Setup Guide](./WEBSOCKET_SETUP.md)
- [Integration Guide](./WEBSOCKET_INTEGRATION_GUIDE.md)
- [Summary](./WEBSOCKET_SUMMARY.md)
